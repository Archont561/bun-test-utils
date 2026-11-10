/**
 * Runner factories (split out of plugin.ts — audit 2026-10-06, finding 3):
 * the per-file `test` wrapper, `test.extend()` chains and `createTest`.
 */

import {
  describe as bunDescribe,
  expect as bunExpect,
  test as bunTest,
} from "bun:test";
import { resolve } from "node:path";
import { detectFixtures } from "./detect.ts";
import { resolveOrder, scopeOf } from "./graph.ts";
import { callerFile } from "./helpers.ts";
import { enterFile, instantiate, runWithUnwind } from "./lifecycle.ts";
import { scenarioFactory } from "./scenario.ts";
import { FIXTURE_MAP_SYMBOL } from "./state.ts";
import { currentTagFilter, tagFilterAccepts } from "./tags.ts";
import type {
  FixtureAwareTest,
  FixtureContext,
  FixtureDef,
  FixtureMap,
  IterateFn,
  ScenarioFactory,
  TestFn,
  TestModifierFn,
  TestModifiers,
  TestOptions,
} from "./types.ts";

/**
 * The registration call a test ultimately performs — Bun's own `test`, or one
 * of its modifiers (`test.skip`, `test.skipIf(cond)`, …).
 */
export type TestRegistrar = (
  name: string,
  body: () => void | Promise<void>,
  timeout?: number,
) => void;

/**
 * Declares one test. `register` selects how Bun records the declaration, so
 * modifiers reuse the whole fixture body; `deferGraph` postpones fixture
 * validation for declarations that Bun will never run (ADR 0043 point 3).
 */
export function makeTest(
  file: string,
  map: FixtureMap,
  register: TestRegistrar = bunTest,
  deferGraph = false,
): TestFn {
  const abs = resolve(file);
  return (name, fn, opts?: TestOptions) => {
    const requested = opts?.fixtures ?? detectFixtures(fn, 0);
    const testName = name;
    // A declaration filtered out by BUN_TEST_UTILS_TAGS is registered as
    // skipped and never resolves its fixtures (ADR 0044 point 4).
    const filteredOut = !tagFilterAccepts(currentTagFilter(), opts?.tags);
    const defer = deferGraph || filteredOut;
    const order = defer ? undefined : resolveOrder(requested, map, abs);
    const registrar = filteredOut ? bunTest.skip : register;

    const body = async () => {
      const resolved = order ?? resolveOrder(requested, map, abs);
      await enterFile(abs);
      const testStack: Array<() => Promise<void>> = [];
      const ctx: FixtureContext = { testFile: abs, testName };

      const buildAll = async (
        target: FixtureContext,
        stack: Array<() => Promise<void>>,
        names: string[],
      ) => {
        for (const fixture of names) {
          target[fixture] = await instantiate(fixture, map, target, abs, stack);
        }
      };

      // ADR 0025 — runWithUnwind, not `finally`: a teardown error must be
      // attached to the error in flight, never replace it.
      await runWithUnwind(testStack, async () => {
        if (opts?.iterate) {
          // Defer test-scope fixtures to ctx.iterate: the wrapper context
          // holds only session/file values, and each iterate() call builds
          // a fresh set of test-scope fixtures with LIFO unwind — the
          // per-sample lifecycle property runners need.
          ctx.iterate = (async <T>(
            fn2: (iterCtx: FixtureContext) => T | Promise<T>,
          ): Promise<T> => {
            const iterStack: Array<() => Promise<void>> = [];
            return runWithUnwind(iterStack, async () => {
              const iterCtx: FixtureContext = { testFile: abs, testName };
              await buildAll(iterCtx, iterStack, resolved);
              return await fn2(iterCtx);
            });
          }) satisfies IterateFn;
          await buildAll(
            ctx,
            testStack,
            resolved.filter((n) => scopeOf(map[n]!) !== "test"),
          );
        } else {
          await buildAll(ctx, testStack, resolved);
        }
        await fn(ctx);
      });
    };
    if (opts?.timeout === undefined) registrar(testName, body);
    else registrar(testName, body, opts.timeout);
  };
}

/**
 * Declares a fixture with an inferred public type.
 *
 * Capability packages use this instead of depending on the `FixtureDef` type
 * directly. It is intentionally a small identity function: the engine still
 * owns validation, dependency ordering, scopes, and teardown.
 */
export function createFixture<T>(definition: FixtureDef<T>): FixtureDef<T> {
  return definition;
}

/**
 * Creates a fixture-aware `test` bound to a specific file.
 *
 * ```ts
 * const { test, expect } = createTest(import.meta.path);
 * const dbTest = test.extend({ db });
 * dbTest("uses db", async ({ db }) => { ... });
 * ```
 */
export function createTest(testFile?: string): {
  test: FixtureAwareTest;
  describe: typeof bunDescribe;
  expect: typeof bunExpect;
} {
  const file = resolve(testFile ?? callerFile());
  return {
    test: makeAwareTest({}, file),
    describe: bunDescribe,
    expect: bunExpect,
  };
}

/** Internal companion hook: bind an existing fixture map to a specific file without changing its cache identity. */
export function createTestWithFixtures(
  testFile: string,
  fixtures: FixtureMap,
): FixtureAwareTest {
  return makeAwareTest(fixtures, resolve(testFile), false);
}

/** Direct (non-conditional) Bun modifiers, in declaration order. */
export const TEST_MODIFIER_KEYS = [
  "only",
  "skip",
  "todo",
  "failing",
  "concurrent",
  "serial",
] as const;

/** Conditional Bun modifier factories, in declaration order. */
export const TEST_MODIFIER_CONDITIONAL_KEYS = [
  "if",
  "skipIf",
  "todoIf",
  "failingIf",
  "concurrentIf",
  "serialIf",
] as const;

type BunTestNode = typeof bunTest;

/**
 * Builds one modifier registration function (ADR 0043 point 1).
 *
 * `node` selects the Bun `Test` the declaration goes through — `bunTest.skip`,
 * `bunTest.skipIf(cond)`, … — so the modifier behaves exactly as Bun documents
 * while the body still resolves and unwinds fixtures. It is a selector, not a
 * value, because some of Bun's own getters are guarded: reading `test.only`
 * under `CI` throws to stop tests being skipped by accident, and building the
 * surface must not trip that guard for a runner that never uses `.only`.
 * `deferGraph` marks a declaration Bun will not run, which postpones fixture
 * validation.
 */
function modifierFn(
  resolveFile: () => string,
  map: FixtureMap,
  node: () => BunTestNode,
  deferGraph: boolean,
): TestModifierFn {
  return (name, fn, opts) =>
    makeTest(resolveFile(), map, node(), deferGraph)(name, fn, opts);
}

/**
 * Copies the modifier surface of `source()` onto `target`, delegating each
 * call lazily.
 *
 * The BDD and PBT layers rebuild the runner around their own fixture map, so
 * they re-attach core's modifiers instead of reimplementing them; the source
 * is a function because those layers resolve their per-file runner per call
 * (ADR 0043 point 6).
 */
export function delegateModifiers<T extends object>(
  target: T,
  source: () => FixtureAwareTest,
): T & TestModifiers {
  const delegate = target as T & TestModifiers;

  for (const key of TEST_MODIFIER_KEYS) {
    Object.defineProperty(delegate, key, {
      value: (...args: Parameters<TestModifierFn>) => source()[key](...args),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  for (const key of TEST_MODIFIER_CONDITIONAL_KEYS) {
    Object.defineProperty(delegate, key, {
      value: (condition: boolean) => source()[key](condition),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return delegate;
}

export function makeAwareTest(
  fixtures: FixtureMap = {},
  fixedFile?: string,
  cloneFixtures = true,
): FixtureAwareTest {
  const map = cloneFixtures ? { ...fixtures } : fixtures;
  const resolveFile = () => resolve(fixedFile ?? callerFile());
  const aware = ((
    name: string,
    fn: (ctx: FixtureContext) => void | Promise<void>,
    opts?: TestOptions,
  ) => {
    return makeTest(resolveFile(), map)(name, fn, opts);
  }) as FixtureAwareTest;
  aware.extend = (more) => makeAwareTest({ ...map, ...more }, fixedFile);
  aware.scenario = ((title: string) =>
    scenarioFactory(resolveFile(), map, makeTest)(title)) as ScenarioFactory;
  aware.scenario.prop = (title, strategies) =>
    scenarioFactory(resolveFile(), map, makeTest).prop(title, strategies);

  // ADR 0043: Bun's modifier surface, with the fixture body intact. Skip-like
  // declarations defer fixture validation because Bun never runs their body.
  aware.only = modifierFn(resolveFile, map, () => bunTest.only, false);
  aware.skip = modifierFn(resolveFile, map, () => bunTest.skip, true);
  aware.todo = modifierFn(resolveFile, map, () => bunTest.todo, true);
  aware.failing = modifierFn(resolveFile, map, () => bunTest.failing, false);
  aware.concurrent = modifierFn(
    resolveFile,
    map,
    () => bunTest.concurrent,
    false,
  );
  aware.serial = modifierFn(resolveFile, map, () => bunTest.serial, false);
  aware.if = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.if(condition), !condition);
  aware.skipIf = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.skipIf(condition), condition);
  aware.todoIf = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.todoIf(condition), condition);
  aware.failingIf = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.failingIf(condition), false);
  aware.concurrentIf = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.concurrentIf(condition), false);
  aware.serialIf = (condition) =>
    modifierFn(resolveFile, map, () => bunTest.serialIf(condition), false);
  Object.defineProperty(aware, FIXTURE_MAP_SYMBOL, {
    value: map,
    enumerable: false,
  });
  return aware;
}
