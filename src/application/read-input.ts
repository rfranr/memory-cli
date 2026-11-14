import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function readInput(input: string): Promise<string> {
  const filePath = resolveReadablePath(input);

  if (filePath) {
    return readFile(filePath, 'utf8');
  }

  if (isHttpUrl(input)) {
    const response = await fetch(input);

    if (!response.ok) {
      throw new Error(`Unable to fetch URL content: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  return input;
}

function resolveReadablePath(input: string): string | undefined {
  const candidates = [input];

  const initCwd = process.env.INIT_CWD;

  if (initCwd) {
    candidates.push(resolve(initCwd, input));
  }

  for (const candidate of candidates) {
    if (isReadableFile(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function isReadableFile(candidate: string): boolean {
  if (!existsSync(candidate)) {
    return false;
  }

  const stat = statSync(candidate);

  if (stat.isDirectory()) {
    throw new Error(`Input path is a directory, expected a file: ${candidate}`);
  }

  return stat.isFile();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
