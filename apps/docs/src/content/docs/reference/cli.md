---
title: CLI, environment variables, and errors
description: The test-utils command, every BUN_TEST_UTILS_* variable, the contractual error messages, and the full error-code list.
status: stable
since: 0.1.0
---

**Use this when** you are wiring the package into a project or a pipeline
(`test-utils init`), choosing an environment variable, or handling a thrown
error. The command's flags are the stable interface: prompts appear only in an
interactive terminal without `CI` set, and in scripts the flags alone decide
what happens. `--yes` and `--dry-run` skip every prompt.

## `test-utils init`

Adds the package's preload to `bunfig.toml`, under `[test].preload`, leaving the
package's other settings untouched. The preload installs run-wide teardown hooks
and loads no fixtures by itself.

```bash partial
bunx test-utils init [options]
```

| Option | Behaviour |
| :-- | :-- |
| `--dir <path>` | The directory to work in. Defaults to the current directory. |
| `--entry <path>` | The preload entry to add. Defaults to the package's `dist/plugin.js` under `node_modules`. |
| `--force` | Accepted for backward compatibility. `init` never overwrites project files. |
| `--yes` | Writes `bunfig.toml` without asking. |

What it changes, and what it does not:

| | Detail |
| :-- | :-- |
| File written | `bunfig.toml` in `--dir` (created if absent) |
| Key written | `[test].preload`, with the package entry appended |
| Prompts | Only when a write is needed and the terminal is interactive, unless `--yes` |
| Non-interactive | Outside a terminal, or with `CI` set, it writes without prompting |
| Already configured | It reports that and changes nothing |
| Fixture files | Never created; compose your own `test.ts` with `test.extend()` |
| Other `bunfig.toml` content | Preserved (`--force` included) |

```text
created bunfig.toml → [test].preload += "./node_modules/@archont561/bun-test-utils/dist/plugin.js"
```

## `test-utils cache clear`

Deletes recorded cassettes, callback sidecars, and snapshots so the next run
records them again. It removes `<name>.json`, `<name>.callbacks.json`, and
`<name>.snap.json` files, and never a directory. Recordings are normally
committed, so `git checkout -- <path>` restores a file deleted by mistake.

```bash partial
bunx test-utils cache clear (--file <path> [--test "<name>"] | --all) [--dry-run] [--yes]
```

Choose exactly one scope:

- `--file <path>` clears every test in the file. The command finds test names by
  reading the file's literal test names; a name built at runtime needs `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the
  project root — the nearest `package.json` at or above the working directory,
  skipping `node_modules`. Without one, the command fails and asks you to run it
  from the project root.

| Option | Behaviour |
| :-- | :-- |
| `--dry-run` | Lists the files that would be removed and deletes nothing. Never prompts. |
| `--yes` | Deletes without asking. |

In an interactive terminal without `CI`, `--yes`, or `--dry-run`, the command
shows the matched files as a multi-select, all selected by default, and asks for
confirmation. Outside a terminal, or with `CI` set, the explicit scope is the
confirmation and the matched files are deleted directly. The output names the
scanned root; when nothing matches, it says how many files it scanned.

## Environment variables

| Variable | Behaviour |
| :-- | :-- |
| `BUN_TEST_UTILS_DEBUG` | Set to `1` to print opt-in engine diagnostics to stderr: session-teardown failures and cassette refresh warnings. It is not a general verbose log. |
| `BUN_TEST_UTILS_WEB_ENV` | Selects the `webPage` backend: `dom` (default), or `browser` / `playwright`. |
| `VCR_MODE` | Selects the cassette mode: `auto` (default), `record`, `replay`, or `passthrough`. |
| `SNAPSHOT_MODE` | Selects the snapshot mode: `match` (default), `update`, or `ci`. `ci` is selected automatically when `CI` is set. |
| `CI` | Makes `auto` cassettes refuse to record, and makes snapshots run in `ci` mode. Set by every mainstream CI provider. |

The preload does not read your project's files for fixtures: fixtures come only
from the runners you import.

## Error-message compatibility

Use the machine-readable `code` and `details` of a thrown error in
integrations. The four messages below are the only contractual human-readable
templates. Their placeholders vary, but the wording and punctuation around
them are stable:

```text
[bun-test-utils] unknown fixture "<NAME>" requested in <FILE>. Available in this explicit test.extend(...) chain: <AVAILABLE>. Compose the fixture with test.extend({ <NAME>: ... }) and import that extended test into this file.

[bun-test-utils] circular fixture dependency: <TRAIL> (<FILE>)

[bun-test-utils] fixture "<NAME>" finished without calling use(value)

[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).
```

Every other diagnostic may be reworded between releases without changing its
code or meaning. `<FILE>` is relative to the test file that raised the error,
and `<TRAIL>` is the cycle in build order.

## Error codes

| Code | Raised when |
| :-- | :-- |
| `UNKNOWN_FIXTURE` | A test requests a fixture that the imported chain does not provide. |
| `SCOPE_MISMATCH` | A fixture depends on a shorter-lived fixture. Raised when the test is declared. |
| `CIRCULAR_DEPENDENCY` | Fixtures depend on each other in a cycle. |
| `FIXTURE_SETUP_FAILED` | A built-in fixture could not start the resource it provides, such as a browser that would not launch. The original error is the `cause`. |
| `FIXTURE_USE_NOT_CALLED` | A fixture's `setup` finished without calling `use(value)`. |
| `FIXTURE_USE_CALLED_TWICE` | A fixture's `setup` called `use(value)` more than once. |
| `MISSING_OPTIONAL_DEPENDENCY` | A capability needs an optional peer that is not installed. The message names the install command. |
| `CASSETTE_NOT_FOUND` | Replay mode found no cassette for the test. |
| `CASSETTE_MISMATCH` | A request is missing from an existing cassette. The message names the command that clears it. |
| `CALLBACK_AMBIGUOUS` | One callback source text was recorded from more than one closure. |
| `CALLBACK_NOT_RECORDED` | A callback's source text has no recording. Re-record it. |
| `CALLBACK_NOT_SERIALIZABLE` | A callback returned a value that is not plain data and that no serializer handles. |
| `CALLBACK_SERIALIZER_NOT_FOUND` | A recording needs a serializer that is not registered. |
| `CALLBACK_SERIALIZER_FAILED` | A serializer threw. The original error is the `cause`. |
| `CALLBACK_STORE_INVALID` | A callback sidecar file is corrupt. |
| `INVALID_API_USAGE` | A capability or command was called with arguments or in a state it does not support. |
| `SNAPSHOT_CIRCULAR_REFERENCE` | A snapshot value contains a cycle. |
| `SNAPSHOT_SERIALIZER_FAILED` | A snapshot serializer threw. The original error is the `cause`. |

Which capability raises which code is also listed on its reference page:
[core runner](/bun-test-utils/reference/core/#errors-raised-here),
[property, scenario, and snapshots](/bun-test-utils/reference/snapshots-and-property/#errors),
and [HTTP, cassettes, and browser](/bun-test-utils/reference/http-and-browser/#errors).

## Related

- [Stability, compatibility, and support](/bun-test-utils/overview/compatibility/): which of these surfaces is contractual.
- [Troubleshooting](/bun-test-utils/recipes/troubleshooting/): the same codes organised by symptom.
- [Install and first passing test](/bun-test-utils/start/first-test/): `init` in context.
