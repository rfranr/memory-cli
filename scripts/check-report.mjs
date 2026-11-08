import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Run every report, retaining failures instead of masking later command errors.
export function runReports(run = spawnSync, includeReports = true) {
  let failed = false;

  const scripts = ["format:check", "lint", "test", "typecheck", "build"];

  if (includeReports) {
    scripts.push("complexity", "metrics", "dependencies", "structure");
  }

  for (const script of scripts) {
    const result = run("pnpm", ["run", script], { stdio: "inherit" });

    if (result.error) {
      console.error(result.error);
      failed = true;
    }

    if (result.status !== 0) {
      failed = true;
    }
  }

  return Number(failed);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runReports(spawnSync, !process.argv.includes("--gates-only"));
}
