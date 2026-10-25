import { describe, expect, it, vi } from 'vitest';
import type { GameStateView } from '../core';
import { createSaveTransfer, type TransferEnvironment, type TransferText } from './saveTransfer';

const text: TransferText = { exported: 'copied', exportFailed: 'blocked', importPrompt: 'paste', imported: 'done', importInvalid: 'bad' };
const state = {} as GameStateView;

const setup = (over: Partial<TransferEnvironment> = {}, accepts = true) => {
  const env: TransferEnvironment = {
    copy: vi.fn(async () => {}),
    ask: vi.fn(() => 'SAVE'),
    notify: vi.fn(),
    restart: vi.fn(),
    ...over,
  };
  const save = { exportText: vi.fn(() => 'TEXT'), importText: vi.fn(() => accepts) };
  return { env, save, transfer: createSaveTransfer(save, () => state, env, text) };
};

describe('save transfer', () => {
  it('copies the save text to the clipboard and says so', async () => {
    const { env, transfer } = setup();
    await transfer.exportSave();
    expect(env.copy).toHaveBeenCalledWith('TEXT');
    expect(env.notify).toHaveBeenCalledWith('copied');
  });

  it('says so when the clipboard is blocked', async () => {
    const { env, transfer } = setup({ copy: () => Promise.reject(new Error('no')) });
    await transfer.exportSave();
    expect(env.notify).toHaveBeenCalledWith('blocked');
  });

  it('imports a valid pasted save and restarts', () => {
    const { env, save, transfer } = setup();
    transfer.importSave();
    expect(save.importText).toHaveBeenCalledWith('SAVE');
    expect(env.notify).toHaveBeenCalledWith('done');
    expect(env.restart).toHaveBeenCalled();
  });

  it('keeps the game when the pasted text is not a valid save', () => {
    const { env, transfer } = setup({}, false);
    transfer.importSave();
    expect(env.notify).toHaveBeenCalledWith('bad');
    expect(env.restart).not.toHaveBeenCalled();
  });

  it('does nothing when the player cancels or pastes nothing', () => {
    for (const answer of [null, '   ']) {
      const { env, save, transfer } = setup({ ask: () => answer });
      transfer.importSave();
      expect(save.importText).not.toHaveBeenCalled();
      expect(env.restart).not.toHaveBeenCalled();
    }
  });
});
