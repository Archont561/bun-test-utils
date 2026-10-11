---
title: HTTP, cassette, and browser API
description: webPage, httpMock, testServer, cassette, the /vcr serializers, and the browser fixtures — members, modes, and contracts.
status: stable
since: 0.1.0
requires: [playwright]
---

**Use this when** you need the member list for a page or HTTP fixture, the
cassette mode semantics, or the serializer contract behind `/vcr`. The task
guides are
[HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/),
[Recording HTTP cassettes](/bun-test-utils/capabilities/cassettes/), and
[DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/).

Browser fixtures and the browser `webPage` backend are **experimental**; the
server, mock, and cassette surfaces are stable. `playwright` is optional and
loaded only when a requested fixture needs it.

## `webPage`: one fixture, two backends

`page` always uses `happy-dom`, and `browserPage` always uses Playwright. Their
meaning never changes. To write a test that runs on either, request `webPage`
and choose the backend with `BUN_TEST_UTILS_WEB_ENV`: `dom` (the default) or
`browser` (or `playwright`).

```ts partial
test("renders the button", async ({ webPage }) => {
  await webPage.setContent(`<button id="save">Save</button>`);
  await webPage.click("#save");
  expect(webPage.mode).toMatch(/^(dom|browser)$/);
});
```

| Member | Behaviour |
| :-- | :-- |
| `mode` | `"dom"` or `"browser"`: the backend this test runs on. |
| `goto(url)` | Loads a page. On the DOM backend, it fetches the URL and sets the body. |
| `setContent(html)` / `mount(html)` | Replaces the page's content. |
| `click(selector)` / `type(selector, text)` | Interacts with an element. |
| `textContent(selector)` / `html()` | Reads the page. |
| `evaluate(fn)` | Runs `fn` in the page on the browser backend. On the DOM backend, `fn` runs with `this` set to the happy-dom window. |
| `raw` | The underlying happy-dom window or Playwright `Page`. Use it only for backend-specific assertions. |

Write portable tests with the helper methods; reach for `raw`, `mode`, or
`browserPage` only when a test is deliberately backend-specific.

## `httpMock`: fetch handlers

`httpMock` patches `fetch` for the current test. It exposes an MSW-style API: a
method per HTTP verb plus `use` for anything else, and a matcher that is a
string, a `RegExp`, or a predicate.

```ts partial
test("loads mocked data", async ({ httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  httpMock.post(/\/api\/events$/, async (request) =>
    Response.json({ received: await request.json() }),
  );

  expect(await fetch("https://app.test/api/user").then((r) => r.json())).toEqual({
    name: "Ada",
  });
  expect(httpMock.calls()[0]).toMatchObject({ method: "GET", handled: true });

  httpMock.reset();
});
```

| Member | Behaviour |
| :-- | :-- |
| `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `use` | Registers a responder. Return `undefined` from a responder to pass the request through. |
| `passthrough(matcher?)` | Lets matching requests reach the network. |
| `reset()` | Clears the handlers. Use it between phases of one test. |
| `calls()` | Lists every intercepted request: `method`, `url`, `request`, and whether a handler matched (`handled`). |
| `install(page)` | Installs the same handlers on a Playwright page or context. Resolves to a cleanup function. |

**Matchers.** A string that starts with `http://`, `https://`, or `data:` is
compared against the **whole URL**. Any other string matches the **pathname**
(or a URL suffix). A `RegExp` is tested against the whole URL. A function
receives a clone of the `Request`.

**Ordering.** Handlers are consulted in registration order; the first match
answers. The fixture built last wraps the others around `globalThis.fetch`, so
listing `httpMock` after `networkGuard` in a test parameter makes mocks win. See
[combining them](/bun-test-utils/capabilities/http-and-servers/#combining-httpmock-with-networkguard).

## `testServer` and `serverUrl`

| Member | Behaviour |
| :-- | :-- |
| `testServer.url` | Origin of the ephemeral server, e.g. `http://localhost:35833`. Changes per test. |
| `testServer.port` | The bound port. |
| `testServer.server` | The Bun `Server` object. |
| `testServer.handle(fn)` | Replaces the request handler: `(req: Request) => Response \| Promise<Response>`. |
| `serverUrl` | The same string as `testServer.url`, for fixtures that depend on the origin without the server object. |

The server starts on a random free port and is stopped at teardown, so
parallel test files cannot collide.

## `cassette`: callbacks and HTTP recordings

| Member | Behaviour |
| :-- | :-- |
| `cassette(callback)` | Get-or-record callback wrapper. Local `auto` replays a hit and refreshes only a missing source with a visible warning; CI, explicit replay, ambiguity, and serializer errors stay strict. |
| `record(callback)` | Runs the callback once and stores its serializable result. Returns the result. |
| `replay(callback)` | Returns the stored result without running the callback. |
| `addSerializer(serializer)` | Registers a reversible, versioned serializer for this test's callback values. |
| `redactHeader(name)` | Redacts the named request header in recordings. Available, but outside the stable contract. |
| `mode`, `setMode(mode)` | The mode for this test: `auto`, `record`, `replay`, or `passthrough`. A mode explicitly set to `replay` keeps the callable strict. |

| Mode | Missing cassette | Existing cassette |
| :-- | :-- | :-- |
| `auto` (default) | Records, unless `CI` is set | Replays |
| `record` | Records and overwrites at end of run | Overwrites at end of run |
| `replay` | Fails with `CASSETTE_NOT_FOUND` | Replays |
| `passthrough` | Goes to the network | Goes to the network |

**Storage.** HTTP entries live in `__cassettes__/<test-slug>.json` next to the
test file; callback results live in the sibling
`__cassettes__/<test-slug>.callbacks.json`. Snapshot baselines live in
`__snapshots__/<test-slug>.snap.json`. The locations are fixed in `0.1.x`:
there is no base-directory override.

**HTTP matching.** The uppercase request method and the full URL must both match
exactly. Partial URLs, regular expressions, request bodies, and custom
predicates are not part of the stable contract. A request missing from an
existing cassette fails with `CASSETTE_MISMATCH`; it is never recorded
silently.

**Callback identity.** Within a run, a callback is identified by its object;
across runs, by its source text. Two closures from one factory are separate
callbacks. Captured values are not part of the identity, which is why hidden
inputs can require an explicit `VCR_MODE=record`.

## `/vcr`: global callback serializers

The helper-only `/vcr` subpath exports no fixture. Use it from a preload when a
serializer should apply to every cassette in a Bun process.

| Export | Behaviour |
| :-- | :-- |
| `defineCallbackSerializer(serializer)` | Returns a reusable reversible serializer definition unchanged. Its `name` and positive integer `version` are stored in recordings. |
| `registerCallbackSerializer(serializer)` | Validates, registers, and returns the same object. Registrations persist for the process and are shared between the `/vcr` preload bundle and the root cassette bundle. |
| `unregisterCallbackSerializer(serializer)` | Removes every registration of that exact object. Returns `true` if it removed one or more, otherwise `false`. |
| `CallbackSerializer<T>` | The `{ name, version, test, serialize, deserialize }` contract for a callback value shape. |

Selection order: newest fixture-local `cassette.addSerializer` registration,
then newest global registration, then built-ins. Exact `(name, version)`
decoding is required at every level: a same-name, different-version serializer
causes `CALLBACK_SERIALIZER_NOT_FOUND` rather than an automatic refresh.

## Browser fixtures

Experimental; requires the `playwright` peer and an installed Chromium build.

| Fixture | Scope | Provides |
| :-- | :-- | :-- |
| `browser` | `session` | The launched headless Chromium. |
| `browserContext` | `test` | A Playwright `BrowserContext`. |
| `browserPage` | `test` | A Playwright `Page`. |
| `browserHttpMock` | `test` | `httpMock` handlers installed on the context. |
| `webPage` with `BUN_TEST_UTILS_WEB_ENV=browser` | `test` | The portable page API on a real page. |

Launch is headless-only and Chromium-only; there is no headed mode. A launch
failure raises `FIXTURE_SETUP_FAILED` with the underlying error as `cause`.
Recovery steps are in
[DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/#troubleshooting)
and [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/).

## Errors

| Code | Raised when |
| :-- | :-- |
| `CASSETTE_NOT_FOUND` | Replay mode found no cassette for the test. |
| `CASSETTE_MISMATCH` | A request is missing from an existing cassette. The message names the command that clears it. |
| `CALLBACK_AMBIGUOUS` | One callback source text was recorded from more than one closure. |
| `CALLBACK_NOT_RECORDED` | A callback's source text has no recording. |
| `CALLBACK_NOT_SERIALIZABLE` | A callback returned a value that is not plain data and that no serializer handles. |
| `CALLBACK_SERIALIZER_NOT_FOUND` | A recording needs a serializer that is not registered. |
| `CALLBACK_SERIALIZER_FAILED` | A serializer threw. The original error is the `cause`. |
| `CALLBACK_STORE_INVALID` | A callback sidecar file is corrupt. |
| `FIXTURE_SETUP_FAILED` | A browser could not launch. The original error is the `cause`. |
| `MISSING_OPTIONAL_DEPENDENCY` | `playwright` is not installed. The message names the install command. |

## Related

- [Recording HTTP cassettes](/bun-test-utils/capabilities/cassettes/): the workflow, secrets policy, and CI mode.
- [HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/): matcher semantics and the guard interaction.
- [Built-in fixture API](/bun-test-utils/reference/fixtures/): the same fixtures at inventory level, including scopes.
