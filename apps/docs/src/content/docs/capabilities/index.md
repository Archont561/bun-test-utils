---
title: Capability index
description: Every capability the package ships, what it is for, its maturity tier, and what it needs before it runs.
---

The fixture engine is the core; everything else on this page is a capability
built on the same runner and the same explicit composition. Each row names the
tier that governs it — read [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/)
for what a tier promises.

## Capabilities

| Capability | Use it for | Tier | Prerequisites | Guide |
| :-- | :-- | :-- | :-- | :-- |
| **Fixtures** | Typed values with a lifetime: databases, containers, users, clients | Stable | None | [The fixture model](/bun-test-utils/fundamentals/fixture-model/) |
| **Standard fixtures** | Isolated `tmpdir`, `env`, `stdio`, `clock`, `seed`, and an armed `networkGuard` | Stable | None | [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/) |
| **Snapshot testing** | Compare a value, a file, or a callback result against a stored baseline | Stable | None | [Snapshot testing](/bun-test-utils/capabilities/snapshots/) |
| **Property-based testing** | State an invariant and let `fast-check` generate inputs, then shrink failures | Stable | `fast-check` | [Property-based testing](/bun-test-utils/capabilities/property-based-testing/) |
| **Parameterized tests** | Run one body over a fixed matrix of named values through `test.prop` | Stable | `fast-check` | [Parameterized tests](/bun-test-utils/capabilities/parameterized-tests/) |
| **HTTP mocking and test servers** | Serve an ephemeral `Bun.serve` instance and intercept `fetch` with MSW-style handlers | Stable | None | [HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/) |
| **Recording HTTP cassettes** | Record real HTTP traffic and callback results, then replay them deterministically | Stable | None | [Recording HTTP cassettes](/bun-test-utils/capabilities/cassettes/) |
| **DOM testing** | Render and query markup in-process with `happy-dom` | Stable | `happy-dom` | [DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/) |
| **Browser testing** | Drive a real headless Chromium page through Playwright | **Experimental** | `playwright` + an installed Chromium build | [DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/) |
| **BDD scenarios** | Write one test as fluent `given` / `when` / `then` steps that share typed state | **Experimental** | `@aboviq/bun-test-cucumber` | [BDD scenarios](/bun-test-utils/capabilities/scenarios/) |

Everything above shares one rule: the capability is available where the runner
you import has it, and a peer package is loaded only when a requested fixture
actually needs it. A unit test that never mentions `webPage` never loads
`happy-dom`, and a suite that never mentions `browserPage` never loads
Playwright.

## Built-in fixtures overview

The root `test` contributes these nineteen names. Request one by destructuring
it; override one with an extension of the same name. Per-fixture members,
scopes, and behaviours are in the
[Built-in fixture API](/bun-test-utils/reference/fixtures/).

| Area | Fixtures | What they give a test |
| :-- | :-- | :-- |
| Standard | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` | A temporary directory, a scoped environment, captured output streams, frozen time, a seeded `Math.random`, and a fetch guard — each restored at teardown. |
| DOM | `window`, `document`, `page` | The `happy-dom` window and document, plus a small helper for mounting, querying, and clicking. |
| Either backend | `webPage` | One page-shaped API that is `happy-dom` by default and Playwright when `BUN_TEST_UTILS_WEB_ENV=browser`. |
| Browser (experimental) | `browser`, `browserContext`, `browserPage`, `browserHttpMock` | A session-scoped Chromium, a per-test context and page, and `httpMock` handlers installed on that context. |
| Server and HTTP | `testServer`, `serverUrl`, `httpMock` | An ephemeral `Bun.serve` instance on a random port, its URL as a dependency, and MSW-style fetch handlers. |
| Cassettes | `cassette` | Callback record/replay plus HTTP record/replay, with serializers. |
| Snapshots | `snapshot` | Value, file, and callable snapshot assertions with serializers and modes. |

## Where to go next

- **Nothing is passing yet?** Start at [Install and first passing test](/bun-test-utils/start/first-test/).
- **Deciding how much environment to take on?** [Choose your test environment](/bun-test-utils/start/environment/).
- **Bringing in a real resource?** [Database fixture](/bun-test-utils/recipes/database/) and [Test server and HTTP mocks](/bun-test-utils/recipes/server-and-mocks/).
- **Blocked by an error?** [Troubleshooting](/bun-test-utils/recipes/troubleshooting/).
