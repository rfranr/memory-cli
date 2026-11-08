#!/bin/sh
# Bootstrap only the Lens daemon with the pnpm adapter; Pi keeps its normal PATH.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PATH="$PWD/scripts/lens-bin:$PATH" node --input-type=module <<'JS'
import { ensureDaemon, stopDaemon } from "./.pi/npm/node_modules/@harms-haus/code-lens/dist/lib-client.js";

// A previously started daemon may have cached a failed npx discovery result.
await stopDaemon(process.cwd());
await ensureDaemon(process.cwd());
JS
exec pi "$@"
