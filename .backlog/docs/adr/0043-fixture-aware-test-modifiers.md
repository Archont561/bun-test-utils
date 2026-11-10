# 0043 — Expose Bun's test modifiers on the fixture-aware test

- **Status:** accepted
- **Date:** 2026-11-10

## Context

`@archont561/bun-test-utils` re-exports `describe`, `expect`, and `test` from
`@archont561/bun-test-utils`, but `test` is a wrapper built by
`makeAwareTest()` in `packages/core/src/factory.ts`. That wrapper is a plain
function with three attached members — `extend`, `scenario`, and (after the
PBT layer) `prop`. Everything else on Bun's `Test` object is lost because the
object is never copied: `skip`, `only`, `todo`, `failing`, `concurrent`,
`serial`, and the conditional `if` / `skipIf` / `todoIf` / `failingIf` /
`concurrentIf` / `serialIf` factories (bun-types 1.4.2 `test.d.ts`).

Consumers therefore cannot skip a test at runtime — the motivating case is a
test that only makes sense on one platform — without abandoning fixtures:

1. Import `test` from `bun:test` for that one declaration: loses every
   bun-test-utils fixture.
2. Guard inside the body: the test still reports as passed without asserting.
3. Register conditionally at module load: scatters platform checks across files.

`test.only` has no workaround at all, and neither does `test.todo`.

Spec 0004 listed "Public `test.each`, `test.skip/only/todo` fixture variants"
as out of scope. That decision predates the wrapper's use as the package's
only public runner; this record reverses the skip/only/todo part of it.

## Decision

1. **The fixture-aware test carries Bun's modifier surface.** The `test`
   object exposes `only`, `skip`, `todo`, `failing`, `concurrent`, and
   `serial` as registration functions with the same `(name, fn, options?)`
   signature as `test`, plus the conditional factories `if(condition)`,
   `skipIf(condition)`, `todoIf(condition)`, `failingIf(condition)`,
   `concurrentIf(condition)`, and `serialIf(condition)`, each returning a
   registration function. Their names, arities, and effects are Bun's; the
   package adds no tag or marker semantics of its own.

2. **Modifiers keep fixtures.** A modifier registration goes through exactly
   the same body wrapper as `test`, so the test still receives a
   `FixtureContext`, still auto-detects or accepts `options.fixtures`, and
   still unwinds test-scoped fixtures in LIFO order.

3. **Non-running registrations do not touch the fixture graph.** For `skip`,
   `todo`, and the conditional factories when the condition makes the test
   non-running, fixture detection and `resolveOrder()` are deferred into the
   body — which Bun never calls. A skipped test therefore does not fail the
   run on a misspelled fixture name, and a platform-specific fixture that only
   exists on one platform can be named in a test that is skipped elsewhere.
   Running registrations keep the existing eager validation, so a typo in a
   test that actually runs still fails at module load with the contractual
   unknown-fixture message.

4. **A modifier is a registration function, not a composable test object.**
   `test.skip(...)` returns `void`; `test.skipIf(cond)` returns a function with
   the `test` signature. It does not return an object with `extend`, `prop`,
   or `scenario`. Composition belongs to the test object: a skipped test has
   no fixture map of its own to extend, and a `prop`/`scenario` on a test that
   never runs would be a type-level promise the runtime cannot honour.

5. **`test.each` and `describe.each` stay out of scope.** Bun passes table
   rows positionally, and fixtures are passed as the first (or only) body
   argument, so the two conventions collide; choosing one is a separate
   decision. `describe` remains Bun's own `describe`, unwrapped, so
   `describe.only` / `describe.skip` / `describe.skipIf` / `describe.each`
   behave exactly as Bun documents and are not affected by this record.

6. **Bun's own guards pass through.** Some of Bun's modifier getters are
   guarded — reading `test.only` while `CI` is set throws to stop tests being
   skipped by accident. The surface therefore resolves Bun's registration node
   when a modifier is called, not when the runner is built, so declaring the
   runner under CI is unaffected; a consumer who actually calls `test.only`
   there gets Bun's message and Bun's documented `CI=false` override.

7. **The surface is declared once and delegated through the layers.** The
   modifier recursion lives in core (`makeAwareTest` builds each modifier from
   the corresponding Bun `Test` node). The BDD and PBT wrappers do not
   reimplement it; they delegate each modifier call to the core runner they
   already hold, so a modifier added to core reaches the public root without a
   second edit and without drifting behaviour between layers.

## Consequences

**Good**

- Platform-conditional tests stop paying the fixture tax: one import, one
  declaration, fixtures intact.
- `test.only` and `test.todo` become usable with fixtures at all.
- Deferring the graph for non-running registrations makes the common
  `skipIf(process.platform !== "linux")` pattern safe even when the body names
  a fixture that only exists on Linux.
- No new exported names: the public API baseline is unchanged, and the change
  is additive for consumers.

**Bad**

- A skipped test with a genuinely wrong fixture name is silent. The trade is
  deliberate (point 3) and is documented.
- Modifier registration functions deliberately lose `extend`/`prop`/`scenario`,
  so `test.skip.extend(...)` fails to typecheck instead of silently
  registering against a wrapper map.
- `test.each` users still need `bun:test`'s `test` for table-driven cases,
  which is a mixed import — the very pattern this record removes for the
  other modifiers.
- Two more delegating surfaces (BDD and PBT) to keep honest in conformance
  tests.

## Alternatives considered

- **Return a full fixture-aware test object from every modifier.** Rejected:
  a chainable `test.skip.extend({...})` invites fixture maps that never
  instantiate, and `test.todo.prop(...)` would typecheck while doing nothing.
- **Keep modifier calls eager and validate fixtures even for skipped tests.**
  Rejected: it breaks the platform-specific case that motivates skipping, and
  it makes `test.skip` fail loudly for code that never runs.
- **Copy Bun's `Test` object wholesale (`{...test}`) and patch the call.** Rejected:
  Bun's modifiers are prototype methods, not own properties, so a spread
  copies nothing; and identity/`this` binding of the internal test object is
  not contractual.
- **Wrap `describe` as well, to add tags and fixture-aware `describe.each`.**
  Deferred: `describe` is a Bun value with its own modifier semantics, and
  nothing in the requests needs a wrapper.
- **Implement `test.each` now with a documented row/context convention.**
  Deferred to its own decision; the convention is breaking once published.
