---
title: HTTP mocking and test servers
description: Serve an ephemeral Bun.serve instance, intercept fetch with MSW-style handlers, and decide when each one is the right tool.
status: stable
since: 0.1.0
---

Three fixtures deal with HTTP, and they compose:

| Fixture | What it is | Use it when |
| :-- | :-- | :-- |
| `testServer` | A real `Bun.serve` instance on a random port, stopped at teardown. Members: `url`, `port`, `server`, `handle(fn)`. | You want real sockets, real status codes, and real streaming for your own application code. |
| `serverUrl` | The same URL as `testServer.url`, declared as a dependency. | Your fixture or test needs the URL without caring about the server object. |
| `httpMock` | An MSW-style `fetch` interceptor with `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use`, `passthrough`, `reset`, `calls`, and `install(page)`. | You need a third-party API to answer deterministically, without a socket. |
| `networkGuard` | A deny-by-default `fetch` guard with `allow(...matchers)` and `calls()`. | You want a test to fail loudly when it reaches the network unexpectedly. |

`testServer` and `httpMock` are both test-scoped, so each test gets a fresh
server on a free port and a fresh set of handlers. Neither needs Playwright:
`httpMock` lives with the server fixtures precisely so a fetch-only test never
loads a browser.

## A local server and a mocked remote

```ts title="api.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";

test("a local server and a mocked remote", async ({ testServer, httpMock }) => {
  testServer.handle((req) => Response.json({ path: new URL(req.url).pathname }));

  const local = await fetch(`${testServer.url}/health`).then((r) => r.json());
  expect(local).toEqual({ path: "/health" });

  httpMock.get("https://api.example.com/user", () => Response.json({ name: "Ada" }));

  const user = await fetch("https://api.example.com/user").then((r) => r.json());
  expect(user.name).toBe("Ada");

  // calls() records every intercepted request, including one that reached the
  // local server with no handler, and says whether a handler matched.
  expect(httpMock.calls()).toEqual([
    expect.objectContaining({
      method: "GET",
      url: `${testServer.url}/health`,
      handled: false,
    }),
    expect.objectContaining({
      method: "GET",
      url: "https://api.example.com/user",
      handled: true,
    }),
  ]);
});
```

`handle(fn)` replaces the handler for the rest of the test; a fresh
`testServer` starts with one that answers `200 OK` to everything. Handler
functions receive the Bun `Request` and return a `Response` (or a promise for
one).

## What a matcher matches

`httpMock` and `networkGuard.allow` share one matcher type — a string, a
`RegExp`, or a predicate — and one rule for interpreting it:

| Matcher | Matches |
| :-- | :-- |
| A string starting with `http://`, `https://`, or `data:` | The **whole URL**, exactly. `"https://api.example.com"` does not match `"https://api.example.com/user"`. |
| Any other string | The **pathname** (`"/api/user"`), or any URL that **ends with** the string. |
| A `RegExp` | The **whole URL**, e.g. `/^https:\/\/api\.example\.com\//`. Its `lastIndex` is reset before each test, so `g` flags are safe. |
| A function | Called with a clone of the `Request`; return `true` to match. |

The exact-URL rule for full URLs surprises people, so prefer a `RegExp` or the
pathname form when you mean "everything under this host".

## When a handler answers

- A responder returns a `Response` to answer the request, or `undefined` to
  let it continue to the real network.
- `passthrough(matcher?)` is the declarative form of the same idea: matching
  requests go to the network, nothing else is recorded by the mock.
- Registrations are consulted in the order they were added; the first match
  answers.
- `reset()` clears the handlers mid-test, which is useful when a test has two
  phases with different expectations.
- `calls()` lists every request the interceptor saw — handled or not — with
  `method`, `url`, `request`, and `handled`.

## Combining `httpMock` with `networkGuard`

`networkGuard` is armed by the mere act of requesting it: with an empty
allowlist it blocks every `fetch` in the test, throwing the contractual message

```text
[bun-test-utils] networkGuard blocked unexpected fetch: GET <URL>. Allow it explicitly with networkGuard.allow(...).
```

Both fixtures install a wrapper around `globalThis.fetch`, and **the fixture
built last is the outermost wrapper**. Fixture build order follows the order you
list names in the test's destructured parameter, so list `httpMock` **after**
`networkGuard` when you want mocks to answer first and the guard to catch
everything else:

```ts title="guarded.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";

test("mocked requests win when httpMock is listed last", async ({
  networkGuard,
  httpMock,
}) => {
  httpMock.get("https://api.example.com/user", () => Response.json({ name: "Ada" }));

  const user = await fetch("https://api.example.com/user").then((r) => r.json());
  expect(user.name).toBe("Ada");
  expect(networkGuard.calls()).toEqual([]); // the mock answered before the guard looked

  await expect(fetch("https://tracker.test/pixel")).rejects.toThrow(
    "networkGuard blocked unexpected fetch",
  );
  expect(networkGuard.calls()).toHaveLength(1);
});
```

Reverse the two names and the guard wraps the mock: a mocked URL that is not in
the allowlist throws instead of being answered.

## Mocking inside a real page

`httpMock.install(page)` installs the same handlers on a Playwright page or
context and resolves to an uninstall function. Request `browserHttpMock`
instead to have the handlers installed on `browserContext` automatically.
See [DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/)
for the browser prerequisites.

```ts partial
test("the page sees mocked data", async ({ browserPage, httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const uninstall = await httpMock.install(browserPage);
  try {
    // ... drive the page
  } finally {
    await uninstall();
  }
});
```

## Failure modes

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `networkGuard blocked unexpected fetch: GET https://…` | The test requested `networkGuard` and fetched a URL that was never allowed. | Allow it with an exact URL, a pathname, a `RegExp`, or a predicate — or mock it with `httpMock`. |
| A mock "does not work" for `https://api.example.com/user` | The matcher was the bare origin `"https://api.example.com"`, which is compared as a full URL. | Use `"/api/user"`, `/^https:\/\/api\.example\.com\//`, or the full URL. |
| A mocked URL still throws a guard error | `httpMock` is listed before `networkGuard` in the test parameter, so the guard is the outer wrapper. | List `httpMock` after `networkGuard`, or allow the URL explicitly. |
| `calls()` includes requests you did not mock | `calls()` records every intercepted request, not only handled ones. | Filter on `handled`, or assert on the exact list as the example above does. |
| A real request leaves the process | Neither fixture intercepts hostname-based requests that bypass `fetch` (for example a raw socket). | Use `testServer` for those, or keep them behind a fixture you can point at it. |

## Related

- [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/): `networkGuard` beside `clock`, `seed`, `env`, and `tmpdir`.
- [Test server and HTTP mocks](/bun-test-utils/recipes/server-and-mocks/): the same fixtures applied to an application route handler.
- [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/): every member and option.
