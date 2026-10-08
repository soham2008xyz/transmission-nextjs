import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLocalStorage } from "@/lib/useLocalStorage";

describe("useLocalStorage", () => {
  it("starts from the initial value and saves it", () => {
    const { result } = renderHook(() => useLocalStorage("key", { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
    expect(localStorage.getItem("key")).toBe('{"a":1}');
  });

  it("restores a saved value", () => {
    localStorage.setItem("key", "[3,4]");
    const { result } = renderHook(() => useLocalStorage("key", [] as number[]));
    expect(result.current[0]).toEqual([3, 4]);
  });

  it("saves updates", () => {
    const { result } = renderHook(() => useLocalStorage("page", 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem("page")).toBe("5");
  });

  it("falls back to the initial value when the saved JSON is corrupt", () => {
    localStorage.setItem("key", "{not json");
    const { result } = renderHook(() => useLocalStorage("key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });

  it("falls back when storage cannot be read", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => useLocalStorage("key", 10));
    expect(result.current[0]).toBe(10);
    spy.mockRestore();
  });
});
