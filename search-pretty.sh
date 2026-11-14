#!/bin/bash

QUERY="$*"

NODE_NO_WARNINGS=1 node --loader ts-node/esm src/index.ts search "$QUERY" \
  | jq -r '.[] | select(.score >= 0.35) | "
====================
score: \(.score)
#source: \(.source)
chunk: \(.metadata.chunkIndex + 1)/\(.metadata.chunkCount)

\(.content)
"' | less -R

#source: \(.source | split("/") | .[-1])

