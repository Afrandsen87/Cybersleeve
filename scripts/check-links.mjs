/**
 * Link check: every relative Markdown link in `docs/` (except `docs/archive`), `DESIGN.md` and `CLAUDE.md` must point at a file that exists.
 *
 * Purpose: the docs are split per context and linked from index files; a moved file must not leave a dead link behind.
 * Inputs: the Markdown files on disk. Outputs: the broken links on stdout; exit code 1 when there are any. Side effects: reads files only.
 * Called by: `npm run check` (`check:links`). Calls: node `fs`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', '.git', 'archive', 'Review 1']);

/** @returns every `.md` file under `dir`, without the skipped folders */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (SKIPPED_DIRS.has(e.name) ? [] : walk(join(dir, e.name))) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

let broken = 0;
for (const file of [...walk('docs'), 'DESIGN.md', 'CLAUDE.md']) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    if (!existsSync(normalize(join(dirname(file), target)))) {
      console.error(`${file}: broken link -> ${target}`);
      broken++;
    }
  }
}
if (broken > 0) process.exit(1);
console.log('links ok');
