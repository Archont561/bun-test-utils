---
title: Release notes and upgrading
description: The version these docs describe, what 0.1.0 contains, how a release is cut, and where every section of the old API reference moved.
status: stable
since: 0.1.0
---

**Use this page** when you need to know which package version the docs
describe, what changed between versions, or where a section of the old
single-page API reference went.

## Current version

These docs describe **v0.1.0**, the version in
`packages/bun-test-utils/package.json`. `0.1.0` is the first supported release of
`@archont561/bun-test-utils`: it was tagged `v0.1.0` and published to npm and to
GitHub Packages on 2026-10-11, with the packed tarball attached to the
[GitHub Release](https://github.com/Archont561/bun-test-utils/releases/tag/v0.1.0).
The `0.0.0` versions published earlier were name-reservation placeholders. The
published version is "whatever the page footer says" — it is rendered from the package
manifest at build time, not typed into a page.

Everything on this site is written against that version. A page whose surface
landed later carries a `Since vX.Y.Z` badge at the top, and a capability whose
contract is not yet frozen carries `Experimental` — see
[Stability, compatibility, and support](/bun-test-utils/overview/compatibility/).

## 0.1.0 — the first supported release

What the first release contains:

| Area | What 0.1.0 ships | Tier |
| :-- | :-- | :-- |
| Fixture engine | `test()`, `test.extend()`, `session` / `file` / `test` scopes, LIFO teardown, dependency injection, overrides | Stable |
| Standard fixtures | `tmpdir`, `env`, `stdio`, `clock`, `seed`, `networkGuard` | Stable |
| DOM | `window`, `document`, `page` on `happy-dom` | Stable |
| Browser | `browser`, `browserContext`, `browserPage`, `webPage` on headless Chromium, `browserHttpMock` | Experimental |
| HTTP | `httpMock` handlers, `testServer`, `serverUrl` | Stable |
| Cassettes | Callback record/replay, HTTP recordings, reversible serializers | Stable |
| Snapshots | `snapshot()`, `match()`, `matchFile()`, serializers, modes | Stable |
| Property-based testing | `test.prop`, `defineArbitraries` on `fast-check` | Stable |
| BDD scenarios | `test.scenario`, `test.scenario.prop`, typed step helpers | Experimental |
| CLI | `test-utils init`, `test-utils cache clear` | Stable |

Platforms: Linux and macOS. Windows is not supported in 0.1.x. Bun `>=1.1.0`;
peer packages are `happy-dom >=20.0.0`, `fast-check >=4.0.0`,
`playwright >=1.40.0`, and `@aboviq/bun-test-cucumber >=0.2.0`, all optional.
The exact compatibility surfaces are in
[Stability, compatibility, and support](/bun-test-utils/overview/compatibility/).

## How a release is cut

1. Changes land on `main` with a changeset describing the user-visible effect and
   the bump level it needs.
2. `auto-release.yml` consumes the pending changesets (`bun run release:version`)
   to cut the version bump in a `chore(release): prepare v<version>` commit on
   `main`, then tags it. A run with no pending changesets has nothing to cut and
   stops before the release gates.
3. A `v<version>` tag on a commit that is already on `main` is the release. The
   tag's version must equal the version in the package manifest, or the release
   workflow refuses it.
4. The tag publishes to npm (Trusted Publishing, with provenance) and to GitHub
   Packages, then attaches the packed tarball to the GitHub Release.

The full decision record is
[ADR 0029](https://github.com/Archont561/bun-test-utils/blob/main/.backlog/docs/adr/0029-release-to-npm-and-github-packages.md).
There is no `CHANGELOG.md` in the repository: GitHub Releases and this page are
the release history. See
[Contributing and docs feedback](/bun-test-utils/project/contributing/) for the
changeset workflow.

## Upgrading

There is no earlier supported release, so there is no upgrade path yet. When
one is needed, it appears here with:

- the exact commands or dependency changes,
- the old behaviour, the new behaviour, and why,
- which error codes or messages changed, if any.

Stable surfaces follow semantic versioning: a breaking change to one of them
means a major version, and the compatibility contract behind what counts as
breaking is in
[ADR 0018](https://github.com/Archont561/bun-test-utils/blob/main/.backlog/docs/adr/0018-release-compatibility-contract.md).
Experimental surfaces may change in a minor release, and each of them is listed
in [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/#stability-tiers).

## Where the old API reference went

`/reference/api/` was one page. It is now five, and
[`/reference/api/`](/bun-test-utils/reference/core/) redirects to
[Core runner and fixture API](/bun-test-utils/reference/core/). A static host
cannot redirect an anchor, so old deep links ending in `#…` land on a page and
then need one more click. Every old anchor is still live under its new page:

| Old link | New page |
| :-- | :-- |
| `/reference/api/#imports` | [Core runner and fixture API](/bun-test-utils/reference/core/#imports) |
| `/reference/api/#stability-and-platforms` | [Core runner and fixture API](/bun-test-utils/reference/core/#stability-and-platforms) |
| `/reference/api/#testname-fn-options` | [Core runner and fixture API](/bun-test-utils/reference/core/#testname-fn-options) |
| `/reference/api/#the-iteration-protocol-iterate` | [Core runner and fixture API](/bun-test-utils/reference/core/#the-iteration-protocol-iterate) |
| `/reference/api/#testextendfixtures` | [Core runner and fixture API](/bun-test-utils/reference/core/#testextendfixtures) |
| `/reference/api/#testproptitle-arbitraryfactory-fn-options` | [Property, scenario, and snapshot API](/bun-test-utils/reference/snapshots-and-property/#testproptitle-arbitraryfactory-fn-options) |
| `/reference/api/#testscenariotitle-and-testscenarioproptitle-arbitraryfactory` | [Property, scenario, and snapshot API](/bun-test-utils/reference/snapshots-and-property/#testscenariotitle-and-testscenarioproptitle-arbitraryfactory) |
| `/reference/api/#webpage-one-fixture-two-backends` | [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/#webpage-one-fixture-two-backends) |
| `/reference/api/#httpmock-fetch-handlers` | [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/#httpmock-fetch-handlers) |
| `/reference/api/#cassette-callbacks-and-http-recordings` | [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/#cassette-callbacks-and-http-recordings) |
| `/reference/api/#vcr-global-callback-serializers` | [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/#vcr-global-callback-serializers) |
| `/reference/api/#snapshot-value-and-file-snapshots` | [Property, scenario, and snapshot API](/bun-test-utils/reference/snapshots-and-property/#snapshot-value-and-file-snapshots) |
| `/reference/api/#built-in-fixture-names` | [Built-in fixture API](/bun-test-utils/reference/fixtures/#built-in-fixture-names) |
| `/reference/api/#error-message-compatibility` | [CLI, environment variables, and errors](/bun-test-utils/reference/cli/#error-message-compatibility) |
| `/reference/api/#error-codes` | [CLI, environment variables, and errors](/bun-test-utils/reference/cli/#error-codes) |
| `/reference/api/#environment-variables` | [CLI, environment variables, and errors](/bun-test-utils/reference/cli/#environment-variables) |

The other moved pages redirect from their old URLs too:
`/quickstart/` → [Install and first passing test](/bun-test-utils/start/first-test/),
the `/guides/*` pages → their new homes under
[Fundamentals](/bun-test-utils/fundamentals/fixture-model/) and
[Capabilities](/bun-test-utils/capabilities/), and `/reference/plugins/` →
[Built-in fixture API](/bun-test-utils/reference/fixtures/).

## Related

- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): the tiers, the Bun range, and the peers.
- [Contributing and docs feedback](/bun-test-utils/project/contributing/): changesets, ADRs, and how to report a problem in these docs.
- [GitHub Releases](https://github.com/Archont561/bun-test-utils/releases): the published artifacts and the generated release notes.
