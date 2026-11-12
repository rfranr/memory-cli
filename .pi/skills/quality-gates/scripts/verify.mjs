import { readFileSync } from 'node:fs';
import path from 'node:path';
import { run } from './process.mjs';

export function verify(options) {
  if (!options.packageManager || options.scripts.length === 0) {
    throw new Error('verify requires --package-manager and at least one --script. No commands are inferred.');
  }

  validateScripts(options);

  for (const script of options.scripts) {
    const status = run(options.packageManager, ['run', script], { cwd: options.root });

    if (status !== 0) {
      return status;
    }
  }

  return 0;
}

function validateScripts(options) {
  const manifest = JSON.parse(readFileSync(path.join(options.root, 'package.json'), 'utf8'));

  // Validate every requested script before executing any project command.
  for (const script of options.scripts) {
    if (!Object.hasOwn(manifest.scripts ?? {}, script)) {
      throw new Error(`Project script does not exist: ${script}`);
    }
  }
}
