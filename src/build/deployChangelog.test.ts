import { describe, expect, it } from 'vitest';
import { commitLines, deployChangelog } from './collateChangelog';

const entry = (version: string, ...changes: string[]) => ({ version, changes });

describe('commitLines', () => {
  it('returns the subjects oldest first', () => {
    expect(commitLines(['second', 'first'])).toEqual(['first', 'second']);
  });

  it('drops merge commits and internal prefixes, with or without a scope', () => {
    const subjects = [
      'Merge branch x',
      'chore: bump',
      'docs(readme): fix',
      'Test: more',
      'refactor!: move',
      'ci: cache',
      'WIP: x',
      'Add Unlock button',
    ];
    expect(commitLines(subjects)).toEqual(['Add Unlock button']);
  });

  it('keeps player-facing subjects that merely contain an internal word', () => {
    expect(commitLines(['Docs are now shown in the tip', 'Chores tab added'])).toEqual([
      'Chores tab added',
      'Docs are now shown in the tip',
    ]);
  });

  it('trims, drops empty subjects and removes duplicates', () => {
    expect(commitLines(['  a ', '', 'b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('deployChangelog', () => {
  const old = [entry('A', 'a1')];
  const base = { previous: old, current: old, subjects: [], label: '2026-10-28 09:00' };

  it('makes one new entry from the commit subjects when no entry was added by hand', () => {
    expect(deployChangelog({ ...base, subjects: ['Second thing', 'First thing'] })).toEqual([
      entry('2026-10-28 09:00', 'First thing', 'Second thing'),
      ...old,
    ]);
  });

  it('leaves the changelog alone when no subject is player-facing', () => {
    expect(deployChangelog({ ...base, subjects: ['chore: x', 'Merge y'] })).toEqual(old);
  });

  it('leaves the changelog alone when there are no commits', () => {
    expect(deployChangelog(base)).toEqual(old);
  });

  it('prefers hand-written entries over commit subjects', () => {
    const current = [entry('B', 'b1'), ...old];
    expect(deployChangelog({ ...base, current, subjects: ['Some commit'] })).toEqual(current);
  });

  it('merges several hand-written entries and still ignores the subjects', () => {
    const current = [entry('C', 'c1'), entry('B', 'b1'), ...old];
    expect(deployChangelog({ ...base, current, subjects: ['Some commit'] })).toEqual([entry('C', 'b1', 'c1'), ...old]);
  });

  it('does not modify its inputs', () => {
    const copy = structuredClone(old);
    deployChangelog({ ...base, subjects: ['x'] });
    expect(old).toEqual(copy);
  });
});
