import { parseArgs } from 'node:util';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = fileURLToPath(new URL('..', import.meta.url));
const repeated = { type: 'string', multiple: true, default: [] };

export function parseOptions(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      root: { type: 'string' },
      input: repeated,
      'node-files': repeated,
      'browser-files': repeated,
      'eslint-config': { type: 'string' },
      'prettier-config': { type: 'string' },
      'dependency-config': { type: 'string' },
      tsconfig: { type: 'string' },
      'package-manager': { type: 'string' },
      script: repeated,
    },
  });

  if (values.help) {
    return { help: true };
  }

  if (!values.root || positionals.length !== 1) {
    throw new Error('Provide one command and --root <project-directory>. See --help.');
  }

  validateCommand(positionals[0]);

  const root = path.resolve(values.root);
  const options = {
    root,
    command: positionals[0],
    inputs: values.input,
    nodeFiles: values['node-files'],
    browserFiles: values['browser-files'],
    eslintConfig: optionalPath(root, values['eslint-config']),
    prettierConfig: path.resolve(root, values['prettier-config'] ?? path.join(skillRoot, 'config/prettier.json')),
    dependencyConfig: path.resolve(
      root,
      values['dependency-config'] ?? path.join(skillRoot, 'config/dependency-cruiser.cjs'),
    ),
    tsconfig: optionalPath(root, values.tsconfig),
    packageManager: values['package-manager'],
    scripts: values.script,
  };

  validateInputs(options);

  return options;
}

function validateCommand(command) {
  const commands = [
    'format',
    'format:check',
    'lint',
    'cognitive',
    'dependencies',
    'structure',
    'metrics',
    'metrics:html',
    'verify',
    'check:report',
  ];

  if (!commands.includes(command)) {
    throw new Error(`Unknown command: ${command}. See --help.`);
  }
}

function optionalPath(root, filename) {
  return filename ? path.resolve(root, filename) : undefined;
}

function validateProjectInput(root, input) {
  const relative = path.relative(root, path.resolve(root, input));

  if (invalidRelativeInput(relative)) {
    throw new Error('Inputs must be paths inside the project root, not the root itself.');
  }

  statSync(path.resolve(root, input));
}

function invalidRelativeInput(relative) {
  return relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function validateInputs(options) {
  if (!statSync(options.root).isDirectory()) {
    throw new Error('Project root must be a directory.');
  }

  if (options.command !== 'verify' && options.inputs.length === 0) {
    throw new Error('Provide at least one --input <directory-or-file>.');
  }

  for (const input of options.inputs) {
    validateProjectInput(options.root, input);
  }
}
