---
title: Built-in fixture API
description: The nineteen built-in fixtures on the root test context — scope, members, prerequisites, and behaviour.
status: stable
since: 0.1.0
---

**Use this when** you need a fixture's exact members, its scope, or whether it
needs a peer package. Each capability also has a guide that explains when to
reach for it — this page is the inventory, not the tutorial.

Built-in capabilities are fixtures on the root `test` context. Request one by
destructuring, exactly as you request your own; you do not compose them
yourself, and any of them can be overridden with `test.extend()`.

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test("uses built-in fixtures", async ({ tmpdir, env, snapshot }) => {
  env.set("APP_MODE", "test");
  tmpdir.write("mode.txt", env.get("APP_MODE")!);
  snapshot.match({ mode: tmpdir.read("mode.txt") }, "mode");
});
```

The root package exports only the runners `describe`, `expect`, and `test`. The
helper subpaths `/pbt`, `/bdd`, `/snap`, and `/vcr` export typed definitions and
serializer helpers, and none of them exports a fixture.

## Built-in fixture names

| Area | Fixtures |
| :-- | :-- |
| Standard | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` |
| DOM | `window`, `document`, `page` |
| Either backend | `webPage` |
| Browser (experimental) | `browser`, `browserContext`, `browserPage`, `browserHttpMock` |
| Server and HTTP | `testServer`, `serverUrl`, `httpMock` |
| Cassettes | `cassette` |
| Snapshots | `snapshot` |

Every one of them is `test`-scoped except `browser`, which is `session`-scoped
so a single launched browser serves the whole run. The
[scope decision table](/bun-test-utils/fundamentals/scopes-and-teardown/#the-decision)
explains when to override that.

## Standard

No prerequisites. All test-scoped, all restored at teardown.

| Fixture | Members | Behaviour |
| :-- | :-- | :-- |
| `tmpdir` | `dir`, `path(...parts)`, `write(name, content)`, `read(name)`, `exists(name)`, `remove(name)` | An isolated temporary directory, removed recursively at teardown. `write` returns the file's path. |
| `env` | `set(key, value)`, `get(key)`, `delete(key)`, `snapshot()` | Changes environment variables for the test. Every change is reverted at teardown. |
| `stdio` | `stdout()`, `stderr()`, `output()`, `clear()` | Captures writes to `process.stdout` and `process.stderr`. The real streams are restored at teardown. `console.*` output is not captured. |
| `clock` | `freeze(time)`, `set(time)`, `now()` | Controls `Date` and time. `time` may be a string, a number, or a `Date`. Restored at teardown. |
| `seed` | `value`, `set(seed)`, `random()` | Makes `Math.random` deterministic from a seed. `set` restarts the sequence, so a failing run replays. |
| `networkGuard` | `allow(...matchers)`, `calls()` | Blocks `fetch` to URLs that were not allowed. `calls()` lists every request and whether it was allowed. Requesting it arms it. |

Matchers are shared with `httpMock`; see
[what a matcher matches](/bun-test-utils/capabilities/http-and-servers/#what-a-matcher-matches).

## DOM

Requires `happy-dom` (`>=20.0.0`). All test-scoped.

| Fixture | Provides |
| :-- | :-- |
| `window` | The `happy-dom` window, bridged onto the host `globalThis` for the test. |
| `document` | The `happy-dom` document. |
| `page` | The DOM helper: `mount(html)`, `querySelector(selector)`, `querySelectorAll(selector)`, `click(selector)`, `type(selector, text)`, `html()`, `clear()`. |

`page` always uses `happy-dom`. For a test that should run on either backend,
use `webPage`.

## Web (either backend)

| Fixture | Provides | Requires |
| :-- | :-- | :-- |
| `webPage` | One page-shaped API whose backend is chosen by `BUN_TEST_UTILS_WEB_ENV`: `dom` (the default) or `browser` / `playwright`. | `happy-dom`, or `playwright` with an installed Chromium build for the browser backend |

Members, all meaning the same thing on both backends:

| Member | Behaviour |
| :-- | :-- |
| `mode` | `"dom"` or `"browser"`: the backend this test runs on. |
| `goto(url)` | Loads a page. On the DOM backend it fetches the URL and sets the body. |
| `setContent(html)` / `mount(html)` | Replaces the page content. |
| `click(selector)` / `type(selector, text)` | Interacts with an element. |
| `textContent(selector)` / `html()` | Reads the page. |
| `evaluate(fn)` | Runs `fn` in the page on the browser backend; on the DOM backend `fn` runs with `this` bound to the happy-dom window. |
| `raw` | The underlying happy-dom window or Playwright `Page`, for backend-specific assertions. |

## Browser (experimental)

Requires the `playwright` peer (`>=1.40.0`) and an installed Chromium build
(`bunx playwright install chromium`). Headless only, Chromium only. Loaded only
when requested, and the API may change in a minor release.

| Fixture | Scope | Provides |
| :-- | :-- | :-- |
| `browser` | `session` | A launched headless Chromium, shared for the run, closed at session teardown. |
| `browserContext` | `test` | A Playwright `BrowserContext` for the test. |
| `browserPage` | `test` | A Playwright `Page` in that context. |
| `browserHttpMock` | `test` | The `httpMock` handlers installed on the `browserContext` automatically. |

`browserPage` and `page` keep their own meanings; use `webPage` when one test
should run on either backend.

## Server and HTTP

No prerequisites. All test-scoped, so parallel files cannot collide on a port.

| Fixture | Provides |
| :-- | :-- |
| `testServer` | An ephemeral `Bun.serve` server on a random port, stopped at teardown. Members: `url`, `port`, `server`, `handle(fn)`. |
| `serverUrl` | The same URL as `testServer.url`, declared as a dependency. |
| `httpMock` | MSW-style fetch handlers: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use`, `passthrough`, `reset`, `calls`, `install(page)`. |

`httpMock` lives with the server fixtures, not the browser ones, so a
fetch-based test never loads Playwright.

## Cassettes

No prerequisites. Test-scoped; the real `globalThis.fetch` is restored at
teardown.

| Member | Behaviour |
| :-- | :-- |
| `cassette(callback)` | Get-or-record wrapper. Local `auto` replays a hit and refreshes only a missing source with a visible warning; CI, explicit replay, ambiguity, and serializer errors stay strict. |
| `record(callback)` | Runs the callback once and stores its serializable result. Returns the result. |
| `replay(callback)` | Returns the stored result without running the callback. |
| `addSerializer(serializer)` | Registers a reversible, versioned serializer for this test's callback values. |
| `redactHeader(name)` | Redacts the named request header in recordings. Available, but outside the stable contract. |
| `mode`, `setMode(mode)` | The mode for this test: `auto`, `record`, `replay`, or `passthrough`. |

## Snapshots

No prerequisites. Test-scoped.

| Member | Behaviour |
| :-- | :-- |
| `snapshot(callback, name)` | Runs and awaits `callback` once, matches its result under the required non-empty `name`, and returns the original result. |
| `match(value, name?)` | Compares a value against the stored snapshot, or records it on first run. |
| `matchFile(path, name?)` | Compares the contents of a file. |
| `addSerializer(serializer)` | Registers a serializer for this test. Return `undefined` for values it does not handle. |
| `mode`, `setMode(mode)` | `"match"`, `"update"`, or `"ci"`. |
| `path` | The path of this test's snapshot file (read-only). |

## Property and scenario tests

These are methods on `test`, not fixtures:

- `test.prop(title, arbitraries, fn, options?)` — property tests; needs
  `fast-check`. See
  [Property tests](/bun-test-utils/reference/snapshots-and-property/#testproptitle-arbitraryfactory-fn-options).
- `test.scenario(title)` and `test.scenario.prop(title, arbitraries)` — BDD
  scenarios; need `@aboviq/bun-test-cucumber`, and are experimental. See
  [BDD scenarios](/bun-test-utils/capabilities/scenarios/).

## Related

- [Capability index](/bun-test-utils/capabilities/): what each area is for, its tier, and its prerequisites.
- [Core runner and fixture API](/bun-test-utils/reference/core/): `test()`, `test.extend()`, and the definition contract.
- [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/): the deep member lists for those fixtures.
