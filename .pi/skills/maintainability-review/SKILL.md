---
name: maintainability-review
description: Review existing code for human comprehension, cohesion, coupling, state ownership, and ease of modification. Identify concrete maintenance risks without changing code.
---

# Maintainability Review

Evaluate the code as an experienced developer unfamiliar with its implementation.

Previous architectural decisions are hypotheses, not evidence of quality.

## AST evidence (JavaScript and TypeScript)

Use this skill for maintainability reviews, not automatic refactoring. Read this
file first, then inspect the source and tests; no other skill is required. Use
`analyze.mjs` when function boundaries, nesting, imports or explicit writes would
help substantiate a finding. The script reads source without executing it.

### Setup

Dependencies belong exclusively to this directory's `package.json` and
`package-lock.json`, not the consuming project's package. Copy the whole skill
directory (excluding `node_modules`) to reuse it. Requirements: Node.js 20+ and
npm. Obtain approval before installing anything, then run from this directory:

```sh
npm ci
npm test
node analyze.mjs fixtures/sample.ts
```

`npm ci` uses the committed lockfile. Runtime `tree-sitter` 0.21.1,
`tree-sitter-javascript` 0.21.4 and `tree-sitter-typescript` 0.21.2 are pinned to
compatible peer versions. These are native Node bindings, not WASM: installation
runs `node-gyp-build` and uses bundled binaries where available. If your npm
requires lifecycle-script approval, review and approve those three packages using
your npm's mechanism. Platforms without a matching binary need a working native
build toolchain (Python, C/C++ compiler and node-gyp prerequisites); do not install
system tools without approval. Only the local directory needs dependencies;
there is no global installation or dependency on the template's tooling.

### Execution and output

From any working directory, pass explicit source paths (relative paths resolve
against the current directory):

```sh
node /path/to/maintainability-review/analyze.mjs src/service.ts src/view.tsx
```

Output is a JSON array, one report per file. Each report includes:

- `functions`: declarations, expressions, arrows and methods, with names where
  available, inclusive line spans and nearest enclosing function (`name:line`).
- `imports`: static import sources as written, including quotes, with line spans.
- `writes`: assignment/update targets, operators and enclosing functions. These
  identify places to inspect for mutation, not proof of shared-state ownership.
- `hasParseErrors` and `parseIssues`: recovered syntax errors or missing nodes.

All line numbers are one-based. Exit status is 0 for successful parsing, 1 for
parse errors, unsupported extensions, missing arguments or read failures. Syntax
errors still emit partial evidence; do not treat that evidence as complete. A
read/extension failure aborts the batch without JSON output.

Supported extensions: JavaScript `.js`, `.mjs`, `.cjs`, `.jsx`; TypeScript `.ts`,
`.mts`, `.cts`; TypeScript with JSX `.tsx`. Extension selects the grammar, not
module semantics. Other languages are rejected. Grammar support is limited to
the pinned releases, not a promise to accept every future JS/TS feature.

### Evidence and limitations

`fixtures/sample.ts` is a small reproducible check: two functions (`record` and
nested `normalize`), one static import and one `total +=` write. `npm test` also
checks representative syntax for every supported extension, malformed syntax,
unsupported languages and CLI behavior. The fixture's unresolved `./storage`
import intentionally demonstrates that parsing does not resolve dependencies.

This is a syntax inventory, not type checking, cognitive complexity, a call graph,
dependency resolution or architectural scoring. It does not detect mutation via
calls such as `items.push()`, count declarations as writes, follow aliases, resolve
scope ownership, collect `require()`/dynamic imports/re-exports, or infer callback
names beyond directly assigned variables. Multiline function spans include nested
functions and comments: length alone is not a maintenance finding. Recursive
traversal and full-file parsing are intended for ordinary source files, not huge
or adversarial input. Review the cited source and tests before drawing conclusions.

## Review process

1. Reconstruct the main execution flows and responsibilities.
2. Identify state ownership, mutation boundaries, and implicit contracts.
3. Evaluate cohesion, coupling, and unnecessary indirection.
4. Examine tests as behavioral specifications.
5. Assess how easily realistic changes could be introduced.
6. Distinguish verified problems from hypothetical risks.

## Review principles

- Prefer observable maintenance costs over stylistic preferences.
- Do not reward short functions or low complexity scores automatically.
- Do not penalize cohesive functions merely for their length.
- Avoid speculative refactoring or unnecessary abstractions.
- Identify specific files and functions supporting each finding.
- Challenge existing decisions, including those made by the reviewing agent.

## Output

Produce a concise review containing:

- Main execution flows and module responsibilities.
- Significant findings, ordered by priority.
- Three strongest architectural decisions.
- Three most important maintenance risks.
- One realistic maintenance exercise to test the conclusions.

For each finding, explain the evidence, maintenance cost, and smallest useful improvement.

Do not modify source files. Save the report under `docs/reviews/` when requested.

Never claim checks were executed unless they actually ran.
