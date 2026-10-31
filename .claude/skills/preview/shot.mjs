// Screenshots a running Cybersleeve dev server through headless Chrome (DevTools protocol, no npm dependencies).
// Usage: node shot.mjs <url> <out.png> [saveJsonFile] [evalJs]
//   saveJsonFile  a save to load first, e.g. src/testing/fixtures/saves/v10-after-three-resleeves.golden.json
//   evalJs        an expression run after load (may return a promise); its value is printed as `EVAL ...`
// Prints page exceptions (`EXC`) and console errors (`ERR`). Chrome path: env CHROME, else the default Windows install.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, saveFile, evalJs] = process.argv.slice(2);
if (!url || !out) {
  console.log('usage: node shot.mjs <url> <out.png> [saveJsonFile] [evalJs]');
  process.exit(1);
}
const SAVE_KEY = 'cybersleeve.save'; // keep equal to SAVE_KEY in src/app/persistence.ts
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cs-'))}`,
  '--window-size=1280,1100',
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
if (!target) {
  console.log('Chrome did not start; set CHROME to its path');
  chrome.kill();
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waits = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waits.has(m.id)) {
    waits.get(m.id)(m);
    waits.delete(m.id);
  }
  if (m.method === 'Runtime.exceptionThrown')
    console.log('EXC', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    console.log('ERR', m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    waits.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
if (saveFile) {
  // Seed from a static file of the same origin: any other path hits the SPA fallback, the game boots and saves over the seed.
  await send('Page.navigate', { url: new URL('/icon.svg', url).href });
  await sleep(800);
  const save = readFileSync(saveFile, 'utf8');
  await send('Runtime.evaluate', { expression: `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(save)})` });
}
await send('Page.navigate', { url });
await sleep(2500);
if (evalJs) {
  const r = await send('Runtime.evaluate', { expression: evalJs, returnByValue: true, awaitPromise: true });
  console.log('EVAL', JSON.stringify(r.result?.result?.value));
  await sleep(800);
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', out);
ws.close();
chrome.kill();
process.exit(0);
