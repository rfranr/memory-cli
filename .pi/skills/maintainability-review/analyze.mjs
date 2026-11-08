import process from 'node:process';
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';

const languages = {
  '.js': JavaScript,
  '.mjs': JavaScript,
  '.cjs': JavaScript,
  '.jsx': JavaScript,
  '.ts': TypeScript.typescript,
  '.mts': TypeScript.typescript,
  '.cts': TypeScript.typescript,
  '.tsx': TypeScript.tsx,
};
const functionTypes = new Set([
  'function_declaration',
  'generator_function_declaration',
  'function_expression',
  'generator_function',
  'arrow_function',
  'method_definition',
]);
const writeTypes = new Set(['assignment_expression', 'augmented_assignment_expression', 'update_expression']);

function location(node) {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}

function functionName(node) {
  const name = node.childForFieldName('name');

  if (name) {
    return name.text;
  }
  if (node.parent?.type === 'variable_declarator') {
    return node.parent.childForFieldName('name').text;
  }

  return '<anonymous>';
}

function writeEvidence(node, owner) {
  const target = node.childForFieldName('left') ?? node.childForFieldName('argument');

  return {
    target: target?.text,
    operator: node.childForFieldName('operator')?.text,
    owner,
    ...location(node),
  };
}

export function analyze(source, filename) {
  const language = languages[extname(filename)];

  if (!language) {
    throw new Error(`Unsupported extension: ${filename}`);
  }
  const parser = new Parser();

  parser.setLanguage(language);
  const tree = parser.parse(source);
  const report = {
    file: filename,
    hasParseErrors: tree.rootNode.hasError,
    functions: [],
    imports: [],
    writes: [],
    parseIssues: [],
  };

  function visit(node, owner) {
    let currentOwner = owner;

    if (functionTypes.has(node.type)) {
      currentOwner = `${functionName(node)}:${node.startPosition.row + 1}`;
      report.functions.push({
        name: functionName(node),
        ...location(node),
        lines: node.endPosition.row - node.startPosition.row + 1,
        enclosingFunction: owner,
      });
    }
    if (node.type === 'import_statement') {
      report.imports.push({
        source: node.childForFieldName('source')?.text,
        ...location(node),
      });
    }
    if (writeTypes.has(node.type)) {
      report.writes.push(writeEvidence(node, currentOwner));
    }
    if (node.type === 'ERROR' || node.isMissing) {
      report.parseIssues.push({ type: node.type, missing: node.isMissing, ...location(node) });
    }

    for (const child of node.children) {
      visit(child, currentOwner);
    }
  }

  visit(tree.rootNode, '<module>');

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const files = process.argv.slice(2);

    if (!files.length) {
      throw new Error('Usage: node analyze.mjs <file> [file ...]');
    }
    const reports = files.map((file) => analyze(readFileSync(file, 'utf8'), file));

    console.log(JSON.stringify(reports, null, 2));

    if (reports.some((report) => report.hasParseErrors)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
