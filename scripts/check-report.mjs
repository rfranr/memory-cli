import { spawnSync } from "node:child_process";
import process from "node:process";
import console from "node:console";

// Run every report, retaining failures instead of masking later command errors.
let failed = false;

for (const script of [
  "format:check",
  "lint",
  "test",
  "typecheck",
  "build",
  "dependencies",
  "complexity",
  "metrics",
  "structure",
]) {
  const result = spawnSync("pnpm", ["run", script], { stdio: "inherit" });

  if (result.error) {
    console.error(result.error);
  }
  if (result.status !== 0) {
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
