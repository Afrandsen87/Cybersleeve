#!/usr/bin/env node
/**
 * Splits DESIGN.md, docs/ARCHITECTURE.md, docs/CONFIG.md and docs/DECISIONS.md into one file per bounded context.
 *
 * Purpose: a task loads `docs/contexts/<context>.md` (a few KB) instead of four 35-60 KB documents. Text is moved verbatim;
 * the originals keep what is cross-cutting and gain a one-line pointer where a section went. Old flat paths like
 * `core/heat.ts` are rewritten to the current folder layout.
 * Inputs: the four docs, `src/core` (for the path rewrite) and `decisions-map.json` (line number -> context for DECISIONS bullets,
 * path given as the first argument). Side effects: rewrites the four docs, writes `docs/contexts/*.md` and `docs/archive/*.md`.
 * Called by: a developer, once (Session S2 of docs/review/execution-plan.md). Calls: node `fs`.
 */
import fs from 'node:fs';

const MAP_FILE = process.argv[2];
const CONTEXTS = {
  kernel: 'Number safety: BigNum adapter use, Infinity (1e308) clamping, sampling, curves, memo cache.',
  config: 'Configuration types and their validation.',
  effects: 'Buyable effect kinds, the effect registry, traits and the resolved effect queries.',
  actions: 'Actions: definitions, runner, toggles, speed, levels and XP, rewards, Overclock and Focus.',
  heat: 'Heat: gain, tax, cooldown cycle, Moles, Legend speed-up.',
  crits: 'Critical successes, Zero-days, Admin keys, links.',
  items: 'Items, rarities, drops, the Inventory, Burn leads, Skill shards, Augments, Back channel.',
  economy: 'Credits, network nodes, passive income, the shop and price growth, purchase reveal.',
  skills: 'Skill trees and skill points.',
  automation: 'Automation points, lanes and features.',
  sleeve: 'Sleeve stats: access level, ICE Rating, Hacking Proficiency, sleeve levels, Sleeve Euphoria.',
  resleeve: 'Re-sleeving (first prestige): gate, carry-over lists, run record, re-sleeve skills.',
  synth: 'Synthetic sleeves: copies of finished runs.',
  corporation: 'The Corporation: actions, levels, stocks, rank.',
  save: 'Save format, state lifetimes, serialization and versions.',
  engine: 'Tick loop, engine facade, queries and commands, time.',
  ui: 'Rendering, view models, text, tooltips, layout.',
  app: 'Composition, loop, hosting, deploy, tooling and process.',
  general: 'Cross-cutting decisions that fit no single context.',
};

/** heading regex -> context (first match wins), or 'stay' / 'archive'. */
const RULES = {
  'DESIGN.md': [
    [/^## 1\./, 'stay'],
    [/^## 2\./, 'stay'],
    [/^## 3\./, 'actions'],
    [/^## 4\./, 'actions'],
    [/^## 5\./, 'sleeve'],
    [/^## 6\./, 'economy'],
    [/^## 7\./, 'economy'],
    [/^### Sleeve Improvements/, 'economy'],
    [/^### The square/, 'actions'],
    [/^### (Practice Hacking|Grow network|Push malware)/, 'actions'],
    [/^## 8\./, 'skills'],
    [/^### 8b\./, 'automation'],
    [/^## 9\./, 'kernel'],
    [/^## 10\./, 'items'],
    [/^## 11\./, 'resleeve'],
    [/^## 11b\./, 'corporation'],
    [/^## 12\./, 'engine'],
    [/^## 13\./, 'stay'],
  ],
  'docs/ARCHITECTURE.md': [
    [/^## Commands/, 'stay'],
    [/^## Deploy changelog/, 'archive'],
    [/^## Core folders/, 'stay'],
    [/^## Layering/, 'stay'],
    [/^## SOLID/, 'stay'],
    [/^## Domain model/, 'stay'],
    [/^### State lifetimes/, 'save'],
    [/^## Tick loop/, 'engine'],
    [/^## Number handling/, 'kernel'],
    [/^## The Corporation/, 'corporation'],
    [/^## Re-sleeving/, 'resleeve'],
    [/^## Persistence/, 'save'],
    [/^## Known limitations/, 'stay'],
  ],
  'docs/CONFIG.md': [
    [/^## Quick recipes/, 'stay'],
    [/^## `actions/, 'actions'],
    [/^## `items/, 'items'],
    [/^## `buyables/, 'effects'],
    [/^## `corporation/, 'corporation'],
    [/^## `criticalSuccess/, 'crits'],
    [/^## Newer re-sleeve/, 'resleeve'],
    [/^## `focus/, 'actions'],
    [/^## `resleeve/, 'resleeve'],
    [/^## `automation/, 'automation'],
    [/^## `reveal/, 'economy'],
    [/^## `(progression|speed)/, 'actions'],
    [/^## `sleeve/, 'sleeve'],
    [/^## `network/, 'economy'],
    [/^## `global/, 'kernel'],
    [/^## `(engine|runtime)/, 'engine'],
    [/^## (What is deliberately|Not configurable)/, 'stay'],
  ],
};

const sections = {}; // ctx -> { design: [], architecture: [], config: [], decisions: [] }
const bucket = (ctx) => (sections[ctx] ??= { design: [], architecture: [], config: [], decisions: [] });
const KIND = { 'DESIGN.md': 'design', 'docs/ARCHITECTURE.md': 'architecture', 'docs/CONFIG.md': 'config' };
const archive = [];

/** Rewrites old flat `core/<stem>.ts` paths to the folder layout. */
function fixPaths(text, flat) {
  return text.replace(/\b(src\/)?core\/([A-Za-z0-9]+)\.(test\.)?ts\b/g, (m, src, stem, test) => {
    const file = `${stem}.${test ? 'test.' : ''}ts`;
    const hit = flat.get(file);
    return hit ? `${src ?? ''}core/${hit}` : m;
  });
}

/** @returns file name -> path under src/core for every file currently in a context folder */
function indexCore() {
  const out = new Map();
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && d !== 'src/core') out.set(e.name, p.slice('src/core/'.length));
    }
  })('src/core');
  return out;
}
const flat = indexCore();

function linkTo(doc, ctx) {
  return `${doc === 'DESIGN.md' ? 'docs/' : ''}contexts/${ctx}.md`;
}

/** Splits one document into blocks at headings of level 2 and 3 and routes each block. */
function splitDoc(doc) {
  const lines = fs.readFileSync(doc, 'utf8').split('\n');
  const blocks = [];
  for (const line of lines) {
    if (/^#{2,3} /.test(line) || blocks.length === 0) blocks.push({ head: line, body: [] });
    else blocks.at(-1).body.push(line);
  }
  const keep = [];
  for (const b of blocks) {
    const rule = RULES[doc].find(([re]) => re.test(b.head));
    const dest = rule ? rule[1] : 'stay';
    if (blocks.indexOf(b) === 0 || dest === 'stay') {
      keep.push(`${b.head}\n${b.body.join('\n')}`);
      continue;
    }
    const text = fixPaths(`${b.head.replace(/^#{2,3} /, '### ')}\n${b.body.join('\n').replace(/\n+$/, '')}\n`, flat);
    if (dest === 'archive') archive.push(text);
    else bucket(dest)[KIND[doc]].push(text);
    const where = dest === 'archive' ? 'archive/deploy-changelog.md' : linkTo(doc, dest).replace(/^docs\//, '');
    const rel = doc === 'DESIGN.md' ? `docs/${where}` : where;
    keep.push(`${b.head}\n\n*Moved to [${rel}](${rel}).*\n`);
  }
  fs.writeFileSync(doc, fixPaths(keep.join('\n').replace(/\n{3,}/g, '\n\n'), flat));
}

for (const doc of Object.keys(RULES)) splitDoc(doc);

// DECISIONS: bullets are routed by the classification file, the rest stays.
{
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const lines = fs.readFileSync('docs/DECISIONS.md', 'utf8').split('\n');
  const stay = [];
  let group = '';
  const counts = {};
  lines.forEach((line, i) => {
    if (line.startsWith('- ')) {
      const ctx = map[String(i + 1)] ?? 'general';
      counts[ctx] = (counts[ctx] ?? 0) + 1;
      const tag = group ? `\n*Group: ${group.replace(/:$/, '')}*\n` : '';
      bucket(ctx).decisions.push(`${tag}${fixPaths(line, flat)}`);
      return;
    }
    if (line.trim()) group = line.trim();
    stay.push(line);
  });
  const table = Object.entries(counts)
    .sort()
    .map(([c, n]) => `| [${c}](contexts/${c}.md) | ${n} |`)
    .join('\n');
  fs.writeFileSync(
    'docs/DECISIONS.md',
    `${stay.join('\n').replace(/\n{3,}/g, '\n\n')}\n\n## Where the entries are\n\nEvery decision entry now lives in the doc of the context it decides (section "Decisions"). Read that entry before changing the mechanic.\n\n| Context | Entries |\n|---|---|\n${table}\n`,
  );
}

fs.mkdirSync('docs/contexts', { recursive: true });
fs.mkdirSync('docs/archive', { recursive: true });
const SRC_NAME = { design: 'DESIGN.md', architecture: 'docs/ARCHITECTURE.md', config: 'docs/CONFIG.md', decisions: 'docs/DECISIONS.md' };
const TITLE = { design: 'Design', architecture: 'Architecture', config: 'Configuration', decisions: 'Decisions' };
const index = [];
for (const [ctx, text] of Object.entries(CONTEXTS)) {
  const s = sections[ctx];
  if (!s) continue;
  const parts = [
    `# Context: ${ctx}\n\n${text}\n\nCode: \`src/core/${ctx}/\` (see \`docs/review/file-map.md\`). Text below is moved verbatim from the four main docs; headings name the source.\n`,
  ];
  for (const k of ['design', 'architecture', 'config', 'decisions']) {
    if (s[k].length) parts.push(`## ${TITLE[k]} (from ${SRC_NAME[k]})\n\n${s[k].join('\n')}`);
  }
  const body = `${parts.join('\n')}\n`;
  fs.writeFileSync(`docs/contexts/${ctx}.md`, body);
  index.push(`| [${ctx}](${ctx}.md) | ${text} | ${(Buffer.byteLength(body) / 1000).toFixed(1)} KB |`);
}
fs.writeFileSync(
  'docs/contexts/README.md',
  `# Context docs\n\nOne file per bounded context: its design text, architecture notes, config variables and decision history, moved verbatim from \`DESIGN.md\`, \`docs/ARCHITECTURE.md\`, \`docs/CONFIG.md\` and \`docs/DECISIONS.md\`. Load only the slice for the context you change. Code folders: \`src/core/<context>/\`; target map: \`docs/review/target-architecture.md\`.\n\n| Context | Responsibility | Size |\n|---|---|---|\n${index.join('\n')}\n`,
);
fs.writeFileSync('docs/archive/deploy-changelog.md', `# Archived: deploy changelog (was in ARCHITECTURE.md)\n\n${archive.join('\n')}\n`);
console.log('done');
