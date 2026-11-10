/**
 * Test modifiers (ADR 0043).
 *
 * The modifier surface is pure registration, so the behaviour that matters is
 * what `bun test` reports and whether fixtures ran. Each case therefore spawns
 * a real `bun test` against a scratch file that imports this package's source.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest, expect, test } from "@/plugin.ts";

const PLUGIN = join(import.meta.dir, "..", "src", "plugin.ts");

interface RunResult {
  output: string;
  exitCode: number | null;
}

/** Runs `bun test` on one scratch file that imports the core source directly. */
function runScratch(
  source: string,
  args: string[] = [],
  extraEnv: Record<string, string> = {},
): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-modifiers-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "scratch", type: "module" }),
    );
    writeFileSync(join(dir, "a.test.ts"), source);
    const proc = Bun.spawnSync({
      cmd: [process.execPath, "test", ...args],
      cwd: dir,
      env: { ...process.env, FORCE_COLOR: "0", ...extraEnv },
    });
    return {
      output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
      exitCode: proc.exitCode,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const header = `import { test as base } from ${JSON.stringify(PLUGIN)};
const test = base.extend({
  thing: {
    setup: async (use) => {
      console.log("SETUP");
      await use({ ready: true });
      console.log("TEARDOWN");
    },
  },
});
`;

test("the modifier surface is attached to the fixture-aware test", () => {
  const { test: fixtureTest } = createTest(import.meta.path);

  for (const name of [
    "only",
    "skip",
    "todo",
    "failing",
    "concurrent",
    "serial",
  ] as const) {
    expect(typeof fixtureTest[name]).toBe("function");
  }
  for (const name of [
    "if",
    "skipIf",
    "todoIf",
    "failingIf",
    "concurrentIf",
    "serialIf",
  ] as const) {
    expect(typeof fixtureTest[name](false)).toBe("function");
  }
  // ADR 0043: table-driven tests stay out of scope until a row/context
  // convention is decided.
  expect("each" in fixtureTest).toBe(false);
});

test("test.skip registers a skipped test without building its fixtures", () => {
  const run = runScratch(`${header}
test.skip("skipped", async ({ thing }) => {
  console.log("BODY", thing);
});
test("runs", () => {});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("1 pass");
  expect(run.output).toContain("1 skip");
  expect(run.output).not.toContain("SETUP");
  expect(run.output).not.toContain("BODY");
});

test("test.skipIf(false) runs the test with fixtures", () => {
  const run = runScratch(`${header}
test.skipIf(false)("runs", async ({ thing }) => {
  console.log("READY", thing.ready);
});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("1 pass");
  expect(run.output).toContain("READY true");
  expect(run.output).toContain("SETUP");
  expect(run.output).toContain("TEARDOWN");
});

test("test.skipIf(true) skips the test and never builds its fixtures", () => {
  const run = runScratch(`${header}
test.skipIf(true)("skipped", async ({ thing }) => {
  console.log("BODY", thing);
});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("1 skip");
  expect(run.output).not.toContain("SETUP");
});

test("test.if runs only when its condition holds", () => {
  const run = runScratch(`${header}
test.if(true)("runs", async ({ thing }) => {
  console.log("RAN", thing.ready);
});
test.if(false)("does not run", async ({ thing }) => {
  console.log("BODY", thing);
});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("RAN true");
  expect(run.output).not.toContain("BODY");
});

test("a skipped test does not fail the run on an unknown fixture", () => {
  const run = runScratch(`${header}
test.skip("skipped with a typo", async ({ thign }) => {
  console.log("BODY", thign);
});
test("runs", () => {});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).not.toContain("unknown fixture");
  expect(run.output).toContain("1 pass");
});

test("a running test still fails the run on an unknown fixture", () => {
  const run = runScratch(`${header}
test.skipIf(false)("typo", async ({ thign }) => {
  console.log("BODY", thign);
});
`);

  expect(run.exitCode).not.toBe(0);
  expect(run.output).toContain('unknown fixture "thign"');
});

test("test.only runs only the marked test", () => {
  // Bun disables `.only` while CI is set; the package passes that guard
  // through, so the assertion itself has to opt out of it.
  const run = runScratch(
    `${header}
test.only("only me", async ({ thing }) => {
  console.log("ONLY", thing.ready);
});
test("not me", () => {
  console.log("OTHER");
});
`,
    [],
    { CI: "false" },
  );

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("ONLY true");
  expect(run.output).not.toContain("OTHER");
});

test("test.todo is reported as a todo until --todo is passed", () => {
  const source = `${header}
test.todo("write this", async ({ thing }) => {
  console.log("TODO BODY", thing.ready);
});
test("runs", () => {});
`;

  const withoutFlag = runScratch(source);
  expect(withoutFlag.output).toContain("1 pass");
  expect(withoutFlag.output).not.toContain("TODO BODY");

  const withFlag = runScratch(source, ["--todo"]);
  expect(withFlag.output).toContain("TODO BODY true");
});

test("serial and concurrent modifiers keep fixtures working", () => {
  const run = runScratch(`${header}
test.serial("serial", async ({ thing }) => {
  console.log("SERIAL", thing.ready);
});
test.concurrent("concurrent", async ({ thing }) => {
  console.log("CONCURRENT", thing.ready);
});
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("SERIAL true");
  expect(run.output).toContain("CONCURRENT true");
});

test("modifiers accept an explicit fixture list", () => {
  const run = runScratch(`${header}
test.skipIf(false)("explicit", async (ctx) => {
  console.log("EXPLICIT", ctx.thing.ready);
}, { fixtures: ["thing"] });
`);

  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("EXPLICIT true");
});

test("building the runner under CI never touches Bun's guarded .only getter", () => {
  // Bun's `test.only` getter throws while `CI` is set, to stop tests being
  // skipped by accident. Attaching the modifier surface must not read it: only
  // a consumer who actually calls `test.only` should see Bun's message.
  const run = runScratch(
    `${header}
test.skip("skipped", async ({ thing }) => { console.log("BODY", thing); });
test("runs", async ({ thing }) => { console.log("RAN", thing.ready); });
`,
    [],
    { CI: "true" },
  );

  expect(run.exitCode).toBe(0);
  expect(run.output).not.toContain(".only is disabled in CI");
  expect(run.output).toContain("RAN true");
});
