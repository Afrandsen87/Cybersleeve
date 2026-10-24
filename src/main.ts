/**
 * @module app
 *
 * Browser entry point: loads the save, starts the loop, mounts the UI, autosaves.
 * All timings come from `gameConfig.runtime`.
 */
import './ui/style.css';
import { createGame } from './app/createGame';
import { createBrowserScheduler, GameLoop } from './app/loop';
import { createNewGameHandler } from './app/newGame';
import { SpeedToggle } from './app/speedToggle';
import { SaveGame, createBrowserStore } from './app/persistence';
import { gameConfig } from './content/gameConfig';
import { numberFactory } from './numbers';
import { mountUi } from './ui/dom';

const { runtime } = gameConfig;

const saveGame = new SaveGame(createBrowserStore(), gameConfig, numberFactory);
const engine = createGame({ state: saveGame.load() ?? undefined });

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const speed = new SpeedToggle(runtime.fastForwardFactor);
const render = mountUi(root, engine, speed, createNewGameHandler(engine, saveGame));

// Rendering is skipped while the page is hidden; the game itself keeps running.
const loop = new GameLoop(
  engine,
  createBrowserScheduler(runtime.stepMs),
  () => {
    if (!document.hidden) render();
  },
  {
    maxDeltaMs: runtime.maxDeltaMs,
    timeScale: () => speed.factor,
  },
);
loop.start();

setInterval(() => saveGame.save(engine.getState()), runtime.autosaveMs);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame.save(engine.getState());
  else render();
});
