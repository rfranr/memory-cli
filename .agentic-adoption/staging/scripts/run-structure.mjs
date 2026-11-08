import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function runStructure(run = spawnSync) {
  const tests = readdirSync('tests')
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `tests/${file}`);
  const cruise = run(
    'npm',
    [
      'exec',
      '--',
      'depcruise',
      '--no-config',
      '--include-only',
      '^(src/|tests/)(?!node_modules/)',
      '-T',
      'json',
      'src/',
      ...tests,
    ],
    { encoding: 'utf8' },
  );

  if (cruise.stderr) {
    process.stderr.write(cruise.stderr);
  }

  if (cruise.error) {
    console.error(cruise.error);

    return 1;
  }

  if (cruise.status !== 0) {
    return cruise.status ?? 1;
  }

  const report = run(process.execPath, ['scripts/structure.mjs'], {
    input: cruise.stdout,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  if (report.error) {
    console.error(report.error);

    return 1;
  }

  return report.status ?? 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runStructure();
}
