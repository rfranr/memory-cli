import { describe, expect, it } from "vitest";
import { parseMetadata } from "../src/cli/program.js";

describe("parseMetadata", () => {
  it("accepts a valid JSON object", () => {
    expect(parseMetadata('{"fileName":"doc.txt","page":3,"published":true}')).toEqual({
      fileName: "doc.txt",
      page: 3,
      published: true,
    });
  });

  it("rejects arrays and primitive values", () => {
    expect(() => parseMetadata("[]")).toThrow("--metadata must be a JSON object");
    expect(() => parseMetadata('"hello"')).toThrow("--metadata must be a JSON object");
    expect(() => parseMetadata("42")).toThrow("--metadata must be a JSON object");
    expect(() => parseMetadata("null")).toThrow("--metadata must be a JSON object");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseMetadata("{not-json}")).toThrow();
  });
});
