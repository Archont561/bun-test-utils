# Contributing to bun-test-utils

## What this project is

`bun-test-utils` is a general-purpose test extension for the
[Bun test runner](https://bun.sh/docs/test/overview): typed, Playwright-style
fixtures composed with `test.extend()`, plus capabilities built on the same
runner — snapshots, property-based testing, HTTP cassettes, DOM and browser
testing, and BDD scenarios. The guides, the capability index, and the API
reference are at <https://archont561.github.io/bun-test-utils/>.

## Reporting

Issues are the front door. Each intent has its own form, so a report arrives
already classified:

| Intent | Where |
| :-- | :-- |
| Something in the package does not behave as documented | [Bug report](https://github.com/Archont561/bun-test-utils/issues/new?template=bug_report.yml) |
| A capability, an API, or a behaviour you want added or changed | [Feature request](https://github.com/Archont561/bun-test-utils/issues/new?template=feature_request.yml) |
| A page in the docs that is wrong, missing, or unclear | [Documentation report](https://github.com/Archont561/bun-test-utils/issues/new?template=docs.yml) |

**Do not file a security report in a public issue.** A vulnerability, or
anything else that should not be public yet, goes to the repository's
[private reporting form](https://github.com/Archont561/bun-test-utils/security/advisories/new)
— the same private route the [Code of Conduct](CODE_OF_CONDUCT.md) names.

A design that is not yet a change is welcome on the issue that proposes it. How
a proposal turns into work, and what "done" means here, is in the working
agreements.

## Proposing a change

1. **Open an issue first for anything larger than a typo**, so the shape can be
   agreed before code is written.
2. **Branch from `main` and keep the pull request scoped** — one capability, one
   page, or one fix per pull request.
3. **Record a design change as an ADR before you implement it.** Decisions live
   in [`.backlog/docs/adr/`](.backlog/docs/adr/), one file each; an accepted ADR
   is immutable and is superseded by a later ADR rather than edited. A change to
   a public surface also has to agree with its spec in
   [`.backlog/docs/specs/`](.backlog/docs/specs/).
4. **Add a changeset when a user-visible surface moves** (`bun run changeset`),
   in the same pull request as the change itself.
5. **Write conventional commit messages** (`fix: …`, `feat: …`, `docs: …`);
   commitlint rejects anything else.

## Running the gates

| Command | What it checks |
| :-- | :-- |
| `bun install --frozen-lockfile` | You build against the lockfile CI installs |
| `bun run lint` | Biome formatting and lint rules |
| `bun run typecheck` | TypeScript across every workspace |
| `bun run test:all` | The unit, conformance, and end-to-end suites |
| `bun run docs:build` | The documentation site builds |
| `bun run docs:test` | The docs samples run, and the site's metadata and links resolve |

`bun run test:bdd` runs the behavioural (Gherkin) suites on their own and
`bun run docs:dev` serves the site locally. The browser suites need Playwright's
browsers (`bun run install-browsers`) and run headless.

`bun run docs:test` installs the built package into a scratch project and runs
the documentation's runnable samples against it, so it needs a build first.
Turbo builds the package for it, so the command above is enough on its own.

CI runs these commands and two more: `bun scripts/audit-check.ts` after a build,
which fails a pull request that adds a `TODO` or `FIXME` or that changes the
public API without updating `scripts/public-api.txt`, and `bun run coverage`.

## Where the rules live

| Document | What it governs |
| :-- | :-- |
| [`.backlog/docs/workflow.md`](.backlog/docs/workflow.md) | The working agreements: tasks, claims, and the definition of done |
| [`apps/docs/README.md`](apps/docs/README.md) | The docs writing contract: layout, sample labels, and the check |
| [`.backlog/docs/adr/`](.backlog/docs/adr/) | Accepted decisions, one file each |
| [`.backlog/docs/specs/`](.backlog/docs/specs/) | The specifications a public surface has to agree with |
| [`README.md`](README.md) | What the package is, and the public API |

## Code of Conduct

Participation in this project — issues, pull requests, reviews, and discussions
— means following the [Code of Conduct](CODE_OF_CONDUCT.md). Reports go through
the private route named there and are read by the maintainer.
