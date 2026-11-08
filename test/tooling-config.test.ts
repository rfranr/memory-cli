import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const load = createRequire(import.meta.url);
const { ESLint } = load("eslint");

describe("quality policy", () => {
  it("uses the approved advisory thresholds and warning-level cycles", async () => {
    const config = await new ESLint().calculateConfigForFile("src/index.ts");

    expect(config.rules["complexity"]).toEqual([1, { max: 10 }]);
    expect(config.rules["sonarjs/cognitive-complexity"]).toEqual([1, 5]);
    expect(config.rules["max-depth"]).toEqual([1, 4]);
    expect(config.rules["max-params"]).toEqual([1, 4]);
    expect(config.rules["max-lines-per-function"]).toEqual([1, { max: 100, skipBlankLines: true, skipComments: true }]);
    expect(config.rules["max-statements"][0]).toBe(0);
    expect(config.rules["max-len"][0]).toBe(1);
    expect(config.rules["stylistic/padding-line-between-statements"][0]).toBe(1);
    expect(load("../.dependency-cruiser.cjs").forbidden[0].severity).toBe("warn");
  });

  it.each(["src/index.ts", "test/tooling-config.test.ts"])(
    "enforces correctness and readability in %s",
    async (file) => {
      const config = await new ESLint().calculateConfigForFile(file);

      for (const rule of [
        "@typescript-eslint/no-explicit-any",
        "@typescript-eslint/no-unused-vars",
        "prefer-const",
        "curly",
        "one-var",
        "no-multi-assign",
        "max-statements-per-line",
      ]) {
        expect(config.rules[rule][0], rule).toBe(2);
      }
    },
  );

  it("allows Node globals in scripts without allowing browser globals", async () => {
    const [result] = await new ESLint().lintText("console.log(process.pid, window.location);", {
      filePath: "scripts/global-probe.mjs",
    });

    expect(result.messages.filter((message: { ruleId: string }) => message.ruleId === "no-undef")).toEqual([
      expect.objectContaining({ message: "'window' is not defined." }),
    ]);
  });

  it("keeps only the approved test function-length exception", async () => {
    const config = await new ESLint().calculateConfigForFile("test/tooling-config.test.ts");

    expect(config.rules["max-lines-per-function"][0]).toBe(0);
    expect(config.rules["sonarjs/cognitive-complexity"]).toEqual([1, 5]);
    expect(config.rules["complexity"]).toEqual([1, { max: 10 }]);
    expect(config.rules["max-depth"]).toEqual([1, 4]);
    expect(config.rules["max-params"]).toEqual([1, 4]);
  });
});
