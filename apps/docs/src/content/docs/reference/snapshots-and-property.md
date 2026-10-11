---
title: Property, scenario, and snapshot API
description: test.prop and test.scenario signatures, the /pbt and /bdd helpers, the snapshot fixture, /snap serializers, and the errors each raises.
status: stable
since: 0.1.0
requires: [fast-check]
---

**Use this when** you need the option tables and type contracts behind the
generative and baseline-based capabilities: property tests, BDD scenarios,
snapshots, and the helper subpaths that type them. Each capability has its own
guide for the workflow —
[property-based testing](/bun-test-utils/capabilities/property-based-testing/),
[BDD scenarios](/bun-test-utils/capabilities/scenarios/), and
[snapshot testing](/bun-test-utils/capabilities/snapshots/).

BDD scenarios are **experimental** and require the
`@aboviq/bun-test-cucumber` peer; the property and snapshot APIs are stable.
`test.prop` and `test.scenario.prop` require the `fast-check` peer
(`>=4.0.0`).

## `test.prop(title, arbitraryFactory, fn, options?)`

Runs a property test. The arbitrary factory receives the `fast-check` API; the
test body receives the fixtures first and the generated values second.

```ts partial
test.prop(
  "encoding is reversible",
  (fc) => ({ text: fc.string(), key: fc.integer({ min: 1, max: 255 }) }),
  async ({ tmpdir }, { text, key }) => {
    tmpdir.write("value.txt", text);
    expect(decode(encode(tmpdir.read("value.txt"), key), key)).toBe(text);
  },
  { numRuns: 100 },
);
```

| Argument / option | Type | Behaviour |
| :-- | :-- | :-- |
| `title` | `string` | The `bun test` case name. |
| `arbitraryFactory` | `(fc) => Record<string, Arbitrary>` | Receives the `fast-check` API; returns one arbitrary per generated value. |
| `fn` | `(fixtures, values) => void \| Promise<void>` | The property. Fixtures are auto-detected from the destructured first parameter. |
| `fixtures` | `string[]` | Explicit fixture list, for fixtures needed only for their side effect. |
| `timeout` | `number` | Per-test timeout in milliseconds. |
| Any other option | `fast-check`'s | Passed straight through to `fc.assert`, e.g. `numRuns`, `seed`, `endOnFailure`. |

**Lifecycle.** Each generated sample and each shrink step runs through the
iteration protocol: `session`- and `file`-scoped fixtures are shared for the
whole test, `test`-scoped fixtures are rebuilt per sample and per shrink step
and torn down in LIFO order. See
[the per-sample lifecycle](/bun-test-utils/capabilities/property-based-testing/#the-fixture-lifecycle-per-sample).

## `test.scenario(title)` and `test.scenario.prop(title, arbitraryFactory)`

Builds one fixture-aware test from fluent `given`, `when`, and `then` steps.
Objects returned from `given` and `when` are merged into the next step's
context, alongside fixture values. Steps are typed in phase order.

```ts partial
test
  .scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .when("the user is created", async ({ db, name }) => ({
    user: await db.users.create({ name }),
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBeDefined();
  });
```

| Member | Behaviour |
| :-- | :-- |
| `test.scenario(title)` | Starts a `given`-phase chain. |
| `.given(description, step)` | Adds a step that produces context. May be repeated. |
| `.when(description, step)` | Adds a step that performs the action. May be repeated. |
| `.then(description, step)` | Adds an assertion. Its return value is not merged. |
| `test.scenario.prop(title, arbitraryFactory)` | Generates the scenario's initial context with `fast-check`. |
| `expect` in a step's context | Injected per step: `({ expect, ... })`. |

Fixture names are detected per step, so a scenario does not repeat a fixture
list. `test.scenario.prop` rebuilds test-scoped fixtures for every generated
example and every shrink step.

## `defineArbitraries` and the `/pbt` subpath

```ts partial
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";
import type {
  ArbitraryInput,
  FastCheckApi,
  GeneratedValues,
} from "@archont561/bun-test-utils/pbt";

export const userArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));
```

| Export | Behaviour |
| :-- | :-- |
| `defineArbitraries(factory)` | Returns `factory` unchanged. Types the `fc` parameter contextually and infers the generated values at each call site. |
| `FastCheckApi` | The `fast-check` API type, for helpers that take an `fc` parameter. |
| `ArbitraryInput` | An arbitrary, or a function returning one. |
| `GeneratedValues` | The values a factory produces, keyed by name. |

## `/bdd` step helpers

```ts partial
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";
import type {
  GivenChain,
  GivenStep,
  ScenarioContext,
  ThenStep,
  WhenStep,
} from "@archont561/bun-test-utils/bdd";
```

| Export | Behaviour |
| :-- | :-- |
| `givenStep<In, Out>(fn)` | Types a `given` step's input context and the state it adds. Returns the function unchanged. |
| `whenStep<In, Out>(fn)` | The same for `when`. |
| `thenStep<In>(fn)` | The same for `then`; the step asserts and returns nothing. |
| `GivenChain` | The chain type a reusable sequence function accepts, e.g. `(chain: GivenChain) => chain.given(...)`. |
| `ScenarioContext` | The context a step receives: fixture values, scenario state, and `expect`. |

## `snapshot`: value and file snapshots

The fixture is callable and also an object.

```ts partial
test("captures states", async ({ snapshot }) => {
  snapshot.match(initialState());
  snapshot.match(afterClick(), "after-click");
  snapshot.matchFile(reportPath, "report");
  const profile = await snapshot(async () => fetchProfile("ada"), "ada-profile");
  expect(profile.id).toBe("ada");
});
```

| Member | Behaviour |
| :-- | :-- |
| `snapshot(callback, name)` | Runs and awaits `callback` once, matches its result under the required non-empty `name`, and returns the original result. Never caches or keys on callback source; a callback error propagates before any write. |
| `match(value, name?)` | Compares a value against the stored snapshot, or records it on first run. Unnamed calls are auto-numbered. |
| `matchFile(path, name?)` | Compares the contents of a file. |
| `addSerializer(serializer)` | Registers a serializer for this test. Return `undefined` for values it does not handle. |
| `mode`, `setMode(mode)` | `"match"`, `"update"`, or `"ci"`. `ci` is selected when `CI` is set. |
| `path` | The path of this test's snapshot file (read-only). |

**Serialization order.** Fixture-local serializers run newest-first, then global
serializers newest-first, then the built-ins. Serializers apply recursively to
object properties and array entries. Details and failure modes are in
[Snapshot testing](/bun-test-utils/capabilities/snapshots/#recursive-values-and-diagnostics).

## `/snap`: global serializers

```ts partial
import {
  createSnapshotSerializer,
  registerSnapshotSerializer,
  resetSnapshotSerializers,
  unregisterSnapshotSerializer,
} from "@archont561/bun-test-utils/snap";
import type { Serializer } from "@archont561/bun-test-utils/snap";
```

| Export | Behaviour |
| :-- | :-- |
| `createSnapshotSerializer(fn)` | Registers `fn` as a process-wide serializer and returns it. |
| `registerSnapshotSerializer(serializer)` | Registers a `Serializer` and returns it. |
| `unregisterSnapshotSerializer(serializer)` | Removes every registration of that exact function; `true` when it removed one or more. |
| `resetSnapshotSerializers()` | Clears the global registry. Use at a controlled boundary such as a watch-mode reload. |
| `Serializer` | `(value) => string \| undefined`. |

## Errors

| Code | Raised when |
| :-- | :-- |
| `MISSING_OPTIONAL_DEPENDENCY` | `fast-check` or `@aboviq/bun-test-cucumber` is not installed. The message names the install command. |
| `SNAPSHOT_CIRCULAR_REFERENCE` | A snapshot value contains a cycle. Details name the snapshot and the value path. |
| `SNAPSHOT_SERIALIZER_FAILED` | A snapshot serializer threw. The original error is the `cause`. |
| `INVALID_API_USAGE` | A capability was called with arguments or in a state it does not support, such as a callable snapshot without a name. |

`fast-check` failures report the generated counterexample and the seed in the
test output; replay them with `{ seed: ... }`.

## Related

- [Property-based testing](/bun-test-utils/capabilities/property-based-testing/) and [Parameterized tests](/bun-test-utils/capabilities/parameterized-tests/): when to generate values and when to enumerate them.
- [BDD scenarios](/bun-test-utils/capabilities/scenarios/): when a fluent chain earns its place.
- [Snapshot testing](/bun-test-utils/capabilities/snapshots/): the update-and-review workflow.
- [CLI, environment variables, and errors](/bun-test-utils/reference/cli/): `SNAPSHOT_MODE`, `CI`, and every error code.
