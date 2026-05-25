#!/bin/bash

DEBUG="${DEBUG:-0}"
MIN_SIZE="${MIN_SIZE:-100k}"

if [ "$DEBUG" = "1" ]; then
  set -uxo pipefail
else
  set -uo pipefail
fi

SOURCE_ROOT="/media/rfranr/8a2e60fb-c9e9-4d23-b8f3-a45a2b01a8a3/share1"
TARGET_ROOT="assets/docs"

find "$SOURCE_ROOT" -type f -iname "*.pdf" -size +"$MIN_SIZE" | while read -r pdf; do
  relative="${pdf#$SOURCE_ROOT/}"
  relative_no_ext="${relative%.pdf}"
  out="$TARGET_ROOT/${relative_no_ext}.txt"

  mkdir -p "$(dirname "$out")"

  echo "Converting: $pdf"
  echo "Output: $out"

  if ! pdftotext "$pdf" "$out"; then
    echo "ERROR converting: $pdf" >&2
    continue
  fi

  echo
  echo "========================================"
  echo "INDEXING DOCUMENT"
  echo "========================================"
  echo "FILE: $out"
  echo "SOURCE PDF: $pdf"
  echo "MIN SIZE: $MIN_SIZE"
  echo "========================================"
  echo

  if ! pnpm run start index "$out" \
    --metadata "{\"fileName\":\"$out\",\"sourcePdf\":\"$pdf\"}"; then
    echo "ERROR indexing: $out" >&2
    echo "SOURCE PDF: $pdf" >&2
    continue
  fi

done