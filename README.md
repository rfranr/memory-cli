# RAG-CLI

Local CLI for taxonomy-based document classification, indexing, and semantic search using embeddings.

## Setup

Install dependencies:

```bash
pnpm install
```

Configure `.env`:

```bash
RAG_CLI_DB=./rag.sqlite
RAG_CLI_CATEGORIES_DB=./rag-categories.sqlite
RAG_CLI_EMBEDDING_PROVIDER=llama.cpp
RAG_CLI_EMBEDDING_URL=http://localhost:8080/embedding
RAG_CLI_EMBEDDING_MODEL=granite-embedding-107m-multilingual
RAG_CLI_EMBEDDING_DIMENSIONS=384
```

The embedding endpoint must accept `POST /embedding`.

## Basic usage

### 1. Sync categories

`categories.yml` is the source of truth for categories.

```bash
pnpm run start categories sync assets/taxonomy/categories.yml
```

This embeds every category and stores it in the categories database.

### 2. Classify a text or file

```bash
pnpm run start classify assets/docs/doc.txt
```

This compares the input with the already-synced categories database.

### 3. Index a text, file, or URL

```bash
pnpm run start index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index https://example.com/article --metadata '{"url":"https://example.com/article"}'
```

This splits the document into chunks and stores each chunk in the documents database with:

- chunk embedding
- best matching category
- user metadata
- chunk metadata such as `chunkIndex`, `chunkCount`, `chunkStart`, and `chunkEnd`

Example output:

```json
{
  "chunks": 3,
  "ids": [1, 2, 3]
}
```

### 4. Search indexed documents

```bash
pnpm run start search "Microsoft BASIC" --limit 5
```

Search returns the best scoring indexed texts with category and metadata (KNN via sqlite-vec).

### 5. Inspect database stats

```bash
pnpm run start stats
```

Or:

```bash
pnpm run start inspect
```

This prints a JSON summary of the documents and categories databases.

### 6. Find indexed chunks by filter

```bash
pnpm run start find --file machinelearning
pnpm run start find --text pipeline
pnpm run start find --category llms
```

You can combine filters and control pagination with `--limit` and `--offset`.

## Taxonomy format

Example:

```yaml
version: 1

categories:
  - id: software-architecture
    path: "Tecnologia / Desenvolupament / Arquitectura"
    description: "Notes sobre disseny de software."
    examples:
      - "Clean Architecture"
      - "DDD"
```

## Build

```bash
pnpm run build
```

## Development

Use Node.js 24 and pnpm 11.2.2-compatible tooling. Install the locked application/tooling dependencies with `pnpm install --frozen-lockfile`.

```bash
pnpm format        # Apply formatting
pnpm check         # Blocking gate; stops at the first failing group
pnpm check:report  # Run every check and report, retaining failures
```

| Command | Coverage / policy |
| --- | --- |
| `format:check` | Application, tests, scripts, root JSON/JS configuration, workspace YAML, Pi settings; double quotes, width 120 |
| `lint` | `src/`, `test/`, `scripts/`, ESLint/Vitest/dependency configuration; correctness, readability, complexity |
| `test` | Existing full TypeScript check and Vitest tests in `test/`; bundled Skills use their own runners |
| `typecheck` / `build` | Existing application TypeScript configuration and output |
| `dependencies` | Application/test dependency graph; cycles are errors |
| `complexity` | Application, tests, scripts and maintained JS configuration; cognitive totals, maximum and violations |
| `metrics` / `metrics:html` | TypeScript metrics for `src/` and `test/`; `.mjs` is not analyzed; HTML output is ignored |
| `structure` | Application/test direct and transitive dependencies and maximum depth |

Formatting, lint errors, tests, typecheck, build, dependency cycles, and failures to execute reports block completion. Lint warnings and metric findings are advisory. The cognitive report may print `FAIL` while exiting zero: ESLint enforces its limits. See the [selected policy, verification results, and current blockers](docs/development-environment-adoption.md).

### Pi and bundled Skills

Review `.pi/settings.json` before approving project trust. Its packages are project-local; do not install global packages or Skills. If they are not installed, approve their setup explicitly:

```bash
pi install npm:@harms-haus/pi-lens -l --approve
pi install npm:pi-web-access -l --approve
pi install npm:pi-skills-sh -l --approve
```

Launch the existing Pi installation with the repository adapter:

```bash
pnpm agent
```

This starts the Lens daemon with a narrowly scoped `npx eslint` → `pnpm exec eslint` adapter, then launches Pi with its original PATH. It restarts this project's shared Lens daemon to clear cached detection failures; coordinate with any other active Pi session in this repository. The adapter supports ESLint only and never downloads packages. The launcher requires a POSIX shell and installed project-local Pi packages. Lens retains lint-only feedback (`prettier`, LSP and tsc integrations disabled); CLI checks remain authoritative.

The complete bundled Skills are `.pi/skills/maintainability-review/` and `.pi/skills/joern-review/`. Pi discovers their instructions after project trust; read each `SKILL.md` before use. Do not run `pnpm format` over their supporting files.

With approval, set up the maintainability analyzer separately:

```bash
cd .pi/skills/maintainability-review
npm ci
npm test
node analyze.mjs fixtures/sample.ts
```

Its isolated npm lockfile belongs to the Skill; the application still uses pnpm. Native Tree-sitter bindings may need platform build tools. The Joern Skill requires an existing Joern installation; this adoption does not install it.

**Compatibility boundary:** use `pnpm agent`, not a fresh plain `pi` launch, for verified Lens lint feedback. Without the adapter, the daemon's `npx eslint` invocation conflicts with this repository's pnpm-only `devEngines` policy and can silently report “No linters detected.” The adapted daemon and actual Lens tool-result hooks were verified against clean code and a deliberate cognitive-complexity violation. Interactive TUI rendering, other platforms, and web-provider behavior remain unverified; see the adoption record.
