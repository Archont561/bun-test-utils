---
title: Core runner and fixture API
description: The package exports, test(), test.extend(), the options object, the iteration protocol, and the fixture-definition contract.
status: stable
since: 0.1.0
---

**Use this when** you need the exact signature of the runner, the options a test
accepts, or the fields a fixture definition may set. It is the reference for
everything the `test` object itself does; per-capability APIs live in
[Built-in fixture API](/bun-test-utils/reference/fixtures/),
[Property, scenario, and snapshot API](/bun-test-utils/reference/snapshots-and-property/),
and [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/).

This page replaces the old single-page API reference: `/reference/api/`
redirects here, and the
[section map](/bun-test-utils/project/releases/#where-the-old-api-reference-went)
says where each old section went.

## Imports

The root package exports the runner values `describe`, `expect`, and `test`:

```ts partial
import { describe, expect, test } from "@archont561/bun-test-utils";
```

Four helper-only subpaths export typed definitions and serializer contracts.
They never export a runner or a fixture:

```ts partial
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import type { ArbitraryInput, FastCheckApi, GeneratedValues } from "@archont561/bun-test-utils/pbt";

import { givenStep, whenStep, thenStep } from "@archont561/bun-test-utils/bdd";
import type { GivenChain, GivenStep, ScenarioContext, ThenStep, WhenStep } from "@archont561/bun-test-utils/bdd";

import {
  createSnapshotSerializer,
  registerSnapshotSerializer,
  resetSnapshotSerializers,
  unregisterSnapshotSerializer,
} from "@archont561/bun-test-utils/snap";
import type { Serializer } from "@archont561/bun-test-utils/snap";

import {
  defineCallbackSerializer,
  registerCallbackSerializer,
  unregisterCallbackSerializer,
} from "@archont561/bun-test-utils/vcr";
import type { CallbackSerializer } from "@archont561/bun-test-utils/vcr";
```

- `/pbt`: `defineArbitraries` returns its argument unchanged and types the
  factory's `fc` parameter. See
  [Property, scenario, and snapshot API](/bun-test-utils/reference/snapshots-and-property/#definearbitraries-and-the-pbt-subpath).
- `/bdd`: phase-specific scenario step helpers, same identity-function
  behaviour. See
  [scenario API](/bun-test-utils/reference/snapshots-and-property/#testscenariotitle-and-testscenarioproptitle-arbitraryfactory).
- `/snap`: process-wide snapshot serializer registration. See
  [snapshot API](/bun-test-utils/reference/snapshots-and-property/#snapshot-value-and-file-snapshots).
- `/vcr`: reusable, reversible callback serializers. See
  [the `/vcr` subpath](/bun-test-utils/reference/http-and-browser/#vcr-global-callback-serializers).

Do not import `@archont561/bun-test-utils/std`, `/dom`, `/browser`, `/server`,
or `/snapshot`, or any other internal workspace path. Fixtures and execution
APIs live on the root `test` object.

## Stability and platforms

The fixture engine and the standard, DOM, snapshot, property-testing, and
minimal cassette capabilities are **stable** and follow semantic versioning.
Browser testing and BDD scenarios are **experimental** and may change in minor
versions. Linux and macOS are supported; Windows is not supported in `0.1.x`.

The full policy — Bun range, peers, compatibility surfaces, and support
channels — is in
[Stability, compatibility, and support](/bun-test-utils/overview/compatibility/).

## `test(name, fn, options?)`

Defines a fixture-aware test. The fixtures it requests are read from the first
parameter's destructuring pattern; each must exist in the imported
`test.extend()` chain or be one of the built-in root fixtures.

```ts partial
test("uses fixtures", async ({ tmpdir, env }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
});
```

| Option | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `fixtures` | `string[]` | auto-detected | Explicit fixture list. Replaces detection from the destructured parameter. |
| `timeout` | `number` | Bun's default | Per-test timeout in milliseconds, forwarded to `bun:test`. |
| `iterate` | `boolean` | `false` | Defers test-scoped fixtures and provides `ctx.iterate(fn)`. See below. |
| `tags` | `string[]` | `[]` | Semantic labels for `BUN_TEST_UTILS_TAGS` selection. See [Selecting tests by tag](#selecting-tests-by-tag). |

The option object is the **third** argument: `test(name, fn, options)`.

### The iteration protocol (`iterate`)

With `iterate: true`, the outer context builds only `session`- and `file`-scoped
fixtures and provides `ctx.iterate(fn)`. Each `await ctx.iterate(fn)` call
builds a fresh set of test-scoped fixtures for that one call and tears them
down in LIFO order afterwards, even when `fn` throws.

```ts partial
test(
  "each iteration gets its own test-scoped state",
  async ({ iterate }) => {
    const dirs: string[] = [];
    await iterate(async (ctx) => {
      ctx.tmpdir!.write("attempt.txt", "one");
      dirs.push(ctx.tmpdir!.dir);
    });
    await iterate(async (ctx) => {
      dirs.push(ctx.tmpdir!.dir);
    });
    expect(new Set(dirs).size).toBe(2); // a different directory per call
  },
  { fixtures: ["tmpdir"], iterate: true },
);
```

Two things about that example are easy to get wrong:

- **The test-scoped value arrives in the iterate callback's context**, not in
  the outer test parameter. In the outer context only `session`- and
  `file`-scoped fixtures are built, so a test-scoped name is `undefined` there.
- **Declare the names explicitly.** The callback's destructured parameter cannot
  be introspected, so pass them through `options.fixtures` (as above) or name
  them in the test's own destructuring pattern.

`test.prop` and `test.scenario.prop` use this protocol, so each generated
sample and each shrink step runs with its own test-scoped state. See
[the per-sample lifecycle](/bun-test-utils/capabilities/property-based-testing/#the-fixture-lifecycle-per-sample).

## `test.extend(fixtures)`

Returns a new runner that includes your fixtures. The parent runner is not
modified, and a test sees exactly the chain it imports.

```ts partial
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  db: {
    scope: "file",
    setup: async (use) => {
      const db = await createDatabase();
      await use(db);
      await db.close();
    },
  },
});
```

Each fixture definition takes:

| Field | Type | Default | Behaviour |
| :-- | :-- | :-- | :-- |
| `setup` | `(use, context) => void \| Promise<void>` | required | Builds the value and passes it to `use(value)`. Code after `await use(value)` is the teardown. |
| `scope` | `"session"` \| `"file"` \| `"test"` | `"test"` | How long the value lives. See [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/). |
| `deps` | `string[]` | inferred | Explicit dependency list. Normally omitted: dependencies come from the destructured second parameter of `setup`. |

The second `setup` parameter is a `FixtureContext`: resolved fixture values by
name, plus `testFile`, `testName`, and `scope` metadata for the fixture being
built.

All fixtures share one flat namespace, built-ins included. Composition is
last-definition-wins: a fixture with the same name as a built-in replaces it,
and a later `extend()` replaces an earlier definition. Dependencies resolve by
name, so they receive the replacement too. See
[Composition and overrides](/bun-test-utils/fundamentals/composition/#overriding-safely).

## Test modifiers

The runner carries Bun's modifiers, so a test that must be skipped, focused, or
deferred still receives its fixtures. Each modifier takes the same
`(name, fn, options?)` triple as `test`:

```ts partial
test.skip("only on another platform", async ({ browser }) => { /* … */ });

test.skipIf(process.platform !== "linux")("symlinks", async ({ tmpdir }) => {
  tmpdir.write("link", "x");
});

test.only("focused", async ({ database }) => { /* … */ });
```

| Modifier | Effect |
| :-- | :-- |
| `test.skip` | Registers a skipped test. |
| `test.only` | Runs only the marked tests (`bun test --only` also selects them). |
| `test.todo` | Marks a test as to be written; it runs only with `bun test --todo`. |
| `test.failing` | Inverts the result: the test passes when it throws. |
| `test.concurrent` | Runs alongside other concurrent tests. |
| `test.serial` | Runs serially even under `bun test --concurrent`. |
| `test.if(condition)` | Returns a registration function that runs only when `condition` is true. |
| `test.skipIf(condition)` | Returns a registration function that skips when `condition` is true. |
| `test.todoIf(condition)` | Conditional `test.todo`. |
| `test.failingIf(condition)` | Conditional `test.failing`. |
| `test.concurrentIf(condition)` | Conditional `test.concurrent`. |
| `test.serialIf(condition)` | Conditional `test.serial`. |

Two consequences follow from how the modifiers are wired:

- **A declaration Bun will not run never resolves its fixtures.** `test.skip`,
  `test.todo`, and the conditional variants use that opportunity: a test skipped
  on this platform may name a fixture that only exists on another one. A
  declaration that does run still validates its fixture graph at load time, so
  a typo in a running test still fails the file with `UNKNOWN_FIXTURE`.
- **A modifier registers a test; it is not a test object.** `test.skip(...)`
  returns nothing and `test.skipIf(cond)` returns a registration function.
  Neither exposes `extend`, `prop`, or `scenario` — composition belongs to
  `test`, whose fixture map is the thing being extended.

Bun's own guard applies unchanged: with `CI` set, `test.only` throws ("`.only`
is disabled in CI environments to prevent accidentally skipping tests"), and
setting `CI=false` overrides it. Declaring the runner never reads that getter,
so an ordinary CI run is unaffected.

`test.each` and `describe.each` are intentionally not provided: Bun passes table
rows positionally and fixtures arrive as the body's first argument, so the two
conventions need a decision of their own. `describe` is Bun's own function, so
its modifiers (`describe.only`, `describe.skipIf`, …) work unchanged.

## Selecting tests by tag

Tags label tests semantically; the filter then selects them without touching
names:

```ts partial
test("writes a manifest", async ({ tmpdir }) => { /* … */ }, {
  tags: ["fast", "filesystem"],
});
```

Bun 1.4.2 has no tag flag, so the selection lives in one environment variable
(`BUN_TEST_UTILS_TAGS`), which works with a plain `bun test`:

```bash illustrative
BUN_TEST_UTILS_TAGS=fast bun test            # only tests tagged fast
BUN_TEST_UTILS_TAGS='!slow' bun test         # everything except slow
BUN_TEST_UTILS_TAGS='fast,!slow' bun test    # fast, but not fast+slow
```

| Value | Effect on a test |
| :-- | :-- |
| unset or blank | No filter; everything runs. |
| `fast` | Runs only tests tagged `fast`; untagged tests are skipped. |
| `!slow` | Runs everything except tests tagged `slow`; untagged tests keep running. |
| `fast,!slow` | Runs tests tagged `fast` unless they are also tagged `slow`. |

Entries are separated by commas or whitespace, matched exactly and
case-sensitively, and empty entries are ignored. A filtered-out test is
registered as skipped — it appears in the run summary and never resolves its
fixtures — so a filtered run cannot be mistaken for a passing one. Tags are
declared per test; `describe` is not wrapped, so there is no tag inheritance.

## Runner extensions

Two capabilities add methods to the runner. They are declared like any other
test and use the same fixtures.

| Method | Provided by | Reference |
| :-- | :-- | :-- |
| `test.prop(title, arbitraryFactory, fn, options?)` | Property-based testing (`fast-check` peer) | [Property tests](/bun-test-utils/reference/snapshots-and-property/#testproptitle-arbitraryfactory-fn-options) |
| `test.scenario(title)` | BDD scenarios (`@aboviq/bun-test-cucumber` peer, experimental) | [Scenario API](/bun-test-utils/reference/snapshots-and-property/#testscenariotitle-and-testscenarioproptitle-arbitraryfactory) |
| `test.scenario.prop(title, arbitraryFactory)` | Both peers | Same section |

## Errors raised here

| Code | Raised when | Guide |
| :-- | :-- | :-- |
| `UNKNOWN_FIXTURE` | A test requests a fixture the imported chain does not provide | [Composition](/bun-test-utils/fundamentals/composition/#where-fixtures-come-from) |
| `SCOPE_MISMATCH` | A fixture depends on a shorter-lived fixture; raised when the test is declared | [Scope rules](/bun-test-utils/fundamentals/scopes-and-teardown/#scope-rules) |
| `CIRCULAR_DEPENDENCY` | Fixtures depend on each other in a cycle | [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/#circular_dependency) |
| `FIXTURE_USE_NOT_CALLED` | A fixture's `setup` finished without calling `use(value)` | Same page |
| `FIXTURE_USE_CALLED_TWICE` | A fixture's `setup` called `use(value)` more than once | Same page |

Every error also carries `details`; prefer it over parsing the message. The
human-readable text of the four contractual templates is in the
[errors reference](/bun-test-utils/reference/cli/#error-message-compatibility).

## Related

- [Built-in fixture API](/bun-test-utils/reference/fixtures/): the nineteen built-in names, their scopes, and their members.
- [CLI, environment variables, and errors](/bun-test-utils/reference/cli/): the command, the environment, and every error code.
- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): the same contract explained with a lifecycle diagram.
