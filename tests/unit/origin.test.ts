import { describe, expect, it } from "vitest";
import { isAllowedOrigin, originPolicyFromEnv, type OriginPolicy } from "@/lib/origin";

const strict: OriginPolicy = { trustProxy: false, allowedOrigins: [] };

const check = (headers: Record<string, string>, policy: OriginPolicy = strict) =>
  isAllowedOrigin(new Headers(headers), policy);

describe("isAllowedOrigin", () => {
  it("allows an Origin that matches the Host header", () => {
    expect(check({ host: "192.168.1.20:3101", origin: "http://192.168.1.20:3101" })).toBe(true);
    expect(check({ host: "nas.lan:3101", origin: "http://nas.lan:3101" })).toBe(true);
  });

  it("compares hosts case-insensitively and ignores default ports", () => {
    expect(check({ host: "NAS.lan", origin: "https://nas.LAN:443" })).toBe(true);
  });

  it("does not compare the scheme, since TLS may end at a proxy", () => {
    expect(check({ host: "nas.lan", origin: "https://nas.lan" })).toBe(true);
  });

  it("blocks an Origin from another host or port", () => {
    expect(check({ host: "nas.lan:3101", origin: "https://evil.example" })).toBe(false);
    expect(check({ host: "nas.lan:3101", origin: "http://nas.lan:4000" })).toBe(false);
    expect(check({ host: "nas.lan:3101", origin: "http://nas.lan.evil.example:3101" })).toBe(false);
  });

  it("blocks opaque or malformed origins", () => {
    for (const origin of ["null", "not a url", "file:///etc/passwd", "data:text/html,x"]) {
      expect(check({ host: "nas.lan", origin })).toBe(false);
    }
  });

  it("blocks an Origin when there is no Host to compare with", () => {
    expect(check({ origin: "http://nas.lan" })).toBe(false);
  });

  it("allows a request with no Origin header", () => {
    expect(check({ host: "nas.lan" })).toBe(true);
    expect(check({})).toBe(true);
  });

  describe("forwarded headers", () => {
    const forwarded = {
      host: "127.0.0.1:3000",
      "x-forwarded-host": "nas.example.com",
      "x-forwarded-proto": "https",
      origin: "https://nas.example.com",
    };

    it("are ignored by default, so a client cannot vouch for itself", () => {
      expect(check(forwarded)).toBe(false);
      expect(
        check({ host: "nas.lan", "x-forwarded-host": "evil.example", origin: "https://evil.example" }),
      ).toBe(false);
    });

    it("are used when trustProxy is on", () => {
      const trusting = { ...strict, trustProxy: true };
      expect(check(forwarded, trusting)).toBe(true);
    });

    it("use the first X-Forwarded-Host entry and still block other origins", () => {
      const trusting = { ...strict, trustProxy: true };
      expect(check({ ...forwarded, "x-forwarded-host": "nas.example.com, internal" }, trusting)).toBe(true);
      expect(check({ ...forwarded, origin: "https://evil.example" }, trusting)).toBe(false);
    });

    it("fall back to Host when trustProxy is on but no header was sent", () => {
      const trusting = { ...strict, trustProxy: true };
      expect(check({ host: "nas.lan", origin: "http://nas.lan" }, trusting)).toBe(true);
    });
  });

  describe("allowedOrigins", () => {
    const policy: OriginPolicy = { trustProxy: false, allowedOrigins: ["https://nas.example.com"] };

    it("accepts a listed origin whatever the Host header says", () => {
      expect(check({ host: "127.0.0.1:3000", origin: "https://nas.example.com" }, policy)).toBe(true);
    });

    it("matches the scheme and port of a listed origin exactly", () => {
      expect(check({ host: "127.0.0.1:3000", origin: "http://nas.example.com" }, policy)).toBe(false);
      expect(check({ host: "127.0.0.1:3000", origin: "https://nas.example.com:8443" }, policy)).toBe(false);
    });

    it("still accepts the Host-matched origin", () => {
      expect(check({ host: "nas.lan", origin: "http://nas.lan" }, policy)).toBe(true);
    });
  });
});

describe("originPolicyFromEnv", () => {
  it("defaults to no proxy trust and no extra origins", () => {
    expect(originPolicyFromEnv({})).toEqual({ trustProxy: false, allowedOrigins: [] });
  });

  it("turns on proxy trust only for the value true", () => {
    expect(originPolicyFromEnv({ APP_TRUST_PROXY: "true" }).trustProxy).toBe(true);
    expect(originPolicyFromEnv({ APP_TRUST_PROXY: " TRUE " }).trustProxy).toBe(true);
    for (const value of ["", "false", "1", "yes"]) {
      expect(originPolicyFromEnv({ APP_TRUST_PROXY: value }).trustProxy).toBe(false);
    }
  });

  it("parses a comma-separated APP_ORIGIN into normalised origins", () => {
    const { allowedOrigins } = originPolicyFromEnv({
      APP_ORIGIN: "https://nas.example.com/, http://192.168.1.20:3000 ,garbage,,https://a.example:443",
    });
    expect(allowedOrigins).toEqual([
      "https://nas.example.com",
      "http://192.168.1.20:3000",
      "https://a.example",
    ]);
  });
});
