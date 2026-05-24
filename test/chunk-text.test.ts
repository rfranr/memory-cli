import { describe, expect, it } from "vitest";
import { chunkText } from "../src/shared/chunk-text.js";

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("splits paragraph separated text into stable chunks", () => {
    const text = "First paragraph.\n\nSecond paragraph.";
    const chunks = chunkText(text);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      content: "First paragraph.",
      chunkIndex: 0,
      chunkCount: 2,
    });
    expect(chunks[1]).toMatchObject({
      content: "Second paragraph.",
      chunkIndex: 1,
      chunkCount: 2,
    });
    expect(text.slice(chunks[0].chunkStart, chunks[0].chunkEnd)).toBe(chunks[0].content);
    expect(text.slice(chunks[1].chunkStart, chunks[1].chunkEnd)).toBe(chunks[1].content);
  });

  it("splits long paragraphs into smaller chunks", () => {
    const text = Array.from({ length: 100 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkText(text, { maxChunkSize: 80 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 80)).toBe(true);
    for (const chunk of chunks) {
      expect(text.slice(chunk.chunkStart, chunk.chunkEnd)).toBe(chunk.content);
    }
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[chunks.length - 1].chunkIndex).toBe(chunks.length - 1);
    expect(chunks.every((chunk) => chunk.chunkCount === chunks.length)).toBe(true);
  });
});
