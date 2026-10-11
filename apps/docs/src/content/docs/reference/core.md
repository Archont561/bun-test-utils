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
