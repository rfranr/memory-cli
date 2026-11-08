import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { spawnSync } from "node:child_process";
import { runStructure } from "../scripts/run-structure.mjs";

const eslint = new ESLint();

describe("adopted quality configuration", () => {
  it("enforces selected limits and the test function-length exemption", async () => {
    const source = await eslint.calculateConfigForFile("src/index.ts");
    const test = await eslint.calculateConfigForFile("test/quality-tooling.test.mjs");

    expect(source.rules["sonarjs/cognitive-complexity"]).toEqual([2, 5]);
    expect(source.rules.complexity).toEqual([2, { max: 10 }]);
    expect(source.rules["max-depth"]).toEqual([2, 3]);
    expect(source.rules["max-params"]).toEqual([2, 4]);
    expect(source.rules["max-statements"]).toEqual([1, 22]);
    expect(source.rules["max-lines-per-function"][1].max).toBe(85);
    expect(test.rules["max-lines-per-function"][0]).toBe(0);
  });

  it("provides Node globals without leaking browser globals", async () => {
    const results = await eslint.lintText("process.exitCode = 0;\nwindow.alert('no');\n", {
      filePath: "scripts/global-probe.mjs",
    });
    const undefinedNames = results[0].messages.filter((message) => message.ruleId === "no-undef");

    expect(undefinedNames).toHaveLength(1);
    expect(undefinedNames[0].message).toContain("window");
  });
});

describe("structural report failure handling", () => {
  it("preserves dependency analysis failure even when JSON was produced", () => {
    const calls = [];
    const run = (...args) => {
      calls.push(args);

      return { status: 7, stdout: '{"modules":[]}', stderr: "" };
    };

    expect(runStructure(run)).toBe(7);
    expect(calls).toHaveLength(1);
  });

  it("passes successful analysis into the reporter using pnpm and test/", () => {
    const calls = [];
    const run = (...args) => {
      calls.push(args);

      return calls.length === 1 ? { status: 0, stdout: '{"modules":[]}', stderr: "" } : { status: 0 };
    };

    expect(runStructure(run)).toBe(0);
    expect(calls[0][0]).toBe("pnpm");
    expect(calls[0][1]).toContain("test/chunk-text.test.ts");
    expect(calls[1][2].input).toBe('{"modules":[]}');
  });

  it("propagates reporter failure", () => {
    let calls = 0;
    const run = () => {
      calls += 1;

      return calls === 1 ? { status: 0, stdout: '{"modules":[]}', stderr: "" } : { status: 9 };
    };

    expect(runStructure(run)).toBe(9);
  });

  it("reports application and test modules but excludes dependencies", () => {
    const report = {
      modules: [
        { source: "src/a.ts", dependencies: [{ resolved: "test/b.ts" }, { resolved: "node_modules/x.js" }] },
        { source: "test/b.ts", dependencies: [] },
        { source: "node_modules/x.js", dependencies: [] },
      ],
    };
    const result = spawnSync(process.execPath, ["scripts/structure.mjs"], {
      input: JSON.stringify(report),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("src/a.ts");
    expect(result.stdout).toContain("test/b.ts");
    expect(result.stdout).not.toContain("node_modules");
    expect(result.stdout).toContain("Max dependency depth: 1");
  });
});
