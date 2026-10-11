---
title: The fixture model
description: What a fixture is, how setup and use work, how dependencies are declared and injected, and which fixtures ship built in.
status: stable
since: 0.1.0
---

A **fixture** is a typed value that a test needs, built by the framework
instead of by the test. `bun-test-utils` composes fixtures explicitly with
`test.extend()`, and a test asks for the ones it needs by destructuring them.
The engine then builds each fixture once per its scope, injects the values, and
unwinds everything in reverse order — including when a test fails.

This page explains the model. [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/)
covers lifetimes in depth, and
[Composition and overrides](/bun-test-utils/fundamentals/composition/) covers
how to organise several runners.

## The definition contract

```ts title="test.ts" runnable
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  greeting: {
    setup: async (use) => {
      await use("hello");
    },
  },
});
```

| Field | Required | Meaning |
| :-- | :-- | :-- |
| `setup` | Yes | `(use, context) => void \| Promise<void>`. Builds the value, hands it to `use(value)`, then runs teardown. |
| `scope` | No | `"session"`, `"file"`, or `"test"` (the default). How long the value lives. |
| `deps` | No | Explicit dependency list. Normally omitted — dependencies come from the destructured second parameter of `setup`. |

`use` is not a return value: it is the hand-off point. Everything before the
`await use(value)` call is setup, the argument is the value the test receives,
and everything after the call is teardown. A `setup` function that never calls
`use` fails with `FIXTURE_USE_NOT_CALLED` naming the fixture.

## How a test asks for a fixture

Destructuring the test's first parameter declares the dependency:

```ts title="greeting.test.ts" runnable
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("provides a fixture", async ({ greeting }) => {
  expect(greeting).toBe("hello");
});
```

The type of `greeting` flows from what the fixture's `setup` passed to `use`,
so `greeting` is a `string` here with no annotation and no cast.

A test only sees fixtures that its imported `test.extend()` chain carries, plus
the built-ins on the root runner. When a fixture is needed only for its side
effect — a server that must be listening, a guard that must be armed — name it
in options instead of destructuring it:

```ts partial
test("the API accepts a payload", async ({ testServer }) => {
  testServer.handle(() => Response.json({ ok: true }));
  // ...
});

test(
  "the guard is armed",
  async () => {
    // networkGuard is built and torn down around this test, but not used here
  },
  { fixtures: ["networkGuard"] },
);
```

The option object is the third argument of `test(name, fn, options)`:
`fixtures` lists names to build, `timeout` sets a per-test timeout in
milliseconds, and `iterate` defers test-scoped fixtures to `ctx.iterate(fn)`
for tests that re-run their body (see the
[Core runner and fixture API](/bun-test-utils/reference/core/#the-iteration-protocol-iterate)).

## The lifecycle, in one picture

```text
bun test
│
├─ session fixture setup ──────────────────────────────────┐   built once per run
│                                                          │
│  file: users.test.ts                                     │
│  ├─ file fixture setup ───────────────────────────┐      │   built once per file
│  │                                                │      │
│  │  test: "creates a user"                        │      │
│  │  ├─ test fixture setup ────────────────┐       │      │   built per test
│  │  │  value injected into the test body  │       │      │
│  │  ├─ teardown (LIFO) ───────────────────┘       │      │   runs even on failure
│  │  │                                             │      │
│  │  test: "deletes a user"                        │      │
│  │  ├─ test fixture setup ────────────┐           │      │   fresh instance
│  │  ├─ teardown ──────────────────────┘           │      │
│  │  │                                             │      │
│  │  └─ teardown: file-scoped fixtures ────────────┘      │   after the file's last test
│  │                                                       │
│  file: orders.test.ts  (same shape)                      │
│  │                                                       │
│  └─ teardown: session-scoped fixtures ───────────────────┘   after the last file
```

Within one test, teardown order is the strict reverse of setup order, and a
fixture's teardown never starts before the teardown of every fixture that
depends on it has finished.

## Dependencies are declared, not inferred

A fixture names its dependencies by destructuring them from `setup`'s second
parameter:

```ts partial
export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const database = await createDatabase();
      await use(database);
      await database.close();
    },
  },
  user: {
    setup: async (use, { database }) => {
      await use(await database.createUser("Ada"));
    },
  },
});
```

`user` depends on `database`, so `database` is built first even though neither
is mentioned in the test signature until the test asks for `user`. The engine
resolves the graph topologically, and a cycle fails with
`CIRCULAR_DEPENDENCY` and the cycle printed.

A fixture may depend only on fixtures with an equal or longer lifetime: a
`session` fixture cannot depend on a `test`-scoped one. The engine checks this
when the test is declared, before any body runs, and raises `SCOPE_MISMATCH`
naming both fixtures and both scopes.

## Manual setup versus a fixture

The alternative to a fixture is setup inside the test (or in `beforeEach`).
It works, and for one or two tests it is shorter:

```ts title="manual.test.ts" illustrative
import { afterEach, beforeEach, expect, test } from "bun:test";

let database: Database;

beforeEach(async () => {
  database = await createDatabase(); // createDatabase and Database are yours
});

afterEach(async () => {
  await database.close();
});

test("the user is stored", async () => {
  const user = await database.createUser("Ada");
  expect(await database.findUser(user.id)).toBeDefined();
});
```

The fixture version of the same test states the dependency in the test
signature, so a reader sees what the test needs without scrolling:

```ts title="fixture.test.ts" illustrative
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("the user is stored", async ({ database }) => {
  const user = await database.createUser("Ada");
  expect(await database.findUser(user.id)).toBeDefined();
});
```

The differences that matter as a suite grows:

| | Manual setup | Fixtures |
| :-- | :-- | :-- |
| What a test needs | Implicit: shared `let` bindings and hooks | Explicit: the destructured parameter |
| Nested resources | Ordering is up to `beforeEach`/`afterEach` blocks | Built in dependency order, torn down in reverse |
| Sharing across a file or run | A module-level singleton, managed by hand | `scope: "file"` or `scope: "session"` |
| Reuse in another suite | Copy the hooks | Import the runner, or extend it |
| Failure behaviour | Teardown runs only if the hook is reached | Teardown runs for everything already built, including on failure |

Fixtures are not free — they add a definition and an import. Use them where a
resource is created, shared, or torn down; a plain `const` inside the test is
still the right answer for a value that needs no lifecycle.

## What ships built in

The root `test` contributes nineteen fixture names. They are ordinary members
of the same namespace, and any of them can be overridden by an extension.

| Area | Fixtures | Prerequisite |
| :-- | :-- | :-- |
| Standard | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` | None |
| DOM | `window`, `document`, `page` | `happy-dom` |
| Either backend | `webPage` | `happy-dom`, or `playwright` with `BUN_TEST_UTILS_WEB_ENV=browser` |
| Browser (experimental) | `browser`, `browserContext`, `browserPage`, `browserHttpMock` | `playwright`, installed Chromium |
| Server and HTTP | `testServer`, `serverUrl`, `httpMock` | None |
| Cassettes | `cassette` | None |
| Snapshots | `snapshot` | None |

[Capability index](/bun-test-utils/capabilities/) summarises what each one is
for, and the
[Built-in fixture API](/bun-test-utils/reference/fixtures/) lists the members
each one provides.

## The two callable fixtures

`cassette` and `snapshot` are fixtures that are also callable. Both are
assertion-shaped helpers, and they solve different problems:

| Form | What each call does | Identity |
| :-- | :-- | :-- |
| `await snapshot(fn, name)` | Runs and awaits `fn`, matches the result under `name`, and returns that result. | `name` is required; this is an assertion, never a cache. |
| `await cassette(fn)` | Replays the recorded result when one exists; otherwise records according to cassette mode. | Replay is keyed by the callback's source and the mode. |

## When the model says no

| Symptom | Error | Where to look |
| :-- | :-- | :-- |
| A test asks for a name its chain does not provide | `UNKNOWN_FIXTURE` | [Composition and overrides](/bun-test-utils/fundamentals/composition/) |
| A short-lived fixture is requested by a longer-lived one | `SCOPE_MISMATCH` | [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/) |
| Two fixtures depend on each other | `CIRCULAR_DEPENDENCY` | [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/) |
| `setup` returned without calling `use` | `FIXTURE_USE_NOT_CALLED` | [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/) |

## Next steps

- [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/): pick a lifetime and understand cleanup failure.
- [Composition and overrides](/bun-test-utils/fundamentals/composition/): organise runners across modules and override safely.
- [Database fixture](/bun-test-utils/recipes/database/): put the model to work on a resource that really needs teardown.
