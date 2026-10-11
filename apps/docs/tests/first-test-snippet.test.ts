/**
 * Docs snippet and metadata check (docs audit, 2026-10-11).
 *
 * The site's promise is that a `Runnable` sample is a complete sample the
 * check executes, and that everything else on a page — sidebar entries, links,
 * anchors, frontmatter — resolves. This file enforces both:
 *
 * 1. **Samples labelled `runnable` run.** Every page with a runnable TypeScript
 *    fence is materialised into a scratch project, the package is installed
 *    into it (the same symlink `bun add -d` would create), the documented shell
 *    lines are performed, and every test file that was written has to be
 *    reported by a real `bun test` run. A page that documents its output has
 *    that output compared line by line with what the run printed.
 * 2. **The site's metadata holds together.** Sidebar slugs resolve to files,
 *    every page is reachable from the sidebar, internal links and anchors
 *    resolve to real pages and headings, and frontmatter uses known statuses,
 *    versions, and peer names.
 *
 * It needs a built package, because the samples import `dist/`, not the
 * workspace sources. `bun run docs:test` (turbo `docs#test`) builds first;
 * running `bun test` in this directory requires `bun run build` beforehand.
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const BUN = process.execPath;
const DOCS_DIR = resolve(import.meta.dir, "..");
const REPO_DIR = resolve(DOCS_DIR, "..", "..");
const CONTENT_DIR = join(DOCS_DIR, "src", "content", "docs");
const PACKAGE_DIR = join(REPO_DIR, "packages", "bun-test-utils");
const PACKAGE_MANIFEST = join(PACKAGE_DIR, "package.json");
const PACKAGE_NAME = "@archont561/bun-test-utils";
const LOCAL_CLI = join(PACKAGE_DIR, "dist", "cli.js");
const BASE_PATH = "/bun-test-utils/";

/** Frontmatter values the remark plugins and the writers' guide understand. */
const STATUSES = ["stable", "experimental"];

/**
 * Shell lines the check knows how to perform. Every runnable shell line in the
 * docs has to match one of these, so adding a command to a page fails the
 * check until the check can carry it out.
 */
const SHELL_HANDLERS: Array<[RegExp, string]> = [
  [/^(mkdir|cd)\b/, "no-op: the scratch project is the documented project"],
  [/^bun init --yes$/, "no-op: the scratch project already has a package.json"],
  [
    /^bun add -d .+$/,
    `link ${PACKAGE_NAME} from the workspace; peers resolve from the workspace install`,
  ],
  [
    /^bunx playwright install chromium$/,
    "no-op: the check installs no browsers",
  ],
  [/^bunx test-utils init --yes$/, "run the built CLI"],
  [/^bun test(?: .+)?$/, "run bun test in the scratch project"],
];

interface Fence {
  lang: string;
  meta: string;
  title?: string;
  body: string;
}

interface Page {
  /** Content path without extension, e.g. `start/first-test`. */
  slug: string;
  file: string;
  markdown: string;
}

/** Every content page, keyed by its Starlight slug. */
function pages(): Page[] {
  const found: Page[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.mdx?$/.test(entry)) {
        found.push({
          slug: relative(CONTENT_DIR, path)
            .replace(/\.mdx?$/, "")
            .split("\\")
            .join("/"),
          file: path,
          markdown: readFileSync(path, "utf8"),
        });
      }
    }
  };
  walk(CONTENT_DIR);
  return found.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Frontmatter as raw key → value strings, enough for the field contract. */
function frontmatter(markdown: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1];
  const data: Record<string, string> = {};
  if (!block) return data;
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    const key = match?.[1];
    if (key !== undefined) data[key] = (match?.[2] ?? "").trim();
  }
  return data;
}

/** Code fences in document order. */
function fences(markdown: string): Fence[] {
  const out: Fence[] = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^```([A-Za-z]+)?[ \t]*(.*)$/.exec(lines[i] as string);
    if (!open) continue;
    const body: string[] = [];
    let j = i + 1;
    for (; j < lines.length && !/^```\s*$/.test(lines[j] as string); j++) {
      body.push(lines[j] as string);
    }
    if (j >= lines.length) break;
    const meta = open[2] ?? "";
    out.push({
      lang: open[1] ?? "",
      meta,
      title: /title="([^"]+)"/.exec(meta)?.[1],
      body: body.join("\n"),
    });
    i = j;
  }
  return out;
}

/** True when a fence's meta names the sample kind. */
function isKind(fence: Fence, kind: string): boolean {
  return new RegExp(`(?:^|\\s)${kind}(?:\\s|$)`).test(fence.meta);
}

/** The runnable shell lines of a page, in document order. */
function shellLines(markdown: string): string[] {
  return fences(markdown)
    .filter(
      (fence) =>
        isKind(fence, "runnable") && ["bash", "sh"].includes(fence.lang),
    )
    .flatMap((fence) => fence.body.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** The runnable TypeScript files of a page, keyed by the documented filename. */
function sampleFiles(markdown: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const fence of fences(markdown)) {
    if (!isKind(fence, "runnable")) continue;
    if (fence.lang !== "ts" && fence.lang !== "typescript") continue;
    expect(
      fence.title,
      'a runnable TypeScript sample needs title="<file>" so it can be written to disk',
    ).toBeString();
    expect(
      fence.body,
      `${fence.title} looks incomplete (an elision marker survived into a runnable sample)`,
    ).not.toMatch(/^\s*(\.\.\.|…)/m);
    files.set(fence.title as string, fence.body);
  }
  return files;
}

/** Heading text → GitHub/Starlight anchor. */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .trim()
    .replace(/ /g, "-");
}

/** Every anchor a page's headings expose. */
function headings(markdown: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = /^#{2,6}\s+(.*?)\s*$/.exec(line);
    if (heading) out.push(slugify(heading[1] as string));
  }
  return out;
}

/**
 * `/index` suffixes are optional in Starlight: the sidebar may point at
 * `capabilities` or `capabilities/index` for the same page.
 */
function canonical(slug: string): string {
  return slug.replace(/\/index$/, "");
}

/** Internal doc links from Markdown links and MDX `href` attributes. */
function internalLinks(
  markdown: string,
): Array<{ path: string; anchor?: string }> {
  const urls = [
    ...markdown.matchAll(/\]\((\/bun-test-utils\/[^)\s]*)\)/g),
    ...markdown.matchAll(/href="(\/bun-test-utils\/[^"]*)"/g),
  ].map((match) => match[1] as string);
  return urls.map((url) => {
    const [rawPath = "", anchor] = url.slice(BASE_PATH.length).split("#");
    return { path: rawPath.replace(/\/$/, ""), anchor };
  });
}

/** Every heading slug on every page, keyed by its canonical slug. */
const anchorsBySlug = new Map<string, Set<string>>();
for (const page of pages()) {
  anchorsBySlug.set(canonical(page.slug), new Set(headings(page.markdown)));
}

/** Install the workspace package into a project, as `bun add -d` would. */
function linkLocalPackage(project: string): void {
  if (!existsSync(join(PACKAGE_DIR, "dist", "plugin.js"))) {
    throw new Error(
      `${PACKAGE_NAME} is not built. Run \`bun run build\` before this check.`,
    );
  }
  const scope = join(project, "node_modules", "@archont561");
  mkdirSync(scope, { recursive: true });
  symlinkSync(PACKAGE_DIR, join(scope, "bun-test-utils"), "dir");
}

/** Spawn a command in a project directory, with docs-timing variables gone. */
function run(cmd: string[], cwd: string): string {
  const env = { ...process.env, FORCE_COLOR: "0" };
  for (const name of [
    "CI",
    "VCR_MODE",
    "SNAPSHOT_MODE",
    "BUN_TEST_UTILS_WEB_ENV",
  ]) {
    delete env[name];
  }
  const proc = Bun.spawnSync({ cmd, cwd, env });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  if (proc.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${proc.exitCode}):\n${output}`);
  }
  return output;
}

/** Perform one documented shell line in the scratch project. */
function runShellLine(line: string, project: string): string {
  const handled = SHELL_HANDLERS.some(([pattern]) => pattern.test(line));
  if (!handled) {
    throw new Error(
      `the docs show a shell line this check cannot perform: \`${line}\`. ` +
        "Teach it to runShellLine() so the sample stays verified, or label the " +
        "sample `partial`.",
    );
  }
  if (/^(mkdir|cd)\b/.test(line) || line === "bun init --yes") return "";
  if (
    /^bun add -d .+$/.test(line) ||
    line === "bunx playwright install chromium"
  ) {
    return "";
  }
  if (line === "bunx test-utils init --yes") {
    return run([BUN, LOCAL_CLI, "init", "--yes"], project);
  }
  // `bun test [file]` — the leading `bun` is this process, not the command.
  return run([BUN, ...line.replace(/^bun\s+/, "").split(/\s+/)], project);
}

/** Lines of a documented output block, with timings removed. */
function expectedLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/\s*\[[^\]]*\]\s*/g, "").trim())
    .filter((line) => line.length > 0 && !/^bun test v/.test(line));
}

/** Every page that has a runnable TypeScript sample. */
function runnablePages(): Page[] {
  return pages().filter((page) => sampleFiles(page.markdown).size > 0);
}

/**
 * Run one page's runnable samples against the built package. Returns the
 * combined output of every `bun test` run the page performed.
 */
function executePage(page: Page): string {
  const project = mkdtempSync(join(tmpdir(), "bun-test-utils-docs-"));
  let output = "";
  try {
    writeFileSync(
      join(project, "package.json"),
      `${JSON.stringify({ name: "docs-snippet", private: true, type: "module" }, null, 2)}\n`,
    );
    // The reader installed the package before writing a sample; every page's
    // project starts from that state.
    linkLocalPackage(project);
    const files = sampleFiles(page.markdown);
    for (const [name, body] of files) {
      writeFileSync(join(project, name), `${body}\n`);
    }

    for (const line of shellLines(page.markdown)) {
      const result = runShellLine(line, project);
      if (!/^bun test/.test(line)) continue;
      expect(result, `\`${line}\` did not pass`).toContain("pass");
      expect(result, `\`${line}\` reported failures`).toContain("0 fail");
      output += result;
    }

    // Every test file has to be exercised by a real run: a page that documents
    // no `bun test` line still gets its files run, whole project.
    const testFiles = [...files.keys()].filter((name) =>
      /\.test\.ts$/.test(name),
    );
    const missing = testFiles.filter((name) => !output.includes(name));
    if (missing.length > 0) {
      const result = run([BUN, "test"], project);
      expect(result, "the whole-project run reported failures").toContain(
        "0 fail",
      );
      output += result;
      for (const name of testFiles) {
        expect(output, `${page.slug}: ${name} was never run`).toContain(name);
      }
    }

    expect(output, `${page.slug} ran no tests`).toContain("0 fail");

    const expected = /Expected output:\s*\n+```text\n([\s\S]*?)```/.exec(
      page.markdown,
    );
    if (expected) {
      for (const line of expectedLines(expected[1] as string)) {
        expect(
          output,
          `${page.slug} documents output the run did not print: ${line}`,
        ).toContain(line);
      }
    }
    return output;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

describe("runnable docs samples", () => {
  for (const page of runnablePages()) {
    test(`${page.slug} runs as written`, () => {
      const output = executePage(page);
      expect(output).toContain("pass");
    });
  }

  test("every runnable shell line is one the check performs", () => {
    for (const page of pages()) {
      for (const line of shellLines(page.markdown)) {
        expect(
          SHELL_HANDLERS.some(([pattern]) => pattern.test(line)),
          `${page.slug} uses \`${line}\`, which no handler in SHELL_HANDLERS covers`,
        ).toBe(true);
      }
    }
  });

  test("every sample carries a kind", () => {
    for (const page of pages()) {
      for (const fence of fences(page.markdown)) {
        // A `text` fence is program output, error text, or a directory
        // listing — the reader reads it, they do not paste it.
        if (fence.lang === "" || fence.lang === "text") continue;
        expect(
          ["runnable", "illustrative", "partial"].some((kind) =>
            isKind(fence, kind),
          ),
          `${page.slug}: a ${fence.lang} sample carries no runnable|illustrative|partial label`,
        ).toBe(true);
      }
    }
  });

  test("every runnable TypeScript sample is a complete, titled file", () => {
    // sampleFiles() asserts both properties as it reads each page.
    for (const page of pages()) {
      sampleFiles(page.markdown);
    }
    expect(runnablePages().length).toBeGreaterThan(0);
  });

  test("a page with runnable files is also a page a reader can run", () => {
    for (const page of runnablePages()) {
      const lines = shellLines(page.markdown);
      const hasTestRun = lines.some((line) => /^bun test(?: .+)?$/.test(line));
      expect(
        hasTestRun || lines.length === 0,
        `${page.slug} shows runnable files but no \`bun test\` command`,
      ).toBe(true);
    }
  });
});

describe("docs metadata", () => {
  test("every sidebar slug resolves to a page", () => {
    const config = readFileSync(join(DOCS_DIR, "astro.config.mjs"), "utf8");
    const slugs = [...config.matchAll(/slug:\s*"([^"]+)"/g)].map(
      (m) => m[1] as string,
    );
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(
        anchorsBySlug.has(canonical(slug)),
        `sidebar entry \`${slug}\` has no content page`,
      ).toBe(true);
    }
  });

  test("every content page except 404 is reachable from the sidebar", () => {
    const config = readFileSync(join(DOCS_DIR, "astro.config.mjs"), "utf8");
    const slugs = new Set(
      [...config.matchAll(/slug:\s*"([^"]+)"/g)].map((m) =>
        canonical(m[1] as string),
      ),
    );
    for (const page of pages()) {
      if (page.slug === "404") continue;
      expect(
        slugs.has(canonical(page.slug)),
        `${page.slug} is not in the sidebar`,
      ).toBe(true);
    }
  });

  test("frontmatter uses known statuses, versions, and peers", () => {
    const peers = Object.keys(
      JSON.parse(readFileSync(PACKAGE_MANIFEST, "utf8")).peerDependencies,
    );
    for (const page of pages()) {
      const data = frontmatter(page.markdown);
      if (data.status !== undefined) {
        expect(STATUSES, `${page.slug} has status ${data.status}`).toContain(
          (data.status as string).replace(/^["']|["']$/g, ""),
        );
      }
      if (data.since !== undefined) {
        expect(data.since, `${page.slug} has a malformed since`).toMatch(
          /^\d+\.\d+\.\d+$/,
        );
      }
      if (data.requires !== undefined) {
        for (const peer of (data.requires as string)
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
          .filter((entry) => entry.length > 0)) {
          expect(
            peers,
            `${page.slug} requires an unknown peer: ${peer}`,
          ).toContain(peer);
        }
      }
    }
  });

  test("capability pages declare their maturity", () => {
    for (const page of pages()) {
      if (!page.slug.startsWith("capabilities/")) continue;
      if (page.slug === "capabilities/index") continue; // the hub, not a capability
      expect(
        frontmatter(page.markdown).status,
        `${page.slug} must declare status: stable | experimental`,
      ).toBeString();
    }
  });

  test("experimental capabilities are labelled experimental", () => {
    const config = readFileSync(join(DOCS_DIR, "astro.config.mjs"), "utf8");
    for (const slug of [
      "capabilities/dom-and-browser",
      "capabilities/scenarios",
    ]) {
      const page = pages().find((candidate) => candidate.slug === slug);
      expect(frontmatter((page as Page).markdown).status).toBe("experimental");
      expect(config).toMatch(
        new RegExp(`slug: "${slug}"[\\s\\S]{0,200}Experimental`),
      );
    }
  });

  test("internal links and anchors resolve to real pages and headings", () => {
    for (const page of pages()) {
      for (const link of internalLinks(page.markdown)) {
        const target = canonical(link.path === "" ? "index" : link.path);
        expect(
          anchorsBySlug.has(target),
          `${page.slug} links to a missing page: ${BASE_PATH}${link.path}/`,
        ).toBe(true);
        if (link.anchor) {
          expect(
            anchorsBySlug.get(target)?.has(link.anchor),
            `${page.slug} links to a missing anchor: ${BASE_PATH}${link.path}/#${link.anchor}`,
          ).toBe(true);
        }
      }
    }
  });

  test("the version signal comes from the package manifest", () => {
    const homepage = pages().find((candidate) => candidate.slug === "index");
    expect((homepage as Page).markdown).toContain(
      "packages/bun-test-utils/package.json",
    );
    const footer = readFileSync(
      join(DOCS_DIR, "src", "components", "Footer.astro"),
      "utf8",
    );
    expect(footer).toContain("packages/bun-test-utils/package.json");
    expect(footer).toContain("project/releases/");
  });

  test("the old API reference anchors are still live and mapped", () => {
    const legacy = [
      "#imports",
      "#stability-and-platforms",
      "#testname-fn-options",
      "#the-iteration-protocol-iterate",
      "#testextendfixtures",
      "#testproptitle-arbitraryfactory-fn-options",
      "#testscenariotitle-and-testscenarioproptitle-arbitraryfactory",
      "#webpage-one-fixture-two-backends",
      "#httpmock-fetch-handlers",
      "#cassette-callbacks-and-http-recordings",
      "#vcr-global-callback-serializers",
      "#snapshot-value-and-file-snapshots",
      "#built-in-fixture-names",
      "#error-message-compatibility",
      "#error-codes",
      "#environment-variables",
    ];
    for (const anchor of legacy) {
      const present = [...anchorsBySlug.values()].some((set) =>
        set.has(anchor.slice(1)),
      );
      expect(present, `legacy anchor ${anchor} no longer exists`).toBe(true);
    }
    const releases = pages().find(
      (candidate) => candidate.slug === "project/releases",
    );
    for (const anchor of legacy) {
      expect(
        (releases as Page).markdown,
        `${anchor} is not mapped in project/releases.md`,
      ).toContain(`#${anchor.slice(1)}`);
    }
  });

  test("reference pages keep their wide layout opt-in", () => {
    const head = readFileSync(
      join(DOCS_DIR, "src", "components", "Head.astro"),
      "utf8",
    );
    expect(head).toContain("--sl-content-width: 72rem");
    expect(head).toContain("reference/");
  });
});
