/**
 * Deploy-time changelog collation (build-time only: nothing is committed).
 *
 * Usage: node scripts/collate-changelog.mjs <previous-deploy-sha>
 *
 * Reads `src/content/changelog.ts` as it was at the previous deploy (`git show <sha>:...`) and the commit subjects since
 * (`git log <sha>..HEAD`), and rewrites the working copy: entries added by hand since then become one; with none, the
 * player-facing commit subjects become one new entry. The logic is `deployChangelog` in `src/build/collateChangelog.ts`
 * (tested); this file only does the git, file and clock access. Needs Node 22.18+ (runs the .ts files directly).
 *
 * With no usable baseline (no argument, an all-zero sha, or a sha git does not know, e.g. after a force push) it leaves the
 * file alone and exits 0, so a deploy is never blocked by this step.
 *
 * Called by: `.github/workflows/deploy.yml`. Calls: `deployChangelog`, `renderChangelogSource`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHANGELOG_PATH = 'src/content/changelog.ts';

/** Imports a changelog.ts text by writing it to a temp file (Node strips the types itself). */
async function loadChangelog(sourceText) {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
  try {
    const file = join(dir, 'changelog.ts');
    writeFileSync(file, sourceText);
    return (await import(pathToFileURL(file).href)).CHANGELOG;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The text of changelog.ts at `sha`, or null when there is no baseline. */
function readPrevious(sha) {
  if (!sha || /^0+$/.test(sha)) return null;
  try {
    return execFileSync('git', ['show', `${sha}:${CHANGELOG_PATH}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** Commit subjects in `sha..HEAD` without merge commits, newest first. */
function readSubjects(sha) {
  return execFileSync('git', ['log', '--no-merges', '--format=%s', `${sha}..HEAD`], { encoding: 'utf8' }).split('\n');
}

/** The deploy time as an entry heading, UTC, in the style of the existing labels ("2026-10-27 13:46"). */
function deployLabel(now) {
  return now.toISOString().slice(0, 16).replace('T', ' ');
}

const { deployChangelog, renderChangelogSource } = await import('../src/build/collateChangelog.ts');

const baseline = process.argv[2];
const previousText = readPrevious(baseline);
if (previousText === null) {
  console.log('collate-changelog: no baseline, leaving the changelog as it is.');
  process.exit(0);
}

const currentText = readFileSync(CHANGELOG_PATH, 'utf8');
const current = await loadChangelog(currentText);
const result = deployChangelog({
  previous: await loadChangelog(previousText),
  current,
  subjects: readSubjects(baseline),
  label: deployLabel(new Date()),
});

if (JSON.stringify(result) === JSON.stringify(current)) {
  console.log('collate-changelog: nothing new to show, changelog unchanged.');
} else {
  writeFileSync(CHANGELOG_PATH, renderChangelogSource(currentText, result));
  console.log(`collate-changelog: changelog rewritten, top entry "${result[0]?.version}".`);
}
