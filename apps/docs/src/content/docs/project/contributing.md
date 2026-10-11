---
title: Contributing and docs feedback
description: How to report a docs problem, where the writing rules live, and how a change to the package or the site is proposed and released.
status: stable
---

**Use this page** when something on this site is wrong, missing, or unclear, or
when you want to change it yourself.

## Report a problem in these docs

Every page has a **Report a docs issue** link in its footer, and an
**Edit page** link in the sidebar that opens the page's Markdown on GitHub. The
report link prefills the page URL, so an issue needs only a sentence about what
is wrong:

- the page and the exact sentence, table row, or sample you mean,
- what you expected instead,
- the Bun version and package version if a sample behaved differently
  (`bun --version`, and the version in the page footer).

[Open an issue](https://github.com/Archont561/bun-test-utils/issues/new?title=Docs%3A%20&body=Page%3A%20%0A%0AWhat%20is%20wrong%20or%20missing%3F%0A%0A)
with the `documentation` label if you cannot tell which page it belongs to.

## The writing rules

The site's contract is in
[`apps/docs/README.md`](https://github.com/Archont561/bun-test-utils/blob/main/apps/docs/README.md).
The short version:

- **Positioning.** The project is a general-purpose test extension for the Bun
  test runner, with a Playwright-style fixture model: typed fixtures composed
  explicitly with `test.extend()`, `session` / `file` / `test` scopes, and
  guaranteed LIFO teardown (ADR 0038).
- **Everything is a first-class capability.** BDD, property-based testing,
  snapshots, cassettes, and DOM and browser testing get the same care as the
  fixture model, and browser and BDD are labelled experimental wherever they
  appear.
- **Samples state what they are.** Every code block carries a
  `Runnable`, `Illustrative`, or `Partial` label. **Runnable** means a complete
  sample — for TypeScript, a whole file with a `title="<file>"`; for shell, only
  lines the check can perform. The check writes those files into a scratch
  project, runs them against the built package, and fails the pull request when
  one does not pass, so a runnable sample cannot rot silently. `text` blocks are
  program output and carry no label. The check lives at
  [`apps/docs/tests/first-test-snippet.test.ts`](https://github.com/Archont561/bun-test-utils/blob/main/apps/docs/tests/first-test-snippet.test.ts).
- **Samples must match the shipped API.** A sample has to agree with the
  package README, the published declarations, and the specifications in
  `.backlog/docs/specs`.
- **Freshness.** Maturity, prerequisites, and the version a page first
  described come from page frontmatter (`status`, `since`, `requires`,
  `platforms`) and render as the badge row at the top; the package version and
  the "last updated" date are rendered from the build, never typed into prose.

## Work on the site locally

```bash partial
bun install --frozen-lockfile
bun run docs:dev
```

`bun run docs:build` produces the static site in `apps/docs/dist`, and
`bun run docs:preview` serves that build. Both go through the `docs` workspace,
so `bun --filter docs build` is the shorter form.

The snippet check needs a built package, because it installs the workspace
package into a scratch project and runs `bun test` there:

```bash partial
bun run docs:test
```

It asserts two things: that the runnable samples on the first-test page and the
homepage actually pass, and that the site's own metadata holds together —
sidebar entries resolve to real pages, internal links and anchors resolve,
frontmatter uses known values, and the version in the homepage matches the
package manifest.

## Propose a change

1. **Open an issue first for anything larger than a typo**, so the shape can be
   agreed before the prose is written.
2. **Branch from `main` and keep the change scoped** to one page or one
   capability where possible.
3. **Match the page template**: outcome first, prerequisites, the minimum
   working example, then failure modes, then related links. New guide pages
   follow the structure of
   [Deterministic tests](/bun-test-utils/recipes/deterministic-tests/).
4. **Run the checks** that apply: `bun run lint`, `bun run typecheck`, and —
   for anything touching samples or frontmatter — `bun run docs:test`.
5. **Commit with a conventional message** (`docs: …`, `fix: …`, `feat: …`);
   commit messages are linted.
6. **Open a pull request** describing the page-level outcome, not the diff.

## Package changes and releases

A change that affects a published surface needs a changeset in the same pull
request:

```bash partial
bun run changeset
```

It writes a `.changeset/<name>.md` file aimed at a user of the package: what
changed, and what the reader should do about it. Pending changesets are consumed
when a version is cut. The release mechanics — the `v<version>` tag, the two
registries, and the tarball on the GitHub Release — are summarised in
[Release notes and upgrading](/bun-test-utils/project/releases/#how-a-release-is-cut).

Decisions that change a contract or a public surface are recorded as ADRs in
[`.backlog/docs/adr/`](https://github.com/Archont561/bun-test-utils/tree/main/.backlog/docs/adr),
one file per decision, immutable once accepted and superseded by a later ADR
rather than edited. The docs audit that produced the current structure of this
site is in
[`.backlog/docs/audits/`](https://github.com/Archont561/bun-test-utils/tree/main/.backlog/docs/audits).

## Related

- [Release notes and upgrading](/bun-test-utils/project/releases/): versions, compatibility, and the old-to-new reference map.
- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): which surfaces are contractual.
- [The fixture model](/bun-test-utils/fundamentals/fixture-model/): the model every guide is written against.
