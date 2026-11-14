# Embedding batching verification

Indexing uses sequential groups of at most 8 chunks. Ollama receives one array-input
request per group; other providers and clients without `embedMany` use sequential
single-input calls. No schema, model, dimensions, chunking, or search changes are
required. Replacement occurs only after all embeddings have been validated.

## Local performance measurement

Measured in the same working environment with Node v24.22.2, local Ollama
`http://localhost:11434/api/embed`, `bge-m3:latest` (1024 dimensions), and the
unchanged default chunker. The document was
`assets/docs/disc2/treball/axpe/Downloads/DevelopmentofPerformanceDashboards.txt`:
32 real document chunks, not short synthetic inputs.

Each version ran three complete indexing operations after a model warm-up, using
fresh in-memory SQLite/sqlite-vec stores. Initialization was outside the timer.
Total time surrounds `IndexDocumentUseCase.execute`; embedding time surrounds
client embedding operations; persistence time surrounds `replaceDocument`.
HTTP calls were counted at `fetch`. Before used the original sequential indexing
implementation; after used batching. All before runs preceded all after runs.

Mean durations:

| Metric | Before | After |
|---|---:|---:|
| Total indexing | 20,263.6 ms | 16,534.7 ms |
| Embedding generation | 20,225.7 ms | 16,494.9 ms |
| SQLite replacement | 35.3 ms | 37.2 ms |
| HTTP embedding requests | 32 | 4 |
| Chunks processed | 32 | 32 |
| Total duration per chunk | 633.2 ms | 516.7 ms |
| Embedding duration per chunk | 632.1 ms | 515.5 ms |

Total times per run were 20,456.4 / 20,235.1 / 20,099.2 ms before and
16,577.3 / 16,496.3 / 16,530.4 ms after. This sample showed about 18.4% lower
elapsed indexing time (1.23× throughput); this is not a general speedup guarantee.

Limitations: one representative document, warm model, no randomized run order,
and in-memory SQLite rather than on-disk durability costs. Hardware load and
model execution dominate results; additional document sizes and on-disk runs
are needed before generalizing. A 64-chunk mock-client test verifies eight batch
calls, but a real 64-chunk HTTP performance run was not performed.

## Verification

59 tests pass, including batch sizes 3, 8, 9, 18, and 64; ordered mapping and
metadata; malformed responses and count mismatches; intermediate failures without
replacement; unchanged-document skipping; single-query semantic search; existing
SQLite compatibility and idempotency tests.

Quality checks ran against `src` and `test` using the bundled quality-gates
configuration with Node bindings for `src/**/*.ts` and `test/**/*.ts`, and
`tsconfig.json` for dependencies. Formatting, lint, cognitive complexity,
dependencies, structure, and tsmetrics completed successfully, as did
`pnpm test`, `pnpm typecheck`, and `pnpm build`.

Lint retains two existing max-statements warnings in idempotency and SQLite
compatibility tests; no errors. Cognitive total is 124, maximum 5, no violations.
Dependency analysis found no violations; maximum structural depth is 4.
Native tsmetrics executed successfully and reports advisory metric findings,
including existing test maintainability/size warnings; these are not blocking.
