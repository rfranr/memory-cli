import { run, toolPath } from './process.mjs';

export function metrics(options, html = false) {
  const args = ['analyze', ...options.inputs];

  if (html) {
    args.push('--format', 'html');
  }

  return run(process.execPath, [toolPath('tsmetrics', 'bin/tsmetrics.js'), ...args], { cwd: options.root });
}
