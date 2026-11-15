# Pi memory integration

Run from Pi's initial working directory (`ctx.cwd` in `.pi/extensions/session-memory.ts`), not a subsequently selected subdirectory. Its basename is the existing memory namespace, passed as `--project`. A project can be any workspace, not only a software repository. Do not substitute a package name, branch or absolute path: old sessions and explicit records depend on this identifier. Identical `basename(cwd)` values collide; project filtering is not access control. No migration or global scope is provided.

Resolve the executable exactly as the session extension does:

```bash
# Run in Pi's initial working directory; re-establish variables in each shell call.
PROJECT="$(basename "$PWD")"
if [ -e "$PWD/node_modules/.bin/memory-cli" ]; then
  MEMORY_CLI=("$PWD/node_modules/.bin/memory-cli")
elif [ "$PROJECT" = memory-cli ] && [ -e "$PWD/dist/index.js" ]; then
  MEMORY_CLI=(node "$PWD/dist/index.js")
else
  MEMORY_CLI=(memory-cli)
fi
"${MEMORY_CLI[@]}" --help
```

Keep CLI configuration unchanged: inherited environment overrides working-directory `.env`, then defaults apply. `RAG_CLI_DB` need not be exported. Do not guess `--db`, change directories, override configuration, initialize another index or switch executables on runtime failure. Required embedding configuration still applies; `stats` shows the selected database.

```bash
"${MEMORY_CLI[@]}" search "relevant question" --project "$PROJECT" --limit 5
"${MEMORY_CLI[@]}" memories list --project "$PROJECT"
"${MEMORY_CLI[@]}" memories get "$ID"
"${MEMORY_CLI[@]}" remember 'Working hypothesis; evidence/date; uncertainty; Agent-owned.' --scope project --project "$PROJECT"
"${MEMORY_CLI[@]}" memories update "$ID" 'Updated understanding; evidence/date; what changed; Agent-owned.'
"${MEMORY_CLI[@]}" memories forget "$ID"
```

These are Bash examples; use actual returned IDs and inspect command help as needed. Get/update/forget are ID-based, not project-filtered: verify the returned project and ownership before mutation.

The separate session extension captures user/assistant conversation on `/new` and `/quit`, indexes with `type: session`, `project: basename(ctx.cwd)` and `originalSession`, and preserves CLI/database configuration. It writes text under `~/.local/share/pi-memory/sessions` and CLI diagnostics to `/tmp/pi-memory-index.log`; indexing failures also notify Pi. It does not perform explicit-memory selection or reflection. Session capture can include private conversation content; explicit-memory exclusions do not redact that history.

For explicit operations, preserve inherited `MEMORY_CLI_ACTOR` and `MEMORY_CLI_SESSION`. If actor is absent, prefix the CLI call with `MEMORY_CLI_ACTOR=pi`; supply the session file basename without `.jsonl` only when reliably available from the host, never invent it. The extension supplies both for episodic indexing. Without attribution the CLI records actor `unknown` and session `null`.

Use `dashboard --project "$PROJECT"` and `traces --project "$PROJECT" --json` for inventory/activity when needed, not on every interaction. Traces exclude content and queries; they establish operations, not the quality of autonomous decisions.
