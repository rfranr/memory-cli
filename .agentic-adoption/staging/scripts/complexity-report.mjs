
import { ESLint } from "eslint";
import path from "node:path";

const RULE = "sonarjs/cognitive-complexity";

// Analysis-only instance. Override the threshold to 0
// to collect scores instead of just violations.
const analyzer = new ESLint({
  overrideConfig: {
    rules: {
      [RULE]: ["error", 0],
    },
  },
  ruleFilter: ({ ruleId }) => ruleId === RULE,
});

// Separate instance to read actual project thresholds.
const configured = new ESLint();

const results = await analyzer.lintFiles(["src/", "tests/"]);
const rows = [];

for (const result of results) {
  const file = path.relative(process.cwd(), result.filePath);
  const config = await configured.calculateConfigForFile(result.filePath);

  const rule = config?.rules?.[RULE];
  const enabled = rule && rule[0] !== 0;

  if (!enabled) {
    continue;
  }

  const limit = Array.isArray(rule[1])
    ? rule[1][0]
    : (rule[1] ?? 15);

  for (const message of result.messages) {
    if (message.fatal) {
      throw new Error(
        `Analysis failed in ${file}:${message.line}: ${message.message}`,
      );
    }

    if (message.ruleId !== RULE) {
      continue;
    }

    const match = message.message.match(
      /Cognitive Complexity from (\d+) to the \d+ allowed/,
    );

    if (!match) {
      throw new Error(
        `Unexpected SonarJS message in ${file}:${message.line}: ${message.message}`,
      );
    }

    const score = Number(match[1]);

    rows.push({
      file,
      line: message.line,
      score,
      limit,
      status: score > limit ? "FAIL" : "PASS",
    });
  }
}

rows.sort(
  (a, b) =>
    b.score - a.score ||
    a.file.localeCompare(b.file) ||
    a.line - b.line,
);

console.log("\nCognitive Complexity Report");
console.log("=".repeat(65));

if (rows.length) {
  console.table(rows);
} else {
  console.log("No functions with positive complexity found.");
}

const violations = rows.filter((row) => row.score > row.limit);
const total = rows.reduce((sum, row) => sum + row.score, 0);
const average = rows.length ? total / rows.length : 0;
const maximum = Math.max(0, ...rows.map((row) => row.score));

console.log(`Functions with complexity > 0: ${rows.length}`);
console.log(`Total complexity:             ${total}`);
console.log(`Average (positive scores):    ${average.toFixed(2)}`);
console.log(`Maximum score:                ${maximum}`);
console.log(`Violations:                   ${violations.length}`);
console.log(`Status:                       ${violations.length ? "FAIL" : "PASS"}`);

// Complexity violations are informational.
// npm run lint remains the mandatory quality gate.
