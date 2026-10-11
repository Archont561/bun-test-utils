---
title: Deterministic tests
description: Freeze time, seed randomness, redirect the temp directory, scope the environment, and guard the network in one test.
status: stable
since: 0.1.0
---

Five standard fixtures remove the usual sources of flakiness: wall-clock time,
unseeded randomness, the machine's temp directory, leaked environment
variables, and unexpected network calls. They are test-scoped, so each one is
restored before the next test starts.

## The example

```ts title="invoice.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";

test("an invoice is reproducible", async ({ clock, seed, tmpdir, env }) => {
  clock.freeze("2026-01-01T00:00:00Z");
  seed.set(42);
  env.set("APP_MODE", "test");

  const id = `inv-${seed.random().toString(36).slice(2, 8)}`;
  tmpdir.write("invoice.json", JSON.stringify({ id, created: clock.now().toISOString() }));

  expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  expect(env.get("APP_MODE")).toBe("test");
  expect(tmpdir.read("invoice.json")).toContain("2026-01-01T00:00:00.000Z");
});

test("the environment is restored between tests", ({ env }) => {
  expect(env.get("APP_MODE")).toBeUndefined();
});
```

With seed `42`, the first `seed.random()` produces the id `inv-ln13h9` on every
machine and every run. That is the property worth having: a failure reported in
CI reproduces locally from the same seed.

## What each fixture does

| Fixture | Members | Effect | Restored at teardown |
| :-- | :-- | :-- | :-- |
| `clock` | `freeze(time)`, `set(time)`, `now()` | Controls `Date` and time. `time` may be a string, a number, or a `Date`. | Yes |
| `seed` | `value`, `set(seed)`, `random()` | Makes `Math.random` deterministic from a seed. `set` restarts the sequence. | Yes |
| `tmpdir` | `dir`, `path(...parts)`, `write(name, content)`, `read(name)`, `exists(name)`, `remove(name)` | An isolated temporary directory, removed recursively at teardown. `write` returns the file's path. | Yes — the directory is deleted |
| `env` | `set(key, value)`, `get(key)`, `delete(key)`, `snapshot()` | Changes environment variables for the test. | Yes — every change is reverted |
| `stdio` | `stdout()`, `stderr()`, `output()`, `clear()` | Captures writes to `process.stdout` and `process.stderr`. | Yes — the real streams return |
| `networkGuard` | `allow(...matchers)`, `calls()` | Blocks `fetch` calls whose URL was not allowed. | Yes — the real `fetch` returns |

`stdio` captures `process.stdout.write` and `process.stderr.write`. `console.*`
output is not captured: assert on the captured stream output, or on the value
the code returns.

## Combining the guard with mocks

Requesting `networkGuard` arms it with an empty allowlist, so every `fetch`
throws until you allow a URL. When a test also mocks the network with
`httpMock`, list `httpMock` **after** `networkGuard` in the test parameter so
the mock is the outer wrapper and answers first:

```ts partial
test("deterministic and offline", async ({ clock, seed, networkGuard, httpMock }) => {
  clock.freeze(0);
  seed.set(7);
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));

  const user = await fetch("http://localhost/api/user").then((r) => r.json());
  expect(user.name).toBe("Ada");
  expect(networkGuard.calls()).toEqual([]); // the mock answered before the guard saw it
});
```

See [Combining `httpMock` with `networkGuard`](/bun-test-utils/capabilities/http-and-servers/#combining-httpmock-with-networkguard)
for the rule and the reversed case.

## A fixture that resets everything at once

Projects usually want the same combination in every test, without repeating the
destructuring. Compose it once:

```ts title="test.ts" illustrative
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  // Built before every test body that requests it, torn down after.
  frozenClock: {
    setup: async (use, { clock }) => {
      clock.freeze("2026-01-01T00:00:00Z");
      await use(clock);
    },
  },
});
```

A fixture that only configures another fixture is a legitimate pattern: it
keeps the setup policy in one file instead of in every test. `frozenClock`
depends on `clock`, so the engine builds `clock` first and tears it down last.

## Related

- [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/): why every standard fixture is test-scoped.
- [HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/): matchers and the guard's message.
- [Built-in fixture API](/bun-test-utils/reference/fixtures/): full member lists.
