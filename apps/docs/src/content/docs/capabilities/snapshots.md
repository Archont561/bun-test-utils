---
title: Snapshot testing
description: Compare values, files, and callback results against stored snapshots, review the diff, and recover from serialization errors.
status: stable
since: 0.1.0
---

The `snapshot` fixture serializes a value — or the contents of a file — and
compares it against a baseline stored next to the test. The first run records
the baseline; later runs compare against it and fail with a readable diff when
the value changes.

## Installation

`snapshot` is on the root `test` context, with no extra dependency:

```bash runnable
bun add -d @archont561/bun-test-utils
```

## Use the fixture

```ts partial
import { test } from "@archont561/bun-test-utils";

test("renders the widget", async ({ snapshot }) => {
  const widget = render({ name: "widget", count: 3 }); // your renderer
  snapshot.match(widget);
});
```

The first run writes `__snapshots__/renders-the-widget.snap.json` next to the
test file, and later runs compare against that file. Commit `__snapshots__/`:
reviewing its diff is how you review a change in behaviour.

## Snapshot a callback result

For work that produces a value asynchronously, call the fixture itself. The
name is required and becomes the stored snapshot key:

```ts partial
import { expect, test } from "@archont561/bun-test-utils";

test("loads a profile", async ({ snapshot }) => {
  const profile = await snapshot(
    async () => fetchProfile("ada"), // your loader
    "ada-profile",
  );

  expect(profile.id).toBe("ada");
});
```

`await snapshot(fn, name)` always runs and awaits `fn` once, then behaves like
`snapshot.match(result, name)` and returns the original result. It is not a
cache: it never reads the function body, captures, or identity, and calling it
again runs the callback again. Use `snapshot.match(value, name?)` for an
already available value, including anonymous auto-numbered snapshots.

If `fn` throws or rejects, its original error propagates, `match` is not
called, and that invocation writes no snapshot. A successful callback can still
report an ordinary snapshot mismatch or serializer error after it returns.

## Modes

Select a mode with `SNAPSHOT_MODE`, or per test with `snapshot.setMode(...)`:

| Mode | Missing snapshot | Mismatch |
| :-- | :-- | :-- |
| `match` (default) | Records it | Fails, with a diff |
| `update` | Records it | Overwrites it with the new value |
| `ci` | Fails | Fails, with a diff |

`ci` is selected automatically when `CI` is set, so a pipeline never writes a
baseline it did not review.

```bash partial
SNAPSHOT_MODE=update bun test
```

## Multiple snapshots and files

```ts partial
test("captures three states", async ({ snapshot }) => {
  snapshot.match(initialState());
  snapshot.match(afterClick(), "after-click");
  snapshot.matchFile(reportPath, "report");
});
```

Unnamed calls are numbered automatically: `value`, `value 2`, and so on. Pass a
name to address one explicitly.

## The update-and-review workflow

Snapshots fail when behaviour changes, and that failure is the point: read the
diff before you accept it.

1. Run the tests and read the failing diff. Confirm the new output is what you
   intend, not a side effect of a bug or of leaked state.
2. Update deliberately: `SNAPSHOT_MODE=update bun test` for a whole run, or
   clear one test and let the next run re-record it. Clearing one test is
   usually better: it keeps the diff small and reviewable.
3. Review the `__snapshots__/` diff in your change. The baseline is committed
   on purpose; if the diff is large and you cannot explain a line, investigate
   before committing.
4. Commit the baseline with the code change that produced it.

```bash partial
bunx test-utils cache clear --file tests/widget.test.ts --test "renders the widget"
bun test tests/widget.test.ts
```

`--file <path>` without `--test` clears every test in the file, and `--all`
clears every snapshot and cassette under the project root. `--dry-run` previews
what would be deleted. In `ci` mode a test fails until a reviewed baseline is
committed. See [Cassettes](/bun-test-utils/capabilities/cassettes/#clear-a-recording)
for the full command.

## Custom serializers

The built-in serializers handle strings, `Error` values, and objects with
sorted keys. Register a serializer for other types: return a string for the
values it handles, and `undefined` for everything else.

```ts partial
test("serializes points", async ({ snapshot }) => {
  snapshot.addSerializer((value) =>
    value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
  );
  snapshot.match(new Point(1, 2));
});
```

Serializers registered on the fixture apply to that test. They run before the
built-in serializers, and the most recent registration runs first.

## Global serializers

For a serializer every test should use, register it once from a preload module
with the `/snap` subpath:

```ts title="test-serializers.ts" partial
import { createSnapshotSerializer } from "@archont561/bun-test-utils/snap";

createSnapshotSerializer((value) => (value instanceof Date ? "<date>" : undefined));
```

```toml title="bunfig.toml" partial
[test]
preload = ["./test-serializers.ts"]
```

Global serializers apply to every `snapshot` in the process, including values
nested inside objects and arrays. Fixture-local serializers run first, then
globals, then the built-in fallbacks.

`createSnapshotSerializer` and `registerSnapshotSerializer` return the function
they register — keep that reference to remove it later:

```ts partial
import {
  createSnapshotSerializer,
  unregisterSnapshotSerializer,
  type Serializer,
} from "@archont561/bun-test-utils/snap";

const redactSecrets: Serializer = (value) =>
  typeof value === "string" && value.startsWith("sk-") ? "<secret>" : undefined;

const registered = createSnapshotSerializer(redactSecrets);
// later, when the owner is done with it:
unregisterSnapshotSerializer(registered);
```

`unregisterSnapshotSerializer` removes every registration of that exact
function and returns `true` if any were removed. `resetSnapshotSerializers()`
clears the global registry; use it only at a controlled boundary such as the
start of a watch-mode reload, and register what you need again afterwards.
Both operations affect every snapshot in the process, so do not call them while
tests run concurrently.

## Recursive values and diagnostics

Serializers run on the root value, and again on each object property and array
entry. At each value, fixture-local serializers take precedence over global
ones, and the newest serializer in each group runs first.

The built-in `Error` serializer is recursive too: a nested error snapshots as
`Error: <message>` unless a custom serializer handles it first. An object that
appears in two places is serialized at both; only a reference back to an object
on the current path counts as a cycle.

| Error | Code | What it means |
| :-- | :-- | :-- |
| `SnapshotSerializationError` for a cycle | `SNAPSHOT_CIRCULAR_REFERENCE` | The value refers back to itself. Details give the snapshot name, the value path (for example `$.user.items[0]`), and where the object was first seen. |
| A serializer threw | `SNAPSHOT_SERIALIZER_FAILED` | The diagnostic names the snapshot and value path, and the original error is preserved as `cause`. |

## Failure modes

| Symptom | Cause | Fix |
| :-- | :-- | :-- |
| A test fails with a diff and no code change | Output changed, or the snapshot was recorded against different inputs | Read the diff; if the new output is correct, clear the snapshot and re-record it, then review the commit. |
| A snapshot never gets recorded | `SNAPSHOT_MODE=ci`, or `CI` is set | Unset `CI` locally or use `SNAPSHOT_MODE=update` for the recording run. |
| `SNAPSHOT_CIRCULAR_REFERENCE` | The value graph contains a cycle | Snapshot a projection of the value, or snapshot the parts that matter separately. |
| `SNAPSHOT_SERIALIZER_FAILED` | A custom serializer threw | Read `cause`; the error names the snapshot and the value path. |
| Two tests fight over one snapshot file | Both tests produce the same auto-numbered names in the same file | Give each snapshot an explicit name. |

## Related

- [Cassettes](/bun-test-utils/capabilities/cassettes/): the same review workflow for HTTP traffic and callback results.
- [Snapshots and property-testing API](/bun-test-utils/reference/snapshots-and-property/): members, serializer contract, and modes.
- [CI-safe cassettes](/bun-test-utils/recipes/ci-safe-cassettes/): what a pipeline should and should not write.
