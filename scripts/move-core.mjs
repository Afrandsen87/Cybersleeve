#!/usr/bin/env node
/**
 * Moves the flat `src/core/*.ts` files into bounded-context folders and rewrites every relative import.
 *
 * Purpose: a purely mechanical step (no logic changes) of the context refactor; the mapping is the table
 * `docs/review/file-map.md` in executable form. Stems not in the table stay where they are.
 * Inputs: `--dry` prints the plan without touching files; no flag performs `git mv` and rewrites imports.
 * Side effects: renames files with `git mv` and edits import specifiers in every `.ts` file under `src/`.
 * Called by: a developer, once (Session S0 of docs/review/execution-plan.md).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = 'src';
const CORE = 'src/core';

/** Context folder for each file stem (a stem covers `x.ts` and `x.test.ts`). `testing` means `src/testing`. */
const CONTEXTS = {
  kernel: 'infinity overflow fields sampling concaveBonus snapshot diagnostics mathSafety hardening structure',
  config: 'config configTypes core',
  effects: 'effectRegistry effectTraits effects buyableTypes buyableCaps buyableEffects skillEffects',
  actions:
    'actionTypes actionLookup actionRunner actionToggles completion speed level progression rewards levelRewardFactor linkedPayouts ' +
    'engineProgress progressAndSpeed levels coreLevels runsPerSleeveXp batching overclock overclockEffects overdriveCap killServers cyberneticsSpeed',
  heat: 'heat heatPace heatEffects cooldowns heatChance heatSkills heatStep skillsHeat',
  crits: 'critical criticalLinks critFeed zeroDays criticalBoosts cyberneticsCrits adminKeys',
  items: 'inventory itemTypes drops rarityShift burnLeads skillShards augments backChannel leverageEffects items dropSources burnLeadsFlat',
  economy: 'economy network shop reveal',
  skills: 'skills skillParents wholeNodes',
  automation: 'automation',
  sleeve: 'sleeveEuphoria iceRating iceRatingFromLevel coreSleeve engineSleeve sleeveEuphoria',
  resleeve:
    'resleeve resleeveCarry resleever resleeveGate resleeveEffects resleeveEffectTypes reflexArchive resleeveTree revealAfterResleeves batchingResleeveSkills retentionLane saveWipe',
  synth: 'synthSleeves synthLane',
  corporation:
    'corporation corporationEffects corporationLevels corporationState corporationTypes corporationLane corporationRank corporationStocks',
  save: 'serialization state stateTypes coreState',
  engine: 'engine api stats engineAccess properties',
  testing: 'skillsKit resleeveSkillsKit',
};
// `types` and `index` stay at the core root: they are the stable barrels other layers import.

/** stem -> destination folder (relative to src/core, or the string '../testing'). */
const DEST = new Map();
for (const [ctx, stems] of Object.entries(CONTEXTS))
  for (const s of stems.split(/\s+/).filter(Boolean)) DEST.set(s, ctx === 'testing' ? '../testing' : ctx);

/** @returns {string[]} every `.ts` file under `dir`, with forward slashes */
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const fileSet = new Set(files);

/** old path -> new path for every file that moves. */
const moves = new Map();
for (const f of files) {
  if (path.posix.dirname(f) !== CORE) continue;
  const stem = path.posix.basename(f, '.ts').replace(/\.test$/, '');
  const dest = DEST.get(stem);
  if (!dest) continue;
  const base = path.posix.basename(f);
  moves.set(f, path.posix.normalize(`${CORE}/${dest}/${base}`));
}

const unmapped = files.filter((f) => path.posix.dirname(f) === CORE && !moves.has(f)).map((f) => path.posix.basename(f));
console.log(`moving ${moves.size} files; staying at core root: ${unmapped.join(', ')}`);
if (DRY) {
  for (const [a, b] of moves) console.log(`${a} -> ${b}`);
  process.exit(0);
}

/** Resolves an import specifier written in `fromFile` to an existing project file, or null. */
function resolve(fromFile, spec) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (fileSet.has(c)) return c;
  return null;
}

/** Relative specifier from `fromFile` to `target` (no extension, `/index` dropped). */
function relative(fromFile, target) {
  const t = target.replace(/\.ts$/, '').replace(/\/index$/, '');
  let rel = path.posix.relative(path.posix.dirname(fromFile), t);
  if (rel === '') rel = '.';
  return rel.startsWith('.') ? rel : `./${rel}`;
}

const SPEC = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*|\bvi\.importActual\(\s*)(['"])(\.{1,2}(?:\/[^'"]*)?)\2/g;

/** New text for `file` (content read from its old path) with every relative import re-pointed. */
function rewrite(file, text) {
  const newPath = moves.get(file) ?? file;
  return text.replace(SPEC, (m, pre, q, spec) => {
    const target = resolve(file, spec);
    if (!target) return m;
    const newTarget = moves.get(target) ?? target;
    if (newTarget === target && newPath === file) return m;
    return `${pre}${q}${relative(newPath, newTarget)}${q}`;
  });
}

// 1. compute new contents from the old layout, 2. move, 3. write.
const contents = new Map(files.map((f) => [f, rewrite(f, fs.readFileSync(f, 'utf8'))]));
for (const [a, b] of moves) {
  fs.mkdirSync(path.dirname(b), { recursive: true });
  execFileSync('git', ['mv', a, b]);
}
for (const [f, text] of contents) fs.writeFileSync(moves.get(f) ?? f, text);
console.log('done');
