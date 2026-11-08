import { describe, expect, it } from "vitest";
import { parseTaxonomyYaml } from "../src/infrastructure/taxonomy/yaml-taxonomy-loader.js";

describe("taxonomy parser state", () => {
  it("ignores content before categories and resets examples for each category", () => {
    expect(
      parseTaxonomyYaml(`version: 1
- id: ignored
path: ignored
categories:
path: ignored-before-id
- id: 'first'
path: "A / B" # comment
examples:
- "example one"
unknown: ignored
categories:
- example two
- id: second
path: C
- ignored-outside-examples
description: 'Description'
examples:
- example three
`),
    ).toEqual([
      { id: "first", path: "A / B", description: undefined, examples: ["example one", "example two"] },
      { id: "second", path: "C", description: "Description", examples: ["example three"] },
    ]);
  });

  it("ends the examples list on known scalar fields", () => {
    expect(
      parseTaxonomyYaml(
        `categories:\r\n- id: a\r\nexamples:\r\n- one\r\npath: A\r\n- ignored\r\nexamples:\r\n- two\r\ndescription: D\r\n- ignored too`,
      )[0],
    ).toEqual({
      id: "a",
      path: "A",
      description: "D",
      examples: ["one", "two"],
    });
  });

  it("requires the categories marker", () => {
    expect(parseTaxonomyYaml("- id: a\npath: A")).toEqual([]);
  });

  it("reports the index of an invalid category", () => {
    expect(() => parseTaxonomyYaml("categories:\n- id: valid\npath: A\n- id: invalid")).toThrow(
      "Invalid taxonomy category at index 1: id and path are required",
    );
  });
});
