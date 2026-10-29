// Writes AGENTS.md from CLAUDE.md so another coding agent can take over if Claude Code is unavailable.
// Run by hand with `npm run agents:sync`; nothing calls it automatically. Not part of `npm run check`.
// Inputs: CLAUDE.md in the repo root. Output: AGENTS.md (a generated copy with a header). Side effects: overwrites AGENTS.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
const header =
  '<!-- Generated from CLAUDE.md by scripts/sync-agents.mjs. Edit CLAUDE.md, then run `npm run agents:sync`. -->\n\n';

writeFileSync(join(root, 'AGENTS.md'), header + source);
console.log('AGENTS.md written from CLAUDE.md');
