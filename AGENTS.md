# RAG-CLI Project Instructions

RAG-CLI is a TypeScript command-line tool for local taxonomy-based classification, document indexing, and semantic search using embeddings.

## Source of truth

`categories.yml` is the source of truth for categories.

- The user owns and defines this taxonomy file.
- Example: `assets/taxonomy/categories.yml`.
- The application must follow the YAML format used by that file.
- Categories are not invented by the system; they come from the user taxonomy.

Think of the project folders as:

```text
assets/taxonomy -> user-defined categories/taxonomy source of truth
assets/docs     -> texts, paragraphs, or documents the user wants to index/query
```

## Databases

RAG-CLI uses two logical databases/indexes.

### 1. Categories database

Purpose: store embeddings for the user-defined taxonomy categories.

Population flow:

```bash
rag-cli categories sync assets/taxonomy/categories.yml
```

This command:

1. Reads the user-provided `categories.yml` file.
2. Creates an embedding for every taxonomy/category entry.
3. Upserts those category embeddings and taxonomy metadata into the categories database.

Important: do not classify documents by passing `--taxonomy` to `classify`. The taxonomy is synced first, then reused from the categories database.

### 2. Documents database

Purpose: store searchable user content.

With the `index` command, the user provides a paragraph, string, or text document plus arbitrary metadata.

```bash
rag-cli index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
```

Indexing behavior:

1. Accept a paragraph/string/text document.
2. Accept metadata from the user.
3. Classify the content using the already-synced category embeddings from the categories database.
4. Store the content embedding in the documents database.
5. Store metadata with the indexed content.

Stored document metadata should include:

- selected category id/path/description
- classification score
- user-provided location metadata, for example filename, URL, section, page, or anything else

## Optional classification check

A classify command may classify a text/file against the existing categories database:

```bash
rag-cli classify assets/docs/doc.txt
```

It must not require `--taxonomy`; taxonomy loading belongs to `categories sync`.

## Query/search behavior

When the user queries the system:

1. Embed the query text.
2. Search the documents database, not the categories database.
3. Return the highest scoring paragraphs/document texts.
4. Include all stored metadata in results.

Search results should return content plus metadata such as:

- category
- taxonomy path
- filename
- URL
- location
- any other user-provided metadata

## Existing capabilities to preserve

- Use `POST /embedding` to create embeddings.
- Persist embeddings and metadata locally.
- Return results sorted from highest similarity score to lowest score.

## Technical dependencies

- TypeScript
- SQLite and/or sqlite-vec
- Bundled CLI output

## Development requirements

- Inspect `./src` for comments and existing conventions before changing code.
- Keep the CLI focused on local-first taxonomy classification, indexing, and semantic search.
- Add tests for new features and functionality. 
- Update documentation in the README.md when necessary.

## Adopted development environment

- Preserve pnpm, Vitest, TypeScript configuration, public APIs, and existing test assertions.
- Keep implementations readable and cohesive. Prefer descriptive names and explicit state ownership; avoid abstractions or fragmentation introduced only to satisfy metrics.
- After changes, run `pnpm format`, then `pnpm check:report`. The latter runs every check independently and retains failures.
- `pnpm check` is the blocking gate: formatting, lint, tests, typecheck, build, and dependency-cycle analysis. Lint warnings are advisory, not errors.
- Cognitive, TypeScript metrics, and structural reports are informational. Failure to execute any check or report is blocking. Review and report findings even when a command exits zero.
- Do not weaken thresholds, disable rules, add suppressions, or change tests merely to obtain passing checks. Report blockers and request approval for substantive refactoring outside the task scope.
- Do not install dependencies or change the environment without approval. Never install global packages or Skills; never modify the source template from this repository.
- Project Pi packages are declared in `.pi/settings.json`. Review them before granting project trust. Use `pnpm agent` for pnpm-compatible Lens feedback; its adapter is confined to the daemon, and the launcher restarts this project's shared daemon. Read a matching Skill's `SKILL.md` before use; preserve bundled Skills and their supporting files.
- For development commands, Skill setup, coverage, and known integration limitations, see [README.md](README.md#development) and [the adoption record](docs/development-environment-adoption.md).
- Completion reports must distinguish executed verification from assumptions, list blockers separately from advisory findings, and include cognitive totals/maximum and test/build results.