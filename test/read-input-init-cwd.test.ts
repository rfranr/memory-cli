import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readInput } from "../src/application/classify-document.js";

describe("readInput INIT_CWD resolution", () => {
  it("resolves a relative file path against INIT_CWD when not found in cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rag-cli-initcwd-"));
    const file = join(dir, "doc.txt");
    await writeFile(file, "hello", "utf8");

    vi.stubEnv("INIT_CWD", dir);

    await expect(readInput("doc.txt")).resolves.toBe("hello");

    vi.unstubAllEnvs();
  });
});
