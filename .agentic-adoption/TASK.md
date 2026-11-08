# Adopt agentic development tooling

## Objective and boundaries
Integrate the prepared reusable tooling with this project's existing workflow.
Bootstrap only copied resources: it did not execute tooling, install dependencies,
change application files, select thresholds, or approve any adaptation.
Start a fresh Pi session so project-local Skills are discovered.
Read this task and existing project instructions before doing anything else.

## Prepared resource inventory
Paths are relative to the project root. Conflicting paths below were NOT installed;
the existing contents remain untouched. Staging preserves template-relative paths.
- `.pi/skills/joern-review/.gitignore`
- `.pi/skills/joern-review/SKILL.md`
- `.pi/skills/joern-review/scripts/analyze.sc`
- `.pi/skills/joern-review/scripts/fixture.js.txt`
- `.pi/skills/maintainability-review/.gitignore`
- `.pi/skills/maintainability-review/SKILL.md`
- `.pi/skills/maintainability-review/analyze.mjs`
- `.pi/skills/maintainability-review/analyze.test.mjs`
- `.pi/skills/maintainability-review/fixtures/sample.ts`
- `.pi/skills/maintainability-review/package-lock.json`
- `.pi/skills/maintainability-review/package.json`
- `.pi/settings.json`
- `.pi-lens.json`
- `.agentic-adoption/staging/eslint.config.mjs`
- `.agentic-adoption/staging/.prettierrc.json`
- `.agentic-adoption/staging/.dependency-cruiser.cjs`
- `.agentic-adoption/staging/package.json`
- `.agentic-adoption/staging/package-lock.json`
- `.agentic-adoption/staging/tsconfig.json`
- `.agentic-adoption/staging/vite.config.ts`
- `.agentic-adoption/staging/scripts/check-report.mjs`
- `.agentic-adoption/staging/scripts/complexity-report.mjs`
- `.agentic-adoption/staging/scripts/run-structure.mjs`
- `.agentic-adoption/staging/scripts/structure.mjs`

## Detected conflicts
- None detected.
Do not overwrite conflicts. Compare the corresponding files in the source template
and propose an explicit resolution. Re-running bootstrap does not merge files.
If this TASK.md itself conflicts, bootstrap preserves it and prints the proposed
handoff in the terminal instead.

## Inspect first; obtain approval
Inspect project instructions, source layout, tests, package manager and lockfiles,
existing scripts/configurations, runtime environments, and CI before proposing edits.
Read the bundled Skills when relevant; their dependencies are not installed.
Review Pi package declarations before trusting/loading them: starting Pi may offer
to install third-party packages; bootstrap did not install or pin those packages.

Conduct an interactive quality-policy wizard with the human, not a silent policy
selection: discuss languages and paths to cover, runtime globals and exclusions,
formatting conventions, lint rules and complexity thresholds, blocking gates versus
advisory reports, existing technical debt, and test/build commands. Explain the
staged defaults and trade-offs; do not assume they are the project's policy.
Present a concrete integration plan, dependency changes, conflict resolutions,
coverage and agreed policy. Obtain explicit human approval BEFORE changing files,
installing packages, or running tooling that writes project files.

## Remaining integration
- Adapt staged ESLint, Prettier and dependency-cruiser configurations to project paths
  and runtimes. Do not blindly replace existing configurations.
- Integrate scripts/complexity-report.mjs, scripts/run-structure.mjs,
  scripts/structure.mjs and scripts/check-report.mjs together, preserving their
  relative references or deliberately updating them.
- Use staged package.json and package-lock.json as references for dependencies and
  commands: check, check:report, complexity, metrics/metrics:html, dependencies,
  structure, formatting, lint, tests and build. TypeScript metrics and the aggregate
  check are package commands, not missing standalone scripts. Never replace the
  project's package manifest or lockfile with these template snapshots.
- Assess staged tsconfig.json and vite.config.ts as fixture-specific build references;
  retain the project's build system unless an approved change is needed.
- Align coverage across lint, cognitive analysis, TypeScript metrics, dependencies,
  structural filters, formatting, tests and build. Inspect hard-coded paths in scripts.
- Reconcile Pi settings and feedback with approved tooling. Propose project-specific
  agent instructions; template application fixtures and root instructions were not copied.

## Validation and completion
After approved integration, run formatting, lint, existing and added tests, build,
and all agreed quality/report commands. Command execution failures are blockers;
advisory findings are reviewed, not silently promoted to gates. Do not weaken agreed
policy or edit existing tests merely to pass. Report exact commands and outcomes,
coverage gaps, total/maximum cognitive complexity, remaining violations and conflicts.
Review the diff for unintended application or behavior changes. Completion requires
approved integration, passing agreed gates, successful report execution, and a clear
summary of advisory findings and any unresolved blockers. Do not claim unrun checks.
