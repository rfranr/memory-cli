# Development workflow

[README](../README.md) · [Agent guidance](../AGENTS.md)

## Setup and verification

Use Node.js 24.22.2 and pnpm 11.2.2 (the adoption verification environment).
From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run check:report
```

Agents must obtain approval before dependency installation. `tsmetrics` has an
explicit `allowBuilds` entry in `pnpm-workspace.yaml`: its postinstall downloads
a platform-specific executable from its GitHub release. A working network and
supported platform are required for that installation. No global tools are required.

| Command | Coverage and meaning |
| --- | --- |
| `pnpm test` | Existing full TypeScript check, then Vitest application and tooling tests |
| `pnpm run typecheck` | Production TypeScript, no output |
| `pnpm run build` | Existing TypeScript CLI build into `dist/` |
| `pnpm run lint` | ESLint over `src/`, `test/`, and `scripts/` |
| `pnpm run format:check` | Non-mutating Prettier check of maintained TS/JS/MJS code |
| `pnpm run format` | Formats that whole code tree; avoid unrelated churn |
| `pnpm run check` | Formatting → lint → tests → typecheck → build; runs every group and retains failures |
| `pnpm run complexity` | Cognitive scores for `src/` and `test/` |
| `pnpm run metrics` | Advisory TypeScript metrics for `src/` and `test/` |
| `pnpm run metrics:html` | Same metrics as ignored `metrics.html` |
| `pnpm run dependencies` | Dependency-cruiser validation, including type-only imports |
| `pnpm run structure` | First-party runtime-import fan-out, reachability, and depth |
| `pnpm run check:report` | Runs all five gate groups, then all four reports, retaining any command failure |

Format changed files explicitly, for example:

```sh
pnpm exec prettier --write scripts/check-report.mjs
```

Whole-project formatting verification is a blocking aggregate gate. Double quotes preserve this
project's convention. Configuration files are outside the format command's glob.
Lint covers reporting scripts; cognitive/TypeScript/structure reports cover only
`src/` and `test/`. TypeScript metrics skip MJS. Structure excludes external packages
and does not enable dependency-cruiser's type-only import analysis; it is not a
complete architectural dependency map. The new runner tests load synchronous ESM
via Node's `createRequire`, using Node 24 support without changing TS build scope.

## Gate policy

This project policy was explicitly selected through the adoption configuration interview;
template rules are references, not mandatory defaults.

Formatting failures, lint errors, failed tests, typecheck/build failures, and nonzero
report command results block completion. Warnings do not become errors.

| Rule group | Policy |
| --- | --- |
| Correctness | Recommended JavaScript/TypeScript lint rules remain errors; additional type-aware linting deferred |
| Type safety and cleanup | Explicit `any`, unused variables, and `prefer-const` are errors in source and tests |
| Readability conventions | Required braces, separate declarations, no chained assignments, and one statement per line are errors |
| Layout heuristics | Blank-line padding and line length above 120 are warnings, alongside Prettier |
| Complexity heuristics | Warnings above cognitive 5 or cyclomatic 10 |
| Function shape | Warnings above nesting 4, parameters 4, or 100 nonblank/noncomment lines |
| Statement count | Disabled as redundant with other heuristics |
| Test exception | Function-length rule disabled; all other selected rules retained |

Complexity, size, and layout findings prompt review, not automatic refactoring.
No parser/CLI-specific exemptions or blanket test type-safety exemptions are used.

Cognitive report findings, TypeScript metrics (even rows labelled `error`), and
structure metrics are advisory. Dependency cycles remain warning-level.
Review advisory findings; successful execution does not imply an empty report.
A cognitive report may print `FAIL` for over-limit findings while exiting zero:
that label is advisory, not a blocking lint result under this policy.
Both aggregate commands run every requested group even when an earlier group fails;
`check:report` does not nest `check` or repeat its gates.

## Adoption validation

Before adoption: 12 test files / 26 tests, production typecheck, and build passed.
The initial template-policy trial passed 35 tests but exposed 84 lint errors and
6 warnings. The subsequent approved policy and cleanup produced these results:

- `pnpm run check:report` passed, including formatting, lint, **39 tests in 14 files**,
  production typecheck/build, and all four report commands.
- Lint reports **0 errors and 77 warnings**; warnings remain visible, not suppressed.
- Prettier normalized the existing differences. Production changes are formatting
  plus one `let`-to-`const` cleanup. Tests also replace an explicit `any` with
  `DocumentChunk` and remove an unused helper; existing assertions are preserved.
- Cognitive total **146**, maximum **20**, with **5** over-limit functions:
  taxonomy YAML parsing, chunk merging, long-paragraph splitting, readable-path
  resolution, and index metadata validation.
- Dependency validation passes without violations; structural maximum depth is 4.
- TypeScript metrics flag existing parser/chunking/CLI complexity or size and some
  long test callbacks. These are review inputs, not additional rejection gates.

The cognitive total changed from 145 to 146 after tooling-test changes; it covers
`src/` and `test/`, not reporting scripts. Remaining warnings are chiefly blank-line
layout suggestions and the existing complexity findings. No complexity-driven
production refactoring was performed. Counts describe this checkout, not guarantees.
No embedding service, Pi package loading, browser, or cross-platform verification
is claimed. HTML report generation is optional and was not verified.

## Documentation and provenance

Preserve existing ADRs under `docs/adr/` and usage guides under `docs/usage/`.
Retain useful assignments under `docs/tasks/`; no mandatory journal or task framework
is introduced. Record observations separately from hypotheses and never copy
historical template validation claims as current results.

Quality configuration and report implementations were adapted from the local
`../agentic-dev-template` checkout. That repository was not modified. Its README
notes unresolved upstream licensing/provenance; resolve this before public
redistribution of copied tooling. This adoption does not assert a new license.
Browser fixtures, Vite, Playwright, npm lockfiles, Pi package declarations, native
maintainability analyzers, and experimental Joern tooling were deliberately omitted.
The available technical-documentation skill can be used without installing skills.
