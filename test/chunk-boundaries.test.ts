import { describe, expect, it } from "vitest";
import { chunkText } from "../src/shared/chunk-text.js";

describe("chunk boundary preservation", () => {
  it.each([0, 5, 100])("greedily merges at the maximum boundary with minimum %s", (minChunkSize) => {
    const input = "aaaa\n\nbbbb\n\nc";
    const chunks = chunkText(input, { maxChunkSize: 10, minChunkSize });

    expect(chunks.map((chunk) => chunk.content)).toEqual(["aaaa\n\nbbbb", "c"]);
    expect(chunks.map((chunk) => [chunk.chunkStart, chunk.chunkEnd])).toEqual([
      [0, 10],
      [12, 13],
    ]);
  });

  it("prefers whitespace after the minimum split size and preserves source offsets", () => {
    const input = `${"a".repeat(449)} ${"b".repeat(100)}`;
    const chunks = chunkText(input, { maxChunkSize: 500, minChunkSize: 0 });

    expect(chunks.map((chunk) => chunk.content)).toEqual(["a".repeat(449), "b".repeat(100)]);
    expect(chunks.map((chunk) => [chunk.chunkStart, chunk.chunkEnd])).toEqual([
      [0, 449],
      [450, 550],
    ]);
  });

  it("keeps one-character hard splits and drops only intervening whitespace", () => {
    expect(chunkText(" a b ", { maxChunkSize: 1, minChunkSize: 20 }).map((chunk) => chunk.content)).toEqual(["a", "b"]);
  });

  it.each([-1, 0, 1.5, Number.NaN])("rejects invalid maximum %s", (maxChunkSize) => {
    expect(() => chunkText("text", { maxChunkSize })).toThrow("maxChunkSize must be a positive integer");
  });

  it.each([-1, 1.5, Number.NaN])("still validates minimum %s", (minChunkSize) => {
    expect(() => chunkText("text", { minChunkSize })).toThrow("minChunkSize must be a non-negative integer");
  });
});
