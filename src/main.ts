/**
 * @module main
 *
 * Browser entry point: loads the save, starts the loop, mounts the UI, autosaves.
 * All timings come from `gameConfig.runtime`.
 */
import './ui/style.css';
import { createGame } from './app/createGame';
import { debugControlsEnabled } from './app/debugControls';
import { createBrowserScheduler, GameLoop } from './app/loop';
import { createNewGameHandler } from './app/newGame';
import { createBrowserFrameScheduler, RenderLoop } from './app/renderLoop';
import { SAVE_KEY, SaveGame, createBrowserStore } from './app/persistence';
import { SpeedToggle } from './app/speedToggle';
import { watchForOtherTab } from './app/tabGuard';
import { createThrottle } from './app/throttle';
import { gameConfig } from './content/gameConfig';
import type { Diagnostics } from './core';
import { numberFactory } from './numbers';
import { mountUi, showNotice } from './ui/dom';
import { uiText } from './ui/uiText';

const { runtime } = gameConfig;

// Warnings about dropped game time are for developers: shown in development builds and with ?debug.
const debug = debugControlsEnabled(import.meta.env.DEV, location.search);
const diagnostics: Diagnostics = { warn: (message) => (debug ? console.warn(message) : undefined) };

const saveGame = new SaveGame(createBrowserStore(), gameConfig, numberFactory);
const engine = createGame({ state: saveGame.load() ?? undefined, diagnostics });

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const speed = new SpeedToggle(runtime.fastForwardFactor);
const render = mountUi(root, engine, speed, createNewGameHandler(engine, saveGame), { debugControls: debug });

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

// A save is written every `autosaveMs`, when the page is hidden and when it is closed. A tab that finds another tab saving
// the same game stops playing and saving, so the two cannot overwrite each other's progress.
let owner = true;
const save = (): void => {
  if (owner) saveGame.save(engine.getState());
};
setInterval(save, runtime.autosaveMs);
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
  else render();
});
watchForOtherTab(window, SAVE_KEY, () => {
  if (!owner) return;
  owner = false;
  loop.stop();
  renderLoop.stop();
  showNotice(root, uiText.notices.otherTab);
});
