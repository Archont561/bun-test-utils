---
title: Browser tests in CI
description: Install Chromium with its system libraries, cache the build, and keep the browser lane green on Linux.
platforms: Linux and macOS
requires: [playwright]
status: experimental
since: 0.1.0
---

Browser tests are the one capability with meaningful CI prerequisites: a
`playwright` peer, a Chromium build, and — on Linux — the shared libraries that
build links against. They run **headless only** and the `browser` fixture
launches **Chromium only** (ADR 0030), so there is no display server to set up
and no `xvfb` step.

## The steps

```yaml title=".github/workflows/ci.yml" partial
jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2 # match packageManager / engines

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Restore the Playwright browser cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          # The key is the lockfile: it changes only when the playwright
          # version does, and the browser revision follows that version.
          key: playwright-${{ runner.os }}-${{ hashFiles('bun.lock') }}
          restore-keys: |
            playwright-${{ runner.os }}-

      - name: Install Chromium
        run: bunx playwright install --with-deps chromium

      - name: Run the suite
        run: bun test
```

Three details are load-bearing:

- **`bunx playwright install --with-deps chromium`** installs the browser *and*
  the system libraries on a bare runner. Without `--with-deps`, Chromium can be
  present and still fail to launch.
- **Cache `~/.cache/ms-playwright`** keyed by the lockfile. Re-downloading the
  browser on every run is the slowest part of a browser lane. If you set
  `PLAYWRIGHT_BROWSERS_PATH`, cache that directory instead.
- **`CI` is already set** by GitHub Actions, which is what makes cassettes
  replay-only and snapshots read-only. Nothing to configure for that.

If you run the suite in a container instead, use a Playwright image
(`mcr.microsoft.com/playwright:v1.63.0-noble`) and skip `--with-deps`: the
libraries are already there.

## Keeping the lane fast

| Cost | What to do |
| :-- | :-- |
| Browser download | Cache it (above) |
| Browser launch per test file | Nothing to do: `browser` is session-scoped, so one Chromium process serves the run |
| Browser contexts | `browserContext` is test-scoped for isolation; that is the intended cost |
| Heavy page work | Prefer `happy-dom` for pure DOM assertions and keep the real browser for tests that need layout, focus, or real input |
| Long suites | Split browser tests into their own job so a failure there does not hide unit-test results |

The `webPage` fixture lets the same test run on either backend, so a project can
run its DOM assertions twice — once cheap on `happy-dom`, once authoritative in
Chromium:

```bash partial
bun test                                   # happy-dom everywhere
BUN_TEST_UTILS_WEB_ENV=browser bun test    # the same tests on Chromium
```

Only the second command needs the install steps above.

## Debugging a failure that only happens in CI

1. **Reproduce locally headless.** `BUN_TEST_UTILS_WEB_ENV=browser bun test`
   uses the same headless path as CI.
2. **Check the install step first.** A `FIXTURE_SETUP_FAILED` with a launch
   error means the browser or its libraries are missing, not that the test is
   wrong. The `cause` names a missing executable when that is the problem.
3. **Capture the test output as an artifact.** The fixtures do not record
   Playwright traces or video; capture stdout and stderr, and print the state
   the assertion expected on failure.
4. **Narrow the difference.** A test that passes locally and fails in CI is
   usually sensitive to timing, fonts, or a missing network. `clock` removes
   the first, CI images differ on the second, and `httpMock` removes the third.

## Failure modes

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| `MISSING_OPTIONAL_DEPENDENCY` naming `playwright` | The peer is not installed in the workspace CI builds | `bun add -d playwright`, and commit the lockfile change |
| `FIXTURE_SETUP_FAILED` with `Executable doesn't exist at …/chromium-<revision>/…` | The cached browser directory is missing or was invalidated | Run the install step with `--with-deps`; check the cache key includes the lockfile |
| A launch failure that is not about a missing file | Shared libraries are absent on the runner | `--with-deps`, or a Playwright container image |
| Tests pass on a developer Mac and fail on the Linux runner | Font metrics, missing fonts, or a locale difference | Avoid pixel assertions; assert on text, attributes, and roles |
| The browser lane takes longer than the rest of CI | Cold cache, or a real browser used for DOM-only assertions | Cache `~/.cache/ms-playwright`; move DOM-only tests to the default backend |

## Related

- [DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/): the decision table and the fixture API.
- [Choose your test environment](/bun-test-utils/start/environment/): the short version, including what each backend costs.
- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): browser testing is experimental, and this is what that means.
