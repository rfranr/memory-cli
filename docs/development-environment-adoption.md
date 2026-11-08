# Development environment adoption

## Status and source

**The complete quality gate and report runner pass.** Existing lint violations were resolved after the user approved a follow-up. Pi Lens lint feedback works through the project-local `pnpm agent` launcher; a fresh plain `pi` launch still has the upstream npm/pnpm incompatibility described below.

Source: the local `../agentic-dev-template` checkout at commit `590e4873c09e3f6ce9d4c12e383c6d7374e61c48`, including its untracked `.pi/skills/joern-review/` directory. The source repository was not modified. No previous adoption branch was used.

Before adoption, all 26 tests in 12 files, typecheck, and build passed. There were no existing format/lint commands. pnpm's initial baseline invocation unexpectedly reconciled installed dependencies; it did not change tracked files. Subsequent installations were explicitly approved.

## Selected policy (decision record)

The user approved each decision individually, then the complete plan and project-local installations:

1. **Correctness:** ESLint and TypeScript recommended rules are blocking errors; no type-aware linting.
2. **Formatting:** Prettier, double quotes, width 120; blocking. Application code, tests, maintained JS tooling/configuration are covered. Bundled Skills retain their original bytes.
3. **Readability:** full template policy: braces, one declaration per statement, no chained assignments, one statement per line, mandatory blank-line patterns. Line-length warnings are advisory (120, with template exceptions for comments, URLs, strings and template literals).
4. **Maintainability:** blocking cognitive complexity 5, cyclomatic complexity 10, nesting depth 3, parameters 4, function lines 85 excluding blank/comment lines. Statement count above 22 is advisory. Tests retain the function-length exemption, not a blanket complexity exemption.
5. **Dependencies:** cycles are blocking errors. No new architectural-boundary rules. Structural metrics are informational.
6. **Verification:** `pnpm check` gates formatting, lint, tests, explicit typecheck, build and dependency analysis. `pnpm check:report` runs every group independently, followed by cognitive, TypeScript metrics and structural reports, retaining nonzero statuses. Report findings are advisory; report execution failures are blocking.

Initial scope authorized formatting/mechanical readability fixes only. Initial verification exposed ten existing lint errors and the Lens incompatibility. The user then approved substantive lint remediation and investigation of a pnpm-compatible Lens fix. No thresholds were changed, no suppressions added, and no existing assertions removed or weakened.

## Current verification results

Executed with Node.js 24.22.2 and pnpm 11.2.2:

| Check | Result |
| --- | --- |
| Frozen-lockfile installation | Passed |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed: 0 errors, 0 warnings |
| `pnpm test` | Passed: 66 tests in 19 files (26 original assertions/suite tests retained) |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed |
| `pnpm dependencies` | Passed: no violations, 52 modules / 132 dependencies |
| `pnpm complexity` | Passed execution; total 126, maximum 5, 0 functions above limit |
| `pnpm metrics` | Executed successfully; 38 TypeScript files, 254 functions; findings advisory |
| `pnpm structure` | Executed successfully; maximum dependency depth 4 |
| `pnpm check` | Passed |
| `pnpm check:report` | Passed; all checks/reports ran independently |
| Skill completeness | All 11 non-`node_modules` files match source SHA-256 manifests byte-for-byte |
| Maintainability Skill | Isolated `npm ci`, all 4 tests, and sample analyzer execution passed |
| Joern Skill | Copied and discovered; execution unverified because Joern is not installed |
| Pi resources | Actual SDK resource loading discovered both project Skills and loaded all 3 extensions without errors/warnings |
| Adapted Lens daemon | Actual lint request returned `Lint: 0 issues (eslint)` |
| Lens runtime hooks | Actual loaded `session_start`, `tool_result`, and `session_shutdown` handlers exercised without a model request; clean file and deliberate cognitive violation reported |
| `git diff --check` | Passed |

The initial adopted configuration reported cognitive total 154, maximum 20, five cognitive violations, ten lint errors and two warnings. The final totals include the added regression tests and maintained JS tooling, so they are not a source-only before/after comparison.

### Behavioral preservation and regression coverage

- Chunking and taxonomy parsing were compared against the original `HEAD` implementation using 3,000 deterministic generated cases each. All returned values/errors matched.
- Chunking now separates greedy grouping from paragraph boundary selection. The former final-tail merge was unreachable: greedy grouping already guarantees that joining adjacent groups exceeds the maximum. Minimum-size validation remains unchanged, including when the minimum exceeds the maximum.
- Taxonomy parsing separates section selection, category collection, and field/example state handling without broadening its supported YAML format. Tests cover ignored lines, repeated section markers, quotes, CRLF, examples-state resets, required fields and category error indexes.
- Configuration tests preserve option → environment → fallback precedence, explicit empty values, env-file behavior, invalid dimensions and the existing `parseInt` acceptance of numeric prefixes.
- Path-resolution tests cover files, directories and literal input; existing INIT_CWD and URL tests still pass.
- Metadata tests cover initial writes, matching/subset metadata, missing keys and mismatched values using SQLite in memory.
- CLI category registration was extracted as a cohesive helper; existing command forwarding/output assertions still pass.
- The indexing test now reuses its existing typed store helper instead of duplicating an `any`-typed fake; all assertions are retained.
- Tooling regressions cover selected limits/test exemption, Node-versus-browser globals, structural upstream/reporter failure propagation, pnpm/test-path adaptation, structural project-module filtering, literal adapter argument forwarding, unsupported-command rejection and shell syntax.
- Vitest is scoped to `test/` so the copied Skill's Node test runner is not mistakenly collected as an application suite.

## Pi Lens compatibility

Project-local versions observed: `@harms-haus/pi-lens` 2.1.0, `pi-web-access` 0.47.0, `pi-skills-sh` 0.2.1; Lens daemon `@harms-haus/code-lens` 0.3.0. Settings retain the template's unpinned package declarations.

### Upstream limitation

The installed daemon recognizes `eslint.config.mjs`, but probes ESLint using `npx eslint --version`. That probe fails with `EBADDEVENGINES` in this repository because npm does not match the existing pnpm `devEngines.packageManager` requirement. Initial actual daemon requests using relative and absolute paths reported “No linters detected” and exited zero. That was not a clean lint result. The published daemon version checked during follow-up was also 0.3.0.

The pnpm policy, global environment and third-party package source were not modified.

### Project-local adapter

Run `pnpm agent` after installing the project-local Pi packages (see README). It runs `scripts/pi-with-lens.sh`, which:

1. Restarts this project's shared daemon to discard failed discovery caches.
2. Starts it with `scripts/lens-bin/` prepended to **only that bootstrap process's PATH**; the daemon inherits it.
3. Launches the normal `pi` command with the caller's original PATH.

`scripts/lens-bin/npx` accepts only the daemon's ESLint invocation and forwards arguments literally to `pnpm exec eslint`. It rejects other package names, does not download packages, and is never placed on a global PATH. Lens retains lint-only configuration, so no additional npx-based integrations are implied to work.

Runtime verification used the actual installed extension's handlers and an actual daemon: a clean source file produced lint feedback; a temporary probe with cognitive complexity above 5 produced the configured `sonarjs/cognitive-complexity` diagnostic through `tool_result`. The probe was removed and the daemon shut down afterward. Resource loading also found both copied Skills with project scope and no diagnostics. Package-provided resources (such as Lens's own Skill) are distinct from copied bundled Skills; no additional Skill was installed manually.

### Remaining warnings and limits

- Use `pnpm agent` for verified feedback. A fresh plain `pi` invocation can start an unadapted daemon. Coordinate launcher use with other Pi sessions: the daemon is shared per project and restarted on launch.
- The launcher/adapter require a POSIX shell and project-local Pi package installation. Linux execution was verified; Windows/native PowerShell and other platforms were not.
- Interactive TUI rendering, subagent monitoring, model requests, web-provider calls and Skill-installation commands were not exercised. The runtime hook test used a non-UI context and synthetic tool-result events, not an interactive user edit.
- TypeScript metrics retain advisory findings for parameter count, function/test length, class weighted-method count and maintainability index, including an `error`-labelled test-suite length finding. Its labels are not extra gates; ESLint and tsmetrics use different measurements.
- Metrics do not cover `.mjs`; lint/cognitive analysis cover maintained JavaScript tooling. Shell files receive syntax and adapter regression checks, not ESLint/Prettier analysis. Bundled Skills remain outside application gates and own their dependencies/tests.
- npm warned that the Skill's three native Tree-sitter packages have lifecycle scripts not covered by npm `allowScripts`; bundled binaries worked and its tests passed. Other platforms are unverified.
- pnpm reported deprecated transitive dependencies during installation. No unrelated dependency upgrade was attempted.
- Joern execution remains unverified; no installation was attempted.

## File inventory

### Added

- `eslint.config.mjs`, `.prettierrc.json`, `.dependency-cruiser.cjs`, `vitest.config.mjs`.
- `scripts/{check-report,complexity-report,run-structure,structure}.mjs`.
- `scripts/pi-with-lens.sh`, `scripts/lens-bin/npx` (executable project-local launcher and adapter).
- `test/quality-tooling.test.mjs`, `test/lens-adapter.test.mjs`.
- `test/{config,taxonomy-parser,chunk-boundaries,read-input-paths,metadata-validation}.test.ts`.
- `.pi/settings.json`, `.pi-lens.json`.
- `.pi/skills/joern-review/`: `.gitignore`, `SKILL.md`, `scripts/analyze.sc`, `scripts/fixture.js.txt`.
- `.pi/skills/maintainability-review/`: `.gitignore`, `SKILL.md`, `analyze.mjs`, `analyze.test.mjs`, `fixtures/sample.ts`, `package.json`, `package-lock.json`.
- `docs/development-environment-adoption.md` (this record).

### Modified

- `package.json`, `pnpm-lock.yaml`: local quality dependencies, pnpm checks and agent launcher; original test/build/typecheck commands preserved.
- `pnpm-workspace.yaml`: approved `tsmetrics` build script; existing entries preserved.
- `.gitignore`: generated metrics HTML, Pi-managed npm state and validation-agent state.
- `AGENTS.md`, `README.md`: conventions, setup, policies and verification boundaries.
- Approved behavior-preserving refactoring in `src/application/classify-document.ts`, `src/cli/program.ts`, `src/config/config.ts`, `src/infrastructure/taxonomy/yaml-taxonomy-loader.ts`, `src/shared/{chunk-text,index-metadata}.ts`.
- Typed fake-store reuse in `test/index-document.test.ts`, retaining assertions.
- Formatting/readability-only changes elsewhere:
  - `src/application/{find-documents,index-document,search-documents,taxonomy-sync}.ts`
  - `src/core/core.ts`, `src/domain/ports.ts`
  - `src/infrastructure/database/{sqlite-category-store,sqlite-vector-store}.ts`
  - `test/{chunk-text,cli-program,find-documents,index-metadata,read-input-init-cwd,sqlite-vector-store-find,sqlite-vector-store-knn,stats,taxonomy-sync}.test.ts`

### Deliberately excluded / preserved

- No template browser page, sample application, Vite configuration, Playwright, experiments, `TASK.md`, generated `dist/`, Git history, installed dependencies, or Pi caches copied.
- Skill fixtures retained because they are supporting files, not application/browser fixtures.
- Existing TypeScript configurations, ADRs, usage documentation, taxonomy, runtime dependencies and CLI behavior preserved.
- Existing untracked `docs/tasks/TASK00-adopt-agentic-dev-template.md` and `example.emebd.curl.log` untouched.
- Local Pi-managed npm files and installed Skill dependencies are ignored, not adoption source files. No global packages/Skills installed.

## Deviations from template

Approved deviations: double quotes; cycle errors instead of warnings; formatting/typecheck/dependencies in the complete gate; expanded tooling/configuration coverage; pnpm and `test/` paths; preserved Vitest and NodeNext/TypeScript 6 instead of browser/tsx tooling. The report runner executes groups independently so lint failures do not hide test/build results. Node runtime bindings replace browser fixture bindings; CommonJS configuration declares CommonJS globals. A project-specific daemon launcher resolves the npm/pnpm mismatch without patching third-party code. All copied Skill source files remain unchanged.
