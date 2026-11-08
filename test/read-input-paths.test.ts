import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readInput } from "../src/application/classify-document.js";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rag-input-paths-"));
  vi.stubEnv("INIT_CWD", directory);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("input path resolution", () => {
  it("reads an existing absolute file", async () => {
    const file = join(directory, "content.txt");

    await writeFile(file, "file content");
    await expect(readInput(file)).resolves.toBe("file content");
  });

  it("rejects directories instead of treating them as literal text", async () => {
    await expect(readInput(directory)).rejects.toThrow(`Input path is a directory, expected a file: ${directory}`);
  });

  it("returns literal input when neither candidate exists", async () => {
    await expect(readInput("literal input that is not a file")).resolves.toBe("literal input that is not a file");
  });
});
