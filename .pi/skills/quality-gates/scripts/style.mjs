import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { qualityConfig } from '../config/eslint.mjs';

export async function lintOptions(options) {
  const configuration = options.eslintConfig
    ? (await import(pathToFileURL(options.eslintConfig).href)).default
    : qualityConfig({ nodeFiles: options.nodeFiles, browserFiles: options.browserFiles });

  // Supplying the config in memory anchors relative file patterns to the project cwd,
  // while imports in the bundled config resolve from the Skill's dependencies.
  return { cwd: options.root, overrideConfigFile: true, overrideConfig: configuration };
}

export async function lint(options) {
  const eslint = new ESLint(await lintOptions(options));
  const results = await eslint.lintFiles(options.inputs);
  const formatter = await eslint.loadFormatter('stylish');

  console.log(formatter.format(results));

  return results.some((result) => result.errorCount > 0) ? 1 : 0;
}

function formattingFiles(options) {
  const patterns = options.inputs.map((input) => {
    if (statSync(path.resolve(options.root, input)).isDirectory()) {
      return `${input.replaceAll('\\', '/')}/**/*.{ts,js,mjs}`;
    }

    return input;
  });

  return [
    ...new Set(
      globSync(patterns, {
        cwd: options.root,
        exclude: ['**/node_modules/**', '**/.git/**'],
      }),
    ),
  ];
}

export async function format(options, write = false) {
  const configuration = JSON.parse(readFileSync(options.prettierConfig, 'utf8'));
  const files = formattingFiles(options);
  const changes = [];

  if (files.length === 0) {
    throw new Error('No formatting inputs matched.');
  }

  for (const file of files) {
    changes.push(await formatFile(path.resolve(options.root, file), configuration, write));
  }

  return changes.includes(true) && !write ? 1 : 0;
}

async function formatFile(filename, configuration, write) {
  const original = readFileSync(filename, 'utf8');
  const formatted = await prettier.format(original, { ...configuration, filepath: filename });

  if (original === formatted) {
    return false;
  }

  console.log(`${write ? 'formatted' : 'unformatted'}: ${filename}`);

  if (write) {
    writeFileSync(filename, formatted);
  }

  return true;
}
