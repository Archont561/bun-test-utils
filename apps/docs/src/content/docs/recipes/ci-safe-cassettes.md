---
title: CI-safe cassettes
description: Record cassette and snapshot baselines locally, commit them, and let CI replay them — without ever recording in a pipeline.
status: stable
since: 0.1.0
---

A cassette makes a network-dependent test deterministic, but only if the
recording is a reviewed artifact. The rule this recipe encodes:

> **CI replays. Only a human records.**

The package enforces the first half: when `CI` is set, `auto` mode refuses to
record, a missing cassette fails the test, and snapshots run in `ci` mode and
never write a baseline. The second half is a workflow decision, and it is the
one that keeps secrets and flaky live responses out of your history.

## The modes, and which one CI gets

| `VCR_MODE` | Records? | In CI (`CI` set) |
| :-- | :-- | :-- |
| `auto` (default) | Only when the cassette is missing | **Refuses.** A missing cassette fails the test instead of recording |
| `record` | Always, overwriting at the end of the run | Still records if you set it explicitly — do not set it in CI |
| `replay` | Never; a missing cassette fails | Same, and the explicit form if you want CI to be loud about it |
| `passthrough` | Never; ignores the cassette | Same, and it means "go to the network" — never in CI |

The default needs no configuration: pipelines that set `CI` (GitHub Actions
does) get refusal-to-record for free. Setting `VCR_MODE=replay` in the pipeline
additionally documents the intent.

## Where the files live

| Artifact | Path | Commit it? |
| :-- | :-- | :-- |
| HTTP recording | `__cassettes__/<test-slug>.json`, next to the test file | Yes |
| Callback sidecar | `__cassettes__/<test-slug>.callbacks.json` | Yes |
| Snapshot baseline | `__snapshots__/<test-slug>.snap.json` | Yes |

The conventions are fixed to the test file's directory in `0.1.x`: there is no
base-directory override. A recording's name follows the test name, so renaming
a test orphans its cassette — clear the old file when you rename.

## The recording workflow

1. **Write the test with the network in place.** Run it once locally with the
   default `auto` mode; the first run records.

   ```bash partial
   bun test tests/user.test.ts
   ```

2. **Review what was recorded**, before anything else:

   ```bash partial
   git status --short
   git diff -- __cassettes__
   ```

   Read the request URLs, status codes, and bodies. Look for tokens, cookies,
   personal data, and anything that would date badly.

3. **Re-record deliberately when the API changes.** Do not let `auto` refresh a
   request for you: a missing request fails with `CASSETTE_MISMATCH` by design,
   and the message names the clear command.

   ```bash partial
   bunx test-utils cache clear --file tests/user.test.ts --test "fetches user details"
   bun test tests/user.test.ts
   git diff -- __cassettes__
   ```

4. **Commit the cassette with the code change** that caused it, so the diff is
   reviewed as part of that change.

5. **Let CI replay.** No pipeline change is needed beyond committing the files.

## Secrets

Redaction covers sensitive request headers only, and configurable redaction is
not part of `0.1.x`. So:

- **Never record against production credentials.** Point the test at a staging
  environment or a local server, and pass throwaway values.
- **Replace credentials before the request**, not after: a token that reaches
  the recorder is in the cassette until you clear and re-record it.
- **Treat every new cassette as sensitive until you have read it.** Committed
  recordings contain real response bodies.
- **Rotate anything that was recorded by mistake.** Clearing the cassette
  removes it from the working tree, not from git history.

## What CI should not do

| Anti-pattern | Why it breaks |
| :-- | :-- |
| `VCR_MODE=record bun test` in a pipeline job | Every run rewrites recordings; the diff is never reviewed, and a live response can be captured with real data |
| Running with `CI` unset to "make it pass" | That is the failure mode the guard exists to prevent — record locally instead |
| `SNAPSHOT_MODE=update` in CI | Baselines accepted by a machine are never reviewed by a human |
| Committing `__cassettes__/` in `.gitignore` | CI then has nothing to replay, and the suite becomes network-dependent in the worst place |
| Recording against `testServer` URLs | The port changes every run, so the recording can never replay; use `httpMock` for local endpoints |

## Failure modes in CI

| Symptom | Meaning | Action |
| :-- | :-- | :-- |
| `CASSETTE_NOT_FOUND` | The test has no committed recording, or the file was cleared | Record locally, review, commit |
| `CASSETTE_MISMATCH` | The request changed (method or full URL) since the recording | Clear the test's recording locally, re-record, review the diff, commit |
| `CALLBACK_NOT_RECORDED` | The callback body changed | Re-record the callback; `cassette(fn)` refreshes a changed body in local `auto` mode with a warning |
| A snapshot test fails with a diff | The baseline is stale | Read the diff; if the change is intended, clear and re-record that one snapshot locally |
| Everything passes locally, CI fails with differences | Real time, randomness, or the network leaked into the test | Add `clock`, `seed`, and `networkGuard` — see [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/) |

## Related

- [Recording HTTP cassettes](/bun-test-utils/capabilities/cassettes/): modes, serializers, and matching rules in full.
- [Snapshot testing](/bun-test-utils/capabilities/snapshots/): the same review workflow for values.
- [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/): the one capability that needs more CI setup than a cache and a replay.
