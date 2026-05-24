import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../src/cli/program.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI commands", () => {
  it("index prints chunk-aware results", async () => {
    const indexDocument = vi.fn(async () => ({ chunks: 2, ids: [11, 12] }));
    const appFactory = vi.fn(async () => ({
      syncTaxonomy: vi.fn(),
      classify: vi.fn(),
      indexDocument,
      stats: vi.fn(),
      find: vi.fn(),
      search: vi.fn(),
    }));
    const program = buildProgram(appFactory);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["node", "rag-cli", "index", "hello world", "--metadata", '{"fileName":"doc.txt"}']);

    expect(indexDocument).toHaveBeenCalledWith({
      input: "hello world",
      metadata: { fileName: "doc.txt" },
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ chunks: 2, ids: [11, 12] }, null, 2));
  });

  it("classify does not require --taxonomy", async () => {
    const classify = vi.fn(async () => [{ score: 0.9 }]);
    const appFactory = vi.fn(async () => ({
      syncTaxonomy: vi.fn(),
      classify,
      indexDocument: vi.fn(),
      stats: vi.fn(),
      find: vi.fn(),
      search: vi.fn(),
    }));
    const program = buildProgram(appFactory);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["node", "rag-cli", "classify", "hello world", "--limit", "2"]);

    expect(classify).toHaveBeenCalledWith({ input: "hello world", limit: 2 });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify([{ score: 0.9 }], null, 2));
  });

  it("categories sync forwards the taxonomy file path", async () => {
    const syncTaxonomy = vi.fn(async () => 3);
    const appFactory = vi.fn(async () => ({
      syncTaxonomy,
      classify: vi.fn(),
      indexDocument: vi.fn(),
      stats: vi.fn(),
      find: vi.fn(),
      search: vi.fn(),
    }));
    const program = buildProgram(appFactory);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["node", "rag-cli", "categories", "sync", "assets/taxonomy/categories.yml"]);

    expect(syncTaxonomy).toHaveBeenCalledWith({ taxonomyFile: "assets/taxonomy/categories.yml" });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ categories: 3 }, null, 2));
  });

  it("find requires at least one filter", async () => {
    const appFactory = vi.fn(async () => ({
      syncTaxonomy: vi.fn(),
      classify: vi.fn(),
      indexDocument: vi.fn(),
      stats: vi.fn(),
      find: vi.fn(),
      search: vi.fn(),
    }));
    const program = buildProgram(appFactory);

    await expect(program.parseAsync(["node", "rag-cli", "find"])).rejects.toThrow(
      "find requires at least one filter: --file, --text, or --category",
    );
  });

  it("find prints filtered results", async () => {
    const find = vi.fn(async () => ({
      total: 1,
      limit: 20,
      offset: 0,
      matches: [
        {
          id: 1,
          source: "assets/docs/doc.txt",
          content: "pipeline data",
          taxonomy: {
            category: "llms",
            taxonomy: "Technology / AI / LLMs",
            metadata: { fileName: "doc.txt", chunkIndex: 0 },
          },
        },
      ],
    }));
    const appFactory = vi.fn(async () => ({
      syncTaxonomy: vi.fn(),
      classify: vi.fn(),
      indexDocument: vi.fn(),
      stats: vi.fn(),
      find,
      search: vi.fn(),
    }));
    const program = buildProgram(appFactory);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["node", "rag-cli", "find", "--text", "pipeline"]);

    expect(find).toHaveBeenCalledWith({ file: undefined, text: "pipeline", category: undefined, limit: 20, offset: 0 });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      total: 1,
      limit: 20,
      offset: 0,
      matches: [
        {
          id: 1,
          source: "assets/docs/doc.txt",
          content: "pipeline data",
          taxonomy: {
            category: "llms",
            taxonomy: "Technology / AI / LLMs",
            metadata: { fileName: "doc.txt", chunkIndex: 0 },
          },
        },
      ],
    }, null, 2));
  });
});
