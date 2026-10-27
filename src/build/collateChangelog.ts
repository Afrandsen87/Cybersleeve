/**
 * @module build
 *
 * Deploy-time changelog: merging hand-written entries added since the last deploy, or making one entry from the commit subjects
 * when there are none (`deployChangelog`). Pure functions only: the file, git and clock access lives in
 * `scripts/collate-changelog.mjs`, which calls these.
 */
import type { ChangelogEntry } from '../content/changelog';

/**
 * Merges the entries added since the previous deploy into one entry.
 *
 * An entry is "added" when its `version` label is not in `previous`. Added entries are replaced by a single entry at the position
 * of the newest one: its label is the newest added label, and its changes are those of every added entry, oldest first, with exact
 * duplicate lines dropped. With fewer than two added entries nothing is merged and `current` is returned unchanged.
 *
 * @param previous - The changelog as of the last deploy (newest first). Empty when there is no baseline.
 * @param current - The changelog now (newest first).
 * @returns A new array, newest first. The inputs are not modified.
 *
 * Called by: `scripts/collate-changelog.mjs`.
 */
export function collateChangelog(previous: readonly ChangelogEntry[], current: readonly ChangelogEntry[]): ChangelogEntry[] {
  const known = new Set(previous.map((entry) => entry.version));
  const added = current.filter((entry) => !known.has(entry.version));
  if (added.length < 2) return [...current];

  const changes = [...new Set([...added].reverse().flatMap((entry) => entry.changes))];
  const merged: ChangelogEntry = { version: added[0]!.version, changes };
  const addedSet = new Set(added);
  return current.flatMap((entry) => (entry === added[0] ? [merged] : addedSet.has(entry) ? [] : [entry]));
}

/**
 * Writes `entries` back into the source text of `content/changelog.ts`.
 *
 * Everything up to and including the `CHANGELOG ... = [` line is kept (the doc comments and the interface); the array body is
 * regenerated. The output is valid TypeScript but not Biome-formatted: run `biome format` on it afterwards.
 *
 * @param source - The current text of `changelog.ts`.
 * @param entries - The entries to write, newest first.
 * @returns The new file text.
 * @throws Error when the `CHANGELOG` array declaration cannot be found.
 *
 * Called by: `scripts/collate-changelog.mjs`.
 */
export function renderChangelogSource(source: string, entries: readonly ChangelogEntry[]): string {
  const match = /export const CHANGELOG[^\n]*= \[\n/.exec(source);
  if (!match) throw new Error('changelog.ts: could not find the CHANGELOG array declaration');
  const head = source.slice(0, match.index + match[0].length);
  const body = entries
    .map(
      (entry) =>
        `  {\n    version: ${JSON.stringify(entry.version)},\n    changes: [\n${entry.changes.map((c) => `      ${JSON.stringify(c)},`).join('\n')}\n    ],\n  },\n`,
    )
    .join('');
  return `${head}${body}];\n`;
}

/**
 * Commit subjects that are not player-facing: merge commits and conventional "internal" prefixes
 * (`chore:`, `docs:`, `test:`, `refactor:`, `ci:`, `build:`, `wip:`, `internal:`, with an optional `(scope)`).
 */
const INTERNAL_SUBJECT = /^(merge\b|(chore|docs|test|tests|refactor|ci|build|wip|internal)(\([^)]*\))?!?:)/i;

/**
 * Turns commit subjects into changelog lines.
 *
 * Drops internal subjects (see `INTERNAL_SUBJECT`) and empty ones, trims, removes exact duplicates and reverses the order, so the
 * result reads oldest first.
 *
 * @param subjects - Commit subject lines, newest first (the order of `git log`).
 * @returns The changelog lines, oldest first.
 *
 * Called by: `deployChangelog`.
 */
export function commitLines(subjects: readonly string[]): string[] {
  const lines = subjects.map((subject) => subject.trim()).filter((subject) => subject !== '' && !INTERNAL_SUBJECT.test(subject));
  return [...new Set(lines.reverse())];
}

/** What `deployChangelog` needs to know about this deploy. */
export interface DeployChangelogInput {
  /** The changelog as of the last deploy (newest first). */
  readonly previous: readonly ChangelogEntry[];
  /** The changelog now (newest first). */
  readonly current: readonly ChangelogEntry[];
  /** Commit subjects since the last deploy, newest first. */
  readonly subjects: readonly string[];
  /** The heading for an entry made from commit subjects (the deploy time, supplied by the caller). */
  readonly label: string;
}

/**
 * Builds the changelog for this deploy.
 *
 * If entries were added by hand since the last deploy they win: they are merged into one (`collateChangelog`) and the commit
 * subjects are ignored (the hand-written text is curated, and mixing both would list the same change twice). Otherwise the
 * player-facing commit subjects become one new entry at the top, labelled `label`. With neither, `current` is returned unchanged.
 *
 * @param input - See `DeployChangelogInput`.
 * @returns A new array, newest first. The inputs are not modified.
 *
 * Called by: `scripts/collate-changelog.mjs`. Calls: `collateChangelog`, `commitLines`.
 */
export function deployChangelog(input: DeployChangelogInput): ChangelogEntry[] {
  const known = new Set(input.previous.map((entry) => entry.version));
  if (input.current.some((entry) => !known.has(entry.version))) return collateChangelog(input.previous, input.current);

  const changes = commitLines(input.subjects);
  if (changes.length === 0) return [...input.current];
  return [{ version: input.label, changes }, ...input.current];
}
