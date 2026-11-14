# ADR 0007: Remove taxonomy classification

## Decision

Use a standalone retrieval pipeline:

Documents → Chunks → Embeddings → SQLite/sqlite-vec → Search

Indexing no longer classifies chunks. Query embedding, normalization, KNN search,
scoring, chunking, and embedding requests remain unchanged. Input reading moved
from the classification module to `src/application/read-input.ts`.

Remove category sync/classify use cases, YAML parser, category store and ports,
category configuration/commands/filters/stats, and the unused cosine helper.
There were no taxonomy-only package dependencies: the YAML parser was local code.
No replacement classification system or graph is introduced.

This supersedes taxonomy-specific parts of ADRs 0001–0006 and the historical
completed-work checklist in `AGENT_INTERACTION.md`; their other decisions remain.

## Compatibility

No destructive migration or rebuilding is required. Existing document rows,
classification columns/indexes, metadata, vectors, IDs, and timestamps are retained.
A small insert compatibility branch supplies empty strings for legacy required
classification columns. New databases omit these columns and indexes entirely.
Category databases and user YAML files remain untouched and unused, including the
historical example under `assets/taxonomy`.

Results expose top-level `metadata` instead of the `taxonomy` wrapper. Stats expose
only chunk/source counts. Removed commands/options are intentionally unsupported.
See README.md for the optional backup-and-reindex procedure into a separate database.

## Verification

Baseline was recorded before implementation: 45 tests across 15 files passed;
`pnpm typecheck`, `pnpm build`, and all six skill quality checks exited 0.
After removal: 40 tests across 14 files passed, including new tests for legacy
preservation, clean schema creation, indexing/search with no initialization, and
dry-run byte preservation. Taxonomy tests were removed, not skipped.

Executed before and after from the project root:

```bash
pnpm test
pnpm typecheck
pnpm build
for check in format:check lint cognitive dependencies structure metrics; do
  node .pi/skills/quality-gates/scripts/quality-gates.mjs "$check" \
    --root "$PWD" --input src --input test \
    --node-files 'src/**/*.ts' --node-files 'test/**/*.ts' --tsconfig tsconfig.json
done
```

All final commands exited 0 using the skill's unchanged bundled policies and Node
runtime bindings for both source/test TypeScript globs. Lint: zero errors, one
non-blocking statement-count warning in the legacy compatibility test.
Cognitive total decreased from 127 to 100, maximum remained 5, zero violations.
Dependency Cruiser: no violations (40 modules, 95 dependencies). Structural maximum
depth: 4. Native tsmetrics ran successfully on 31 files/192 functions; eight
informational warnings cover function length, chunker parameter count, and vector
store weighted method count. No policy thresholds were changed.

Three deterministic vector searches were captured before implementation and
compared after building; full source/content/score outputs were identical:

| Query vector | Ranking | Scores (rounded) |
| --- | --- | --- |
| `[1,0]` | architecture, mixed, music | 1, 0.707107, 0 |
| `[0,1]` | music, mixed, architecture | 1, 0.707107, 0 |
| `[0.7,0.7]` | mixed, architecture, music | 1, 0.707107, 0.707107 |

Fixture contents were “Software design patterns”, “Guitar practice”, and
“Designing musical software”; their vectors were `[1,0]`, `[0,1]`, and `[0.7,0.7]`.

A separate built-CLI smoke test used a temporary database and local HTTP embedding
stub: dry-run before database creation, file indexing with page/file metadata,
software/music searches, find, and stats all passed. Source references, chunk
metadata, and descending scores were asserted. All smoke-test data was temporary;
no existing user database was opened. Raw execution logs and smoke scripts are in
`/tmp/memory-cli-validation` for this session.

## Limitations

Retrieval comparison used deterministic vectors and HTTP stubs, not a live model
or a relevance benchmark against the user's corpus. Existing data is deliberately
not scrubbed: historical scores remain ordinary metadata and classification
columns remain accessible through SQLite, but are no longer returned as a wrapper.
Consumers of the old JSON shape must update. Re-indexing still appends duplicates.
