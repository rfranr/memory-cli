import { spawnSync } from 'node:child_process';
import { findPackageJSON } from 'node:module';
import { dirname, resolve } from 'node:path';

export function toolPath(packageName, relative) {
  return resolve(dirname(findPackageJSON(packageName, import.meta.url)), relative);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}
