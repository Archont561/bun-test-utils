# 0044 — Tag-based test filtering without a runner flag

- **Status:** accepted
- **Date:** 2026-11-10

## Context

The suite has no way to group tests by intent and run a subset other than
`bun test --test-name-pattern`, which matches names, not semantics. Filtering
"only the fast tests" or "everything except the slow filesystem tests" then
depends on naming discipline that reviewers must remember.

Bun 1.4.2 does not offer a tag facility to build on. `bun test --help` lists
`--test-name-pattern`, `--only`, `--todo`, `--concurrent`, `--bail`, and the
coverage/sharding flags — there is no `--tags` or `--marker`, and a test's
option object accepts `timeout`, `retry`, and `repeats` only. A package cannot
add a flag to `bun test`; it can only decide what to do at declaration time.

The feature request proposed `test.use({ tags: [...] })`. There is no
`test.use` in this package — `use` is the fixture setup callback
(`await use(value)`), and borrowing the name for runner options would collide
with the fixture contract. The natural home is the options object `test`
already accepts: `fixtures`, `timeout`, and `iterate`.

## Decision

1. **Tags are an option on the existing third argument.** A test declares them
   as `test("name", fn, { tags: ["fast", "filesystem"] })`. Tags are
   non-empty, case-sensitive strings; duplicates within one declaration are
   ignored. Other option keys (`fixtures`, `timeout`, `iterate`) are unaffected
   and combine freely.

2. **The filter is an environment variable, not a runner flag.**
   `BUN_TEST_UTILS_TAGS` holds a comma- or space-separated list:
   - `fast` — a positive filter: only tests tagged `fast` run.
   - `!slow` — an exclusion: tests tagged `slow` do not run.
   - `fast,!slow` — both: only fast tests that are not also slow.
   Whitespace around entries is trimmed, empty entries are ignored, and an
   unset or empty variable means "no filter". This works with a plain
   `bun test`, needs no wrapper binary, and can be set per run in a script or
   CI job.

3. **Filtering happens at declaration time and reports as skipped.** A test
   whose tags do not pass the filter is registered through Bun's `test.skip`,
   so it appears as skipped in the run summary rather than disappearing.
   Under a positive filter, untagged tests are skipped too; with exclusions
   only, untagged tests run. A test with several tags runs if any tag matches a
   positive filter and no tag matches an exclusion.

4. **Filtered-out tests do not resolve fixtures.** The same rule as
   [ADR 0043](./0043-fixture-aware-test-modifiers.md) point 3 applies: fixture
   detection and `resolveOrder()` are deferred into the body, which Bun never
   calls. Filtering out a test cannot fail a run because of that test's fixture
   names.

5. **Scope of v1.** Per-test declaration only: no `describe`-level tags, no tag
   inheritance through `test.extend()`, no runtime tag API, and no `test-utils
   test` CLI wrapper. A future CLI command would only set the environment
   variable; it would not be a second filtering implementation. `describe`
   remains Bun's unwrapped `describe`.

## Consequences

**Good**

- `BUN_TEST_UTILS_TAGS=fast bun test` and `BUN_TEST_UTILS_TAGS='!slow' bun test`
  cover the two real use cases without touching test bodies.
- Filtered tests remain visible as skipped, so a filtered run cannot be
  mistaken for a run in which the tests passed.
- No new exported values, no runner patching, no monkey-patching of
  `bun:test`, and the same mechanism works under `--parallel` and `--shard`
  because it is decided inside each file.
- The option object stays the single place where per-test runner options live.

**Bad**

- The filter is an environment variable: it is invisible in `bun test --help`
  and must be documented, and a typo silently matches nothing (an unmatched
  positive filter skips everything with a visible skip count).
- Tags are not inherited from `describe`, so grouping still needs repeating the
  tag on each test.
- No completion or validation of tag names; a misspelled tag under a positive
  filter just excludes the test.
- The suite's own tests must not depend on the caller's environment, so
  conformance tests set and restore `BUN_TEST_UTILS_TAGS` explicitly.

## Alternatives considered

- **`test.use({ tags })` as requested.** Rejected: `use` is the fixture setup
  callback, and a runner-options method would be a second, competing options
  channel next to the third argument.
- **A `--tags` flag.** Not possible: `bun test` owns its flag parsing, and a
  preload script cannot register new CLI flags.
- **Encode tags in the test name (`"name @fast"`) and recommend
  `--test-name-pattern`.** Rejected: it pollutes reporting and reintroduces
  name-regex coupling, which is the problem being solved.
- **Skip filtering when the environment variable is unset but expose a
  programmatic API (`configureTags()`).** Deferred: configuration without a
  runner flag tends to become per-file boilerplate; the environment variable
  is the smallest thing that works with plain `bun test`.
- **Remove filtered tests entirely instead of registering them as skipped.**
  Rejected: silent disappearance makes a filtered run indistinguishable from a
  run in which those files do not exist.
