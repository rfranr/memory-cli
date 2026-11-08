import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let directory;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rag-lens-adapter-"));
  await writeFile(join(directory, "pnpm"), '#!/bin/sh\nprintf "<%s>\\n" "$@"\n', { mode: 0o755 });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("Lens-only pnpm adapter", () => {
  it("forwards ESLint arguments literally through pnpm exec", () => {
    const result = spawnSync("scripts/lens-bin/npx", ["eslint", "--format", "json", "--", "file with spaces.ts"], {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("<exec>\n<eslint>\n<--format>\n<json>\n<-->\n<file with spaces.ts>\n");
  });

  it.each([{ args: [] }, { args: ["some-package"] }])("refuses unsupported package execution: $args", ({ args }) => {
    const result = spawnSync("scripts/lens-bin/npx", args, { encoding: "utf8" });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("only supports ESLint");
  });

  it.each(["scripts/pi-with-lens.sh", "scripts/lens-bin/npx"])("validates shell syntax: %s", (file) => {
    expect(spawnSync("sh", ["-n", file]).status).toBe(0);
  });
});
