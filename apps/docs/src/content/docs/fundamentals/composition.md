---
title: Composition and overrides
description: Organise runners across modules, extend them without touching the parent, and override built-in fixtures deliberately.
status: stable
since: 0.1.0
---

Fixtures are composed with `test.extend()`. A test gets exactly the fixtures in
the runner it imports, and nothing else — so how you split runners across
modules is how you control what each test file can reach.

## Define a runner

Export a runner created with `test.extend()` from a module. The module is the
complete definition of what its tests can request:

```ts title="test.ts" illustrative
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const database = await createDatabase();
      await use(database);
      await database.close();
    },
  },
});
```

A test imports that runner:

```ts title="users.test.ts" illustrative
import { test } from "./test";

test("uses the database", async ({ database }) => {
  // database is typed and scoped by the extension chain
});
```

## Extend a runner

Calling `extend()` returns a new runner. Child modules add fixtures without
touching the parent:

```ts title="test-with-user.ts" illustrative
import { test as databaseTest } from "./test";

export const test = databaseTest.extend({
  user: {
    setup: async (use, { database }) => {
      await use(await database.createUser("Ada"));
    },
  },
});
```

Some files need the database and the user; others need only the database. Each
imports the runner that matches its needs, and each runner stays a short,
readable list.

## A layout that scales

There is no convention to follow — a fixture is available exactly where you
import it — so pick a layout that matches the suite's shape. Two that work:

```text partial
Project with one shared base               Project with per-area runners
────────────────────────────               ──────────────────────────────
test.ts            base + everything       testing/db.ts       container, database
users.test.ts      import "./test"         testing/http.ts     db.ts + testServer
orders.test.ts     import "./test"         testing/ui.ts       http.ts + webPage
                                           users.test.ts       import testing/db
                                           api.test.ts         import testing/http
                                           checkout.test.ts    import testing/ui
```

The left layout is simpler and fine while a suite is small. The right one
keeps a unit test from loading Playwright or `happy-dom` because a sibling
directory wanted them: a capability peer is loaded only when a requested
fixture needs it.

## One namespace, last definition wins

All fixtures share one flat namespace, built-in capabilities included. When two
definitions use the same name, the later one replaces the earlier one. That
applies to your own fixtures and to built-ins:

```ts partial
import { test as base } from "@archont561/bun-test-utils";

// Replace the built-in clock for this project's tests.
export const test = base.extend({
  clock: {
    setup: async (use) => {
      await use({ now: () => new Date("2026-01-01T00:00:00Z") });
    },
  },
});
```

The root runner contributes nineteen built-in names:

- Standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`
- DOM: `window`, `document`, `page`
- Browser and server: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`, `httpMock`, `browserHttpMock`
- Cassettes: `cassette`
- Snapshots: `snapshot`

## Overriding safely

Overriding is a deliberate act with three consequences worth knowing before you
ship it:

1. **Dependencies follow the name.** A fixture that depends on `clock`
   receives your replacement, not the built-in. That is usually the point, and
   it is also how an override can change the behaviour of a fixture you did not
   touch.
2. **The override applies to the whole chain.** Every test that imports the
   extended runner sees it; a test that imports a parent runner does not.
3. **Nothing warns.** Last-definition-wins is never an error, a warning, or a
   log line.

Three habits keep overrides reviewable:

- **Override in one place.** Put built-in replacements in the base runner (or a
  dedicated `testing/overrides.ts`) so a reader can find every intentional
  difference from the shipped behaviour in one file.
- **Keep the built-in's contract.** An overridden `clock` should still answer
  `now()`, `freeze(time)`, and `set(time)`; code that depends on the fixture
  cannot tell which definition it received. When you need a different contract,
  use a new fixture name instead of an override.
- **Test the override once.** One test that asserts the replacement is in force
  is enough to catch a name typo, which would otherwise silently leave the
  built-in in place.

## Where fixtures come from

A test can request a fixture only when the imported runner's chain includes it,
or when it is one of the built-in names. Directory position never adds a
fixture. Two sibling test files that import different runners see different
fixtures, even though they sit in the same folder.

Because composition is explicit, a missing fixture fails with a message that
lists the names the chain provides:

```text
[bun-test-utils] unknown fixture "user" requested in /app/users.test.ts.
Available in this explicit test.extend(...) chain: database, test, expect.
Compose the fixture with test.extend({ user: ... }) and import that extended
test into this file.
```

The error code is `UNKNOWN_FIXTURE`; the four contractual message templates are
listed in the
[errors reference](/bun-test-utils/reference/cli/#error-message-compatibility).
The usual cause is an import of the wrong runner, so read the import line
before editing the fixture map.

## Next steps

- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): the definition contract and how injection works.
- [Built-in fixture API](/bun-test-utils/reference/fixtures/): the nineteen built-in names and their members.
- [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/): what each fixture error means and how to recover.
