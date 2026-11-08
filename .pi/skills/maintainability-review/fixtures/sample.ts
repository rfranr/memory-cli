import { save } from './storage';

let total = 0;

export function record(value: number) {
  const normalize = (input: number) => Math.max(0, input);

  total += normalize(value);
  save(total);

  return total;
}
