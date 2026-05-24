import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ClassifyCommand } from "../domain/commands.js";
import type { CategoryMatch } from "../domain/entities.js";
import type { CategoryStore, EmbeddingClient } from "../domain/ports.js";

export class ClassifyDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly categories: CategoryStore,
  ) {}

  async execute(command: ClassifyCommand): Promise<CategoryMatch[]> {
    const content = await readInput(command.input);
    const embedding = await this.embeddings.embed(content);
    return this.categories.search(embedding, command.limit);
  }
}

export async function readInput(input: string): Promise<string> {
  const filePath = resolveReadablePath(input);

  if (filePath) {
    return readFile(filePath, "utf8");
  }

  if (isHttpUrl(input)) {
    const response = await fetch(input);

    if (!response.ok) {
      throw new Error(`Unable to fetch URL content: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  return input;
}

function resolveReadablePath(input: string): string | undefined {
  const candidates = [input];

  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    candidates.push(resolve(initCwd, input));
  }

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const stat = statSync(candidate);
    if (stat.isFile()) {
      return candidate;
    }

    if (stat.isDirectory()) {
      throw new Error(`Input path is a directory, expected a file: ${candidate}`);
    }
  }

  return undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
