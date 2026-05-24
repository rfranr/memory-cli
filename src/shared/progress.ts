export interface ProgressReporter {
  start(total: number): void;
  update(current: number, total: number): void;
  done(total: number): void;
}

export const noopProgressReporter: ProgressReporter = {
  start() {},
  update() {},
  done() {},
};

export function createStderrProgressReporter(label: string): ProgressReporter {
  let current = 0;
  let total = 0;

  return {
    start(nextTotal: number) {
      current = 0;
      total = nextTotal;
      writeProgress(label, current, total);
    },
    update(nextCurrent: number, nextTotal: number) {
      current = nextCurrent;
      total = nextTotal;
      writeProgress(label, current, total);
    },
    done(nextTotal: number) {
      current = nextTotal;
      total = nextTotal;
      writeProgress(label, current, total);
      process.stderr.write("\n");
    },
  };
}

function writeProgress(label: string, current: number, total: number): void {
  process.stderr.write(`\r${label}: ${current}/${total}`);
}
