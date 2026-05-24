import { describe, expect, it } from "vitest";
import { chunkText } from "../src/shared/chunk-text.js";

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("merges small paragraphs into larger human-readable chunks by default", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      chunkCount: 1,
    });
    expect(chunks[0].content).toBe(text);
    expect(text.slice(chunks[0].chunkStart, chunks[0].chunkEnd)).toBe(chunks[0].content);
  });

  it("splits long paragraphs into smaller chunks", () => {
    const text = Array.from({ length: 100 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkText(text, { maxChunkSize: 80, minChunkSize: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 80)).toBe(true);
    for (const chunk of chunks) {
      expect(text.slice(chunk.chunkStart, chunk.chunkEnd)).toBe(chunk.content);
    }
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[chunks.length - 1].chunkIndex).toBe(chunks.length - 1);
    expect(chunks.every((chunk) => chunk.chunkCount === chunks.length)).toBe(true);
  });

  it("allows a small final leftover chunk when it cannot be merged without exceeding maxChunkSize", () => {
    const text = `${"a".repeat(95)}\n\n${"b".repeat(5)}`;
    const chunks = chunkText(text, { maxChunkSize: 100, minChunkSize: 60 });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(60);
    expect(chunks[1].content.length).toBeLessThan(60);
  });
});
