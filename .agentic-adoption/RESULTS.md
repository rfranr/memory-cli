# Adoption validation

Status: complete after separately approved cleanup of the three existing lint errors.
Final validation: `pnpm run check:report` and `pnpm run metrics:html` both exited 0.
The aggregate executed formatting checks, lint, both typechecks, all tests, build,
and all four text reports successfully.

## Final commands

- `pnpm install --frozen-lockfile`: exit 0.
- `pnpm run format`: exit 0; existing application/test changes are formatting only.
- `pnpm run format:check`: exit 0.
- `pnpm run lint`: exit 0 in aggregate, zero errors and ten advisory warnings.
- `pnpm test`: exit 0; 12 Vitest files, 26 application tests, five Node tooling tests.
- `pnpm run test:tooling`: exit 0; five tests. The printed spawn error is deliberately simulated failure-path evidence.
- `pnpm run typecheck`: exit 0.
- `pnpm run build`: exit 0.
- `pnpm run check`: exit 0 in final aggregate; all gates executed.
- `pnpm run check:report`: exit 0 after cleanup.
- `pnpm run complexity`: exit 0 in final aggregate; total 144, maximum 20, 43 positive-score functions, five over threshold 5.
- `pnpm run metrics`: exit 0 in final aggregate; 33 files, 204 functions. Built-in metric diagnostic labels remain advisory.
- `pnpm run dependencies`: exit 0 in aggregate; no violations, 37 modules and 85 dependencies cruised (includes external references).
- `pnpm run structure`: exit 0 in aggregate; maximum local dependency depth 6.
- `pnpm run metrics:html`: exit 0; generated ignored `metrics.html`.
- `git diff --check`: exit 0. Source/test diff reviewed: formatting plus the approved const declaration, unused helper removal, and DocumentChunk parameter type. No test assertions or runtime behavior changed.

## Resolved gate blockers

- `src/shared/chunk-text.ts:58`: prefer-const.
- `test/index-document.test.ts:30`: unused makeVectorStore helper.
- `test/index-document.test.ts:71`: explicit any.

The user explicitly approved separate cleanup: changed the unreassigned local to const,
removed the unused helper and its SearchMatch import, and typed the mock batch as
DocumentChunk[]. No suppressions or rule downgrades. All gates rerun successfully;
no unresolved blockers.

## Advisory findings

Ten ESLint warnings: five cognitive complexity, two cyclomatic complexity, two statement counts, one function length.
Cognitive scores above 5: taxonomy parser 20; chunk merge 16; paragraph splitter 11;
input path resolution 8; index metadata validation 8. TypeScript metrics have independent
built-in thresholds and include one error-labelled test-length finding; these labels
are not blocking policy.

## Scope and remaining boundaries

Coverage and exclusions are documented in README.md. Scripts/configs are linted but
excluded from application cognitive/metrics/dependency/structure reports. MJS files
are not typechecked; shell helpers, copied skill internals, staging, user assets,
secrets and generated output remain outside checks. No live embedding test or test
coverage percentage gate was introduced.

Initial installation exited 1 because pnpm blocked tsmetrics postinstall. Its installer
was inspected, its existing versioned binary download mechanism allowed explicitly,
and `pnpm rebuild tsmetrics` succeeded; subsequent frozen installation passed.
Initial Vitest discovery included copied skill/Node test suites; explicit application
include configuration resolved that tooling failure without changing existing tests.

No template manifest/lockfile replacement, browser/Vite build, new CI workflow,
Pi package installation, or native skill setup. Existing Pi declarations remain
unpinned/unreviewed; feedback settings are unchanged semantically. No conflicts found.
Existing untracked logs and adoption resources were preserved. Adoption resources are
included in the requested commit; generated Pi package cache and unrelated logs are excluded.
The staged template ESLint snapshot retains its original trailing whitespace; maintained
code passes the whitespace check.
