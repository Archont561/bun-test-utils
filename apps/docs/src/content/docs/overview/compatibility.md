---
title: Stability, compatibility, and support
description: Which capabilities are stable, which are experimental, the Bun and platform support window, the optional peers, and how to get help.
status: stable
since: 0.1.0
---

This page is the compatibility contract for `bun-test-utils`. Everything here
applies to the current published release; the [release notes](/bun-test-utils/project/releases/)
record when each statement changed.

## Stability tiers

| Tier | Capabilities | What a release may change |
| :-- | :-- | :-- |
| **Stable** | The fixture engine (`test`, `test.extend`, scopes, teardown), standard fixtures, DOM fixtures, snapshot testing, property-based testing, and the minimal cassette contract | Nothing breaking outside a major version. Fixes and additions land in minor and patch releases. |
| **Experimental** | Browser testing (headless Chromium through Playwright) and BDD scenarios (`test.scenario`) | Anything, in any minor release. Patch releases stay for compatible fixes only. |

The stable cassette contract is deliberately narrow: the callable
`cassette(callback)`, `cassette.record(callback)`, `cassette.replay(callback)`,
fixture-local `cassette.addSerializer(serializer)`, `/vcr` global serializer
registration, and HTTP matching by the uppercase method plus the full URL.
`redactHeader(name)` ships and works, but it is outside the contract. Matcher
DSLs, configurable redaction, and cassette migration tooling are not part of
`0.1.x`.

The tier for each capability is repeated where it is used: the badge row at the
top of every capability page, the `Experimental` markers in the sidebar, and
the table in the [capability index](/bun-test-utils/capabilities/).

## Bun and platform support

| | Support |
| :-- | :-- |
| Bun | **1.1.0 or later**, the range in the package's `engines` field. The `0.1.0` release and these docs were verified against Bun 1.4.2. |
| Linux | Supported. |
| macOS | Supported. |
| Windows | **Not supported in `0.1.x`.** Some paths assume POSIX `URL.pathname` behaviour, and no Windows CI lane exists yet. Support is planned. |
| Other runtimes | Not supported. The package extends `bun test`; it is not a Node.js test runner. |

Browser testing adds one more platform boundary: the Playwright peer and the
Chromium build it downloads must be installed for the host platform by the
standard Playwright installer. Browser tests run **headless only**, and the
`browser` fixture **launches Chromium only**. See
[DOM and browser testing](/bun-test-utils/capabilities/dom-and-browser/).

## Optional peer dependencies

Every capability peer is optional. A project installs only what it uses, and a
capability that is missing its peer fails with a `MISSING_OPTIONAL_DEPENDENCY`
error naming the install command.

| Peer | Needed by | Declared range |
| :-- | :-- | :-- |
| `happy-dom` | DOM fixtures (`window`, `document`, `page`) and the default `webPage` backend | `>=20.0.0` |
| `playwright` | Browser fixtures, the browser `webPage` backend, `browserHttpMock` | `>=1.40.0` |
| `fast-check` | `test.prop` and `test.scenario.prop` | `>=4.0.0` |
| `@aboviq/bun-test-cucumber` | `test.scenario` (experimental) | `>=0.2.0` |

`@archont561/bun-test-utils` itself has three runtime dependencies — `citty`,
`smol-toml`, and `@clack/prompts` — for the `test-utils` command. They are
installed with the package and are not peers.

## Compatibility surfaces

Three things are contractual and checked in this repository's CI:

1. **The public API surface.** The root package exports exactly `describe`,
   `expect`, and `test`; the helper subpaths `/pbt`, `/bdd`, `/snap`, and
   `/vcr` export typed definitions and serializer contracts, never a runner or
   a fixture. `scripts/public-api.txt` is a generated baseline, and a
   conformance test fails when it changes without being regenerated.
2. **Machine-readable errors.** Thrown capability errors expose `code` and
   `details`. Prefer those in integrations; they are the stable integration
   surface. The code list is in the
   [CLI, environment variables, and errors reference](/bun-test-utils/reference/cli/#error-codes).
3. **Four human-readable message templates.** Only these four messages are
   contractual, placeholders aside; every other diagnostic may be reworded
   between releases without notice. They are listed verbatim in the
   [same reference](/bun-test-utils/reference/cli/#error-message-compatibility).

## Documentation versioning

These docs describe the **latest published release** and are deployed from
`main`. There is one documented version and no version switcher, because a
switcher for a single version is a control that does nothing. The footer of
every page names the release the page documents, and the
[release notes](/bun-test-utils/project/releases/) list what changed. When a
second maintained docs version exists, this policy changes with it.

## Getting support

| Need | Where |
| :-- | :-- |
| A bug in the package, or behaviour that contradicts these docs | [Open an issue](https://github.com/Archont561/bun-test-utils/issues/new) |
| A mistake or gap in a documentation page | **Report a docs issue** in the page footer — it opens an issue with the page URL already filled in |
| A correction you can write yourself | **Edit this page** in the page footer beside the last-updated date |
| Release history and breaking changes | [Release notes](/bun-test-utils/project/releases/) and the [GitHub releases](https://github.com/Archont561/bun-test-utils/releases) |

Response times are best-effort. There is no commercial support tier, and no
security-only disclosure channel yet; report security-sensitive issues through
the issue tracker and say so in the title.

## Related

- [Capability index](/bun-test-utils/capabilities/): what ships, its tier, and its prerequisites.
- [CLI, environment variables, and errors](/bun-test-utils/reference/cli/): the exhaustive reference.
- [Release notes and upgrading](/bun-test-utils/project/releases/): what changed in each release.
