import { describe, expect, it, vi } from "vitest";
import { StatsUseCase } from "../src/application/stats.js";

describe("StatsUseCase", () => {
  it("returns counts for documents and categories", async () => {
    const store = {
      init: vi.fn(async () => {}),
      add: vi.fn(),
      search: vi.fn(),
      stats: vi.fn(async () => ({
        chunks: 12,
        sources: 4,
        categories: 3,
        byCategory: [
          { category: "guitar", chunks: 6 },
          { category: "software-architecture", chunks: 4 },
        ],
      })),
      close: vi.fn(async () => {}),
    };

    const categories = {
      init: vi.fn(async () => {}),
      upsert: vi.fn(),
      search: vi.fn(),
      count: vi.fn(async () => 9),
      close: vi.fn(async () => {}),
    };

    const useCase = new StatsUseCase(store as never, categories as never, "./rag.sqlite", "./rag-categories.sqlite");
    await expect(useCase.execute()).resolves.toEqual({
      documentsDb: "./rag.sqlite",
      categoriesDb: "./rag-categories.sqlite",
      documents: {
        chunks: 12,
        sources: 4,
        categories: 3,
        byCategory: [
          { category: "guitar", chunks: 6 },
          { category: "software-architecture", chunks: 4 },
        ],
      },
      categories: {
        synced: 9,
      },
    });
  });
});
