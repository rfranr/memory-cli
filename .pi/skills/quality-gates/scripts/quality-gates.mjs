#!/usr/bin/env node
import { parseOptions } from './options.mjs';

const help = `Usage: node quality-gates.mjs <command> --root <project> [options]

Commands:
  format:check / format   Check formatting / explicitly write formatting.
  lint / cognitive       Enforce ESLint rules / report cognitive scores.
  dependencies           Dependency Cruiser rules (cycles remain warnings).
  structure              Project-owned fan-out, transitive counts and depth.
  metrics / metrics:html tsmetrics text / HTML to stdout.
  verify                 Delegate existing project scripts, stopping on failure.
  check:report           Lint, then verification; always run all advisory reports.

Options:
  --root <directory>           Required project root; no cwd-based discovery.
  --input <directory-or-file>   Repeat for each analyzed path; required except verify.
  --node-files <glob>          Repeat Node runtime bindings, relative to root.
  --browser-files <glob>       Repeat browser runtime bindings (window only).
  --eslint-config <file>       Explicit flat config instead of bundled policy.
  --prettier-config <json>     Explicit Prettier JSON (default: bundled config).
  --dependency-config <file>   Explicit Cruiser config (default: bundled config).
  --tsconfig <file>            Explicit target tsconfig for dependency resolution.
  --package-manager <program>  Existing npm/pnpm/yarn executable for verification.
  --script <name>              Repeat existing scripts in execution order.
  -h, --help                   Show help without loading tooling dependencies.

Relative paths resolve against --root. Inputs are literal paths, not globs.
No target configs or package files are written. Only format writes input files.
Exit 0: successful execution (possibly advisory findings/warnings).
Exit nonzero: blocking findings, missing input/script, or execution failure.
Example:
  node quality-gates.mjs lint --root /work/app --input lib --input spec \\
    --node-files 'lib/**/*.ts' --node-files 'spec/**/*.ts'
`;

async function execute(options) {
  switch (options.command.replace(/:(check|html)$/, '')) {
    case 'format':
      return (await import('./style.mjs')).format(options, options.command === 'format');
    case 'lint':
      return (await import('./style.mjs')).lint(options);
    case 'cognitive':
      return (await import('./cognitive.mjs')).cognitive(options);
    case 'dependencies':
    case 'structure':
      return (await import('./architecture.mjs'))[options.command](options);
    case 'metrics':
      return (await import('./metrics.mjs')).metrics(options, options.command === 'metrics:html');
    case 'verify':
      return (await import('./verify.mjs')).verify(options);
    case 'check:report':
      return report(options);
    default:
      throw new Error(`Unknown command: ${options.command}. See --help.`);
  }
}

async function attempt(options, command) {
  console.log(`\n=== ${command} ===`);

  try {
    return await execute({ ...options, command });
  } catch (error) {
    console.error(error.message);

    return 1;
  }
}

async function report(options) {
  let failed = await attempt(options, 'lint');

  if (failed === 0) {
    failed = await attempt(options, 'verify');
  }

  for (const command of ['cognitive', 'metrics', 'dependencies', 'structure']) {
    const status = await attempt(options, command);

    if (status !== 0) {
      failed = 1;
    }
  }

  return failed;
}

try {
  const options = parseOptions(process.argv.slice(2));

  if (options.help) {
    console.log(help);
  } else {
    process.exitCode = await execute(options);
  }
} catch (error) {
  console.error(`quality-gates: ${error.message}`);
  process.exitCode = 1;
}
