import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { URL, fileURLToPath } from 'node:url';
import { analyze } from './analyze.mjs';

const fixture = new URL('./fixtures/sample.ts', import.meta.url);

test('TypeScript fixture provides functions, ownership, imports and writes', () => {
  const report = analyze(readFileSync(fixture, 'utf8'), 'sample.ts');

  assert.equal(report.hasParseErrors, false);
  assert.deepEqual(
    report.functions.map((entry) => entry.name),
    ['record', 'normalize'],
  );
  assert.equal(report.functions[1].enclosingFunction, `record:${report.functions[0].startLine}`);
  assert.equal(report.imports[0].source, "'./storage'");
  assert.equal(report.writes[0].target, 'total');
  assert.equal(report.writes[0].owner, `record:${report.functions[0].startLine}`);
});

test('JavaScript, JSX and TSX grammars parse representative syntax', () => {
  for (const extension of ['js', 'mjs', 'cjs', 'jsx']) {
    const report = analyze('export const View = () => <div />;', `sample.${extension}`);

    assert.equal(report.hasParseErrors, false);
    assert.equal(report.functions[0].name, 'View');
  }

  for (const extension of ['ts', 'mts', 'cts', 'tsx']) {
    const source =
      extension === 'tsx'
        ? 'export const View = (x: number) => <div>{x}</div>;'
        : 'export const value = (x: number): number => x;';

    assert.equal(analyze(source, `sample.${extension}`).hasParseErrors, false);
  }
});

test('parse errors and unsupported extensions are explicit', () => {
  const report = analyze('function broken( {', 'broken.js');

  assert.equal(report.hasParseErrors, true);
  assert.ok(report.parseIssues.length > 0);
  assert.throws(() => analyze('print(1)', 'sample.py'), /Unsupported extension/);
});

test('CLI emits JSON and rejects missing input', () => {
  const script = new URL('./analyze.mjs', import.meta.url);
  const result = spawnSync('node', [fileURLToPath(script), fileURLToPath(fixture)], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout)[0].functions.length, 2);
  assert.equal(spawnSync('node', [fileURLToPath(script)]).status, 1);
});
