import { describe, expect, it, vi } from "vitest";
import { IndexDocumentUseCase } from "../src/application/index-document.js";
import type { CategoryMatch, Metadata, SearchMatch } from "../src/domain/entities.js";

function makeEmbeddings() {
  const inputs: string[] = [];
  return {
    inputs,
    embed: vi.fn(async (input: string) => {
      inputs.push(input);
      return [input.length, 1];
    }),
  };
}

function makeCategoryStore(match: CategoryMatch | undefined) {
  const searches: Array<{ embedding: number[]; limit: number }> = [];
  return {
    searches,
    init: vi.fn(async () => {}),
    upsert: vi.fn(),
    search: vi.fn(async (embedding: number[], limit: number) => {
      searches.push({ embedding, limit });
      return match ? [match] : [];
    }),
    close: vi.fn(async () => {}),
  };
}

function makeVectorStore() {
  const records: SearchMatch[] = [];
  return {
    records,
    init: vi.fn(async () => {}),
    add: vi.fn(async (chunk: SearchMatch) => {
      records.push(chunk);
      return records.length;
    }),
    addMany: vi.fn(async (chunks: SearchMatch[]) => {
      const ids: number[] = [];
      for (const chunk of chunks) {
        records.push(chunk);
        ids.push(records.length);
      }
      return ids;
    }),
    search: vi.fn(),
    find: vi.fn(),
    stats: vi.fn(),
    close: vi.fn(async () => {}),
  };
}

describe("IndexDocumentUseCase", () => {
  it("indexes each chunk independently and returns chunk ids", async () => {
    const embeddings = makeEmbeddings();
    const bestMatch: CategoryMatch = {
      category: {
        id: "software-architecture",
        path: "Tecnologia / Desenvolupament / Arquitectura",
        description: "Notes sobre disseny de software",
        examples: ["Clean Architecture"],
      },
      score: 0.84,
    };
    const categories = makeCategoryStore(bestMatch);
    const storeRecords: Array<unknown> = [];
    const store = {
      init: vi.fn(async () => {}),
      add: vi.fn(),
      addMany: vi.fn(async (chunks: any[]) => {
        const ids: number[] = [];
        for (const chunk of chunks) {
          storeRecords.push(chunk);
          ids.push(storeRecords.length);
        }
        return ids;
      }),
      search: vi.fn(),
      find: vi.fn(),
      stats: vi.fn(),
      close: vi.fn(async () => {}),
    };

    const useCase = new IndexDocumentUseCase(embeddings as never, store as never, categories as never);
    const input = "First paragraph.\n\nSecond paragraph.";
    const result = await useCase.execute({
      input,
      metadata: { fileName: "doc.txt", location: "note" } as Metadata,
    });

    // Default chunking merges small paragraphs into a larger chunk.
    expect(result).toEqual({ chunks: 1, ids: [1] });
    expect(embeddings.embed).toHaveBeenCalledTimes(1);
    expect(categories.search).toHaveBeenCalledTimes(1);
    expect(store.addMany).toHaveBeenCalledTimes(1);
    expect(embeddings.inputs).toEqual([input]);

    expect(storeRecords[0]).toMatchObject({
      source: input,
      content: input,
      taxonomy: {
        category: "software-architecture",
        taxonomy: "Tecnologia / Desenvolupament / Arquitectura",
        description: "Notes sobre disseny de software",
        metadata: {
          fileName: "doc.txt",
          location: "note",
          chunkIndex: 0,
          chunkCount: 1,
          chunkStart: expect.any(Number),
          chunkEnd: expect.any(Number),
          categoryScore: 0.84,
        },
      },
    });
  });

  it("fails clearly when the categories database is empty", async () => {
    const embeddings = makeEmbeddings();
    const categories = makeCategoryStore(undefined);
    const store = {
      init: vi.fn(async () => {}),
      add: vi.fn(),
      addMany: vi.fn(),
      search: vi.fn(),
      find: vi.fn(),
      stats: vi.fn(),
      close: vi.fn(async () => {}),
    };

    const useCase = new IndexDocumentUseCase(embeddings as never, store as never, categories as never);

    await expect(
      useCase.execute({
        input: "Only one paragraph.",
        metadata: { fileName: "doc.txt" } as Metadata,
      }),
    ).rejects.toThrow(
      "Cannot index document: categories database is empty. Run `rag-cli categories sync <categories.yml>` first.",
    );
  });
});
