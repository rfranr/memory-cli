import { describe, expect, it, vi } from "vitest";
import { readInput } from "../src/application/classify-document.js";

describe("readInput", () => {
  it("fetches content when input is an http(s) URL", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "hello from url",
    }));

    vi.stubGlobal("fetch", fetchMock as never);

    await expect(readInput("https://example.com/doc")).resolves.toBe("hello from url");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/doc");

    vi.unstubAllGlobals();
  });

  it("throws a clear error when URL fetch fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "",
    }));

    vi.stubGlobal("fetch", fetchMock as never);

    await expect(readInput("https://example.com/missing")).rejects.toThrow(
      "Unable to fetch URL content: 404 Not Found",
    );

    vi.unstubAllGlobals();
  });
});
