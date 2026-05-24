import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TaxonomySyncUseCase, categoryEmbeddingText } from "../src/application/taxonomy-sync.js";
import type { CategoryEntry } from "../src/domain/entities.js";

function makeFakeEmbeddings() {
  const calls: string[] = [];
  return {
    calls,
    embed: vi.fn(async (input: string) => {
      calls.push(input);
      return [input.length];
    }),
  };
}

function makeFakeCategoryStore() {
  const upserts: Array<{ category: CategoryEntry; embedding: number[] }> = [];
  return {
    upserts,
    init: vi.fn(async () => {}),
    upsert: vi.fn(async (category: CategoryEntry, embedding: number[]) => {
      upserts.push({ category, embedding });
    }),
    search: vi.fn(),
    close: vi.fn(async () => {}),
  };
}

describe("category taxonomy sync", () => {
  it("formats category embedding text deterministically", () => {
    const text = categoryEmbeddingText({
      id: "software-architecture",
      path: "Tecnologia / Desenvolupament / Arquitectura",
      description: "Notes sobre disseny de software",
      examples: ["Clean Architecture", "DDD"],
    });

    expect(text).toBe([
      "Category id: software-architecture",
      "Path: Tecnologia / Desenvolupament / Arquitectura",
      "Description: Notes sobre disseny de software",
      "Examples: Clean Architecture; DDD",
    ].join("\n"));
  });

  it("embeds and upserts every taxonomy entry from a YAML file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rag-cli-taxonomy-"));
    const taxonomyFile = join(dir, "categories.yml");
    await writeFile(
      taxonomyFile,
      `version: 1
categories:
  - id: alpha
    path: "A / B"
    description: "First category"
    examples:
      - "example one"
  - id: beta
    path: "A / C"
    examples:
      - "example two"
`,
      "utf8",
    );

    const embeddings = makeFakeEmbeddings();
    const categories = makeFakeCategoryStore();
    const useCase = new TaxonomySyncUseCase(embeddings, categories as never);

    const count = await useCase.execute({ taxonomyFile });

    expect(count).toBe(2);
    expect(embeddings.embed).toHaveBeenCalledTimes(2);
    expect(categories.upsert).toHaveBeenCalledTimes(2);
    expect(embeddings.calls[0]).toContain("Category id: alpha");
    expect(embeddings.calls[0]).toContain("Path: A / B");
    expect(embeddings.calls[1]).toContain("Category id: beta");
    expect(embeddings.calls[1]).toContain("Path: A / C");

    const contents = await readFile(taxonomyFile, "utf8");
    expect(contents).toContain("version: 1");
  });
});
