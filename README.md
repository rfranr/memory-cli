# RAG-CLI

Local CLI for document indexing and semantic search using embeddings.

Documents → Chunks → Embeddings → Vector Store → Search

## Install in another project (optional Pi integration)

From the consumer project root (for example, `agentic-dev-scorch-poc`):

```bash
npm install @rfranr/memory-cli
npx --no-install memory-cli setup pi --dry-run
npx --no-install memory-cli setup pi
npx --no-install memory-cli setup pi --check
```

For an unpublished build, run `npm pack` in this repository and install the resulting
`.tgz` instead of the package name. No global installation or source checkout is
needed by the consumer. The core CLI does not depend on Pi.

Setup copies the bundled Skill into `.pi/skills/agent-memory/` and the extension into
`.pi/extensions/session-memory.ts`. Start (or restart) Pi from this project root.
Identical files are left alone; differing files require interactive confirmation
(default: no), and non-interactive runs preserve them. Other Skills, extensions and
Pi configuration are untouched. Dry runs never write or prompt.

`--check` exits 0 when all bundled resource paths exist and the project-local CLI
executes, or 1 otherwise. It does not compare customized contents, launch Pi, open a
database, or contact the embedding server. Setup also needs neither Pi nor an LLM.
The installed extension uses `node_modules/.bin/memory-cli` in Pi's initial working
directory. Keep the npm dependency installed. Configure the database and embedding
endpoint as below before using memory; actual recall and capture require embeddings.
Session capture can retain private conversation content; see the
[Pi integration instructions](.pi/skills/agent-memory/pi.md).

Run `npm run test:package` to build a real tarball and verify installation in an
isolated temporary consumer (npm dependency installation may require network access).

## Explicit project memories

Save selected long-term context separately from indexed documents, manually or through an autonomous agent:

```bash
memory-cli remember "Preserve deterministic tie-breaking" --scope project --project reversi
memory-cli memories list --project reversi
memory-cli memories get <id>
memory-cli memories update <id> "Updated memory content"
memory-cli memories forget <id>
memory-cli search "tie-breaking"
```

Memory commands return JSON. Use the UUID returned by `remember` as `<id>`.
Only project scope is supported; a project identifier is required and is never
inferred from the working directory. Lists are project-isolated. Semantic search
without `--project` searches all projects and documents in the selected database.
Use `memory-cli search "tie-breaking" --project reversi --limit 5` to search only
explicit memories and indexed documents associated with `reversi`. Documents must
have an exact, case-sensitive top-level `metadata.project` value (set at indexing
with `--metadata '{"project":"reversi"}'`); records without project metadata are
excluded. Project filtering happens before nearest-neighbor selection, so `--limit`
applies to matching records only. This is a retrieval filter, not access control.
Explicit search
results carry `metadata.kind: "explicit"`, `memoryId`, `scope`, and `project`.

Memories preserve Unicode, multiline content, creation time and identity on update.
Whitespace-only content and malformed IDs are rejected. Getting a missing UUID
returns `null`; updating it fails; forgetting it succeeds repeatedly. Updates
replace the embedding atomically after successful embedding generation. Memories
use the configured database and embedding model; incompatible index configuration
is rejected. Document indexing never creates memories, and `forget --source`
remains document-only. Global options such as `--db` apply to these commands too.

### Autonomous agent memory (Pi)

The [agent-memory Skill](.pi/skills/agent-memory/SKILL.md) guides selective recall,
remembering and reconciliation across programming, research, planning, writing and
other tasks, without requiring users to request each memory. Preferences,
hypotheses and open questions can be retained with uncertainty in ordinary content;
there is no new schema or classification system.

[Pi setup](.pi/skills/agent-memory/pi.md) keeps executable/configuration details
separate from that policy. Pi retains its existing `basename(ctx.cwd)` project
identifier as a memory namespace, even for non-software workspaces. Equal directory
basenames collide; identifiers and existing data are not migrated. Only project
scope is supported, not global preferences or cross-namespace recall. The existing
session extension continues episodic indexing independently of explicit selection.
See the [manual acceptance scenarios](.pi/skills/agent-memory/acceptance.md) for
cross-domain behavior checks; automated storage tests do not prove agent judgment.

## Inspect inventory and activity

```bash
memory-cli dashboard
memory-cli dashboard --project reversi
memory-cli dashboard --json
memory-cli stats
memory-cli traces --limit 30 --project reversi
memory-cli traces --operation search --since 2026-01-01T00:00:00Z --json
memory-cli traces --follow
memory-cli traces --cleanup-before 2026-01-01T00:00:00Z
```

The dashboard is a read-only snapshot: run it again to refresh. It adapts to terminal
width, colors its heading only on a TTY, and respects `NO_COLOR`. JSON never contains
ANSI formatting. `stats` preserves `documentsDb` and `documents` and adds an
`observability` object. `dashboard --json` returns that object's project-filtered
inventory. `traces --json` emits one event per line (also with `--follow`); follow
polls every second, printing only new sequence numbers. Stop with Ctrl-C. Trace
filters accept exact project/operation names and inclusive ISO `--since`/`--until`.
Limits must be positive integers (maximum 10,000).

Example dashboard:

```text
MEMORY · local overview
────────────────────────────────────────
Memories 12 · Sessions 4
Documents 9 · Chunks 48

ACTIVITY · last 24h
Reads 18 · Writes 5 · Failures 1
Average 84ms
```

### Local traces and attribution

Operations recorded: `search`, `remember`, `memories update`, `memories forget`,
`index`, and `forget --source`. Dry runs are not recorded. Events live in
`operation_traces` in the same SQLite database, with an increasing `sequence`, UUID
`id`, UTC `timestamp`, `operation`, `status` (`success`/`failure`), nullable `project`,
`actor`, nullable `session`, `durationMs`, `count`, and `memoryIds` (explicit UUIDs).
Counts describe search results, indexed chunks, or explicit memory mutation requests;
source deletion counts are measured before deletion when available (`null` otherwise). Repeated explicit forget requests
can succeed without removing a record. Failed operations have count zero.
Directory indexing produces one aggregate event. Failures do not include error
messages: these can contain private input. CLI argument parsing failures occur
before application instrumentation and are not traced.

Set context explicitly in the invoking process:

```bash
MEMORY_CLI_ACTOR=my-agent MEMORY_CLI_SESSION=session-42 \
  memory-cli search "tie-breaking" --project reversi
```

Without context, actor is `unknown` and session is `null`; CLI invocation does not
imply Pi. Project comes from the command/index metadata or the existing explicit
memory for update/forget; source deletion uses matching document metadata when it identifies a single project. An unfiltered search has no project attribution even if
its results span projects. The Pi session-indexing extension supplies actor `pi`
and the session file basename (without `.jsonl`) as session context. The CLI does
not depend on Pi.

Traces never contain queries, prompts, contents, embeddings, or error text. Treat
project, actor and session identifiers as public labels: do not supply secrets in
them. Telemetry write failures do not change primary operation results. Traces
retain at most the latest 10,000 events automatically; cleanup deletes only traces,
never memories or documents. There is no external telemetry service.

Statistics show inventory, per-project memory/chunk/activity counts, last-24-hour
reads/writes, successes/failures and average duration, recent operations, failures
and operations taking at least one second. Episodic sessions are distinct
`originalSession` metadata values on documents with `type: session`. Documents
are distinct stored sources; chunks are document rows, excluding explicit memories.
Frequently retrieved and never-retrieved explicit memories are based only on
retained successful search events, not lifetime usage or confirmed usefulness.
Historical operations before instrumentation are unknown. Inventory is current;
activity is bounded by retention. Dashboard sections truncate long lines in narrow
terminals; use JSON for complete identifiers. Live dashboard refresh, navigation,
error diagnostics and lifetime counters are deferred.

## Install the packaged CLI

Requires Node.js 20 or newer. Build a local tarball (nothing is published):

```bash
pnpm install
npm pack
# In a separate consumer project:
npm install /absolute/path/to/rfranr-memory-cli-1.0.0.tgz
```

The package contains compiled ESM JavaScript and runtime dependencies only; no
TypeScript loader, source checkout, Pi, or other agent is needed. The executable
is `memory-cli` (`rag-cli` remains an alias). From any working directory, use the
absolute path to the consumer's `node_modules/.bin/memory-cli`, or add that
consumer's `node_modules/.bin` to `PATH`:

```bash
export PATH="/absolute/path/to/consumer/node_modules/.bin:$PATH"
export RAG_CLI_EMBEDDING_PROVIDER=ollama
export RAG_CLI_EMBEDDING_URL=http://localhost:11434/api/embed
export RAG_CLI_EMBEDDING_MODEL=bge-m3
export RAG_CLI_EMBEDDING_DIMENSIONS=1024
cd /tmp
memory-cli index 'A document to remember'
memory-cli search 'remember'
memory-cli find --text 'document'
memory-cli stats
```

Ollama is an external service: install/start it and pull the configured model
separately. This package does not bundle or start it. Model/provider/dimension
metadata mismatches are rejected; choose a separate database to change models.

Without `--db` or `RAG_CLI_DB`, the database defaults to:

- Linux: `$XDG_DATA_HOME/memory-cli/rag.sqlite` (absolute XDG path only), or
  `~/.local/share/memory-cli/rag.sqlite`.
- macOS: `~/Library/Application Support/memory-cli/rag.sqlite`.
- Windows: `%LOCALAPPDATA%/memory-cli/rag.sqlite` (home-directory fallback).

Parent directories are created automatically. Existing repository databases are
not discovered, overwritten, or migrated: pass `--db /path/to/existing.sqlite`
or set `RAG_CLI_DB` to keep using one. Relative input and database paths are
relative to the caller's working directory. Existing `INIT_CWD` file fallback is
retained for package-manager invocations. Environment variables take precedence
over the caller's `.env`; `--env-file /absolute/path/to/.env` selects another file.
Export configuration to use the same settings across directories.

`sqlite3` and `sqlite-vec` require native platform binaries. Unsupported platforms
may need a compiler/Python toolchain for sqlite3 and a supported sqlite-vec binary;
installation is not guaranteed on every OS/architecture.

## Source development setup

Install dependencies:

```bash
pnpm install
```

Configure `.env`:

```bash
RAG_CLI_DB=./rag.sqlite
RAG_CLI_EMBEDDING_PROVIDER=llama.cpp
RAG_CLI_EMBEDDING_URL=http://localhost:8080/embedding
RAG_CLI_EMBEDDING_MODEL=granite-embedding-107m-multilingual
RAG_CLI_EMBEDDING_DIMENSIONS=384
```

For llama.cpp, use an endpoint accepting `POST /embedding`. For Ollama, configure:

```dotenv
RAG_CLI_EMBEDDING_PROVIDER=ollama
RAG_CLI_EMBEDDING_URL=http://localhost:11434/api/embed
RAG_CLI_EMBEDDING_MODEL=bge-m3
RAG_CLI_EMBEDDING_DIMENSIONS=1024
```

The configured model must be available in Ollama (for example, run `ollama pull bge-m3`).
Indexing sends sequential batches of at most 8 chunks to Ollama's `/api/embed`
endpoint. Other providers retain sequential single-input requests, including
`POST /embedding`. Search continues to use a single query embedding. Batch results
must contain one non-empty, finite vector per input, in input order. Embedding
failures write no partial document and leave the previous indexed version intact.
See [batching measurements](docs/embedding-batching.md) for local benchmark results.
Requests use the configured URL unchanged. Ollama requests send `model` and `input`
and read the first vector from `embeddings`; llama.cpp request and response formats
remain supported.

## Basic usage

### 1. Index a text, file, or URL

```bash
pnpm run start index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index assets/docs/doc.txt --dry-run --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index https://example.com/article --metadata '{"url":"https://example.com/article"}'
```

This splits the document into chunks and stores each chunk in the documents database with:

- chunk embedding
- user metadata
- chunk metadata such as `chunkIndex`, `chunkCount`, `chunkStart`, and `chunkEnd`

Example output:

```json
{
  "chunks": 3,
  "ids": [1, 2, 3]
}
```

Repeating `index` for unchanged content returns `{"chunks":0,"ids":[]}` without
embedding again. Files are identified by their absolute real path (including symlink
resolution), URLs by their normalized URL, and literal text by its exact value.
Changed content at the same source atomically replaces its tracked chunks and vectors;
failed updates preserve the previous version. Metadata-only changes are skipped too.
Renaming a file or changing literal text creates a new document identity.

Existing chunks from older versions are retained, not automatically adopted or removed.
The first indexing after upgrading creates a tracked version alongside any legacy
chunks; subsequent updates replace only that tracked version. Back up existing databases
before any manual cleanup of legacy duplicates.

Use `index --dry-run` to validate, chunk, and embed the input without inserting
chunks. An existing database is opened to check tombstones; a missing database is
not created. Only the embedding service is required when no database exists. JSON output includes
`dryRun: true`, the chunk count, empty `ids`, and prepared `documents` with source,
content, embeddings, and metadata. No taxonomy initialization is needed.

To permanently exclude a source from the selected database:

```bash
memory-cli forget --source /path/to/document.txt
```

This atomically removes its chunks, vectors, and version entry and persists a
tombstone. The source file is not deleted. Repeating the command is safe. Ordinary
indexing, including changed content, dry runs, and recursive directory indexing
(`memory-cli index /path/to/directory`), returns
`{"chunks":0,"ids":[],"skipped":"forgotten","identity":"file:/path/to/document.txt"}`
for excluded documents without calling the embedding service. Directory results
include a `results` array for individual files.

Forgetting uses the same identity rules as indexing: keep a file available at its
original path when forgetting it. Renamed files and changed literal text are distinct
identities. Tombstones apply only to the selected database; there is no restore command.
This is logical deletion, not secure erasure of SQLite free pages, backups, or copies.

### 2. Search indexed documents

```bash
pnpm run start search "Microsoft BASIC" --limit 5
```

Search embeds the query and retrieves document chunks using sqlite-vec KNN,
sorted by descending cosine similarity. Each result includes `id`, `source`,
`content`, top-level `metadata` (all user and chunk metadata), and `score`.

### 3. Inspect database stats

```bash
pnpm run start stats
```

Or:

```bash
pnpm run start inspect
```

This prints `documentsDb` and `documents: { chunks, sources }`.

### 4. Find indexed chunks by filter

```bash
pnpm run start find --file machinelearning
pnpm run start find --text pipeline
```

You can combine filters and control pagination with `--limit` and `--offset`.

## Compatibility

Taxonomy classification has been removed: `categories sync`, `classify`,
`--categories-db`, `RAG_CLI_CATEGORIES_DB`, and `find --category` are no longer used.
Results and dry-run documents now expose `metadata` directly, not `taxonomy.metadata`.
Category distribution and synchronization counts are no longer returned by stats.

Existing document databases work without rebuilding: IDs, source references,
content, metadata, embeddings, and vector rows are retained. Legacy classification
columns and indexes remain untouched; new rows in legacy tables use empty strings
for required classification columns. Old classification scores remain in stored
metadata; the application does not interpret them. New databases have no classification
columns or indexes. Embedding identity/dimension validation is unchanged.

No automatic migration, deletion, or re-embedding occurs. Separate category database
files and user taxonomy YAML files are never opened or removed. You may retain them
as archives. If you want a clean schema, back up the original database and explicitly
index your source documents into a new `--db` path; keep the original until you have
verified retrieval. Re-indexing appends chunks, so avoid doing it into the original
unless duplicates are intended.

Historical ADRs describe earlier decisions; taxonomy-specific portions are superseded
by this simplified flow.

## Build

```bash
pnpm run build
```
