# docs (apps/docs)

The documentation site for `bun-test-utils`, built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/). It is published to GitHub Pages at <https://archont561.github.io/bun-test-utils/>.

## Layout

| Path | Contents |
| :-- | :-- |
| `src/content/docs/index.mdx` | Landing page: what the package is, the capability split, and the quick start. |
| `src/content/docs/overview/` | Positioning and the stability / compatibility contract. |
| `src/content/docs/start/` | Install, first passing test, and how to choose a test environment. |
| `src/content/docs/fundamentals/` | The fixture model, scopes and teardown, composition. |
| `src/content/docs/capabilities/` | One guided page per capability, plus the capability index. |
| `src/content/docs/recipes/` | Task-oriented pages: database, servers, determinism, CI, troubleshooting. |
| `src/content/docs/reference/` | The dense API pages: core, built-in fixtures, property/scenario/snapshot, HTTP/cassette/browser, CLI and errors. |
| `src/content/docs/project/` | Release notes (including the old-to-new reference map) and contributing. |
| `src/components/` | `Head.astro` (wide reference layout), `Footer.astro` (version, release notes, report-an-issue link into the docs issue form). |
| `src/remark/` | `status-badges.mjs` (frontmatter → badge row), `sample-labels.mjs` (fence meta → sample label). |
| `src/content.config.ts` | Starlight's schema plus `status`, `since`, `requires`, `platforms`. |
| `tests/` | `first-test-snippet.test.ts`: the snippet and metadata check described below. |
| `astro.config.mjs` | Site metadata, redirects from the pre-restructure URLs, remark plugins, and the sidebar. |

## Writing rules

- **Positioning.** The project is a general-purpose test extension for the Bun test runner. Describe its fixture model as Playwright-style: typed fixtures composed explicitly with `test.extend()`, with `session`, `file`, and `test` scopes and guaranteed LIFO teardown.
- **Capabilities.** Describe BDD scenarios, property-based testing, snapshot testing, HTTP record/replay cassettes, and DOM and browser testing as first-class capabilities, with the same care as the fixture model.
- **Composition.** State composition positively: a fixture is available to a test through the imported `test.extend()` chain. Do not put disclaimers about file-name conventions on individual pages, and do not define the project by another runner's conventions. The decision is recorded in [ADR 0038](../../.backlog/docs/adr/0038-general-purpose-positioning-playwright-style-fixtures.md).
- **Accuracy.** Every code sample must match the current public API. The reference pages and the capability guides must agree with the package README, the published `.d.ts` declarations, and the specs in [`.backlog/docs/specs`](../../.backlog/docs/specs).
- **Stability labels.** Mark experimental capabilities (browser, BDD scenarios) as experimental where they appear.

### Every sample carries a kind

Fence meta decides the label a reader sees, and the label is a promise:

| Meta | Label | Means |
| :-- | :-- | :-- |
| `runnable` | **Runnable** — the docs check runs it | A complete sample. TypeScript blocks need `title="<file>"`; the check writes them into a scratch project, performs every shell line, and requires a passing `bun test`. |
| `illustrative` | **Illustrative** — complete, not executed | The sample is complete but the check cannot run it: it needs a browser, a service, or application helpers the sample does not define. |
| `partial` | **Partial** — surrounding lines omitted | One step of a longer file or workflow. |

A shell line in a `runnable` fence must match a handler in `SHELL_HANDLERS` (`apps/docs/tests/first-test-snippet.test.ts`). Adding a command to a page therefore fails the check until the check can perform it — which is the point. Commands that only make sense inside a reader's project (cache-clear steps, `git diff`) belong in `partial` fences.

The check enforces that every fence with a language carries a kind. The one exemption is `text`: a `text` fence is program output, an error message, or a directory listing — something the reader reads rather than pastes.

### Frontmatter carries maturity and prerequisites

```yaml
---
title: Recording HTTP cassettes
description: One sentence, used for search results and social cards.
status: stable # or experimental; renders the first badge
since: 0.1.0 # the package version the page first described
requires: [playwright] # optional peers, by package name
platforms: Linux and macOS # only when a page narrows the support window
---
```

`status-badges.mjs` renders these as a text badge row: the words carry the meaning, colour is secondary, and the row is readable without CSS. `status` defaults to `stable`, but a page under `capabilities/` must state it explicitly — the snippet check enforces that.

### Page shape

A guide or recipe page states, in order: the outcome ("use this when…"), prerequisites and maturity, the minimum working example, the failure modes (a symptom → cause → fix table where useful), and related links. `src/content/docs/recipes/deterministic-tests.md` is the model.

### Links and anchors

Use absolute in-site links (`/bun-test-utils/<slug>/`, with `#anchor` where it helps). The snippet check resolves every internal link and anchor against the real pages, so a renamed heading fails the check instead of producing a 404. Anchors that older releases published are listed in `src/content/docs/project/releases.md` and are checked too; move a mapping when you move a section.

## Commands

```bash
bun run docs:dev      # local development server
bun run docs:build    # static build into apps/docs/dist
bun run docs:preview  # preview the production build
bun run docs:test     # snippet + metadata check (builds the package first)
```

`bun run docs:test` runs `turbo run test --filter=docs`, which builds `@archont561/bun-test-utils` first because the runnable samples import the built package rather than the workspace sources. Running `bun test` directly in this directory works too, as long as `bun run build` has run.

## Deployment

`.github/workflows/docs.yml` runs the snippet check and the build on pushes to `main` and on pull requests that touch `apps/docs/**`, `.backlog/docs/**`, `packages/**`, `package.json`, `turbo.json`, `bun.lock`, or the workflow itself. It deploys to GitHub Pages only from `main`.

The check therefore runs before a page is published, and its build step fails the pull request when a sidebar entry, an internal link, a frontmatter value, or a runnable sample no longer holds.
