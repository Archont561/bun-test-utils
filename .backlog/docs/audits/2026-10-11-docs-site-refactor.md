# Docs site audit — 2026-10-11

## Scope

Reviewed `apps/docs` as a published documentation product: the landing page, the
quickstart, the nine capability guides, the three reference pages, the sidebar in
`astro.config.mjs`, the freshness and feedback affordances, and the absence of any
mechanism that keeps samples honest. Benchmarked against Playwright's documentation
for information architecture and sample labelling, not for scale. Sources of truth
for the writing rules were `apps/docs/README.md`, the public API in
`packages/*/src` and `packages/bun-test-utils/dist/*.d.ts`, and the specs under
`.backlog/docs/specs`.

## Ranked findings

1. **High — the quickstart was not runnable.** `quickstart.mdx` called
   `startTestServer()` and `server.insertUser()`, neither of which exists, and showed
   no expected output. A reader following it hit two undefined identifiers before
   their first green run. **Resolution:** replaced by
   [Install and first passing test](../../../apps/docs/src/content/docs/start/first-test.md),
   which uses only the package and Bun, shows every file in full, and prints the real
   output of the run.
2. **High — no sample was verified.** Nothing connected a code block to the shipped
   package, so the first finding was invisible to both CI and review. **Resolution:**
   `SampleLabel` kinds (`runnable`, `illustrative`, `partial`) in
   `src/remark/sample-labels.mjs`, plus `apps/docs/tests/first-test-snippet.test.ts`,
   which extracts every `runnable` sample, runs it in a scratch project against the
   built package, and fails the pull request when it does not pass.
3. **High — no failure-oriented page existed.** Error messages, CI setup, and
   symptom-level debugging were spread across guide prose. **Resolution:**
   [Troubleshooting](../../../apps/docs/src/content/docs/recipes/troubleshooting.md)
   (symptom → cause → fix),
   [Debugging fixture failures](../../../apps/docs/src/content/docs/recipes/debugging-fixture-failures.md)
   (the four contractual messages and the error codes), and
   [Browser tests in CI](../../../apps/docs/src/content/docs/recipes/browser-tests-in-ci.md).
4. **High — the core story was told three times.** `index.mdx`, `quickstart.mdx`, and
   `guides/getting-started.md` each introduced fixtures and scopes differently, so no
   version was authoritative. **Resolution:** the homepage decides and links, the
   tutorial installs and runs, and
   [The fixture model](../../../apps/docs/src/content/docs/fundamentals/fixture-model.md)
   owns the model.
5. **Medium — the navigation mixed two taxonomies.** The sidebar walked a
   sequential path (Quickstart, Getting started) next to capability guides and a
   monolithic API page, so a reader who wanted one capability had to scan everything.
   **Resolution:** the six-group sidebar — Start here, Fundamentals, Capabilities,
   Recipes, Reference, Project — with each group answering one question.
6. **Medium — status and prerequisites were prose.** Stability tiers and peer
   requirements appeared inside paragraphs, never in the navigation or at the top of a
   page. **Resolution:** page frontmatter (`status`, `since`, `requires`, `platforms`)
   rendered as a text badge row, `Experimental` badges in the sidebar, a maturity
   column in the [capability index](../../../apps/docs/src/content/docs/capabilities/index.md),
   and [Stability, compatibility, and support](../../../apps/docs/src/content/docs/overview/compatibility.md)
   as the single contract page.
7. **Medium — `/reference/api/` was 298 lines of mixed audiences.** The runner, the
   built-in fixtures, the capability APIs, the CLI, the environment, and the error
   codes shared one page and one anchor namespace.
   **Resolution:** five focused reference pages, `/reference/api/` redirects to
   `/reference/core/`, every legacy anchor is still live, and
   [Release notes](../../../apps/docs/src/content/docs/project/releases.md) maps each
   old section to its new page.
8. **Medium — no visible version, date, edit path, or feedback path.** A reader could
   not tell which release a page described or where to correct it. **Resolution:**
   `editLink`, `lastUpdated`, and a footer line rendering the package version from
   `packages/bun-test-utils/package.json` with **Release notes** and **Report a docs
   issue** links.
9. **Low — the reference tables were cramped** in the default 45rem column, and the
   homepage grid did not force a decision between the fixture model and the add-on
   capabilities. **Resolution:** `src/components/Head.astro` widens `reference/*` and
   the capability index to 72rem from 90rem up; the homepage splits *core* from
   *add-on* capabilities and leads with four outcome-shaped links.

## What landed

- `apps/docs/astro.config.mjs`: six-group sidebar, redirects for every pre-restructure
  URL, `editLink`, `lastUpdated`, the two remark plugins.
- 12 pages moved with `git mv` (nine `/guides/*`, `quickstart.mdx`, the API split);
  eight new pages (`overview/compatibility`, `start/*`, three capabilities, the
  capability index, five recipes, `project/*`).
- `src/content.config.ts`, `src/remark/status-badges.mjs`,
  `src/remark/sample-labels.mjs`, `src/components/Head.astro`,
  `src/components/Footer.astro`, and the badge and label styles in `src/styles/custom.css`.
- `apps/docs/tests/first-test-snippet.test.ts`: 21 checks, including eight pages of
  runnable samples executed against the built package, sample-kind labelling on
  every non-output fence, sidebar and anchor integrity, frontmatter validity, and a
  guard that the homepage version is read from the manifest rather than typed.
- `turbo.json` task `docs#test`, root script `docs:test`, and a `docs.yml` workflow
  that runs the check on pull requests before deploying from `main`.

## Deferred work

- **Browser-lane samples are not executed.** `capabilities/dom-and-browser.md` keeps
  its Chromium samples labelled `illustrative`, because the docs workflow installs no
  browsers. Promoting them needs a Playwright browser cache in `docs.yml` and a
  documented runtime budget.
- **Snapshot and cassette samples are not executed.** The guide and capability pages
  in those areas use `partial` fences for workflow commands (`cache clear`,
  `SNAPSHOT_MODE=update`) and inline `partial` TypeScript. A second scratch project
  that writes fixtures, runs `SNAPSHOT_MODE=update`, and asserts the reviewed diff
  would cover them.
- **`lastUpdated` is empty for pages created or moved in this change** until they
  have their own commit: Starlight reads the date from the file's git history, and a
  staged rename has none yet. It resolves with the next commit touching each page.
- **No issue template for documentation reports.** The footer prefills a plain
  `issues/new` URL. A `documentation` issue form would classify reports without a
  maintainer relabelling them.
- **Anchor redirects remain a manual table.** A static host cannot redirect a
  fragment; `project/releases.md` is the mapping. A generated map would remove the
  hand-maintenance if the reference pages split again.

## Verification

`bun run docs:test` — 21 pass, 0 fail: eight pages of runnable samples executed
against `packages/bun-test-utils/dist`, including the end-to-end
`bunx test-utils init --yes` → `bun test` flow with its documented output compared
line by line. `bun run docs:build` — 30 pages, no warnings beyond the pre-existing
`/404` route conflict, redirects present for `/quickstart/`, the nine `/guides/*`
paths, `/reference/api/`, and `/reference/plugins/`, and the badge, label, and
wide-layout markers verified in the emitted HTML.
