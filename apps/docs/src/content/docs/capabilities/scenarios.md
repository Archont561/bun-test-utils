---
title: BDD scenarios
description: Write behaviour-driven tests with given, when, and then steps that share typed state and fixtures.
status: experimental
since: 0.1.0
requires: ["@aboviq/bun-test-cucumber"]
---

A scenario is one test written as fluent `given`, `when`, and `then` steps.
Each step can read the state the steps before it produced, and each step can use
fixtures. Scenarios are a readable form of an ordinary fixture-aware test, so
they support the same fixtures, scopes, and teardown.

:::caution[Experimental]
The scenario API is experimental and may change in a minor release. It rides
the pre-1.0 `@aboviq/bun-test-cucumber` peer. Everything else on this page is
still the stable fixture engine: a scenario is one `bun test` case like any
other.
:::

## When a scenario earns its place

| Use a scenario when | Prefer a plain `test` when |
| :-- | :-- |
| A behaviour has several stages that each produce state for the next one, and the stages read like a specification | The test is one arrange–act–assert block |
| You want shared step sequences reused across files with typed inputs and outputs | The steps would only ever be used once |
| The audience of the file is a specification, not just an implementation check | The assertions are the interesting part |
| Non-engineers review the flow | The flow is obvious from the code |

A scenario compiles to one test: `given`, `when`, and `then` do not add
retries, separate reporting, or Gherkin `.feature` parsing. If you need
`.feature` files, use a Cucumber runner instead — the package's own behavioural
suite does that for this repository.

## Installation

The scenario API uses the optional `@aboviq/bun-test-cucumber` peer
(`>=0.2.0`):

```bash runnable
bun add -d @archont561/bun-test-utils @aboviq/bun-test-cucumber
```

Property scenarios also need `fast-check`:

```bash runnable
bun add -d fast-check
```

## A fluent scenario

```ts partial
import { test } from "@archont561/bun-test-utils";

test
  .scenario("creates a user")
  .given("a name", () => ({ name: "Ada" }))
  .given("a request id", () => ({ requestId: "req-1" }))
  .when("the user is created", ({ name, requestId }) => ({
    user: { id: 1, name },
    requestId,
  }))
  .then("the id is assigned", ({ user, expect }) => {
    expect(user.id).toBe(1);
  })
  .then("the request is retained", ({ requestId, expect }) => {
    expect(requestId).toBe("req-1");
  });
```

The chain is typed in phase order: `given` steps first, then `when`, then
`then`, with any number of steps per phase.

- An object returned by a `given` or `when` step is merged into the context of
  the next step.
- A `then` step is an assertion; its return value is not merged.
- `expect` is passed into every step, so you do not import it.

## Use fixtures in steps

Fixture values are available alongside scenario state. Destructure a fixture in
a step and the engine builds it for the scenario like any other test:

```ts partial
test
  .scenario("stores a record")
  .given("a record", async ({ database }) => ({
    record: await database.insert({ name: "Ada" }),
  }))
  .then("the record has an id", ({ record, expect }) => {
    expect(record.id).toBeDefined();
  });
```

Fixtures are composed the same way as anywhere else: with `test.extend()`, in
the imported runner.

## Share steps and sequences

Put reusable steps in a shared module. The phase-specific helpers from
`@archont561/bun-test-utils/bdd` give each step its input and output types; the
generic arguments declare the state a step expects and the state it adds.

```ts title="scenario-steps.ts" partial
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";
import type { GivenChain } from "@archont561/bun-test-utils/bdd";

export const writeFile = givenStep<object, { filename: string }>(({ tmpdir }) => {
  const filename = "shared.txt";
  tmpdir.write(filename, "shared scenario data");
  return { filename };
});

export const readFile = whenStep<{ filename: string }, { contents: string }>(
  ({ tmpdir, filename }) => ({ contents: tmpdir.read(filename) }),
);

export const assertSharedContents = thenStep<{ contents: string }>(
  ({ contents, expect }) => expect(contents).toBe("shared scenario data"),
);

export const withSharedFile = (chain: GivenChain) =>
  chain.given("a shared file", writeFile).when("the file is read", readFile);
```

A consumer-owned function can apply the sequence to any chain, so several
scenario files can reuse it:

```ts title="reads-shared-file.test.ts" partial
import { test } from "@archont561/bun-test-utils";
import { assertSharedContents, withSharedFile } from "./scenario-steps";

withSharedFile(test.scenario("reads a file from a shared sequence")).then(
  "the contents are available",
  assertSharedContents,
);
```

Steps that destructure fixtures are detected per step, so a scenario does not
repeat a fixture list.

## Property scenarios

`test.scenario.prop` generates the scenario's initial context:

```ts partial
import { test } from "@archont561/bun-test-utils";

test.scenario
  .prop("calculates a total", (fc) => ({
    price: fc.integer({ min: 0, max: 100 }),
  }))
  .given("a quantity", () => ({ quantity: 2 }))
  .when("the total is calculated", ({ price, quantity }) => ({
    total: price * quantity,
  }))
  .then("the total is non-negative", ({ total, expect }) => {
    expect(total).toBeGreaterThanOrEqual(0);
  });
```

Each generated example gets a fresh scenario context. Test-scoped fixtures are
rebuilt for every example and every shrink step, while session and file
fixtures are shared. See
[Property-based testing](/bun-test-utils/capabilities/property-based-testing/)
for the lifecycle.

## Related

- [Property-based testing](/bun-test-utils/capabilities/property-based-testing/): generated values, shrinking, and shared arbitrary definitions.
- [Snapshots and property-testing API](/bun-test-utils/reference/snapshots-and-property/): `test.scenario` signatures and the `/bdd` helpers.
- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): what "experimental" promises.
