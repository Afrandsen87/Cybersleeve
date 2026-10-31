/**
 * The title bar derivations of an action card: the process id and the state LED mapping.
 *
 * Called by: vitest. Calls: `processId`, `processState`.
 */
import { describe, expect, it } from 'vitest';
import { processId, processState } from './view/processId';

describe('processId', () => {
  it('keeps the first word and cuts the others to three letters', () => {
    expect(processId('grow-network')).toBe('grow_net');
    expect(processId('practice-hacking')).toBe('practice_hac');
    expect(processId('corporate-access-upgrade')).toBe('corporate_acc_upg');
  });

  it('leaves a single word alone and lower-cases it', () => {
    expect(processId('legend')).toBe('legend');
    expect(processId('Legend')).toBe('legend');
  });

  it('treats underscores like dashes and ignores stray separators', () => {
    expect(processId('push_malware')).toBe('push_mal');
    expect(processId('--a--b--')).toBe('a_b');
  });

  it('gives empty text for an id with no letters', () => {
    expect(processId('')).toBe('');
    expect(processId('---')).toBe('');
  });
});

describe('processState', () => {
  it('is auto while running on Auto-run, running while running by hand, idle otherwise', () => {
    expect(processState(true, true)).toBe('auto');
    expect(processState(true, false)).toBe('running');
    expect(processState(false, false)).toBe('idle');
  });

  it('is idle when not running even if Auto-run is on (nothing is running)', () => {
    expect(processState(false, true)).toBe('idle');
  });
});
