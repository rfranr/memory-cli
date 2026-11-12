import { ESLint } from 'eslint';
import path from 'node:path';
import { lintOptions } from './style.mjs';

const RULE = 'sonarjs/cognitive-complexity';

function configuredLimit(configuration) {
  const rule = configuration?.rules?.[RULE];

  if (!rule || rule[0] === 0) {
    return undefined;
  }

  if (Array.isArray(rule[1])) {
    return rule[1][0];
  }

  return rule[1] ?? 15;
}

function scoredMessages(result, root, limit) {
  const file = path.relative(root, result.filePath);
  const rows = [];

  for (const message of result.messages) {
    if (message.ruleId === RULE) {
      rows.push(scoreMessage(message, file, limit));
    }
  }

  return rows;
}

function assertParsed(result, root) {
  const fatal = result.messages.find((message) => message.fatal);

  if (fatal) {
    const file = path.relative(root, result.filePath);

    throw new Error(`Analysis failed in ${file}:${fatal.line}: ${fatal.message}`);
  }
}

function scoreMessage(message, file, limit) {
  const match = message.message.match(/Cognitive Complexity from (\d+) to the \d+ allowed/);

  if (!match) {
    throw new Error(`Unexpected SonarJS message in ${file}:${message.line}: ${message.message}`);
  }

  const score = Number(match[1]);

  return { file, line: message.line, score, limit, status: score > limit ? 'FAIL' : 'PASS' };
}

export function printCognitive(rows) {
  rows.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line);
  console.log('\nCognitive Complexity Report');
  console.table(rows);

  const violations = rows.filter((row) => row.score > row.limit);
  const total = rows.reduce((sum, row) => sum + row.score, 0);
  const average = rows.length ? total / rows.length : 0;
  const maximum = Math.max(0, ...rows.map((row) => row.score));

  console.log(`Functions with complexity > 0: ${rows.length}`);
  console.log(`Total complexity:             ${total}`);
  console.log(`Average (positive scores):    ${average.toFixed(2)}`);
  console.log(`Maximum score:                ${maximum}`);
  console.log(`Violations:                   ${violations.length}`);
  console.log(`Status:                       ${violations.length ? 'FAIL' : 'PASS'}`);
}

export async function cognitive(options) {
  const configuration = await lintOptions(options);
  const configured = new ESLint(configuration);
  const analyzer = new ESLint({
    ...configuration,
    overrideConfig: [configuration.overrideConfig, { rules: { [RULE]: ['error', 0] } }].flat(),
    ruleFilter: ({ ruleId }) => ruleId === RULE,
  });
  const results = await analyzer.lintFiles(options.inputs);
  const rows = [];

  for (const result of results) {
    assertParsed(result, options.root);

    const limit = configuredLimit(await configured.calculateConfigForFile(result.filePath));

    if (limit !== undefined) {
      rows.push(...scoredMessages(result, options.root, limit));
    }
  }

  printCognitive(rows);

  // Findings remain advisory. Execution and parse failures still fail the command.
  return 0;
}
