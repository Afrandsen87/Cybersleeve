import { describe, expect, it } from 'vitest';
import { CHANGELOG } from '../content/changelog';
import { collateChangelog, renderChangelogSource } from './collateChangelog';

/** Evaluates the rendered array literal (test only). */
const evaluate = (body: string): unknown => new Function(`return ${body.replace(/;\s*$/, '')}`)();

const entry = (version: string, ...changes: string[]) => ({ version, changes });

describe('collateChangelog', () => {
  const old = [entry('A', 'a1'), entry('Z', 'z1')];

  it('returns the changelog unchanged when nothing was added', () => {
    expect(collateChangelog(old, old)).toEqual(old);
  });

  it('returns the changelog unchanged when one entry was added', () => {
    const current = [entry('B', 'b1'), ...old];
    expect(collateChangelog(old, current)).toEqual(current);
  });

  it('merges several added entries into one, oldest changes first, under the newest label', () => {
    const current = [entry('C', 'c1'), entry('B', 'b1', 'b2'), ...old];
    expect(collateChangelog(old, current)).toEqual([entry('C', 'b1', 'b2', 'c1'), ...old]);
  });

  it('drops exact duplicate lines', () => {
    const current = [entry('C', 'x', 'c1'), entry('B', 'x', 'b1'), ...old];
    expect(collateChangelog(old, current)[0]?.changes).toEqual(['x', 'b1', 'c1']);
  });

  it('keeps older entries untouched and in place', () => {
    const current = [entry('C', 'c1'), entry('B', 'b1'), entry('A', 'a1'), entry('Z', 'z1')];
    expect(collateChangelog([entry('A', 'a1'), entry('Z', 'z1')], current)).toEqual([
      entry('C', 'b1', 'c1'),
      entry('A', 'a1'),
      entry('Z', 'z1'),
    ]);
  });

  it('treats everything as added when there is no baseline', () => {
    const current = [entry('B', 'b1'), entry('A', 'a1')];
    expect(collateChangelog([], current)).toEqual([entry('B', 'a1', 'b1')]);
  });

  it('does not modify its inputs', () => {
    const current = [entry('C', 'c1'), entry('B', 'b1'), ...old];
    const copy = structuredClone(current);
    collateChangelog(old, current);
    expect(current).toEqual(copy);
  });
});

describe('renderChangelogSource', () => {
  const source = '/** doc */\nexport const CHANGELOG: readonly ChangelogEntry[] = [\n  { version: "old", changes: [] },\n];\n';

  it('keeps the head and regenerates the array body', () => {
    const out = renderChangelogSource(source, [entry('V', 'one', 'it\'s "two"')]);
    expect(out.startsWith('/** doc */\nexport const CHANGELOG: readonly ChangelogEntry[] = [\n')).toBe(true);
    expect(out).not.toContain('old');
  });

  it('round-trips through evaluation', () => {
    const entries = [entry('V', 'one', 'it\'s "two"\\ é')];
    const out = renderChangelogSource(source, entries);
    const body = out.slice(out.indexOf('= [') + 2);
    expect(evaluate(body)).toEqual(entries);
  });

  it('round-trips the real changelog', () => {
    const out = renderChangelogSource(source, CHANGELOG);
    const body = out.slice(out.indexOf('= [') + 2);
    expect(evaluate(body)).toEqual(CHANGELOG);
  });

  it('throws when the array declaration is missing', () => {
    expect(() => renderChangelogSource('nothing here', [])).toThrow();
  });
});
