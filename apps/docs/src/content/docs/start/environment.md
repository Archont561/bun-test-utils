---
title: Choose your test environment
description: Decide between plain bun test, a happy-dom page, and a real headless Chromium page before you write the first test.
---

`bun-test-utils` runs wherever `bun test` runs. Two capabilities add an
environment underneath your assertions: DOM fixtures, which render markup in
`happy-dom`, and browser fixtures, which drive a real headless Chromium through
Playwright. Choose once, at the start, and the rest of the fixture model stays
the same.

## The decision

| Environment | Use it when | Prerequisites | Maturity |
| :-- | :-- | :-- | :-- |
| **Plain `bun test`** — no environment fixtures | You test functions, HTTP handlers, services, or data access. Most suites never need more. | None | Stable |
| **`happy-dom`** — `page`, `window`, `document` | You test rendering logic, DOM manipulation, or component output, and speed matters more than browser fidelity. | `bun add -d happy-dom` | Stable |
| **A real browser** — `browserPage`, or `webPage` with `BUN_TEST_UTILS_WEB_ENV=browser` | You need real layout, real timers, real network, or the code behaves differently in a browser engine. | `bun add -d playwright` + `bunx playwright install chromium` | Experimental |

Portable tests request **`webPage`**, which renders in `happy-dom` by default and
switches to a Playwright page when `BUN_TEST_UTILS_WEB_ENV=browser` is set. One
test body, two backends:

```bash partial
bun test                                  # happy-dom (the default)
BUN_TEST_UTILS_WEB_ENV=browser bun test   # real headless Chromium
```

The second command is partial because it assumes the Playwright peer and a
Chromium build are already installed; the capability page shows both installs.

`page` and `browserPage` keep fixed meanings — `page` is always `happy-dom`,
`browserPage` is always Playwright. Reach for them when a test is deliberately
backend-specific.

## What to expect from each

- **`happy-dom`** starts in-process, needs no browser binary, and works on any
  machine that can run `bun test`. It implements the DOM, not a rendering
  engine: no layout, no paint, no real navigation.
- **A real browser** is authoritative but slower and heavier: it needs the
  Playwright peer, an installed Chromium build, and shared libraries on Linux.
  It is experimental, so its API may change in a minor release.
- Fixture lifecycle is identical on both. `webPage` is test-scoped, so each
  test gets a clean page, and teardown closes it.

## Next steps

- [DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/): the decision table in depth, both minimal examples, and the failure modes.
- [Browser tests in CI](/bun-test-utils/recipes/browser-tests-in-ci/): the exact CI steps, including the Linux system libraries.
- [Install and first passing test](/bun-test-utils/start/first-test/): the plain-`bun test` path, if you have not run it yet.
