# Next session: issue templates, Code of Conduct, and a root CONTRIBUTING

Handoff from the 2026-10-11 session. Paste this as the opening prompt of the next session.

---

You are continuing work on `Archont561/bun-test-utils`. Work on the session branch Arena gives you. Never switch to, create, or push to another branch. Do every change through a PR from that branch. Do not merge unless the user asks.

## Context

The docs site was restructured and its samples are now verified (PR #62, merged as `4cb353a`; audit record `.backlog/docs/audits/2026-10-11-docs-site-refactor.md`). That work filed `task_102` as a deferred item and left the repository with no community health files at all: there is no `.github/ISSUE_TEMPLATE/`, no `CODE_OF_CONDUCT.md`, and no root `CONTRIBUTING.md`. GitHub's community profile therefore shows an incomplete checklist, and every report — bug, feature, docs — arrives as an undifferentiated issue.

This session creates those files.

## Deliverables

| # | File | What it must contain |
|---|---|---|
| 1 | `.github/ISSUE_TEMPLATE/bug_report.yml` | YAML issue form: what happened vs what was expected, a minimal reproduction, Bun version, package version, OS, which capability area (dropdown), the `BUN_TEST_UTILS_DEBUG=1` output when relevant. |
| 2 | `.github/ISSUE_TEMPLATE/feature_request.yml` | YAML issue form: the problem, the proposed shape, the alternative considered, and whether it changes a stable surface. |
| 3 | `.github/ISSUE_TEMPLATE/docs_report.yml` | YAML issue form for `task_102`: required page URL, required "what is wrong or missing". |
| 4 | `.github/ISSUE_TEMPLATE/config.yml` | `blank_issues_enabled` plus `contact_links` (docs site; security route only if one exists). |
| 5 | `CODE_OF_CONDUCT.md` | Contributor Covenant **2.1**, verbatim, with `[INSERT CONTACT METHOD]` replaced. |
| 6 | `CONTRIBUTING.md` | The GitHub-recognized entry point: how to report, how to propose a change, how to run the gates, and where the working agreements live. |

Deliverables 5 and 6 are the plural in the user's ask ("issue templates and contributor code of conduct"): write the Code of Conduct **and** the contributor guide. A `PULL_REQUEST_TEMPLATE.md` is *not* in scope — offer it at the end, do not add it unasked.

## Ask the user before you write, not after

1. **The Code of Conduct enforcement contact.** Contributor Covenant 2.1 requires a real contact method and the placeholder must not ship. The address the maintainer already publishes on npm is `esrebrny@tuta.io` (`npm view @archont561/bun-test-utils maintainers`). Confirm that this is the address to publish in the repository, or take the one the user gives you. If the user wants a non-email route, the wording changes — do not guess.
2. **`blank_issues_enabled`.** Default to `false` (templates only) and say so; the user may prefer `true` so a blank issue is always possible.

Do not create GitHub labels before asking: prefer labels that already exist (`gh label list --limit 100`) and fall back to labels the repository already uses in `.backlog/tasks.yaml` (`bug`, `docs`, `feature`, `ci`, `testing`, …). In an issue form, a label that does not exist is not applied and GitHub warns about it when the form is opened.

## Facts verified on 2026-10-11

These came from inspecting the tree. Re-check the ones you depend on.

- **The files are genuinely missing.** `.github/` contains `workflows/` only; `find . -iname "*code_of_conduct*" -o -iname "*contribut*"` matches only `apps/docs/src/content/docs/project/contributing.md`.
- **The canonical Code of Conduct text is reachable with the page-fetch tool**, even though bash networking is restricted to npm and PyPI. Fetch `https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md` for the raw markdown (the HTML page is `https://www.contributor-covenant.org/version/2/1/code_of_conduct/`). Copy it unmodified; the Attribution section already carries the version and links.
- **Biome ignores YAML.** Adding `.github/ISSUE_TEMPLATE/*.yml` leaves `bun run lint` green and untouched (verified by probe: `biome check .` stayed at "Checked 197 files"; `biome format` on the YAML processed 0 files). Do not add Biome configuration for it. The pre-commit hook glob is `*.{js,ts,cjs,mjs,json,jsonc}`, so the hooks do not touch these files either.
- **CI path filters.** `ci.yml` has `paths-ignore` for `**.md`, so `CODE_OF_CONDUCT.md` and `CONTRIBUTING.md` alone do not trigger CI, while `.github/ISSUE_TEMPLATE/*.yml` does. `docs.yml` runs when `apps/docs/**` or `packages/**` change, so editing the docs page (below) does trigger it. `relock.yml` runs a `lock guard` job on every pull request, no paths filter.
- **The docs site already documents contribution**, at `apps/docs/src/content/docs/project/contributing.md`: "Report a problem in these docs" (with a hardcoded `issues/new?...` link), the writing rules, the local commands, and the changeset flow. The homepage `apps/docs/src/content/docs/index.mdx` ends with another hardcoded `issues/new?...` link. Both should point at the new docs form, and `README.md` has a **Contributing** section (line ~122) that should link to `CONTRIBUTING.md` and the Code of Conduct.
- **The docs check constrains the footer.** `apps/docs/tests/first-test-snippet.test.ts` asserts that `src/components/Footer.astro` contains `packages/bun-test-utils/package.json` and `project/releases/`. Changing the footer's issue URL is fine as long as those two hold; run `bun run docs:test` after the edit.
- **The footer's current link is `issues/new?title=…&body=…`.** `task_102` wants `issues/new?template=docs.yml`. GitHub prefills `title` for a YAML form but ignores `body` (the form owns the body), so drop the body parameter when you switch — and keep the page title in the prefill. Confirm the final URL by opening it once in a browser; a malformed form fails only when rendered, not when committed.
- **`task_102` exists and is `ready`** (P3, labels `docs`, `process`) with its three acceptance criteria. `task_105` and `task_106` do not exist yet — create them (below).

## Backlog

The repository is backlog-driven; follow `.backlog/docs/workflow.md`.

- Implement `task_102` (docs issue form) and move it `in_progress` → `done`.
- Create `task_105` — "Add a Code of Conduct (Contributor Covenant 2.1)" and `task_106` — "Add a root CONTRIBUTING.md" with `bunx backlog task add --title … --priority P3 --label process --label docs --repository bun-test-utils --acceptance …`, then move them as they land. The counter is at `task_104`, so ids start at `task_105`.
- Claims are enforced on commit, and the claims directory is missing in a fresh sandbox: `mkdir -p .backlog/claims/active .backlog/claims/archive`, then `bunx backlog claim start --topic "community health files" --path ".github/**" --path "CODE_OF_CONDUCT.md" --path "CONTRIBUTING.md" --path "README.md" --path "apps/docs/**" --path ".backlog/**"`.
- No ADR is needed: no contract or public API changes. No changeset either — nothing a package consumer sees changes.

## Shape of the files

`CODE_OF_CONDUCT.md`: the verbatim 2.1 text, with the enforcement address filled in and a short note above or below the attribution saying how a report is handled in this repository (a maintainer reads it; the reporter's identity stays private). Keep it plain markdown — GitHub renders it and links it from the community profile.

`CONTRIBUTING.md`: short, and a router rather than a second copy of `README.md`. Suggested sections:

1. **What this project is** — two sentences; link the docs site.
2. **Reporting** — one pointer per intent: bug, feature, docs (the three forms), and a sentence that security-sensitive reports should not be filed publicly.
3. **Proposing a change** — branch from `main`, keep it scoped, conventional commit messages, ADR first for a design change, changeset when a user-visible surface moves.
4. **Running the gates** — the exact commands from `README.md`'s Development section (`bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun run test:all`, `bun run docs:build`, `bun run docs:test`) and the note that `bun run docs:test` needs a built package, which turbo handles.
5. **Where the rules live** — `.backlog/docs/workflow.md` (working agreements), `apps/docs/README.md` (docs writing contract), `.backlog/docs/adr/` (decisions).
6. **Code of Conduct** — link `CODE_OF_CONDUCT.md` and say that participation implies following it.

Issue forms: `name`, `description`, `body` are required at the top level; each body entry needs `type`, and `attributes.label` for the interactive types. Minimal shape to copy:

```yaml
name: Bug report
description: Something in the package does not behave as documented
title: "bug: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for the report. A minimal reproduction gets a fix much faster.
  - type: textarea
    id: what-happened
    attributes:
      label: What happened
      description: What you ran, what it printed, and what you expected instead.
      placeholder: |
        bun test → error: ...
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Package version
      description: From the page footer, or `npm view @archont561/bun-test-utils version`.
    validations:
      required: true
  - type: dropdown
    id: area
    attributes:
      label: Capability
      options:
        - Fixtures and scopes
        - Standard fixtures
        - DOM or browser
        - HTTP mocking or test servers
        - Cassettes
        - Snapshots
        - Property-based tests or scenarios
        - CLI
        - Not sure
    validations:
      required: true
  - type: checkboxes
    id: checks
    attributes:
      label: Before filing
      options:
        - label: I searched the open and closed issues
          required: true
        - label: I read the troubleshooting page
          required: true
```

`config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: https://archont561.github.io/bun-test-utils/
    about: Guides, recipes, the capability index, and the API reference
```

Add a security `contact_links` entry only if the user enables a route for it (GitHub private vulnerability reporting, or an address they are willing to publish). There is no `SECURITY.md` in this repository; do not add one unless asked, and do not point at a URL that does not exist.

## Existing issue links to repoint

`grep -rn "issues/new"` (excluding `.backlog/`) finds exactly six, and they split by intent:

| File | Current link | Should become |
|---|---|---|
| `apps/docs/src/components/Footer.astro:14` | `issues/new?title=…&body=…` | `issues/new?template=docs.yml&title=…` — drop the body parameter (an issue form owns the body) and keep `project/releases/` in the file, which the docs check asserts |
| `apps/docs/src/content/docs/project/contributing.md:22` | same, hardcoded | the docs form |
| `apps/docs/src/content/docs/index.mdx:147` | same, hardcoded | the docs form |
| `apps/docs/src/content/docs/overview/compatibility.md:95` | bare `issues/new` | the bug-report form |
| `apps/docs/src/content/docs/capabilities/dom-and-browser.md:93` | bare `issues/new` | the bug-report form |
| `apps/docs/src/content/docs/recipes/troubleshooting.md:90` | bare `issues/new` | the bug-report form |

Also update `README.md` (its **Contributing** section should link `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`) and add a short paragraph to `apps/docs/src/content/docs/project/contributing.md` about the Code of Conduct. None of these six URLs is covered by the docs check — it resolves internal `/bun-test-utils/` links only — so verify the docs form link once by opening it.

After any docs edit: `bun run docs:test` must stay green (21 checks), and `bun run docs:build` must stay clean.

## Rules that stay in force

- An ADR is accepted before any implementation of a design change; this session needs none, and you must not edit existing ADRs.
- Public API changes are out of scope. If you touch anything under `packages/*/src`, the README, the matching spec, and `scripts/public-api.txt` have to move in the same PR.
- Do not touch `.github/workflows/*`.
- Do not rewrite history: ADRs 0001, 0002, 0006, 0008, 0011, spec 0002 line 47, `caveats.md`, milestone M2.
- No tags, releases, npm publishes, or `auto-release` dispatches. `task_090` stays `in_progress`; `task_066` and `task_005` stay open until v0.1.0 is on npm.
- `scripts/audit-check.ts` fails a PR that adds a `TODO`/`FIXME`, and `bun run audit:api` is an update command — check `git diff -- scripts/public-api.txt` after running it.
- Merges to `main` run `publish-sandbox.yml`. That is routine and runs on every merge.

## Sandbox quirks verified this session

- `/tmp` is wiped between sessions. Reinstall Bun with `mkdir -p /tmp/bunsetup && cd /tmp/bunsetup && npm install bun@1.4.2`, then `export PATH="/tmp/bunsetup/node_modules/.bin:$PATH"`. The alternative `npm i -g --prefix /home/user/.tools bun@1.4.2` works too.
- `bun install --frozen-lockfile` runs `lefthook install`, so the hooks are live as soon as you install.
- The `actionlint` pre-commit hook needs `.pixi/envs/default/bin/actionlint`, which does not exist in this sandbox: a commit then fails on a file type this session never touches. Commit with `LEFTHOOK=0 git commit` and run `bunx biome check .` plus `bunx turbo run typecheck` yourself.
- The pre-push hook runs the whole turbo suite, which needs Playwright browsers and the pixi libraries that are absent here. Push with `LEFTHOOK=0 git push` and let CI be the suite gate; say so in the PR.
- A build is required before any docs gate: `bun run build`, or let `bun run docs:test` do it through turbo (`docs#test` depends on `@archont561/bun-test-utils#build`).
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install --frozen-lockfile` keeps the install from trying to fetch browsers.

## Gates before opening a PR

```bash
bun run build
bun run lint
bun run typecheck
bun run docs:test     # 21 checks, executes the runnable docs samples
bun run docs:build
```

Add `bun test` if the sandbox can run it; otherwise state in the PR that the suite ran in CI.

## Done means

- The three issue forms and `config.yml` exist, are well-formed YAML, and carry only labels that exist in the repository.
- `CODE_OF_CONDUCT.md` is Contributor Covenant 2.1 verbatim with a real enforcement contact and no placeholder left anywhere.
- `CONTRIBUTING.md` exists, routes each kind of contribution, and links the working agreements, the docs contract, and the Code of Conduct.
- `README.md`, the docs site's contributing page, and the homepage use the new template links, and `bun run docs:test` is green.
- `task_102` is `done`; `task_105` and `task_106` exist and are `done`.
- All gates pass, and the PR is open from the session branch to `main`.
- Report the PR URL, the enforcement contact that went in, and anything deferred.

---

## Outcome

Implemented in the same 2026-10-11 session, from `arena/6f663a78-bun-test-utils`, in [PR #63](https://github.com/Archont561/bun-test-utils/pull/63).

What the maintainer decided when asked:

- **Enforcement contact: the private reporting form**, not an email address:
  `https://github.com/Archont561/bun-test-utils/security/advisories/new`.
- **`blank_issues_enabled: true`** — a blank issue stays possible.
- **No new labels.** The forms carry the labels the repository already has:
  `bug`, `enhancement`, `documentation`. The backlog-only vocabulary (`docs`,
  `feature`) is not used in the forms.
- **No security `contact_links` entry**, and no `SECURITY.md`.

Deviations and follow-ups:

- The docs form is `.github/ISSUE_TEMPLATE/docs.yml`, not `docs_report.yml` as the
  deliverable table above says. `task_102`'s acceptance criteria and both URL
  references in this handoff say `docs.yml`, and a form's URL has to match its
  file name, so the file name follows the acceptance criteria. The form's
  displayed name is still "Documentation report".
- **The private reporting form has to be enabled in the repository settings
  before the Code of Conduct's contact route works**, for anyone but an admin.
  The session token could not turn it on (403, `Resource not accessible by
  integration`), so this is a maintainer action:
  *Settings → Code security → Private vulnerability reporting → Enable*, or
  `gh api -X PUT repos/Archont561/bun-test-utils/private-vulnerability-reporting`.
- `apps/docs/README.md` gained a half-sentence naming the docs issue form beside
  `Footer.astro`, because that table describes what the footer links to.
- The forms were validated against the SchemaStore schemas for issue forms and
  issue configuration (`github-issue-forms.json`, `github-issue-config.json`),
  and every label they reference was checked against `gh label list`.
- A `PULL_REQUEST_TEMPLATE.md` was offered and deliberately not added.

