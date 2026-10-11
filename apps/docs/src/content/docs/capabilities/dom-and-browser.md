---
title: DOM and browser testing
description: Render markup in happy-dom or drive a real headless Chromium, choose between them per test, and recover from the failures each one has.
status: experimental
requires: [happy-dom, playwright]
platforms: Linux and macOS
---

Two backends are available for page-shaped tests, and one fixture can run on
either. **DOM testing is stable**; **browser testing is experimental** and may
change in a minor release. Both are selected per test file, not globally.

## The decision

| | `happy-dom` (default) | Real browser |
| :-- | :-- | :-- |
| **What runs** | A DOM implementation in the same process as the test | A headless Chromium process driven over the Playwright protocol |
| **Speed** | Fast: no browser process, no protocol round-trip | Slower to start, and every interaction is a round-trip |
| **Fidelity** | DOM APIs only — no layout, no paint, no real navigation engine | A real engine: layout, CSS cascade, real timers, real `fetch` |
| **Prerequisites** | `bun add -d happy-dom` | `bun add -d playwright` **and** `bunx playwright install chromium` |
| **Platforms** | Anywhere `bun test` runs | Linux and macOS; on Linux the Chromium build also needs system libraries — see [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/) |
| **Use it for** | Rendering logic, DOM manipulation, component output, event wiring, text and attribute assertions | Real layout, computed styles, focus and keyboard behaviour, anything where the browser engine is the thing under test |
| **Known limits** | No layout or paint; `evaluate` runs with the happy-dom window as `this` rather than in a page context; a `goto` fetches the document and sets it instead of navigating | Experimental API; headless only — there is no headed mode (ADR 0030); the `browser` fixture launches Chromium only |
| **Maturity** | Stable | Experimental |

If a suite only needs DOM APIs, `happy-dom` is the right default and it is
already the default. Reach for the browser backend when a test would pass
against `happy-dom` and the real engine disagrees — that difference is usually
the bug.

## A minimal DOM test

Install the peer, then request `page` (or `window` / `document`):

```bash runnable
bun add -d happy-dom
```

```ts title="renders.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";

test("renders a heading with the DOM fixture", async ({ page }) => {
  page.mount('<h1 id="title">Ada</h1>');
  expect(page.querySelector("#title")?.textContent).toBe("Ada");
  expect(page.html()).toContain("Ada");
});
```

```bash runnable
bun test renders.test.ts
```

`page` is test-scoped: each test mounts into a fresh document, and the window
is torn down afterwards. `page.mount(html)` returns the mounted element;
`querySelector`, `querySelectorAll`, `click`, `type`, `html`, and `clear` make
up the rest of the helper. Without `happy-dom` installed, the fixture fails
with `MISSING_OPTIONAL_DEPENDENCY` and the message says
`Install via 'bun add -d happy-dom'`.

## A minimal browser test

The browser backend needs the peer **and** a Chromium build:

```bash runnable
bun add -d playwright
bunx playwright install chromium
```

Then either request a Playwright-specific fixture — `browserPage` — or keep the
portable `webPage` and select the backend with the environment variable:

```ts title="browser.test.ts" illustrative
import { expect, test } from "@archont561/bun-test-utils";

test("renders a heading in a real page", async ({ browserPage }) => {
  await browserPage.setContent('<h1 id="title">Ada</h1>');
  expect(await browserPage.textContent("#title")).toBe("Ada");
});
```

```bash illustrative
BUN_TEST_UTILS_WEB_ENV=browser bun test browser.test.ts
```

`browser` (the launched Chromium) is session-scoped, so one browser process is
reused across the run; `browserContext` and `browserPage` are test-scoped, so
each test gets a clean context. This is the experimental surface: the fixtures,
their members, and the environment-variable values may change in a minor
release.

:::caution[Experimental]
Browser support may change without a major version bump. Report failures with
the [bug report form](https://github.com/Archont561/bun-test-utils/issues/new?template=bug_report.yml),
including `bun --version`, the OS, and the output of `bunx playwright --version`.
Documentation problems go through the page footer link instead.
:::

## One test, both backends

`webPage` is the portable fixture. Its members mean the same thing on both
backends, so the same assertion runs unchanged:

```ts title="portable.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";

test("renders a heading on either backend", async ({ webPage }) => {
  await webPage.setContent('<h1 id="title">Ada</h1>');
  expect(await webPage.textContent("#title")).toBe("Ada");
});
```

```bash partial
bun test portable.test.ts                    # happy-dom
BUN_TEST_UTILS_WEB_ENV=browser bun test portable.test.ts   # headless Chromium
```

Keep the assertion the same and let the environment choose. Backend-specific
code belongs behind `webPage.mode` or on `webPage.raw`:

| Member | On `happy-dom` | On the browser backend |
| :-- | :-- | :-- |
| `mode` | `"dom"` | `"browser"` |
| `goto(url)` | Fetches the URL and sets the document body | Navigates the page |
| `setContent(html)` / `mount(html)` | Replaces the document content | Replaces the page content |
| `click(selector)` / `type(selector, text)` | Dispatches a synthetic event | Drives real user input |
| `textContent(selector)` / `html()` | Reads the DOM | Reads the DOM |
| `evaluate(fn)` | Runs `fn` with `this` bound to the happy-dom window | Runs `fn` inside the page |
| `raw` | The happy-dom window | The Playwright `Page` |

`page` always uses `happy-dom` and `browserPage` always uses Playwright; their
meaning never changes. Use them when a test is deliberately backend-specific,
and `webPage` when it should run on both.

## Bringing a browser into the fixture model

`httpMock` handlers can be installed on a real page too. Request
`browserHttpMock` to put the same handlers on the `browserContext`
automatically, or call `httpMock.install(page)` yourself:

```ts partial
test("the page sees mocked data", async ({ browserPage, httpMock }) => {
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));
  const uninstall = await httpMock.install(browserPage);
  // ... drive the page, then:
  await uninstall();
});
```

See [HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/)
for the handler API.

## Troubleshooting

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `MISSING_OPTIONAL_DEPENDENCY` naming `playwright`, with `Install via 'bun add -d playwright'` | The peer is not installed in the project. | `bun add -d playwright` in the project that runs the browser test. |
| `FIXTURE_SETUP_FAILED`: "No browser is available — both the headless shell and the full chromium build failed to launch." | Playwright is installed but has no Chromium build, or the build cannot launch. The underlying `cause` reads `Executable doesn't exist at …/chromium-<revision>/chrome-linux64/chrome`. | Run `bunx playwright install chromium` in the project. The message names the repository's own `bun run install-browsers` script, which is a convenience alias for this repository, not a command in your project. |
| The same error on a Linux CI runner, with a launch failure that is not about a missing executable | Chromium's shared libraries are missing. | Install the system dependencies: `bunx playwright install --with-deps chromium`, or use Playwright's [documented container](https://playwright.dev/docs/docker). See [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/). |
| A selector matches in `happy-dom` and not in the browser | `happy-dom` does not implement layout, so selectors that depend on rendering, `:visible`, or computed styles can differ. | Assert on text, attributes, and roles instead of layout, or move the test to the browser backend deliberately. |
| `evaluate` behaves differently between backends | On `happy-dom`, `fn` runs in the test process with `this` bound to the window; in a browser it is serialized into the page. | Keep `evaluate` callbacks free of closures over test variables, or branch on `webPage.mode`. |
| Browser tests are slow in CI | Every `browser` launch is a process; contexts add start-up cost. | Keep `browser` session-scoped (it is), and reuse `browserPage` across assertions within one test. |

## Related

- [Choose your test environment](/bun-test-utils/start/environment/): the short version of the decision above.
- [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/): the exact pipeline steps.
- [Built-in fixture API](/bun-test-utils/reference/fixtures/): members and scopes for every DOM and browser fixture.
- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): what "experimental" promises.
