# 0042 — Release versions are cut from pending changesets

- **Status:** accepted
- **Date:** 2026-10-11
- **Builds on:** [0029](./0029-release-to-npm-and-github-packages.md) (the release contract)

## Context

Changesets were configured (`.changeset/`, `changelog: false`) and the docs said a
release cuts a version bump from the changesets accumulated on `main`, but
`auto-release.yml` never ran `changeset version` (`bun run release:version`): it took
the version from a required `version` dispatch input and wrote it into
`packages/bun-test-utils/package.json` with `npm pkg set` (task_090). The two stories
disagreed — the released version was whatever string the dispatch carried, and
pending changesets were never consumed. The first release, `v0.1.0` (2026-10-11),
was cut through that input.

On 2026-10-11 the maintainer chose to wire the mechanism to the prose rather than
reconcile the prose to the mechanism.

## Decision

1. `auto-release.yml` derives the release version from the pending changesets. The
   cut step runs `bun run release:version` (`changeset version`), which bumps
   `packages/bun-test-utils/package.json` and deletes the consumed changeset files;
   the `chore(release): prepare v<version>` commit carries both. `changelog: false`
   stands: there is no `CHANGELOG.md`, and release history stays on GitHub Releases
   and the docs page.
2. The `version` dispatch input is removed. A dispatch with no pending changesets
   has nothing to cut, and the cut step refuses it before the release gates run.
3. The rest of the contract is unchanged (ADR 0029): the version read back from the
   manifest must be strict semver, the tag is `v<version>` on a commit on `main`,
   and `release.yml` verifies tag == manifest == ancestry before publishing to both
   registries.
4. An explicit cut with no changesets — recovering a deleted, never-published tag,
   or seeding a version by hand — stays out of band: a human tags a commit on `main`
   and pushes the tag, which triggers `release.yml` directly (only `GITHUB_TOKEN`
   pushes are recursion-suppressed).

## Consequences

**Good:** one source of version truth — the changesets on `main`. The bump level is
reviewed in the same pull request as the change it describes. The docs,
`.changeset/README.md`, and the workflow now tell the same story. Dispatching a
release carries no version string to mistype.

**Bad:**
- A release needs at least one pending changeset; a dispatch with none fails early.
- A wrong bump level must be fixed in the changeset before cutting — the tag will
  carry whatever the changesets say.
- Recovering a deleted, never-published tag needs a human tag push, not a dispatch.
- `bun run release:version` run by hand consumes the pending changesets early and
  must never land in a pull request.

## Alternatives considered

- **Keep the `version` input and consume changesets alongside it.** Rejected: two
  sources of version truth can disagree.
- **Keep the `version` input as an explicit override.** Rejected for the same drift;
  the recovery cases are covered by a human tag push (decision 4).
- **Reconcile the prose to the mechanism instead**, documenting the input as the
  version source. The maintainer decided otherwise on 2026-10-11.
- **`changeset publish`.** Rejected already in ADR 0029: publishing goes through
  `release.yml` from a tag, to two registries.
