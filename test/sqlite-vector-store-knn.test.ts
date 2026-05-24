import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteVectorStore } from "../src/infrastructure/database/sqlite-vector-store.js";

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), "rag-cli-knn-"));
  const store = new SqliteVectorStore(join(dir, "docs.sqlite"), {
    embedding_provider: "test",
    embedding_url: "http://localhost",
    embedding_model: "test-model",
    embedding_dimensions: "2",
  });
  await store.init();
  return store;
}

describe("SqliteVectorStore.search (sqlite-vec KNN)", () => {
  it("returns nearest neighbors ordered by similarity", async () => {
    const store = await makeStore();

    await store.add({
      source: "a",
      content: "doc a",
      embedding: [1, 0],
      taxonomy: { category: "c", taxonomy: "t", metadata: {} },
    });

    await store.add({
      source: "b",
      content: "doc b",
      embedding: [0, 1],
      taxonomy: { category: "c", taxonomy: "t", metadata: {} },
    });

    const matches = await store.search([0.9, 0.1], 2);

    expect(matches).toHaveLength(2);
    expect(matches[0].source).toBe("a");
    expect(matches[0].score).toBeGreaterThan(matches[1].score);

    await store.close();
  });

  it("fails clearly on embedding dimension mismatch", async () => {
    const store = await makeStore();

    await expect(store.search([1, 0, 0], 1)).rejects.toThrow("Embedding dimension mismatch");

    await store.close();
  });
});
