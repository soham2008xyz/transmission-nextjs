import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ORIGIN = "http://localhost:3000";

// proxy.ts reads its settings from the environment when it loads.
async function loadProxy(username?: string, password?: string, extraEnv: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("APP_USERNAME", username);
  vi.stubEnv("APP_PASSWORD", password);
  vi.stubEnv("APP_TRUST_PROXY", undefined);
  vi.stubEnv("APP_ORIGIN", undefined);
  for (const [key, value] of Object.entries(extraEnv)) vi.stubEnv(key, value);
  return import("@/proxy");
}

function basic(credentials: string | Uint8Array) {
  const bytes = typeof credentials === "string" ? new TextEncoder().encode(credentials) : credentials;
  return "Basic " + Buffer.from(bytes).toString("base64");
}

function request(
  { method = "GET", path = "/", authorization, origin, host = "localhost:3000", headers: extra = {} }: {
    method?: string;
    path?: string;
    authorization?: string;
    origin?: string;
    host?: string;
    headers?: Record<string, string>;
  } = {},
) {
  // The Host header a real server receives; the URL's host is what Next reports.
  const headers = new Headers({ host, ...extra });
  if (authorization) headers.set("authorization", authorization);
  if (origin) headers.set("origin", origin);
  return new NextRequest(ORIGIN + path, { method, headers });
}

// NextResponse.next() marks the response with this header.
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("with auth off", () => {
  it.each([
    [undefined, undefined],
    ["admin", undefined],
    [undefined, "secret"],
    ["", ""],
  ])("lets every request through when APP_USERNAME=%j and APP_PASSWORD=%j", async (user, pass) => {
    const { proxy } = await loadProxy(user, pass);
    expect(passedThrough(proxy(request()))).toBe(true);
    expect(
      passedThrough(proxy(request({ method: "POST", origin: "https://evil.example" }))),
    ).toBe(true);
  });
});

describe("with auth on", () => {
  it("challenges a request without credentials", async () => {
    const { proxy } = await loadProxy("admin", "secret");
    const res = proxy(request());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Basic realm="Transmission", charset="UTF-8"');
  });

  it("lets correct credentials through", async () => {
    const { proxy } = await loadProxy("admin", "secret");
    expect(passedThrough(proxy(request({ authorization: basic("admin:secret") })))).toBe(true);
  });

  it("accepts the scheme in any case", async () => {
    const { proxy } = await loadProxy("admin", "secret");
    const encoded = basic("admin:secret").split(" ")[1];
    expect(passedThrough(proxy(request({ authorization: `bAsIc ${encoded}` })))).toBe(true);
  });

  it.each([
    ["a wrong password", basic("admin:wrong")],
    ["a wrong username", basic("root:secret")],
    ["a password prefix", basic("admin:secre")],
    ["a longer password", basic("admin:secret!")],
    ["an empty password", basic("admin:")],
    ["no colon", basic("adminsecret")],
    ["another scheme", "Bearer abc"],
    ["a scheme with no credentials", "Basic"],
    ["invalid base64", "Basic !!!not-base64!!!"],
    ["invalid UTF-8", basic(new Uint8Array([0x61, 0x3a, 0xff, 0xfe]))],
  ])("rejects %s", async (_label, authorization) => {
    const { proxy } = await loadProxy("admin", "secret");
    expect(proxy(request({ authorization })).status).toBe(401);
  });

  it("allows a colon inside the password", async () => {
    const { proxy } = await loadProxy("admin", "pa:ss:word");
    expect(passedThrough(proxy(request({ authorization: basic("admin:pa:ss:word") })))).toBe(true);
  });

  it("compares non-ASCII credentials as UTF-8", async () => {
    const { proxy } = await loadProxy("jürgen", "pässwörd🔑");
    expect(passedThrough(proxy(request({ authorization: basic("jürgen:pässwörd🔑") })))).toBe(true);
    expect(proxy(request({ authorization: basic("jurgen:pässwörd🔑") })).status).toBe(401);
  });

  describe("cross-origin protection", () => {
    const authorization = basic("admin:secret");

    it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks a cross-origin %s", async (method) => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(request({ method, authorization, origin: "https://evil.example" }));
      expect(res.status).toBe(403);
    });

    it("blocks a cross-origin POST before checking credentials", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      expect(proxy(request({ method: "POST", origin: "https://evil.example" })).status).toBe(403);
    });

    it("treats another port as another origin", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(request({ method: "POST", authorization, origin: "http://localhost:4000" }));
      expect(res.status).toBe(403);
    });

    it("allows a same-origin POST", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(request({ method: "POST", authorization, origin: ORIGIN }));
      expect(passedThrough(res)).toBe(true);
    });

    it("allows a POST whose Origin matches the Host header, whatever URL Next reports", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      for (const host of ["192.168.1.20:3101", "nas.lan:3101", "nas.lan"]) {
        const origin = `http://${host}`;
        const res = proxy(request({ method: "POST", authorization, origin, host }));
        expect(passedThrough(res)).toBe(true);
      }
    });

    it("blocks an Origin that does not match the Host header", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(
        request({ method: "POST", authorization, host: "nas.lan:3101", origin: "http://localhost:3000" }),
      );
      expect(res.status).toBe(403);
    });

    it("ignores X-Forwarded-Host unless APP_TRUST_PROXY is set", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(
        request({
          method: "POST",
          authorization,
          origin: "https://evil.example",
          headers: { "x-forwarded-host": "evil.example" },
        }),
      );
      expect(res.status).toBe(403);
    });

    it("uses X-Forwarded-Host when APP_TRUST_PROXY=true", async () => {
      const { proxy } = await loadProxy("admin", "secret", { APP_TRUST_PROXY: "true" });
      const res = proxy(
        request({
          method: "POST",
          authorization,
          origin: "https://nas.example.com",
          headers: { "x-forwarded-host": "nas.example.com", "x-forwarded-proto": "https" },
        }),
      );
      expect(passedThrough(res)).toBe(true);
    });

    it("accepts an origin listed in APP_ORIGIN and still blocks others", async () => {
      const { proxy } = await loadProxy("admin", "secret", { APP_ORIGIN: "https://nas.example.com" });
      const allowed = proxy(request({ method: "POST", authorization, origin: "https://nas.example.com" }));
      expect(passedThrough(allowed)).toBe(true);
      const blocked = proxy(request({ method: "POST", authorization, origin: "https://evil.example" }));
      expect(blocked.status).toBe(403);
    });

    it("allows a POST with no Origin header", async () => {
      const { proxy } = await loadProxy("admin", "secret");
      expect(passedThrough(proxy(request({ method: "POST", authorization })))).toBe(true);
    });

    it.each(["GET", "HEAD", "OPTIONS"])("allows a cross-origin %s", async (method) => {
      const { proxy } = await loadProxy("admin", "secret");
      const res = proxy(request({ method, authorization, origin: "https://evil.example" }));
      expect(passedThrough(res)).toBe(true);
    });
  });
});

describe("matcher", () => {
  it("covers pages and the API but skips static assets", async () => {
    const { config } = await loadProxy();
    const matcher = new RegExp(`^${config.matcher}$`);
    expect(matcher.test("/")).toBe(true);
    expect(matcher.test("/api/transmission/rpc")).toBe(true);
    expect(matcher.test("/_next/static/chunks/app.js")).toBe(false);
    expect(matcher.test("/_next/image")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
  });
});
