import { describe, expect, it, vi } from "vitest";
import { FindDocumentsUseCase } from "../src/application/find-documents.js";

describe("FindDocumentsUseCase", () => {
  it("forwards filters to the store", async () => {
    const find = vi.fn(async () => ({ total: 1, limit: 20, offset: 0, matches: [] }));
    const store = {
      init: vi.fn(),
      add: vi.fn(),
      search: vi.fn(),
      find,
      stats: vi.fn(),
      close: vi.fn(),
    };

    const useCase = new FindDocumentsUseCase(store as never);
    await useCase.execute({ file: "docs", text: "pipeline", category: "llms", limit: 20, offset: 0 });

    expect(find).toHaveBeenCalledWith({ file: "docs", text: "pipeline", category: "llms", limit: 20, offset: 0 });
  });

  it("requires at least one filter", async () => {
    const store = { find: vi.fn() };
    const useCase = new FindDocumentsUseCase(store as never);

    await expect(useCase.execute({ limit: 20, offset: 0 })).rejects.toThrow(
      "find requires at least one filter: --file, --text, or --category",
    );
  });
});
