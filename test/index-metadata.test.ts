import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteVectorStore } from "../src/infrastructure/database/sqlite-vector-store.js";

const metaA = {
  embedding_provider: "llama.cpp",
  embedding_url: "http://localhost:8080/embedding",
  embedding_model: "granite",
  embedding_dimensions: "384",
};

const metaB = {
  ...metaA,
  embedding_model: "other",
};

describe("index_metadata", () => {
  it("writes metadata on first init and rejects mismatches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rag-cli-meta-"));
    const dbPath = join(dir, "docs.sqlite");

    const store1 = new SqliteVectorStore(dbPath, metaA);
    await store1.init();
    await store1.close();

    const store2 = new SqliteVectorStore(dbPath, metaA);
    await store2.init();
    await store2.close();

    const store3 = new SqliteVectorStore(dbPath, metaB);
    await expect(store3.init()).rejects.toThrow("documents index metadata mismatch");
  });
});
