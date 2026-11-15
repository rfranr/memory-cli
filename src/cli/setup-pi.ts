import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const resources = ['skills/agent-memory', 'extensions/session-memory.ts'];

function resourceFiles(relative: string): string[] {
  const source = join(packageRoot, '.pi', relative);

  if (!lstatSync(source).isDirectory()) {
    return [relative];
  }

  return readdirSync(source)
    .sort()
    .flatMap((name) => resourceFiles(`${relative}/${name}`));
}

function safeDestination(relative: string): string {
  let current = process.cwd();

  for (const part of ['.pi', ...relative.split('/')]) {
    current = join(current, part);

    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing symbolic link: ${current}`);
    }
  }

  return current;
}

async function approve(path: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });

  try {
    return /^y(es)?$/i.test((await prompt.question(`Overwrite ${path}? [y/N] `)).trim());
  } finally {
    prompt.close();
  }
}

function describeCopy(target: string, present: boolean): void {
  console.log(`${present ? 'Would ask to overwrite' : 'Would install'}: ${target}`);
}

async function installFile(relative: string, dryRun: boolean): Promise<void> {
  const target = safeDestination(relative);
  const content = readFileSync(join(packageRoot, '.pi', relative));
  const present = existsSync(target);

  if (present && readFileSync(target).equals(content)) {
    console.log(`Unchanged: ${target}`);

    return;
  }
  if (dryRun) {
    describeCopy(target, present);

    return;
  }
  if (present && !(await approve(target))) {
    console.log(`Preserved: ${target}`);

    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, { flag: copyFlag(present) });
  console.log(`Installed: ${target}`);
}

function copyFlag(present: boolean): 'w' | 'wx' {
  return present ? 'w' : 'wx';
}

function checkInstallation(files: string[]): void {
  const missing = files.filter((relative) => !existsSync(safeDestination(relative)));
  const cli = resolve('node_modules/.bin/memory-cli');
  const result = spawnSync(cli, ['--version'], { encoding: 'utf8' });

  for (const relative of missing) {
    console.error(`Missing: .pi/${relative}`);
  }
  console.log(`Project CLI: ${cli} (${result.status === 0 ? 'available' : 'unavailable'})`);

  if (missing.length || result.status !== 0) {
    process.exitCode = 1;
  }
}

export function registerPiSetup(program: Command): void {
  program
    .command('setup')
    .description('Install optional integrations')
    .command('pi')
    .description('Install Pi Skill and session extension in the current project')
    .option('--dry-run', 'Preview changes without writing files')
    .option('--check', 'Check installed resources and project-local CLI without opening a database')
    .action(async (options: { dryRun?: boolean; check?: boolean }) => {
      const files = resources.flatMap(resourceFiles);

      if (options.check) {
        checkInstallation(files);

        return;
      }

      for (const file of files) {
        await installFile(file, Boolean(options.dryRun));
      }
    });
}
