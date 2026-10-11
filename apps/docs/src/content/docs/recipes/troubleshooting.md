---
title: Troubleshooting
description: Setup, runtime, and CI symptoms across every capability, with the cause and the recovery step for each.
status: stable
since: 0.1.0
---

Organised by what you observe. Fixture-specific errors have their own page:
[Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/).

## Setup: nothing runs at all

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `Cannot find package "@archont561/bun-test-utils"` | The package is not installed in the project that runs the test, or the command ran in a different directory | `bun add -d @archont561/bun-test-utils` beside the `package.json` that owns the test |
| Tests pass, but session-scoped fixtures never tear down | The preload from `test-utils init` is missing from `bunfig.toml`, so the run has no teardown hooks | `bunx test-utils init --yes`, then check `[test].preload` |
| A fixture "does not exist" that you can see in another file | The test imports `bun:test` or the package instead of the composed runner | Import the runner module: `import { test } from "./test"` |
| The same fixture name behaves differently in two files | One file imports an extended runner, the other the parent | Sibling modules do not share fixtures; import the runner that has the fixture you need |
| `test-utils: command not found` | The CLI is run from the repo root without `bunx`, or the package is not installed | `bunx test-utils <command>` from the project directory |
| Fixtures are not discovered from the file tree, as expected | By design: composition is explicit | Import the `test.extend()` chain — see [Composition and overrides](/bun-test-utils/fundamentals/composition/) |

## Setup: a capability refuses to start

Each message names the exact install command.

| Error | Capability | Fix |
| :-- | :-- | :-- |
| `'happy-dom' is required for DOM fixtures. Install via 'bun add -d happy-dom'.` | DOM fixtures, default `webPage` backend | `bun add -d happy-dom` |
| `'playwright' is required for browser fixtures. Install via 'bun add -d playwright'.` | Browser fixtures | `bun add -d playwright` |
| `test.prop() requires 'fast-check'. Install via 'bun add -d fast-check'.` | Property tests | `bun add -d fast-check` |
| `test.scenario() requires '@aboviq/bun-test-cucumber'. Install via 'bun add -d @aboviq/bun-test-cucumber'.` | BDD scenarios | `bun add -d @aboviq/bun-test-cucumber` |
| `FIXTURE_SETUP_FAILED`: "No browser is available — both the headless shell and the full chromium build failed to launch." | Browser fixtures | `bunx playwright install chromium` (the message names this repository's alias, not a consumer command) |
| The same error on Linux with a launch failure unrelated to a missing file | Browser fixtures, missing system libraries | `bunx playwright install --with-deps chromium`, or use [Playwright's container](https://playwright.dev/docs/docker) |

All four peer errors carry the code `MISSING_OPTIONAL_DEPENDENCY`; the browser
launch failure carries `FIXTURE_SETUP_FAILED` with the original error as
`cause`.

## Runtime: network and time

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `networkGuard blocked unexpected fetch: GET https://…` | The test requested `networkGuard` and fetched a URL it never allowed | Allow it deterministically, or mock it — see [matchers](/bun-test-utils/capabilities/http-and-servers/#what-a-matcher-matches) |
| A mock never matches | A bare origin string such as `"https://api.example.com"` is compared as a whole URL | Use `"/api/user"`, a `RegExp`, or the full URL |
| A mocked URL still throws a guard error | `httpMock` is listed before `networkGuard`, so the guard wraps the mock | List `httpMock` after `networkGuard` |
| A test reaches the network in CI and fails | Nothing intercepts it: no mock and no guard | Mock it with `httpMock`, or record it as a cassette |
| Time is real again in the middle of a test | The `clock` fixture was not requested by that test | Destructure `clock`; the fixture is test-scoped, not global |
| A test passes alone and fails in a file | State is leaking through a `file`- or `session`-scoped fixture | Move the mutated state to `test` scope, or reset it in the shared fixture's teardown |

## Runtime: cassettes and snapshots

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `CASSETTE_NOT_FOUND` | Replay mode with no cassette for the test | Record it: run without `VCR_MODE=replay`, or clear and re-record |
| `CASSETTE_MISMATCH` | The request is not in the existing cassette: method or full URL changed | Clear the test's recording, run again to record, review the diff |
| A `testServer` cassette never replays | The URL contains the random port, which changes every run | Record against a stable URL, or use `httpMock` for local endpoints |
| `CASSETTE_NOT_FOUND` only in CI | `CI` makes `auto` refuse to record | Record locally, commit `__cassettes__/`, then push — see [CI-safe cassettes](/bun-test-utils/recipes/ci-safe-cassettes/) |
| A snapshot is never written | `CI` is set, or `SNAPSHOT_MODE=ci` | Unset `CI` or use `SNAPSHOT_MODE=update` for the recording run |
| A snapshot mismatch after an intended change | The baseline is stale | Read the diff, then clear one test's snapshot and re-record it |
| `CALLBACK_NOT_RECORDED` | The callback body changed, so its source text no longer matches | Re-record the callback, and review the sidecar diff |
| `CALLBACK_AMBIGUOUS` | One source text was recorded from two different closures | Replay the closure you recorded, or give each one its own function |
| `CALLBACK_NOT_SERIALIZABLE` | The callback returned something that is not plain data | Convert the value inside the callback, or register a serializer |
| `CALLBACK_SERIALIZER_NOT_FOUND` | A recording needs a serializer name and version that is not registered | Register the exact serializer, or clear and re-record |
| `CALLBACK_STORE_INVALID` | The `.callbacks.json` sidecar is corrupt | Delete the sidecar; the next recording run rewrites it |

## CI

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| Browser tests fail only on CI | The Chromium build or its shared libraries are missing on the runner | `bunx playwright install --with-deps chromium` before the test step, and cache `~/.cache/ms-playwright` — see [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/) |
| Cassettes fail with a missing recording | The cassette was never committed, or was cleared locally | Commit `__cassettes__/`; `git checkout -- <path>` restores one deleted by mistake |
| A snapshot test fails with "missing snapshot" | The baseline is not committed | Commit `__snapshots__/` with the change that produced it |
| Tests pass locally and fail on CI with different timings | Real time or real randomness in the test | Request `clock` and `seed` — see [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/) |
| Windows runners fail | Windows is not supported in `0.1.x` | Run the suite on Linux or macOS; Windows support is planned |

## Platform and version

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| An unexpected Bun API error | Bun older than 1.1.0 | Upgrade Bun; the supported range is in the package's `engines` field |
| Import errors from a subpath such as `/snap` | The subpath is helper-only and exports no runner | Import fixtures from the package root; the subpaths export typed definitions and serializer contracts — see [Imports](/bun-test-utils/reference/core/#imports) |
| A capability behaves differently after an upgrade | It is experimental (browser or BDD) | Read [Release notes](/bun-test-utils/project/releases/) and [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/) |

## Still blocked?

1. Reproduce with `BUN_TEST_UTILS_DEBUG=1 bun test <file>` to see engine diagnostics.
2. Check the error's `code` in the [error-code list](/bun-test-utils/reference/cli/#error-codes).
3. Reduce the file to one test and one fixture. If the failure survives that, it
   is a bug worth reporting.
4. [Open a bug report](https://github.com/Archont561/bun-test-utils/issues/new?template=bug_report.yml)
   with `bun --version`, the OS, the code, and the full output. The page footer
   has a pre-filled link for documentation problems.
