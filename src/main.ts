/**
 * @module main
 *
 * Browser entry point: claims the game for this tab, loads the save, starts the loop, mounts the UI, autosaves.
 * All timings come from `gameConfig.runtime`.
 */
import './ui/style.css';
import { createGame } from './app/createGame';
import { debugControlsEnabled } from './app/debugControls';
import { createBrowserScheduler, GameLoop } from './app/loop';
import { createNewGameHandler } from './app/newGame';
import { createBrowserFrameScheduler, RenderLoop } from './app/renderLoop';
import { SAVE_KEY, SaveGame, createBrowserStore } from './app/persistence';
import { createSaveTransfer } from './app/saveTransfer';
import { CHANGELOG } from './content/changelog';
import { SpeedToggle } from './app/speedToggle';
import { claimGame, watchForOtherTab } from './app/tabGuard';
import { createThrottle } from './app/throttle';
import { gameConfig } from './content/gameConfig';
import { ENTITY_ICONS, ICON_GRIDS, ICON_PALETTE, ICON_SIZE } from './content/icons';
import type { Diagnostics } from './core';
import { numberFactory } from './numbers';
import { mountUi, showNotice } from './ui/dom';
import { createIconSource } from './ui/pixelIcon';
import { uiText } from './ui/uiText';

const { runtime } = gameConfig;

/** Starts the game in this tab (unless another tab already plays it). */
async function start(root: HTMLElement): Promise<void> {
  // One tab plays: a second one is told so before it loads (and could overwrite) the save.
  const claim = await claimGame(navigator.locks);
  if (claim === 'taken') {
    showNotice(root, uiText.notices.taken);
    return;
  }

  // Warnings about dropped game time are for developers: shown in development builds and with ?debug.
  const debug = debugControlsEnabled(import.meta.env.DEV, location.search);
  const diagnostics: Diagnostics = { warn: (message) => (debug ? console.warn(message) : undefined) };

  const saveGame = new SaveGame(createBrowserStore(), gameConfig, numberFactory);
  const engine = createGame({ state: saveGame.load() ?? undefined, diagnostics });

  // Saving stops when this tab must not write any more: another tab took over (fallback guard), or a save was just imported.
  let saving = true;
  const transfer = createSaveTransfer(
    saveGame,
    () => engine.getState(),
    {
      copy: (text) => navigator.clipboard.writeText(text),
      ask: (message) => window.prompt(message),
      notify: (message) => window.alert(message),
      restart: () => {
        saving = false;
        location.reload();
      },
    },
    uiText.saveTools,
  );

  const speed = new SpeedToggle(runtime.fastForwardFactor);
  const render = mountUi(root, engine, speed, createNewGameHandler(engine, saveGame), {
    debugControls: debug,
    icons: createIconSource({ size: ICON_SIZE, palette: ICON_PALETTE, grids: ICON_GRIDS, assignment: ENTITY_ICONS }),
    saveTransfer: { exportSave: () => void transfer.exportSave(), importSave: () => transfer.importSave() },
    changelog: CHANGELOG,
  });

  // The game steps on a timer every `stepMs` (timers keep running in background tabs). The screen is drawn on the display's frame
  // clock, at most every `renderMs` and not at all while the page is hidden; the bars ease towards each new value for one refresh
  // interval (--render-ms), so they glide instead of stepping.
  root.style.setProperty('--render-ms', `${runtime.renderMs}ms`);
  const scheduler = createBrowserScheduler(runtime.stepMs);
  const loop = new GameLoop(engine, scheduler, () => {}, {
    maxDeltaMs: runtime.maxDeltaMs,
    timeScale: () => speed.factor,
    diagnostics,
  });
  const mayRender = createThrottle(runtime.renderMs, () => scheduler.now());
  const renderLoop = new RenderLoop(createBrowserFrameScheduler(), render, { mayRender, hidden: () => document.hidden });
  loop.start();
  renderLoop.start();

  // A save is written every `autosaveMs`, when the page is hidden and when it is closed.
  const save = (): void => {
    if (saving) saveGame.save(engine.getState());
  };
  setInterval(save, runtime.autosaveMs);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else render();
  });

  // Browsers without Web Locks: a tab that finds another tab saving the same game stops playing and saving.
  if (claim === 'unsupported') {
    watchForOtherTab(window, SAVE_KEY, () => {
      if (!saving) return;
      saving = false;
      loop.stop();
      renderLoop.stop();
      showNotice(root, uiText.notices.otherTab);
    });
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
void start(root);
