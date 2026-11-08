import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfig } from "../src/config/config.js";

let directory: string;
let envFile: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rag-config-"));
  envFile = join(directory, ".env");

  for (const key of [
    "DB",
    "CATEGORIES_DB",
    "EMBEDDING_URL",
    "EMBEDDING_PROVIDER",
    "EMBEDDING_MODEL",
    "EMBEDDING_DIMENSIONS",
  ]) {
    vi.stubEnv(`RAG_CLI_${key}`, undefined);
  }
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("configuration precedence", () => {
  it("uses defaults when only dimensions are supplied", () => {
    expect(buildConfig({ envFile, embeddingDimensions: "384" })).toEqual({
      databasePath: "./rag.sqlite",
      categoriesDatabasePath: "./rag-categories.sqlite",
      embeddingEndpoint: "http://localhost:3000/embedding",
      embeddingProvider: "unknown",
      embeddingModel: "unknown",
      embeddingDimensions: 384,
    });
  });

  it("prefers options over environment, including explicit empty strings", () => {
    vi.stubEnv("RAG_CLI_DB", "environment.sqlite");
    vi.stubEnv("RAG_CLI_EMBEDDING_DIMENSIONS", "768");

    expect(buildConfig({ envFile, db: "", embeddingDimensions: "12suffix" })).toMatchObject({
      databasePath: "",
      embeddingDimensions: 12,
    });
  });

  it("loads the env file without overriding existing process values", async () => {
    await writeFile(
      envFile,
      "RAG_CLI_DB=file.sqlite\nRAG_CLI_EMBEDDING_MODEL=file-model\nRAG_CLI_EMBEDDING_DIMENSIONS=24\n",
    );
    vi.stubEnv("RAG_CLI_DB", "process.sqlite");

    expect(buildConfig({ envFile })).toMatchObject({
      databasePath: "process.sqlite",
      embeddingModel: "file-model",
      embeddingDimensions: 24,
    });
  });

  it.each([undefined, "", "0", "-1", "invalid"])("rejects invalid dimensions %s", (embeddingDimensions) => {
    expect(() => buildConfig({ envFile, embeddingDimensions })).toThrow(
      "RAG_CLI_EMBEDDING_DIMENSIONS must be a positive integer",
    );
  });
});
