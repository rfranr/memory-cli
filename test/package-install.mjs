import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stdout + result.stderr);

  return result.stdout;
}

test('real tarball installs independently with optional Pi resources', () => {
  const root = mkdtempSync(join(tmpdir(), 'memory-package-'));
  const consumer = join(root, 'consumer');

  try {
    run('npm', ['pack', '--pack-destination', root], resolve('.'));
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), '{"private":true}');
    run('npm', ['install', '--no-audit', '--no-fund', join(root, 'rfranr-memory-cli-1.0.0.tgz')], consumer);
    const cli = join(consumer, 'node_modules/.bin/memory-cli');
    const invoke = (...args) => run(cli, args, consumer);

    assert.match(invoke('--version'), /1\.0\.0/);
    invoke('setup', 'pi', '--dry-run');
    assert.equal(existsSync(join(consumer, '.pi')), false);
    mkdirSync(join(consumer, '.pi/skills/other'), { recursive: true });
    mkdirSync(join(consumer, '.pi/extensions'), { recursive: true });
    const unrelated = join(consumer, '.pi/extensions/other.ts');

    writeFileSync(unrelated, 'untouched');
    invoke('setup', 'pi');
    invoke('setup', 'pi', '--check');
    const skill = join(consumer, '.pi/skills/agent-memory/SKILL.md');
    const extension = join(consumer, '.pi/extensions/session-memory.ts');

    assert.match(readFileSync(skill, 'utf8'), /name: agent-memory/);
    // Execute the actual installed resolver, without Pi or its type-only imports.
    const code = ts.transpileModule(readFileSync(extension, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    const probe = join(consumer, 'probe.mjs');

    writeFileSync(probe, `${code}\nconst cli = resolveMemoryCli(process.cwd());\nconsole.log(JSON.stringify(cli));`);
    const resolved = JSON.parse(run(process.execPath, [probe], consumer));

    assert.equal(resolved.command, cli);
    assert.match(run(resolved.command, [...resolved.args, '--version'], consumer), /1\.0\.0/);
    writeFileSync(skill, 'custom skill');
    writeFileSync(extension, 'custom extension');
    invoke('setup', 'pi', '--dry-run');
    invoke('setup', 'pi');
    assert.equal(readFileSync(skill, 'utf8'), 'custom skill');
    assert.equal(readFileSync(extension, 'utf8'), 'custom extension');
    assert.equal(readFileSync(unrelated, 'utf8'), 'untouched');
    assert.equal(existsSync(join(consumer, '.pi/skills/other')), true);
    assert.equal(existsSync(join(consumer, 'rag.sqlite')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
