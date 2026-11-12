---
name: quality-gates
description: Run reusable formatting, lint, cognitive complexity, dependency, structural and TypeScript metrics checks against an existing Node.js/TypeScript project without integrating configurations or dependencies into that project. Use for quality verification and reporting, not automatic policy adaptation.
compatibility: Node.js 24+, npm for Skill setup; project dependencies and its package manager for delegated verification. No agent runtime required.
---

# Quality gates

Run scripts relative to this Skill directory. Read this document first; no other
Skill or agent is required. 
This skill is diagnostic and must not modify project files.
When the user explicitly requests remediation, the agent may modify application 
code as a separate task, following the project's instructions.
Never weaken, disable, or bypass quality gates to make checks pass. 
Re-run the relevant checks after remediation.

## Setup

Review the bundled files, then install dependencies **in this directory only**:

```sh
npm ci --prefix /absolute/path/to/quality-gates
node /absolute/path/to/quality-gates/scripts/quality-gates.mjs --help
```

Setup is explicit, not part of the installer or any check. `tsmetrics` downloads
its platform-specific native binary during npm installation; network access to
GitHub releases and a supported OS/libc are necessary. No global packages,
`NODE_PATH`, target manifest changes, or target configuration changes are needed.

## Run against a project

Inputs are literal files or directories relative to the explicit project root.
Repeat `--input`; no `src`, `test`, or `tests` directories are inferred. Supply
runtime file globs explicitly. Node bindings are process, console, URL,
AbortController, AbortSignal, setTimeout, clearTimeout. Browser bindings provide
window only. Do not assign browser globals to server files.

```sh
SKILL=/absolute/path/to/quality-gates
PROJECT=/absolute/path/to/project
node "$SKILL/scripts/quality-gates.mjs" format:check --root "$PROJECT" --input lib --input spec
node "$SKILL/scripts/quality-gates.mjs" lint --root "$PROJECT" --input lib --input spec \
  --node-files 'lib/**/*.{ts,js,mjs}' --node-files 'spec/**/*.{ts,js,mjs}'
node "$SKILL/scripts/quality-gates.mjs" dependencies --root "$PROJECT" --input lib --input spec \
  --tsconfig tsconfig.json
node "$SKILL/scripts/quality-gates.mjs" verify --root "$PROJECT" --package-manager npm \
  --script test --script typecheck --script build
```

Change those paths, globs and script names to match the project. Missing requested
scripts are errors; there is no implicit success, replacement test runner or
compiler invocation. A project with typechecking inside `build` can delegate just
`test` and `build`, explicitly reporting that no separate typecheck was requested.
Use the project's installed package manager; the Skill does not provision it.
Review project scripts before running them: delegated commands can write outputs,
run lifecycle scripts, or perform arbitrary operations.

`check:report` accepts the same options: lint gates verification, then all four
reports (`cognitive`, `metrics`, `dependencies`, `structure`) run even after failure.
Report execution errors remain failures. Run `format:check` separately; formatting
was not a blocking aggregate gate in the original tooling. `format` is the sole
quality command that deliberately rewrites input files; obtain approval first.
`metrics:html` emits HTML to stdout; redirect it to a caller-chosen output file.

## Modules and policy

| Module               | Commands                                      | Behavior                                                                                  |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Code style           | `format:check`, `format`, `lint`, `cognitive` | Prettier; recommended ESLint/TypeScript rules, SonarJS cognitive rule and stylistic rules |
| Architecture         | `dependencies`, `structure`                   | Dependency Cruiser; project-owned fan-out, reachability and longest simple-path depth     |
| Code metrics         | `metrics`, `metrics:html`                     | tsmetrics 0.4.0 text/HTML; informational findings                                         |
| Project verification | `verify`                                      | Run explicitly named existing package scripts in order; stop on failure                   |

Cognitive complexity **5/error**, cyclomatic complexity **10/error**, nesting
**3/error**, parameters **4/error**, function lines **85/error** (blank lines and
comments skipped), statements **22/warning**, line length **120/warning** retain
the template policy. Test files ending `.test.ts` or `.test.mjs` retain the existing
function-line exception. Cognitive totals/maximum are advisory; lint enforces the
configured cognitive limit. Cycles remain warnings. Structure and tsmetrics
findings have no new exit-code thresholds. ESLint warnings are not promoted.

Every command exits zero on successful execution, except blocking lint or formatting
findings. Errors, invalid inputs, missing scripts, failed delegated commands and
report execution failures return nonzero. Cognitive `FAIL` findings can coexist
with exit zero because enforcement belongs to lint.

## Configuration and resolution

| Reference                          | Read/use when                                           |
| ---------------------------------- | ------------------------------------------------------- |
| `config/eslint.mjs`                | Inspect all lint rules or runtime-binding behavior      |
| `config/prettier.json`             | Inspect formatting policy                               |
| `config/dependency-cruiser.cjs`    | Inspect cycle severity and pre-compilation dependencies |
| `scripts/quality-gates.mjs --help` | Find complete command-line options and defaults         |

By default bundled configuration is used, not the project's existing quality
configuration. `--eslint-config`, `--prettier-config` (JSON only), and
`--dependency-config` explicitly select alternatives. Relative config paths and
runtime globs resolve against `--root`. External ESLint flat-config imports resolve
from their own file location; any extra plugins must already be resolvable there.
Relative `files`/`ignores` in that flat config are evaluated against the project
root. Overrides must export a flat array/object; function/promise exports are not
supported. Configs are executable trusted code, not sandboxed.

The bundled ESLint parser and plugins resolve from this Skill. Lint is deliberately
not type-aware, matching the template. Dependency Cruiser uses the Skill's
TypeScript 5.9.3 to parse the explicit target `--tsconfig`, and resolves project
imports and packages from the target. The target compiler, type declarations,
frameworks, tests and build dependencies remain project-owned. Newer TypeScript
syntax/configuration unsupported by 5.9 is not guaranteed. Without `--tsconfig`,
path aliases are not inferred. Supply each relevant entry path explicitly.

Formatting directory coverage preserves `.ts`, `.js`, `.mjs`; explicit files can
select other Prettier-supported extensions. It ignores node_modules and .git, but
does not silently load target .prettierignore or .editorconfig. ESLint also does
not load target configs implicitly. tsmetrics supports its own native parser and
skips `.mjs`; it is not a TypeScript compiler or type checker. Dependency reports
can warn about unresolved imports; successful execution alone does not prove
resolution. Review that output.

Structure excludes external/node_modules files and limits traversal to selected
paths. Its longest-simple-path calculation retains the original potentially
expensive behavior on dense cyclic graphs. Huge projects can exceed memory/output
limits; no truncation is presented as a complete report. Inputs containing symlinked
source trees, monorepo multi-tsconfig resolution, Windows execution, Yarn PnP and
framework-specific compilation are not guaranteed by the integration validation.

## Output contract

Report selected root, paths, runtime bindings/configs, executed commands and exit
statuses. Include total/maximum cognitive complexity, remaining errors/warnings,
dependency and structure findings, tsmetrics compatibility, tests/typecheck/build
outcomes, and unsupported or unexecuted coverage. Distinguish policy findings from
execution failures. Never weaken thresholds, suppress findings, install packages
without authorization, or claim success for commands not executed.
