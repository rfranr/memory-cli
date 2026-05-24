# ADR 0003: Add progress indicators for long-running CLI operations

## Status

Accepted

## Context

RAG-CLI has several long-running operations that can leave the user unsure whether the command is still working:

- syncing categories from YAML
- embedding many categories
- indexing a document with chunking
- embedding and classifying each chunk

Right now, the CLI prints only the final result, so large inputs can feel like the process is stuck.

This is especially relevant for:

- taxonomy sync over many category entries
- indexing documents split into multiple chunks
- slow embedding endpoints

## Decision

Add a progress indicator for long-running operations.

The progress indicator should be shown for:

1. `rag-cli categories sync <taxonomy-file>`
2. `rag-cli index <input> --metadata ...`

## Expected behavior

### Categories sync

While syncing categories:

- show progress while iterating taxonomy entries
- indicate how many categories have been embedded/upserted
- keep the final summary output at the end

### Document indexing

While indexing a document:

- show progress while chunks are being embedded and classified
- indicate how many chunks have been processed
- keep the final JSON result at the end

## Constraints

- Keep stdout JSON output valid for the final result.
- Do not mix progress text into the final JSON payload.
- Prefer writing progress to stderr or using a TUI/progress component that does not break machine-readable output.
- Keep the implementation minimal and dependency-light.

## Consequences

Positive:

- Better UX for long-running commands.
- Clearer feedback for slow embedding or large documents.
- Users can see that the CLI is actively working.

Negative:

- Adds UI complexity.
- Requires care to avoid breaking JSON output.
- Might need a small progress helper shared by commands.

## Implementation notes

Possible approaches:

- simple stderr progress messages like `Processed 3/12`
- a lightweight spinner/progress bar
- a shared helper used by both sync and indexing flows

A good first implementation would be simple and compatible with the existing CLI output.
