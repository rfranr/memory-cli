import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureIndexMetadata } from "../src/shared/index-metadata.js";

let db: Database<sqlite3.Database, sqlite3.Statement>;

beforeEach(async () => {
  db = await open({ filename: ":memory:", driver: sqlite3.Database });
});

afterEach(async () => {
  await db.close();
});

describe("persisted metadata validation", () => {
  it("inserts initial metadata and accepts matching values with extra stored keys", async () => {
    await ensureIndexMetadata(db, { model: "test", dimensions: "2" }, "documents");
    await ensureIndexMetadata(db, { model: "test" }, "documents");

    expect(await db.all("SELECT key, value FROM index_metadata ORDER BY key")).toEqual([
      { key: "dimensions", value: "2" },
      { key: "model", value: "test" },
    ]);
  });

  it("distinguishes missing keys from mismatched values", async () => {
    await ensureIndexMetadata(db, { model: "test" }, "documents");

    await expect(ensureIndexMetadata(db, { dimensions: "2" }, "documents")).rejects.toThrow(
      "documents metadata mismatch: missing key 'dimensions' in index_metadata",
    );
    await expect(ensureIndexMetadata(db, { model: "other" }, "documents")).rejects.toThrow(
      "documents metadata mismatch for 'model': expected 'other' but found 'test'",
    );
  });
});
