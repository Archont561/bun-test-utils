/**
 * Tag-based test filtering (ADR 0044).
 *
 * Bun 1.4.2 has no tag or marker facility — `bun test --help` lists only
 * `--test-name-pattern`, `--only`, and `--todo` — and a package cannot add a
 * flag to the runner. Filtering therefore happens where the package already
 * has control: at declaration time, against one environment variable.
 *
 * The filter is deliberately small: a list of tags to include and a list to
 * exclude, both read from `BUN_TEST_UTILS_TAGS`. A declaration that does not
 * pass is registered through Bun's `test.skip`, so it stays visible in the
 * run summary.
 */

/** Environment variable that selects a subset of tagged tests. */
export const TAG_FILTER_ENV = "BUN_TEST_UTILS_TAGS";

/** A parsed `BUN_TEST_UTILS_TAGS` value: `fast,!slow` → `{include:[fast], exclude:[slow]}`. */
export interface TagFilter {
  include: string[];
  exclude: string[];
}

/**
 * Parses `BUN_TEST_UTILS_TAGS`. Entries are separated by commas or whitespace;
 * a leading `!` marks an exclusion. An unset, blank, or purely separators
 * value means "no filter".
 */
export function parseTagFilter(raw: string | undefined): TagFilter | undefined {
  if (!raw) return undefined;

  const include: string[] = [];
  const exclude: string[] = [];

  for (const entry of raw.split(/[\s,]+/)) {
    if (!entry) continue;
    const excluded = entry.startsWith("!");
    const tag = excluded ? entry.slice(1).trim() : entry;
    if (!tag) continue;
    const bucket = excluded ? exclude : include;
    if (!bucket.includes(tag)) bucket.push(tag);
  }

  return include.length > 0 || exclude.length > 0
    ? { include, exclude }
    : undefined;
}

/**
 * Whether a declaration passes the filter.
 *
 * - No filter: everything runs.
 * - An excluded tag always wins, even when another tag matches an inclusion.
 * - With at least one inclusion, only tagged matches run (untagged tests are
 *   skipped); with exclusions only, untagged tests keep running.
 */
export function tagFilterAccepts(
  filter: TagFilter | undefined,
  tags: readonly string[] | undefined,
): boolean {
  if (!filter) return true;

  const declared = new Set(tags);
  if (filter.exclude.some((tag) => declared.has(tag))) return false;
  if (filter.include.length === 0) return true;
  return filter.include.some((tag) => declared.has(tag));
}

/** Reads and parses the filter from the environment of the current run. */
export function currentTagFilter(): TagFilter | undefined {
  return parseTagFilter(process.env[TAG_FILTER_ENV]);
}
