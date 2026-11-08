# Task: Adopt the Agentic Development Template

Adopt the complete reusable development environment from `../agentic-dev-template` into this existing repository.

This is a fresh adoption experiment. Do not use the previous adoption branch as an implementation source.

## Objective

Transfer the reusable development environment, preserving the target application's architecture, behavior, package manager, and existing tests.

The template is a reusable development environment, not an application starter to be copied wholesale.

## Scope

### 1. Quality tooling

Inspect and adapt:

- ESLint and its plugins.
- Prettier.
- Cognitive complexity and TypeScript metrics.
- Dependency and structural analysis.
- Verification scripts and quality gates.

Preserve existing tools and integrate rather than replace them unnecessarily.

### 2. Agent development environment

Adopt the complete reusable Pi environment:

- Copy **all bundled Skills** from `.pi/skills/`, preserving their files and directory structure.
- Adopt `.pi/settings.json`.
- Adopt `.pi-lens.json`.
- Preserve and adapt agent guidance and development conventions.

Do not filter bundled Skills according to the target application's current needs.

Do not introduce Skills that are not present in the template.

### 3. Project preservation

- Preserve the existing application architecture and behavior.
- Preserve the package manager, test framework, and TypeScript configuration unless an approved change is necessary.
- Preserve existing ADRs, tests, and documentation.
- Do not copy browser fixtures, sample application code, or experiments.
- Do not modify the source template repository.
- Do not install global packages or global Skills.

## Interactive quality policy configuration

Before implementing the quality tooling, conduct an interactive configuration interview.

1. Inspect the target project and establish its existing verification baseline.
2. Identify applicable quality policies from the template.
3. Ask one decision at a time.
4. For each decision:
   - Explain what it controls.
   - Present 2–3 reasonable options.
   - Recommend one with a brief justification.
   - Wait for the user's answer.
5. Group related rules into meaningful decisions.
6. Distinguish correctness, formatting, readability, and maintainability policies.
7. Treat template thresholds as reference values, not mandatory defaults.
8. Record every decision.

After the interview, present the complete selected configuration and implementation scope.

**Do not modify files until the user approves the complete plan.**

## Implementation

After approval:

- Apply the agreed quality policies.
- Integrate all reusable tooling.
- Copy the complete bundled Skills directory.
- Adapt Pi integrations to the target environment.
- Preserve existing functionality and test assertions.
- Avoid unrelated refactoring.
- Do not weaken policies merely to obtain passing checks.

## Validation

Verify independently:

- Formatting, lint, tests, typecheck, and build.
- Cognitive complexity and structural reports.
- Dependency analysis.
- Pi configuration and project-local Skill discovery.
- Pi Lens compatibility with the adopted lint configuration.
- Completeness of copied Skills and supporting files.

Distinguish verified behavior from unverified assumptions.

Report blocking failures separately from advisory findings.

## Completion report

Include:

- Files added, modified, and deliberately excluded.
- Quality policy selected by the user.
- Verification results.
- Remaining warnings and limitations.
- Any deviations from the source template.

Do not claim that Pi integrations or Skills work unless actually verified.

Keep the adoption minimal, transparent, and project-specific. Avoid introducing a migration framework, generic installer, or automatic synchronization mechanism.
