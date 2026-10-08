import { describe, expect, it } from "vitest";
import type { Row } from "@tanstack/react-table";
import type { Torrent } from "@/lib/types";
import {
  cn,
  columnHeaderNames,
  formatBytes,
  getRowStyle,
  getStatusText,
  statusMap,
  statusReverseMap,
  statuses,
  validateDestination,
} from "@/lib/utils";
import { MAX_RPC_BODY_BYTES, MAX_TORRENT_FILE_BYTES } from "@/lib/limits";

describe("cn", () => {
  it("joins classes and lets later Tailwind classes win", () => {
    expect(cn("p-2", false && "hidden", "p-4", ["text-sm"])).toBe("p-4 text-sm");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1, "1 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [1024 ** 2, "1 MB"],
    [5.25 * 1024 ** 3, "5.25 GB"],
    [1024 ** 4, "1 TB"],
    [2 * 1024 ** 5, "2 PB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("rounds to two decimals and drops trailing zeros", () => {
    expect(formatBytes(1024 + 1)).toBe("1 KB");
    expect(formatBytes(1024 * 1.234567)).toBe("1.23 KB");
  });
});

describe("getStatusText", () => {
  it.each([
    [0, "Stopped"],
    [1, "Queued to check"],
    [2, "Checking"],
    [3, "Queued to download"],
    [4, "Downloading"],
    [5, "Queued to seed"],
    [6, "Seeding"],
    [7, "Unknown"],
    [-1, "Unknown"],
  ])("maps %d to %s", (status, text) => {
    expect(getStatusText(status)).toBe(text);
  });
});

describe("status maps", () => {
  it("cover every status the filter offers, in both directions", () => {
    expect(statuses[0]).toBe("All");
    expect(statusMap.All).toBeUndefined();
    for (const label of statuses.slice(1)) {
      const code = statusMap[label];
      expect(code).toBeTypeOf("number");
      expect(statusReverseMap[code!]).toBe(label);
      expect(getStatusText(code!)).toBe(label);
    }
  });

  it("names every hideable column", () => {
    expect(Object.keys(columnHeaderNames)).toEqual(
      expect.arrayContaining(["name", "status", "totalSize", "percentDone", "rateDownload", "rateUpload"]),
    );
  });
});

describe("getRowStyle", () => {
  const row = (status: number, percentDone: number) =>
    ({ original: { status, percentDone } }) as Row<Torrent>;

  it("uses the downloading colour for status 4", () => {
    expect(getRowStyle(row(4, 0.25)).background).toBe(
      "linear-gradient(to right, hsl(var(--downloading-h) var(--downloading-s) var(--downloading-l)) 25%, transparent 25%)",
    );
  });

  it.each([5, 6])("uses the seeding colour for status %d", (status) => {
    expect(getRowStyle(row(status, 1)).background).toContain("--seeding-h");
    expect(getRowStyle(row(status, 1)).background).toContain("100%");
  });

  it.each([0, 1, 2, 3, 99])("uses the stopped colour for status %d", (status) => {
    expect(getRowStyle(row(status, 0.5)).background).toContain("--stopped-h");
  });
});

describe("validateDestination", () => {
  it.each(["", "/downloads", "/a b/c", "C:\\Downloads", "d:/media", "\\\\server\\share"])(
    "accepts %j",
    (path) => {
      expect(validateDestination(path)).toBe("");
    },
  );

  it.each(["downloads", "./downloads", "~/downloads", "/", "C:", "C:Downloads", "\\\\server"])(
    "rejects %j",
    (path) => {
      expect(validateDestination(path)).toMatch(/must be absolute/);
    },
  );
});

describe("limits", () => {
  it("caps .torrent files at 20 MB", () => {
    expect(MAX_TORRENT_FILE_BYTES).toBe(20 * 1024 * 1024);
  });

  it("leaves room for a maximum-size file as base64 plus JSON overhead", () => {
    const base64Length = Math.ceil(MAX_TORRENT_FILE_BYTES / 3) * 4;
    expect(MAX_RPC_BODY_BYTES).toBeGreaterThan(base64Length + 1024);
  });

  it("stays below the proxy body limit in next.config.mjs", async () => {
    const { default: nextConfig } = await import("../../next.config.mjs");
    const limit = String(nextConfig.experimental?.proxyClientMaxBodySize);
    const megabytes = Number(/^(\d+)mb$/i.exec(limit)?.[1]);
    expect(megabytes * 1024 * 1024).toBeGreaterThan(MAX_RPC_BODY_BYTES);
  });
});
