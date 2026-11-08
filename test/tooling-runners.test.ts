import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

// JavaScript tooling stays outside the production TypeScript build.
const load = createRequire(import.meta.url);
const { runReports } = load("../scripts/check-report.mjs");
const { runStructure } = load("../scripts/run-structure.mjs");

describe("report orchestration", () => {
  it("runs every report and retains an earlier failure", () => {
    const run = vi.fn().mockReturnValue({ status: 0 });

    run.mockReturnValueOnce({ status: 7 });

    expect(runReports(run)).toBe(1);
    expect(run.mock.calls.map((call) => call[1][1])).toEqual([
      "format:check",
      "lint",
      "test",
      "typecheck",
      "build",
      "complexity",
      "metrics",
      "dependencies",
      "structure",
    ]);
    expect(run.mock.calls.every((call) => call[0] === "pnpm")).toBe(true);
  });

  it("runs every gate without reports in gates-only mode", () => {
    const run = vi.fn().mockReturnValueOnce({ status: 1 }).mockReturnValue({ status: 0 });

    expect(runReports(run, false)).toBe(1);
    expect(run.mock.calls.map((call) => call[1][1])).toEqual(["format:check", "lint", "test", "typecheck", "build"]);
  });

  it("retains a late report failure", () => {
    const run = vi.fn().mockImplementation((_command, args) => ({ status: args[1] === "structure" ? 9 : 0 }));

    expect(runReports(run)).toBe(1);
    expect(run).toHaveBeenCalledTimes(9);
  });

  it("succeeds only when every command succeeds", () => {
    expect(runReports(() => ({ status: 0 }))).toBe(0);
    expect(runReports(() => ({ status: null }))).toBe(1);
  });

  it("retains spawn errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(runReports(() => ({ status: null, error: new Error("spawn failed") }))).toBe(1);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});

describe("structure orchestration", () => {
  it("does not mask dependency analysis failure with valid JSON", () => {
    const run = vi.fn().mockReturnValue({ status: 7, stdout: '{"modules":[]}' });

    expect(runStructure(run)).toBe(7);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("passes analysis output to the reporter and retains its status", () => {
    const run = vi.fn().mockReturnValueOnce({ status: 0, stdout: '{"modules":[]}' }).mockReturnValue({ status: 9 });

    expect(runStructure(run)).toBe(9);
    expect(run.mock.calls[0][0]).toBe("pnpm");
    expect(run.mock.calls[0][1]).toContain("test/tooling-runners.test.ts");
    expect(run.mock.calls[1][2].input).toBe('{"modules":[]}');
  });

  it("handles successful reporting and abnormal termination", () => {
    expect(runStructure(() => ({ status: 0, stdout: '{"modules":[]}' }))).toBe(0);
    expect(runStructure(() => ({ status: null }))).toBe(1);
  });
});
