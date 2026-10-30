/**
 * Architecture test: the bounded contexts of `src/core` (one folder each) may only depend on each other downward, along the layers below.
 *
 * Purpose: make a second code path for the same rule hard to write by accident. An import from one context into another passes when it
 * points to a lower layer, or along a listed same-layer edge; anything else must be a named exception with a reason, and an exception that no
 * longer happens must be deleted, so the exception list can only shrink. `core/types.ts` and `core/index.ts` are the root: everyone may
 * import the types, and the barrel (`index.ts`) is a re-export, so it is not checked as a source.
 * Also checks that production code in `core` never imports `app`, `ui` or `testing`.
 * Inputs: the source files on disk. Outputs: pass/fail. Side effects: reads files only.
 * Called by: `npm test`. Calls: node `fs` (no browser, DOM or timers).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const CORE = join(SRC, 'core');

/** Layer of each context (higher may import lower): kernel, effects, the domain contexts, the prestige layers, then engine/save/config. */
const LAYER: Readonly<Record<string, number>> = {
  kernel: 1,
  effects: 2,
  actions: 3,
  heat: 3,
  crits: 3,
  items: 3,
  economy: 3,
  skills: 3,
  automation: 3,
  sleeve: 3,
  resleeve: 4,
  synth: 4,
  corporation: 4,
  engine: 5,
  save: 5,
  config: 5,
};

/** Edges between contexts of the same layer that the target architecture allows ("Allowed deps" column). */
const SAME_LAYER: readonly string[] = [
  'actions -> crits',
  'actions -> items',
  'actions -> economy',
  'actions -> sleeve',
  'crits -> items',
  'automation -> items',
  'economy -> heat',
  'corporation -> synth',
  'engine -> save',
];

/**
 * Edges that break the layer rule today, each with the reason it stays. Delete a line when the edge goes away.
 * Most are type-only imports of a type owned by the wrong context; the fix is a narrow interface owned by the consumer.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'actions -> engine':
    'ActionRunner and StartCosts take the DerivedStats facade (engine/stats.ts) as a type; narrow per-service interfaces would remove it.',
  'economy -> engine': 'NetworkSystem takes the DerivedStats facade as a type (same reason as actions -> engine).',
  'resleeve -> engine': 'Resleever takes the DerivedStats facade as a type (same reason as actions -> engine).',
  'economy -> actions':
    'Economy reads the reward descriptors (actions/rewards.ts) to turn a payout into a currency; the descriptors belong in a lower layer.',
  'effects -> actions': 'Effect kinds name ActionId/ActionDefinition: type-only imports of action types.',
  'effects -> automation':
    'effects/entries/automationEntries.ts and kinds/sleeve.ts import from automation/automation.ts (the feature names and table).',
  'effects -> corporation': 'The corporation kinds name CorporationEffect/ActionId: type-only imports of corporation types.',
  'effects -> heat': 'The effect registry composes the heat entries (heat/heatEffects.ts); entry files live with their mechanic.',
  'effects -> items': 'effects/kinds/items.ts names item ids (itemTypes) and entries/itemEntries.ts imports items/inventory.ts.',
  'effects -> resleeve': 'The effect registry composes the re-sleeve entries (resleeve/resleeveEffects.ts) and their kind types.',
  'items -> actions': 'itemTypes.ts names ActionId (a drop source): type-only import.',
  'resleeve -> save': 'Resleever resets the state with save/state.ts (resetForResleeve); the reset lists belong with the state shape.',
  'resleeve -> synth': 'Resleever gives the synthetic sleeve for the run that just ended (SynthSleeves.addForResleeve).',
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

/** True when the layer rule or the same-layer table allows `from -> to`. */
function isAllowed(from: string, to: string): boolean {
  const down = (LAYER[to] as number) < (LAYER[from] as number);
  return down || SAME_LAYER.includes(`${from} -> ${to}`);
}

describe('core context boundaries', () => {
  const found = new Set<string>();
  const upward: string[] = [];
  for (const { file, targets } of importsOfCore()) {
    const from = contextOf(file);
    for (const target of targets) {
      if (!target.startsWith(CORE)) {
        if (/[\\/](app|ui|testing)[\\/]/.test(relative(SRC, target))) upward.push(`${relative(SRC, file)} -> ${relative(SRC, target)}`);
        continue;
      }
      const to = contextOf(target);
      if (from !== '(root)' && to !== '(root)' && from !== to) found.add(`${from} -> ${to}`);
    }
  }
  const broken = [...found].filter((e) => {
    const [from, to] = e.split(' -> ') as [string, string];
    return !isAllowed(from, to);
  });

  it('has every context in a layer', () => {
    const contexts = new Set([...found].flatMap((e) => e.split(' -> ')));
    expect([...contexts].filter((c) => LAYER[c] === undefined)).toEqual([]);
  });

  it('has no edge that breaks the layer rule without a named exception', () => {
    expect(broken.filter((e) => !(e in EXCEPTIONS)).sort()).toEqual([]);
  });

  it('lists no exception or same-layer edge that has gone away (the lists only shrink)', () => {
    expect(
      Object.keys(EXCEPTIONS)
        .filter((e) => !broken.includes(e))
        .sort(),
    ).toEqual([]);
    expect(SAME_LAYER.filter((e) => !found.has(e)).sort()).toEqual([]);
  });

  it('never imports app, ui or testing from production code in core', () => {
    expect(upward).toEqual([]);
  });
});
