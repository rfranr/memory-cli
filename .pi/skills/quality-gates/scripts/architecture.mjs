import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { run, toolPath } from './process.mjs';
import { printStructure, projectGraph } from './structure.mjs';

function cruiseArguments(options) {
  const args = ['--config', options.dependencyConfig];

  if (options.tsconfig) {
    args.push('--ts-config', options.tsconfig);
  }

  return args;
}

export function dependencies(options) {
  return run(
    process.execPath,
    [
      toolPath('dependency-cruiser', 'bin/dependency-cruiser.mjs'),
      ...cruiseArguments(options),
      '-T',
      'err',
      ...options.inputs,
    ],
    { cwd: options.root },
  );
}

function projectFilter(options) {
  const selected = options.inputs.map((input) => path.resolve(options.root, input));

  return (filename) => {
    if (!filename || filename.split('/').includes('node_modules')) {
      return false;
    }

    const absolute = path.resolve(options.root, filename);

    return selected.some((input) => absolute === input || absolute.startsWith(`${input}${path.sep}`));
  };
}

export function structure(options) {
  // Structural reporting deliberately has no dependency rules, as in the template.
  const args = ['--no-config', '-T', 'json'];

  if (options.tsconfig) {
    args.push('--ts-config', options.tsconfig);
  }

  const result = spawnSync(
    process.execPath,
    [
      toolPath('dependency-cruiser', 'bin/dependency-cruiser.mjs'),
      ...args,
      '--include-only',
      projectPattern(options),
      ...options.inputs,
    ],
    { cwd: options.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  if (result.error) {
    throw result.error;
  }

  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    return result.status ?? 1;
  }

  printStructure(projectGraph(JSON.parse(result.stdout), projectFilter(options)));

  return 0;
}

function projectPattern(options) {
  const paths = options.inputs.map((input) => {
    const relative = path.relative(options.root, path.resolve(options.root, input)).replaceAll('\\', '/');

    return relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  return `^(?:${paths.join('|')})(?:/|$)`;
}
