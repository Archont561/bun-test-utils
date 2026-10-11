---
title: Parameterized tests
description: Run one test over a matrix of values with test.prop and fc.constantFrom, with a fresh fixture lifecycle for each combination.
status: stable
since: 0.1.0
requires: [fast-check]
---

Parameterized tests run one test body over several values. In `bun-test-utils`
that is `test.prop` — the same mechanism
[property-based testing](/bun-test-utils/capabilities/property-based-testing/)
describes, used with a fixed set of values instead of random ones.

## A fixed matrix

`fc.constantFrom` turns a list of values into an arbitrary. One arbitrary per
axis gives you a matrix:

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "renders the navigation bar",
  (fc) => ({
    viewport: fc.constantFrom("mobile", "desktop"),
    locale: fc.constantFrom("en", "pl"),
  }),
  async ({ tmpdir }, { viewport, locale }) => {
    tmpdir.write("config.json", JSON.stringify({ viewport, locale }));
    // assert the rendering for this combination
    expect(tmpdir.read("config.json")).toContain(viewport);
  },
  { numRuns: 20, seed: 20261007 },
);
```

Test-scoped fixtures are built and torn down for every sample, so each
combination gets a fresh set. Session and file fixtures are shared across the
whole run. A run with a fixed `seed` replays exactly, and a failure shrinks to
the smallest counterexample.

## Coverage caveat

`fc.constantFrom` draws with replacement. `numRuns` sets how many samples are
drawn, so a small `numRuns` may miss some values. When every value must run,
use a plain loop in the test body:

```ts partial
test("renders the navigation bar in every locale", async ({ tmpdir }) => {
  for (const locale of ["en", "pl"]) {
    // assert the rendering for this locale
  }
});
```

Choose the form that matches the requirement: `test.prop` when sampling over a
space is the point, a loop when every named case must run and report.

## When to use which

| You have | Use |
| :-- | :-- |
| Two or three axes with a few values each, and the body is the same | `test.prop` with `fc.constantFrom`, `numRuns` set to cover the matrix |
| A list of named cases that each need a distinct assertion or a distinct failure message | `test` inside a `for` loop, or one test per case |
| A space of inputs where any valid value should pass | `test.prop` with generative arbitraries |
| Cases derived from a fixture, not from literals | Either form; build the list in the test body or in a fixture the test requests |

## Where the data comes from

Inline `fc.constantFrom(...)` lists are the right answer for small matrices.
For anything larger, keep the cases in a module and import them, so the same
list serves the test and any fixtures around it:

```ts title="cases.ts" partial
export const locales = ["en", "pl"] as const;
export const viewports = ["mobile", "desktop"] as const;
```

```ts title="nav.test.ts" partial
import { expect, test } from "@archont561/bun-test-utils";
import { locales, viewports } from "./cases";

test.prop(
  "renders the navigation bar",
  (fc) => ({
    viewport: fc.constantFrom(...viewports),
    locale: fc.constantFrom(...locales),
  }),
  async ({ tmpdir }, { viewport, locale }) => {
    tmpdir.write("config.json", JSON.stringify({ viewport, locale }));
    expect(tmpdir.read("config.json")).toContain(locale);
  },
  { numRuns: 20, seed: 20261007 },
);
```

Fixture data works the same way: a fixture that reads JSON, CSV, or a fixture
file can hand the cases to the test, and `tmpdir` gives each sample its own
scratch directory. See
[Deterministic tests](/bun-test-utils/recipes/deterministic-tests/) for the
fixtures that keep a matrix run reproducible.

## Requirements

`test.prop` needs the optional `fast-check` peer (`>=4.0.0`):

```bash runnable
bun add -d fast-check
```

## Related

- [Property-based testing](/bun-test-utils/capabilities/property-based-testing/): generated values, shrinking, and shared arbitrary definitions.
- [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/): `seed`, `clock`, `env`, and `tmpdir` together.
- [Snapshots and property-testing API](/bun-test-utils/reference/snapshots-and-property/): `test.prop` options.
