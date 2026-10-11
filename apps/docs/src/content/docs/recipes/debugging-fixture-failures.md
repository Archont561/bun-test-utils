---
title: Debugging fixture failures
description: What each fixture error means, which mistakes produce it, and how to recover — with the real messages the engine prints.
status: stable
since: 0.1.0
---

Fixture errors are raised either when a test is declared (before any body runs)
or while its fixtures build. Both are early: a suite with a broken fixture
graph fails at load, not in the middle of an assertion. Every error carries a
machine-readable `code`; the four templates in
[Error-message compatibility](/bun-test-utils/reference/cli/#error-message-compatibility)
are also stable as text.

## First: get the code, not the sentence

```ts partial
try {
  // ... something that builds fixtures
} catch (error) {
  const { code, details } = error as { code?: string; details?: unknown };
  console.error(code, details);
}
```

In a failing test the code is on the thrown error. `details` is structured:
`UnknownFixtureError` carries `available` and `file`, the scope error carries
both scopes and both names, and the circular error carries the `trail`.
Prefer these over parsing the message.

## `UNKNOWN_FIXTURE`

```text
[bun-test-utils] unknown fixture "user" requested in /app/users.test.ts. Available in this explicit test.extend(...) chain: database, testFile, testName. Compose the fixture with test.extend({ user: ... }) and import that extended test into this file.
```

| Cause | Check |
| :-- | :-- |
| The test imports `test` from `bun:test` or from the package instead of the local composed runner | The import line: it must be `import { test } from "./test"` (or whichever module composes the fixture) |
| The fixture was added to a different runner than the one imported | The `test.extend()` chain the file imports; sibling modules do not share fixtures |
| Typo in the destructured name | The `Available …` list in the message is the authoritative list for that file |

## `SCOPE_MISMATCH`

```text
[bun-test-utils] scope mismatch: "user" (test) cannot depend on "connection" (file) — a fixture may only use equally or longer-lived fixtures.
```

Raised when the test is declared, so it fails before any body runs. The cause is
always the same shape: a shorter-lived fixture is referenced from a
longer-lived one. Two ways out:

- **Move the dependency up the ladder.** If `connection` really must exist for
  the whole run, give it `scope: "session"`, or make the dependent fixture
  `file`-scoped so the lifetimes match.
- **Narrow the dependency.** If the long-lived fixture only needs a value the
  short-lived one produces, compute that value inside the long-lived fixture
  instead of requesting the fixture.

[Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/#scope-rules)
has the full rule table.

## `CIRCULAR_DEPENDENCY`

```text
[bun-test-utils] circular fixture dependency: a → b → a (/app/test.ts)
```

Two `setup` functions destructure each other — directly or through a longer
cycle. The trail shows the cycle in build order. Break it by lifting the shared
value into a third fixture both depend on, or by passing the value as an
argument inside the test body instead of through a fixture.

## `FIXTURE_USE_NOT_CALLED` and `FIXTURE_USE_CALLED_TWICE`

```text
[bun-test-utils] fixture "greeting" finished without calling use(value)
```

| Cause | Fix |
| :-- | :-- |
| An early `return` skips the `use` call | Call `use` on every path, or throw deliberately |
| The setup code throws before reaching `use` | The thrown error is the real failure; it surfaces with this code as context |
| An `if/else` where only one branch calls `use` | Call `use` once, after the branch |
| `use` is called in a loop or twice | Call it once; for repeated values, build a list first |

Not awaiting `use` is allowed and simply means no teardown — but code written
after an un-awaited `use` runs as setup, not teardown, which is a common source
of "cleanup happened too early".

## `FIXTURE_SETUP_FAILED`

A built-in fixture could not start its resource. The thrown error's `cause` is
the original failure, and the message names what to install or configure. The
browser fixture is the usual source:

```text
[@bun-test-utils/browser] No browser is available — both the headless shell and the full chromium build failed to launch. Run 'bun run install-browsers' to install chromium and firefox via the standard Playwright installer.
```

For a consumer project the correct command is `bunx playwright install chromium`
(the message names this repository's own alias). See
[Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/) and
[DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/#troubleshooting).

## Failures that are not errors

| Symptom | Explanation |
| :-- | :-- |
| A `session` fixture is still alive after the first test | Expected: `session` teardown runs after the last test file, not after a test. |
| A `file` fixture was built twice in one run | Expected: it is rebuilt for each file. |
| A property test builds a `test`-scoped fixture many times | Expected: once per generated sample and per shrink step. |
| Teardown ran even though the test failed | Expected: the unwinding path is the same for a failure, a throw, and a normal finish. |
| The reported failure is not the teardown error | Expected: the first error wins; later teardown errors are attached as `suppressed`. |
| A test file takes longer after adding fixtures | Check the scope: a `test`-scoped fixture that is expensive to build multiplies its cost by the number of tests. |

## Seeing more

| Tool | What it gives |
| :-- | :-- |
| `error.code` and `error.details` | Structured cause information, stable across releases |
| `BUN_TEST_UTILS_DEBUG=1` | Opt-in engine diagnostics on stderr: session-teardown failures and cassette refresh warnings. It is not a general verbose log; fixture builds are not printed. |
| The `Available …` list in an unknown-fixture message | The exact fixture names the file's chain provides |

## Related

- [Troubleshooting](/bun-test-utils/recipes/troubleshooting/): symptoms that are not fixture-specific.
- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): the definition contract these errors enforce.
- [CLI, environment variables, and errors](/bun-test-utils/reference/cli/#error-codes): every code and what raises it.
