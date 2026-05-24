import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteVectorStore } from "../src/infrastructure/database/sqlite-vector-store.js";

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "rag-cli-find-"));
  const store = new SqliteVectorStore(join(dir, "docs.sqlite"), {
    embedding_provider: "test",
    embedding_url: "http://localhost",
    embedding_model: "test-model",
    embedding_dimensions: "2",
  });
  await store.init();
  return store;
}

describe("SqliteVectorStore.find", () => {
  it("filters by file, text and category using AND semantics", async () => {
    const store = await makeStore();

    await store.add({
      source: "assets/docs/machinelearning-notes.txt",
      content: "pipeline data and llms",
      embedding: [1, 0],
      taxonomy: {
        category: "llms",
        taxonomy: "Technology / AI / LLMs",
        metadata: { fileName: "machinelearning-notes.txt", chunkIndex: 0 },
      },
    });

    await store.add({
      source: "assets/docs/machinelearning-notes.txt",
      content: "unrelated content",
      embedding: [1, 0],
      taxonomy: {
        category: "rag",
        taxonomy: "Technology / AI / RAG",
        metadata: { fileName: "machinelearning-notes.txt", chunkIndex: 1 },
      },
    });

    await store.add({
      source: "assets/docs/other.txt",
      content: "pipeline data",
      embedding: [1, 0],
      taxonomy: {
        category: "llms",
        taxonomy: "Technology / AI / LLMs",
        metadata: { fileName: "other.txt", chunkIndex: 0 },
      },
    });

    const fileResult = await store.find({ file: "machinelearning", limit: 20, offset: 0 });
    expect(fileResult.total).toBe(2);
    expect(fileResult.matches).toHaveLength(2);

    const textResult = await store.find({ text: "pipeline", limit: 20, offset: 0 });
    expect(textResult.total).toBe(2);

    const categoryResult = await store.find({ category: "llms", limit: 20, offset: 0 });
    expect(categoryResult.total).toBe(2);

    const combined = await store.find({ file: "machinelearning", text: "pipeline", category: "llms", limit: 20, offset: 0 });
    expect(combined.total).toBe(1);
    expect(combined.matches[0]).toMatchObject({
      source: "assets/docs/machinelearning-notes.txt",
      content: "pipeline data and llms",
      taxonomy: {
        category: "llms",
        taxonomy: "Technology / AI / LLMs",
      },
    });

    await store.close();
  });
});
