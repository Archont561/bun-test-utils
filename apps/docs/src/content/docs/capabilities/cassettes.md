---
title: Recording HTTP cassettes
description: Record a callback's result and record and replay HTTP traffic with the cassette fixture, with deterministic, committed recordings.
status: stable
since: 0.1.0
---

The `cassette` fixture records results once and replays them afterwards, so a
test that depends on a network call or a slow computation runs the same way
every time. It has two parts:

- **Callback recording.** `cassette(callback)` is a get-or-record wrapper. The
  explicit `cassette.record(callback)` always runs an unrecorded callback, and
  `cassette.replay(callback)` returns a stored result without running it.
- **HTTP recording.** While the fixture is open, `fetch` traffic is captured
  under `__cassettes__/` on the first run and replayed from that file
  afterwards, with no network access.

The stable surface is deliberately small — callable `cassette(callback)`, its
explicit `record`/`replay` methods, `cassette.addSerializer(serializer)`, the
`/vcr` global serializers, and HTTP matching by the uppercase method plus the
full URL, both exact. Matcher DSLs, configurable redaction, and cassette
migration tooling are not part of `0.1.x`.

## Installation

`cassette` is on the root `test` context, so there is no extra dependency
beyond the package itself:

```bash runnable
bun add -d @archont561/bun-test-utils
```

## Record and replay a callback

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test("replays a user lookup", async ({ cassette }) => {
  let calls = 0;
  const loadUser = async () => {
    calls++;
    return { id: "user-1", name: "Ada" };
  };

  expect(await cassette.record(loadUser)).toEqual({ id: "user-1", name: "Ada" });
  expect(await cassette.replay(loadUser)).toEqual({ id: "user-1", name: "Ada" });
  expect(calls).toBe(1); // the callback ran once
});
```

Replay the same function you recorded. Within a run, a function is identified
by its object. In a later run, a function whose source text matches a recording
is matched to it, as long as every recording with that source text holds the
same result; otherwise `replay` throws `CALLBACK_AMBIGUOUS` without running the
callback.

Two closures created by one factory are separate callbacks: each runs once and
keeps its own result. A closure with different captured values can still match
a recording of the same code, so replay the closure you recorded when the
captured values differ.

## Get or record with `cassette(fn)`

For the usual cache lookup, call the fixture itself. The callable keeps all the
object methods, so serializers and explicit modes still work:

```ts partial
test("gets or records a profile", async ({ cassette }) => {
  const loadProfile = () => api.profiles.get("ada");

  const profile = await cassette(loadProfile);
  expect(profile.id).toBe("ada");
});
```

In `record` mode the callable records. In `replay` mode it is strict and never
runs a missing callback. In `passthrough` mode it runs the callback without
storing the result. In local `auto` mode it records on a first run; when an
existing cassette has no matching **callback source**, it records the callback
again, replaces stale sidecar entries at teardown, and writes one warning
beginning `[bun-test-utils/vcr] cassette(fn) re-recorded callback`.

That exception is deliberately limited to this wrapper. A missing HTTP request
still fails with `CASSETTE_MISMATCH`, direct `cassette.replay(callback)` stays
strict, and a callback miss in CI never runs or writes. The warning and the
resulting sidecar diff make a local refresh visible for review.

Callback identity remains exact function source text. Captured values, module
state, environment values, and changed imported helper implementations are not
part of that text. If one of those hidden inputs changed while the source did
not, use explicit `VCR_MODE=record` or clear the recording and review the
replacement. The callable intentionally takes no separate key or version
argument.

## Serializable values

Callback results round-trip through versioned serializers. These built-ins are
included:

- `Date`, `BigInt`, `Map`, `Set`, `RegExp`, `Error`
- typed arrays and `ArrayBuffer`
- `NaN`, `Infinity`, `-Infinity`, and `-0`

```ts partial
test("replays an account", async ({ cassette }) => {
  const account = () => ({
    createdAt: new Date(0),
    roles: new Map([["admin", true]]),
    balance: 10n,
  });

  expect(await cassette.record(account)).toEqual(account());
  expect(await cassette.replay(account)).toEqual(account());
});
```

Everything else must be plain data: `null`, booleans, strings, finite numbers,
arrays without holes, and plain objects. Anything else makes `record` throw a
`CassetteError` with the code `CALLBACK_NOT_SERIALIZABLE`; the error names the
path to the value, and nothing is stored. A class instance, a function, a
symbol, a sparse array, or a circular structure all fail this way.

The fix is to convert the value inside the callback, or to teach the cassette
fixture the type:

```ts partial
import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";

class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

const pointSerializer = defineCallbackSerializer<Point>({
  name: "point",
  version: 1,
  test: (value) => value instanceof Point,
  serialize: (point) => ({ x: point.x, y: point.y }),
  deserialize: (data) => {
    const { x, y } = data as { x: number; y: number };
    return new Point(x, y);
  },
});

test("replays a point", async ({ cassette }) => {
  cassette.addSerializer(pointSerializer);
  const load = () => new Point(1, 2);

  expect(await cassette.record(load)).toEqual(load());
  expect(await cassette.replay(load)).toEqual(load());
});
```

### Share a serializer from a preload

When every cassette in a process needs the same custom class, register it once
from a Bun preload instead of repeating `cassette.addSerializer(...)`. Import
the public `/vcr` subpath: it shares registrations with the root cassette
plugin even though the entrypoints are bundled separately.

```ts title="test-serializers.ts" partial
import {
  defineCallbackSerializer,
  registerCallbackSerializer,
} from "@archont561/bun-test-utils/vcr";

export class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

export const pointSerializer = defineCallbackSerializer<Point>({
  name: "point",
  version: 1,
  test: (value) => value instanceof Point,
  serialize: (point) => ({ x: point.x, y: point.y }),
  deserialize: (data) => {
    const { x, y } = data as { x: number; y: number };
    return new Point(x, y);
  },
});

registerCallbackSerializer(pointSerializer);
```

```toml title="bunfig.toml" partial
[test]
preload = ["./test-serializers.ts"]
```

Global registrations last for the Bun process. `registerCallbackSerializer`
returns the serializer object; if a helper owns a temporary registration, call
`unregisterCallbackSerializer(serializer)` in cleanup. It removes every
registration of that exact object and returns `true` when it removed one or
more.

Fixture-local serializers stay available and win over globals. The selection
order is newest fixture-local registration, newest global registration, then
built-ins, so a focused test can override a project preload.

Serializers are named and versioned, and each encoded payload records both.
Two failures are reported by code:

- `CALLBACK_SERIALIZER_NOT_FOUND`: a recording needs an exact serializer name
  and version that is not registered. Replay fails rather than returning a
  wrong value; a same-name, different-version registration is also an error,
  and `cassette(fn)` never silently re-records a serializer migration.
- `CALLBACK_SERIALIZER_FAILED`: a serializer threw. The error wraps the
  original cause.

Information not preserved by the built-ins: unknown `Error` subclass
constructors, non-enumerable error properties such as `cause`,
`RegExp.lastIndex`, and shared-reference identity.

## Callback results persist across runs

Callback results are saved per test in `__cassettes__/<test>.callbacks.json`,
next to the HTTP cassette. `record` writes this run's results when the test
ends, including an explicit `record` or a successful local-auto `cassette(fn)`
refresh. Each write contains this run's recordings only, so an edited callback
source replaces its stale sidecar entry. `replay` reads the sidecar in replay
mode only, so a later run can replay a callback that an earlier run recorded
without running it.

Three more failures are reported by code:

- `CALLBACK_NOT_RECORDED`: the callback's body changed, so its source text no
  longer matches a recording. The error names the file to re-record.
- `CALLBACK_AMBIGUOUS`: one source text was recorded from more than one
  closure, so their captured values cannot be told apart across runs.
- `CALLBACK_STORE_INVALID`: the sidecar file is corrupt. This fails at setup.

The cassette file itself still holds only HTTP entries.

## Record and replay HTTP traffic

The default mode is `auto`: the first run of a test records its HTTP traffic
under `__cassettes__/`, next to the test file, and later runs replay it without
network access.

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test("fetches user details", async ({ cassette }) => {
  // Requesting the fixture turns interception on for this test.
  expect(cassette).toBeDefined();

  const response = await fetch("https://api.example.test/users/user-1");
  expect(await response.json()).toEqual({ id: "user-1" });
});
```

Commit `__cassettes__/` so CI replays the same recordings.

| `VCR_MODE` | Behaviour |
| :-- | :-- |
| `auto` (default) | Replays when the cassette exists and records when it does not. With `CI` set, a missing cassette fails instead of recording. |
| `record` | Goes to the network on every run and overwrites the cassette when the run ends. |
| `replay` | Never goes to the network. A missing cassette fails. |
| `passthrough` | Ignores the cassette entirely. |

A test whose body fails writes nothing in `auto` mode, so a broken first run
cannot leave a partial recording behind.

:::caution[CI and secrets]
- **A recording run never happens in CI.** `CI` makes `auto` refuse to record,
  so a missing cassette fails the build instead of silently capturing a live
  response. See [CI-safe cassettes](/bun-test-utils/recipes/ci-safe-cassettes/).
- **Do not record secrets.** Redaction covers sensitive request headers only,
  and configurable redaction is not in this release. Remove or replace
  credentials before a request reaches the recorder.
- **Review every new recording before committing it.** Committed cassettes
  contain real response bodies, and the file format is not yet a stable public
  format: treat them as generated test artifacts owned by the version that
  wrote them.
:::

Replay compares the uppercase request method and the full URL, exactly. It does
not match partial URLs, regular expressions, request bodies, or custom
predicates. Because the URL includes the port, a recording of a request to
`testServer` will not replay on the next run — that server binds a new port each
time. Record against a stable URL, or stub local endpoints with `httpMock`
instead. In `auto` mode, a request that is missing from an existing cassette
fails with `CASSETTE_MISMATCH`, and the message names the command that clears
the test's recording. The request never reaches the network and is never
recorded silently.

## Clear a recording

When an HTTP request changes, or when a callback's hidden inputs change without
changing its source, clear its recording and run the test again. A changed
callback body passed through local-auto `cassette(fn)` refreshes itself
visibly instead: it warns and replaces the sidecar entry.

```bash partial
bunx test-utils cache clear --file tests/user.test.ts --test "fetches user details"
bunx test-utils cache clear --file tests/user.test.ts
bunx test-utils cache clear --all
bunx test-utils cache clear --all --dry-run
```

Choose one scope:

- `--file <path>` clears every test in the file. The command finds test names
  by reading the file's literal names, so a name built at runtime needs
  `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under
  the project root — the nearest `package.json` at or above the working
  directory, skipping `node_modules`.

`--dry-run` lists the files and deletes nothing. In an interactive terminal
without `CI`, the command shows the matched files as a multi-select, all
selected by default, and asks before deleting; `--yes` skips both steps.
Outside a terminal the explicit scope is the confirmation. The command removes
`<name>.json`, `<name>.callbacks.json`, and `<name>.snap.json` files, never a
directory. Because recordings are committed, `git checkout -- <path>` restores
a file deleted by mistake.

The real `globalThis.fetch` is restored when the fixture tears down, including
when the test fails.

## Related

- [Snapshot testing](/bun-test-utils/capabilities/snapshots/): the same commit-and-review workflow applied to values.
- [CI-safe cassettes](/bun-test-utils/recipes/ci-safe-cassettes/): record locally, replay in CI, review the diff.
- [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/): cassette members, serializer contracts, and error codes.
