---
name: project-memory
description: Recover context from previous development sessions using memory-cli. Use when continuing past work, reviewing decisions, avoiding repeated experiments, or investigating why something was implemented.
---

# Project memory

Use `memory-cli` to consult previous development sessions.

## Configuration

- CLI: `./node_modules/.bin/memory-cli`
- Database: environment variable `RAG_CLI_DB`
- Run commands from the project root.
- If the CLI or database is unavailable, report the problem. Do not create a new index.

## Search

```bash
./node_modules/.bin/memory-cli search "relevant technical question" --limit 5
```

Use additional focused searches when needed.

## Rules

- Consult memory when historical context is relevant, not for every task.
- Search before repeating experiments or revisiting earlier technical decisions.
- Distinguish proposals, rejected options, user-approved decisions and implemented changes.
- Check chronology: later decisions may supersede earlier ones.
- Memory is historical evidence, not the current source of truth.
- Verify current state against code, tests and maintained documentation.
- Cite relevant session sources when explaining historical decisions.
- Be concise. Summarize relevant findings in at most 10 lines unless the user requests detail.
- Do not create journals or Markdown files merely to preserve session history.
- Never modify or delete memory without explicit authorization.

## Retrieval strategy

- For historical questions, search memory first. Do not inspect the repository unless the user requests verification or the memory is insufficient.
- When comparing changes across sessions, retrieve evidence for each change separately and reconstruct their chronological order.
- Never combine benchmark results from different sessions or baselines without explaining the distinction.
- Prefer 1–3 focused searches. Expand only if necessary.
- Answer concisely with source references. Report uncertainty rather than filling gaps.

## Scope

This Skill is read-only.

Session indexing is handled separately. Explicit memories, global memories and forgetting are not yet implemented.