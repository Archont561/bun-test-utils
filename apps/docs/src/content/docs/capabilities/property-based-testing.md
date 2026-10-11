---
title: Property-based testing
description: Generative tests with fast-check arbitraries and injected fixtures, with a fresh test-scoped lifecycle for every generated sample.
status: stable
since: 0.1.0
requires: [fast-check]
---

`test.prop` runs a property test. You describe the inputs with
[fast-check](https://fast-check.dev/) arbitraries, state a property that must
hold for them, and the runner generates many samples. If a sample fails,
fast-check shrinks it to a minimal counterexample and reports the seed to
replay it. Fixtures work exactly as they do in ordinary tests.

## Installation

`test.prop` ships in `@archont561/bun-test-utils`; `fast-check` is an optional
peer (`>=4.0.0`), so install it in projects that use property tests:

```bash runnable
bun add -d @archont561/bun-test-utils fast-check
```

Projects without property tests do not need `fast-check` at runtime, and
`test.prop` fails with `MISSING_OPTIONAL_DEPENDENCY` naming the install command
when the peer is absent.

## Write a property test

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "addition is commutative",
  (fc) => ({ a: fc.integer(), b: fc.integer() }),
  async (_fixtures, { a, b }) => {
    expect(a + b).toBe(b + a);
  },
  { numRuns: 100 },
);
```

- The **arbitrary factory** receives the `fast-check` API and returns a record
  of arbitraries, one per generated value.
- The **test body** receives the fixtures first, then the generated values.
- **Other options** such as `numRuns` and `seed` pass straight through to
  `fc.assert`.

## Use fixtures in a property

Destructure fixtures from the first parameter, exactly as in an ordinary test;
the engine detects them:

```ts partial
test.prop(
  "orders survive a round trip through the store",
  (fc) => ({ orders: fc.array(fc.record({ id: fc.uuid(), total: fc.nat() })) }),
  async ({ tmpdir }, { orders }) => {
    tmpdir.write("orders.json", JSON.stringify(orders));
    const saved = JSON.parse(tmpdir.read("orders.json"));
    expect(saved).toEqual(orders);
  },
  { numRuns: 50 },
);
```

`tmpdir` is test-scoped, so each sample gets its own directory, and that
directory is removed before the next sample starts.

## The fixture lifecycle per sample

A property test is one `bun test` case whose body runs many times. Scope
decides what is shared between those runs:

| Scope | Across samples and shrink steps |
| :-- | :-- |
| `session` and `file` | **Shared.** Built once and reused for every sample. |
| `test` (default) | **Rebuilt for each sample.** A fresh instance, torn down before the next sample starts. |

Each sample — and each candidate fast-check tries while shrinking a failure —
runs through the engine's iteration protocol: build the test-scoped fixtures,
run the body, tear them down in LIFO order, even when the body throws. State
left over from one sample cannot leak into the next.

Put expensive, read-only resources in `session` or `file` scope. Put anything a
sample writes to in `test` scope. See
[Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/).

## Share arbitrary definitions

An arbitrary definition is an ordinary record or factory. Export it from a
shared module and import it wherever a property needs it:

```ts title="arbitraries.ts" partial
import { defineArbitraries } from "@archont561/bun-test-utils/pbt";

export const userArbitraries = defineArbitraries((fc) => ({
  name: fc.string(),
  age: fc.nat(),
}));

export const adminArbitraries = defineArbitraries((fc) => ({
  ...userArbitraries(fc),
  permissions: fc.array(fc.constantFrom("read", "write")),
}));
```

`defineArbitraries` is an identity function. It types the `fc` parameter
contextually, so you do not need to import the `fast-check` type into every
definition module, and generated values are inferred at each call site:

```ts title="admin.test.ts" partial
import { expect, test } from "@archont561/bun-test-utils";
import { adminArbitraries } from "./arbitraries";

test.prop(
  "admins have a valid name and permissions",
  adminArbitraries,
  async (_fixtures, { name, age, permissions }) => {
    const displayName: string = name;
    const years: number = age;
    const grants: ("read" | "write")[] = permissions;

    expect(displayName.length).toBeGreaterThanOrEqual(0);
    expect(years).toBeGreaterThanOrEqual(0);
    expect(grants.every((grant) => grant === "read" || grant === "write")).toBe(true);
  },
);
```

`test.scenario.prop` accepts the same kind of arbitrary record, so generated
values are available in the first scenario step. See
[BDD scenarios](/bun-test-utils/capabilities/scenarios/).

## Choose fixtures explicitly

Auto-detection reads the destructured first parameter. If a property needs a
fixture only for its side effect, such as a server that must be listening, list
it in `options.fixtures` instead:

```ts partial
test.prop(
  "the API accepts any JSON payload",
  (fc) => ({ payload: fc.json() }),
  async (_fixtures, { payload }) => {
    expect(JSON.parse(payload)).toBeDefined();
  },
  { fixtures: ["testServer"], numRuns: 200 },
);
```

## Shrinking and replay

When a sample fails, fast-check shrinks the input to the smallest failing case
and reports the counterexample with the seed. Pass that seed back as
`{ seed: ... }` to replay the same sequence of samples.

## When not to use it

Property tests are the wrong tool when:

- **You already know the cases.** Write a table-driven test or a loop over
  named values instead — [Parameterized tests](/bun-test-utils/capabilities/parameterized-tests/)
  covers the fixed-matrix form. A generated test with `numRuns` samples may
  never draw the one value you care about.
- **The property is the same assertion restated.** `expect(sorted(x)).toEqual(sorted(x))`
  proves nothing; a property has to be checkable independently of the code
  under test.
- **Each run is expensive.** Samples multiply cost. A property over a real
  database or a browser is usually better expressed as a handful of explicit
  examples.
- **The failure is one specific value.** A generator that has to be constrained
  so tightly that it produces one value is a parameterized test in disguise.

## Requirements and limits

- `fast-check` must be installed in any project that runs a property test.
- With `skipLibCheck: false`, TypeScript also needs `fast-check` installed to
  check the published declarations. See the
  [package README](https://github.com/Archont561/bun-test-utils/blob/main/packages/bun-test-utils/README.md#optional-peers).

## Related

- [Parameterized tests](/bun-test-utils/capabilities/parameterized-tests/): the same mechanism over a fixed set of values.
- [BDD scenarios](/bun-test-utils/capabilities/scenarios/): `test.scenario.prop` for generated scenario context.
- [Snapshots and property-testing API](/bun-test-utils/reference/snapshots-and-property/): `test.prop` options and the `/pbt` helper.
