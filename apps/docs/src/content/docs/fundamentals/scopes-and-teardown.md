---
title: Scopes and teardown
description: Choose between session, file, and test lifetimes, understand the rules between them, and know exactly when teardown runs.
status: stable
since: 0.1.0
---

Every fixture has a scope. The scope decides how long the value lives and when
its teardown runs. Picking the scope is the only performance decision most
suites have to make, and it is a one-line change.

## The decision

| Scope | Built | Torn down | Use it for | Watch out for |
| :-- | :-- | :-- | :-- | :-- |
| `"session"` | Once, on first request anywhere in the run | After the last test file | A container, a shared mock server, a pool that is expensive to start | State leaks across files: two files that write to the same shared resource see each other's writes |
| `"file"` | Once per test file | When the run moves to the next file | A database connection pool, a schema loaded per file, an in-memory store seeded per file | The fixture is rebuilt for the second file, so per-file setup cost is paid per file |
| `"test"` (default) | Once per test | Right after the test finishes, pass or fail | A temporary directory, a user record, a transaction, anything a test mutates | Setup cost per test — cache the expensive half in a longer-lived fixture instead |

Two rules of thumb:

- **Share what is expensive and read-only.** Precomputing a schema or starting
  a container in `session` scope removes that cost from every test.
- **Isolate what a test mutates.** Anything a test writes belongs in `test`
  scope, unless the tests in one file are deliberately cooperating.

## Set the scope

```ts partial
export const test = base.extend({
  container: {
    scope: "session",
    setup: async (use) => {
      const container = await startContainer();
      await use(container);
      await container.stop();
    },
  },
  connection: {
    scope: "file",
    setup: async (use, { container }) => {
      const connection = await container.connect();
      await use(connection);
      await connection.close();
    },
  },
  row: {
    setup: async (use, { connection }) => {
      const row = await connection.insert({ name: "Ada" });
      await use(row);
      await connection.delete(row.id);
    },
  },
});
```

`row` is rebuilt for every test. `connection` is shared by the tests in one
file. `container` is shared by the whole run. The ladder is visible in one
place, which is the point: a reader sees the lifetime of every resource without
reading any test.

## Scope rules

A fixture may depend only on fixtures of equal or longer lifetime:

- A `session` fixture can depend on `session` fixtures only.
- A `file` fixture can depend on `session` and `file` fixtures.
- A `test` fixture can depend on any scope.

A violation fails with `SCOPE_MISMATCH`, raised when the test is declared —
before any test body runs — and the message names both fixtures and both
scopes. The rule exists because the alternative would be a long-lived value
holding a reference to something that has already been torn down.

## Teardown order

Teardown is strictly last-in, first-out. The code after `await use(value)` in
one fixture runs only after the teardown of every fixture that depends on it
has finished. In the example above, `row` is deleted before `connection`
closes, and `connection` closes before `container` stops.

Teardown runs even when the test fails. An assertion failure, a thrown error,
and a normal finish all take the same unwinding path.

## When a teardown fails

If a teardown throws while another error is already in flight, the **first**
error is reported as the failure and later teardown errors are attached to it
as `suppressed`, so no failure is lost. A session teardown that fails outside
`bun test` is reported on stderr, with the suppressed messages included.
A teardown failure never replaces the assertion failure that caused it.

## Setup that never calls `use`

A fixture that finishes without calling `use(value)` fails with
`FIXTURE_USE_NOT_CALLED`, naming the fixture. The engine needs the `use` call
to know the fixture is ready and when to tear it down; calling it twice fails
with `FIXTURE_USE_CALLED_TWICE`.

Not awaiting `use` is allowed, and means the fixture has no teardown:

```ts partial
greeting: {
  setup: (use) => {
    use("hello"); // no teardown: nothing after the call
  },
},
```

Prefer `await use(value)`. Code after an un-awaited `use` call runs as setup,
not teardown, which is rarely what was intended.

## What the built-ins use

Every shipped fixture except one is `test`-scoped, which is why the standard
fixtures can reset time, environment, and the network per test:

| Fixture | Scope |
| :-- | :-- |
| `browser` (experimental) | `session` — one launched browser is reused for the whole run |
| Everything else: `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard`, `window`, `document`, `page`, `webPage`, `browserContext`, `browserPage`, `browserHttpMock`, `testServer`, `serverUrl`, `httpMock`, `cassette`, `snapshot` | `test` — a fresh, isolated instance per test |

A session-scoped fixture is not automatically faster for these: `testServer`
starts a `Bun.serve` instance on a random port, which costs little, while an
isolated port per test avoids cross-test coupling. If your suite needs the same
server across a whole file, override the fixture with `scope: "file"` in your
own runner and keep the teardown in your extension — see
[Composition and overrides](/bun-test-utils/fundamentals/composition/).

## Next steps

- [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/): the fixture-specific errors, with the message each one prints.
- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): dependencies, injection, and the definition contract.
- [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/): the standard fixtures that reset time, randomness, environment, and the network per test.
