# RAG-CLI

Local CLI for taxonomy-based document classification, indexing, and semantic search using embeddings.

## Development quality checks

Use Node.js 24 and pnpm 11.2.2. Install with `pnpm install --frozen-lockfile`.
The pinned tsmetrics package installs a platform binary from its GitHub release;
its postinstall is explicitly allowed in `pnpm-workspace.yaml` alongside existing permissions.

```bash
pnpm run format       # rewrites maintained code/config formatting
pnpm run check        # blocking: format, lint errors, typecheck, tests, build
pnpm run check:report # runs check and all text reports, even after failures
```

Individual reports: `pnpm run complexity`, `pnpm run metrics`,
`pnpm run dependencies`, and `pnpm run structure`. `pnpm run metrics:html`
writes the ignored `metrics.html`. Report command failures are blockers;
complexity warnings, metric values, and dependency cycles are advisory.
Unresolved imports are errors. No CI workflow is installed.
tsmetrics uses its own built-in diagnostic thresholds and may label findings
`error`; these are advisory metric labels, not ESLint gates. Its exit status
still determines whether report execution succeeded.

ESLint recommended JavaScript/TypeScript rules and readability rules are blocking.
Advisory limits: cyclomatic 10, cognitive 5, nesting 3, parameters 4,
function lines 85 (excluding blanks/comments; exempt in tests), statements 22,
and line width 120. Prettier uses double quotes, semicolons, and two spaces.
Existing violations are not silently suppressed or automatically refactored.

Coverage:

- Lint: `src/**/*.ts`, `test/**/*.ts`, `scripts/**/*.mjs`, root MJS/CJS configs.
- Format: source/tests/scripts plus root JSON/MJS/CJS configs; not Markdown or taxonomy.
- Cognitive, TypeScript metrics, dependency and structural reports: `src/` and `test/`.
  Maintained scripts/configs are linted but excluded from these application reports.
- Tests: Vitest only discovers `test/**/*.test.ts`; `pnpm test` also runs Node tooling
  tests in `scripts/*.test.mjs`. `pnpm run test:tooling` runs these separately.
- Type checks include source/tests; build emits only source into `dist/`.
  MJS tooling is linted and tested, not TypeScript-checked.
- Generated output, dependencies, copied skills, adoption snapshots, user documents,
  databases, logs, and secrets are outside maintained-code checks. Shell helpers are
  not linted by this JavaScript/TypeScript toolchain. No test-coverage percentage gate.

Pi feedback remains supplementary (`.pi-lens.json`); package commands are authoritative.
Existing third-party Pi declarations remain unpinned and are not independently audited
by this adoption. Review them before future installation. Optional AST/Joern skills are
not part of `check`; install skill dependencies only with separate approval.

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
