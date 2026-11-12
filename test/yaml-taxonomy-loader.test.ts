import { describe, expect, it } from 'vitest';
import { parseTaxonomyYaml } from '../src/infrastructure/taxonomy/yaml-taxonomy-loader.js';

describe('parseTaxonomyYaml', () => {
  it('ignores preamble and keeps example state scoped to each category', () => {
    const categories = parseTaxonomyYaml(`
- id: ignored
categories:
  path: ignored
  - id: 'first'
    path: "User / First" # comment
    examples:
      - "example one"
    description: 'First category'
      - ignored
  - id: second
    path: User / Second
      - ignored
    examples:
      - example two
`);

    expect(categories).toEqual([
      { id: 'first', path: 'User / First', description: 'First category', examples: ['example one'] },
      { id: 'second', path: 'User / Second', description: undefined, examples: ['example two'] },
    ]);
  });

  it('requires the categories header', () => {
    expect(parseTaxonomyYaml('- id: ignored\n  path: ignored')).toEqual([]);
  });

  it('rejects entries without a path', () => {
    expect(() => parseTaxonomyYaml('categories:\n  - id: incomplete')).toThrow(
      'Invalid taxonomy category at index 0: id and path are required',
    );
  });
});
