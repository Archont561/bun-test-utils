---
title: Install and first passing test
description: Install bun-test-utils into an empty project, compose one fixture, and run a passing test — with every file shown in full.
---

This page creates a project from an empty directory and ends with a green
`bun test`. Every file is complete. The example uses only the package and Bun:
it does not call application helpers you would have to invent first.

**Prerequisites.** [Bun](https://bun.sh) 1.1 or later — the version range in the
package's `engines` field. The outputs on this page were captured with Bun
1.4.2. Nothing else is needed; optional capabilities such as browsers and
property tests install their own peers when you reach them.

## 1. Create a project and install

```bash runnable
mkdir greeting
cd greeting
bun init --yes
bun add -d @archont561/bun-test-utils
bunx test-utils init --yes
```

`bun init` only has to produce a `package.json`; any existing project works.
`test-utils init` adds the package's preload to `bunfig.toml`, which installs
run-wide teardown hooks. It loads no fixtures of its own. `--yes` writes without
asking, which is the form to use in scripts and CI; run it without `--yes` to
confirm the change first.

The directory now looks like this:

```text partial
greeting/
├── bunfig.toml      # test-utils init wrote [test].preload here
├── node_modules/
├── package.json
└── tsconfig.json
```

## 2. Compose a fixture

Create `test.ts` and extend the base `test` with the fixtures this project
provides:

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

A fixture is an object with a `setup` function. `await use(value)` marks the
value as ready and injects it into whatever asks for it. Code placed after the
`use` call would be teardown.

## 3. Write a test that asks for it

```ts title="greeting.test.ts" runnable
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("provides a fixture", async ({ greeting }) => {
  expect(greeting).toBe("hello");
});
```

The test imports the runner from `./test`, so `greeting` exists for this file.
Destructuring it from the test parameter is what requests it. A fixture is
never discovered from the file tree: only the `test.extend()` chain a file
imports is available to it.

## 4. Run the tests

```bash runnable
bun test
```

Expected output:

```text
bun test v1.4.2 (744846f84)

greeting.test.ts:
(pass) provides a fixture [0.87ms]

 1 pass
 0 fail
 1 expect() calls
Ran 1 test across 1 file. [11.00ms]
```

One test, one passing assertion, no failures. `apps/docs/tests/first-test-snippet.test.ts`
runs the two files above against the built package on every CI run, so this
page cannot drift away from the package's behaviour.

## What just happened

1. `test-utils init` pointed `[test].preload` in `bunfig.toml` at the package's
   plugin, which installs teardown hooks for the run.
2. `test.ts` composed one fixture, `greeting`, on top of the package's base
   `test`.
3. `greeting.test.ts` imported that composed runner and destructured
   `greeting`, declaring the dependency.
4. The engine built the fixture, injected its value into the test, and unwound
   the fixture after the test finished.

Fixtures are typed from the `extend()` chain, so `greeting` completes as a
`string` in your editor without an annotation. The next page explains the model
in full: [The fixture model](/bun-test-utils/fundamentals/fixture-model/).

## If the run does not pass

| What you see | Why | Fix |
| :-- | :-- | :-- |
| `Cannot find package "@archont561/bun-test-utils"` | The install step ran in a different directory, or dependencies were not installed. | Run `bun add -d @archont561/bun-test-utils` in the directory holding `package.json`. |
| `unknown fixture "greeting" requested in …` | The test file imported `test` from `bun:test` or from the package instead of from `./test`, so the composed chain is not in scope. | Import the runner the fixture was composed in: `import { test } from "./test";`. |
| `fixture "greeting" finished without calling use(value)` | The `setup` function returned without calling `use`. | Call `await use(value)`; the engine needs it to know when the fixture is ready and when to tear it down. |
| Session- or file-scoped teardown never runs | The preload is missing from `bunfig.toml`, so the run has no teardown hooks. | Run `bunx test-utils init --yes` and check `[test].preload` in `bunfig.toml`. |

[Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/)
walks through the fixture-specific errors, and
[Troubleshooting](/bun-test-utils/recipes/troubleshooting/) maps symptoms from
the whole capability set to their causes.

## Next steps

- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): dependencies, injection, and what a fixture definition may contain.
- [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/): choose between `session`, `file`, and `test` lifetimes.
- [Choose your test environment](/bun-test-utils/start/environment/): stay with `bun test` alone, or add DOM and browser backends.
- [Capability index](/bun-test-utils/capabilities/): what else the package ships, its maturity, and what each capability requires.
- [Recipes](/bun-test-utils/recipes/database/): bring a database, a test server, or a browser into the same fixture model.
