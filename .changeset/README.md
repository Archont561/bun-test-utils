# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Each `.md` file here is one pending, unreleased change. They accumulate on `main`
and are consumed — and deleted — when versions are cut.

## Day to day

```bash
bun run changeset          # describe a change; writes .changeset/<name>.md — commit it
bun run release:version    # consume the pending changesets now; auto-release runs this when a release is cut
```

Publishing does not go through `changeset publish` (`bun run release:publish`); do not run it. A
release is a `v<version>` tag on a commit on `main`. `release.yml` verifies the tag, publishes the
package to npm (Trusted Publishing, environment `npm`) and to GitHub Packages, and then attaches the
tarball to the GitHub Release. See [ADR 0029](../.backlog/docs/adr/0029-release-to-npm-and-github-packages.md).

You add a changeset in the **same pull request** as the change it describes. The
file is prose aimed at a user of the package, not a restatement of the commit
message — those two audiences want different things.

A change needs a changeset when it alters what a consumer sees: public API,
behaviour, types, dependencies, docs that ship in the tarball. Internal
refactors, CI tweaks, and `.backlog/` edits do not.

## How this repo is configured

As of the `bun-test-utils` rebrand and single-package consolidation (see the ADR
superseding ADR 0011, `task_018`/`task_020`), exactly **one** package ever publishes:
`@archont561/bun-test-utils`. The six capability packages it bundles (`std`, `pbt`, `dom`, `browser`,
`vcr`, `snapshot`) are internal, unpublished (`private: true`) workspace packages nested
inside it — changesets ignores them automatically, the same way it already ignored
`@bun-test-utils/config` and `docs`.

| Setting | Value | Why |
|---------|-------|-----|
| `access` | `public` | `@archont561/bun-test-utils` publishes to the public npm registry |
| `baseBranch` | `main` | changed-package detection diffs against `main` |
| `privatePackages` | not versioned or tagged | every `private: true` workspace package (`@bun-test-utils/config` and the six bundled internal packages) is skipped |
| `updateInternalDependencies` | `patch` | kept for workspace hygiene; with a single published package this mostly has nothing to do |
| `fixed` / `linked` | empty | only one package versions, so there is nothing left to fix or link |
| `commit` | `false` | lefthook runs commitlint, so commits stay hand-written and conventional |

## First release and beyond

`v0.1.0` was cut on 2026-10-11 from the version already in the manifest, before the
changeset-driven cut landed (ADR 0042). From now on `auto-release.yml` derives the
release version from the pending changesets on `main` and consumes them as it cuts;
a dispatch with no pending changesets has nothing to cut and stops. Accumulate a
changeset in every pull request that changes what a consumer sees, and the next
release cuts itself from them.
