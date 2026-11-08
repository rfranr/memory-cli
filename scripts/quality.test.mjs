import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runStructure } from "./run-structure.mjs";

const graph = JSON.stringify({
  modules: [
    { source: "src/a.ts", dependencies: [{ resolved: "test/b.ts" }] },
    { source: "test/b.ts", dependencies: [{ resolved: "src/a.ts" }] },
    { source: "node_modules/external.js", dependencies: [] },
  ],
});

test("structure retains test/ modules, handles cycles and excludes external modules", () => {
  const result = spawnSync(process.execPath, ["scripts/structure.mjs"], { input: graph, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /test\/b.ts/);
  assert.match(result.stdout, /Max dependency depth: 1/);
  assert.doesNotMatch(result.stdout, /external/);
});

test("structure handles an empty project", () => {
  const result = spawnSync(process.execPath, ["scripts/structure.mjs"], {
    input: JSON.stringify({ modules: [] }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Max dependency depth: 0/);
});

test("structure runner uses local pnpm and passes graph to its sibling script", () => {
  const calls = [];
  const status = runStructure((...args) => {
    calls.push(args);
    return { status: 0, stdout: graph };
  });
  assert.equal(status, 0);
  assert.equal(calls[0][0], "pnpm");
  assert.ok(calls[0][1].includes("test/chunk-text.test.ts"));
  assert.equal(calls[1][2].input, graph);
});

test("structure runner propagates command and spawn failures without running the next stage", () => {
  for (const result of [{ status: 7 }, { status: null }, { error: new Error("spawn failed") }]) {
    let calls = 0;
    assert.equal(
      runStructure(() => {
        calls += 1;
        return result;
      }),
      result.status ?? 1,
    );
    assert.equal(calls, 1);
  }
});

test("aggregate report runs later reports after failures and returns nonzero", () => {
  const source = readFileSync("scripts/check-report.mjs", "utf8").replace(
    'import { spawnSync } from "node:child_process";',
    `const spawnSync = (_command, args) => {
      console.log(args[1]); return { status: args[1] === "check" ? 2 : 0 };
    };`,
  );
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /check\ncomplexity\nmetrics\ndependencies\nstructure/);
});
