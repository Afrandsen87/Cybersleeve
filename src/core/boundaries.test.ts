/**
 * Architecture test: the bounded contexts of `src/core` (one folder each) may only depend on each other along the listed edges.
 *
 * Purpose: make a second code path for the same rule hard to write by accident. A new import from one context into another fails here
 * until the edge is added on purpose; an edge that no longer exists must be deleted from the list, so the list can only shrink
 * as the refactor (docs/review/execution-plan.md) removes cross-context reaching. `(root)` is `core/types.ts` and `core/index.ts`.
 * Also checks that production code in `core` never imports `app`, `ui` or `testing`.
 * Inputs: the source files on disk. Outputs: pass/fail. Side effects: reads files only.
 * Called by: `npm test`. Calls: node `fs` (no browser, DOM or timers).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const CORE = join(SRC, 'core');

/** Allowed `from -> to` context edges, generated from the code on 2026-10-29 (session S0). Delete lines as they stop being true. */
const ALLOWED_EDGES: Readonly<Record<string, readonly string[]>> = {
  '(root)': [
    'actions',
    'automation',
    'config',
    'corporation',
    'crits',
    'economy',
    'effects',
    'engine',
    'heat',
    'items',
    'kernel',
    'resleeve',
    'save',
    'skills',
    'sleeve',
    'synth',
  ],
  actions: ['(root)', 'crits', 'economy', 'effects', 'engine', 'items', 'kernel', 'resleeve', 'sleeve'],
  automation: ['(root)', 'items'],
  config: ['(root)', 'actions', 'corporation', 'effects', 'items'],
  corporation: ['(root)', 'actions', 'effects', 'items', 'kernel'],
  crits: ['(root)', 'items', 'kernel'],
  economy: ['(root)', 'actions', 'effects', 'engine', 'heat', 'kernel', 'synth'],
  effects: ['(root)', 'actions', 'automation', 'corporation', 'heat', 'items', 'kernel', 'resleeve'],
  engine: [
    '(root)',
    'actions',
    'automation',
    'corporation',
    'crits',
    'economy',
    'effects',
    'heat',
    'items',
    'kernel',
    'resleeve',
    'save',
    'synth',
  ],
  // heat -> kernel and sleeve -> kernel added in S3: both read the shared `kernel/curves` orders helper (downward edge to the lowest layer).
  heat: ['(root)', 'effects', 'kernel'],
  items: ['(root)', 'actions', 'kernel'],
  kernel: ['(root)'],
  resleeve: ['(root)', 'actions', 'economy', 'effects', 'engine', 'kernel', 'save', 'synth'],
  save: ['(root)', 'actions', 'automation', 'corporation', 'effects', 'items', 'kernel', 'resleeve'],
  sleeve: ['kernel'],
  synth: ['(root)', 'actions', 'effects'],
};

/** @returns every `.ts` file under `dir` */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

/** @returns the context of a file under `src/core` (its folder, or `(root)`) */
function contextOf(file: string): string {
  const parts = relative(CORE, file).split(sep);
  return parts.length > 1 ? (parts[0] as string) : '(root)';
}

/** Production files of `core` with the files each one imports (relative imports only, resolved to paths under `src`). */
function importsOfCore(): { file: string; targets: string[] }[] {
  const all = new Set(walk(SRC));
  return walk(CORE)
    .filter((f) => !f.endsWith('.test.ts'))
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      const targets: string[] = [];
      for (const m of text.matchAll(/from\s+'(\.[^']*)'/g)) {
        const base = normalize(join(dirname(file), m[1] as string));
        const hit = [`${base}.ts`, join(base, 'index.ts')].find((c) => all.has(c));
        if (hit) targets.push(hit);
      }
      return { file, targets };
    });
}

describe('core context boundaries', () => {
  const found = new Set<string>();
  const upward: string[] = [];
  for (const { file, targets } of importsOfCore()) {
    for (const target of targets) {
      if (!target.startsWith(CORE)) {
        if (/[\\/](app|ui|testing)[\\/]/.test(relative(SRC, target))) upward.push(`${relative(SRC, file)} -> ${relative(SRC, target)}`);
        continue;
      }
      const from = contextOf(file);
      const to = contextOf(target);
      if (from !== to) found.add(`${from} -> ${to}`);
    }
  }
  const allowed = new Set(Object.entries(ALLOWED_EDGES).flatMap(([from, tos]) => tos.map((to) => `${from} -> ${to}`)));

  it('has no context edge outside the allowed list', () => {
    expect([...found].filter((e) => !allowed.has(e)).sort()).toEqual([]);
  });

  it('lists no edge that has gone away (the list only shrinks)', () => {
    expect([...allowed].filter((e) => !found.has(e)).sort()).toEqual([]);
  });

  it('never imports app, ui or testing from production code in core', () => {
    expect(upward).toEqual([]);
  });
});
