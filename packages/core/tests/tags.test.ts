/**
 * Tag-based filtering (ADR 0044).
 *
 * The parser is pure and tested directly; the filtering semantics need a real
 * `bun test` run because only Bun decides what a skipped declaration looks
 * like and whether a body executes.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "@/plugin.ts";
import { parseTagFilter, TAG_FILTER_ENV, tagFilterAccepts } from "@/tags.ts";

const PLUGIN = join(import.meta.dir, "..", "src", "plugin.ts");

interface RunResult {
  output: string;
  exitCode: number | null;
}

/** Runs `bun test` on one scratch file, optionally under a tag filter. */
function runScratch(source: string, filter?: string): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-tags-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "scratch", type: "module" }),
    );
    writeFileSync(join(dir, "a.test.ts"), source);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    env.FORCE_COLOR = "0";
    if (filter === undefined) delete env[TAG_FILTER_ENV];
    else env[TAG_FILTER_ENV] = filter;

    const proc = Bun.spawnSync({
      cmd: [process.execPath, "test"],
      cwd: dir,
      env,
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
    },
  },
});
`;

const tagged = `${header}
test("untagged", () => { console.log("UNTAGGED"); });
test("fast one", async ({ thing }) => { console.log("FAST", thing.ready); }, { tags: ["fast"] });
test("slow one", () => { console.log("SLOW"); }, { tags: ["slow"] });
test("both", () => { console.log("BOTH"); }, { tags: ["fast", "slow"] });
`;

describe("parseTagFilter", () => {
  test("an unset or blank variable is no filter", () => {
    expect(parseTagFilter(undefined)).toBeUndefined();
    expect(parseTagFilter("")).toBeUndefined();
    expect(parseTagFilter("   ")).toBeUndefined();
    expect(parseTagFilter(" , ")).toBeUndefined();
  });

  test("accepts commas, whitespace, and exclusions", () => {
    expect(parseTagFilter("fast, integration")).toEqual({
      include: ["fast", "integration"],
      exclude: [],
    });
    expect(parseTagFilter(" fast , !slow ")).toEqual({
      include: ["fast"],
      exclude: ["slow"],
    });
    expect(parseTagFilter("!slow")).toEqual({ include: [], exclude: ["slow"] });
  });

  test("drops duplicates", () => {
    expect(parseTagFilter("fast,fast,!slow,!slow")).toEqual({
      include: ["fast"],
      exclude: ["slow"],
    });
  });
});

describe("tagFilterAccepts", () => {
  test("runs everything when there is no filter", () => {
    expect(tagFilterAccepts(undefined, undefined)).toBe(true);
    expect(tagFilterAccepts(undefined, ["slow"])).toBe(true);
  });

  test("exclusions alone keep untagged tests running", () => {
    const filter = parseTagFilter("!slow");
    expect(tagFilterAccepts(filter, undefined)).toBe(true);
    expect(tagFilterAccepts(filter, ["fast"])).toBe(true);
    expect(tagFilterAccepts(filter, ["slow"])).toBe(false);
    expect(tagFilterAccepts(filter, ["fast", "slow"])).toBe(false);
  });

  test("a positive filter skips untagged tests", () => {
    const filter = parseTagFilter("fast");
    expect(tagFilterAccepts(filter, undefined)).toBe(false);
    expect(tagFilterAccepts(filter, ["slow"])).toBe(false);
    expect(tagFilterAccepts(filter, ["fast"])).toBe(true);
  });

  test("an exclusion wins over an inclusion", () => {
    const filter = parseTagFilter("fast,!slow");
    expect(tagFilterAccepts(filter, ["fast", "slow"])).toBe(false);
    expect(tagFilterAccepts(filter, ["fast"])).toBe(true);
  });
});

describe("filtered runs", () => {
  test("no filter runs every test", () => {
    const run = runScratch(tagged);
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain("4 pass");
    expect(run.output).toContain("UNTAGGED");
    expect(run.output).toContain("SLOW");
  });

  test("a positive filter runs only matching tests and reports the rest as skipped", () => {
    const run = runScratch(tagged, "fast");
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain("2 pass");
    expect(run.output).toContain("2 skip");
    expect(run.output).toContain("FAST true");
    expect(run.output).toContain("BOTH");
    expect(run.output).not.toContain("UNTAGGED");
    expect(run.output).not.toContain("SLOW");
  });

  test("an exclusion keeps untagged tests running", () => {
    const run = runScratch(tagged, "!slow");
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain("2 pass");
    expect(run.output).toContain("2 skip");
    expect(run.output).toContain("UNTAGGED");
    expect(run.output).not.toContain("SLOW");
  });

  test("a filtered-out tag does not build fixtures", () => {
    const run = runScratch(
      `${header}
test("fast with fixture", async ({ thing }) => { console.log("FAST", thing.ready); }, { tags: ["fast"] });
test("slow with fixture", async ({ thing }) => { console.log("SLOW", thing.ready); }, { tags: ["slow"] });
`,
      "fast",
    );
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain("FAST true");
    expect(run.output.match(/SETUP/g)?.length).toBe(1);
  });

  test("a filtered-out test does not fail the run on an unknown fixture", () => {
    const run = runScratch(
      `${header}
test("filtered", async ({ thign }) => { console.log("BODY", thign); }, { tags: ["slow"] });
test("kept", () => {});
`,
      "fast",
    );
    expect(run.exitCode).toBe(0);
    expect(run.output).not.toContain("unknown fixture");
  });

  test("tags combine with a modifier", () => {
    const run = runScratch(
      `${header}
test.skipIf(true)("filtered and skipped", async ({ thing }) => { console.log("BODY", thing.ready); }, { tags: ["slow"] });
test("kept", () => {}, { tags: ["fast"] });
`,
      "fast",
    );
    expect(run.exitCode).toBe(0);
    expect(run.output).toContain("1 pass");
    expect(run.output).not.toContain("SETUP");
  });
});
