import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import sampleLabels from "./src/remark/sample-labels.mjs";
import statusBadges from "./src/remark/status-badges.mjs";

// Deployed to GitHub Pages by .github/workflows/docs.yml.
//
// Reference pages opt into a wider content column in src/components/Head.astro.
export default defineConfig({
  site: "https://archont561.github.io",
  base: "/bun-test-utils",
  // Old paths keep working: the guides moved under fundamentals/ and
  // capabilities/, and the monolithic API reference was split. Anchor-level
  // deep links cannot be redirected from a static host, so each new reference
  // page carries a "where the old API reference section went" table in
  // src/content/docs/project/releases.md.
  redirects: {
    "/quickstart/": "/start/first-test/",
    "/guides/getting-started/": "/fundamentals/fixture-model/",
    "/guides/scopes-and-teardown/": "/fundamentals/scopes-and-teardown/",
    "/guides/explicit-composition/": "/fundamentals/composition/",
    "/guides/parameterized-fixtures/": "/capabilities/parameterized-tests/",
    "/guides/property-based-testing/": "/capabilities/property-based-testing/",
    "/guides/recording-http-cassettes/": "/capabilities/cassettes/",
    "/guides/scenarios-and-fluent-api/": "/capabilities/scenarios/",
    "/guides/snapshot-testing/": "/capabilities/snapshots/",
    "/reference/api/": "/reference/core/",
    "/reference/plugins/": "/reference/fixtures/",
  },
  markdown: {
    // Frontmatter (`status`, `since`, `requires`) renders the badge row, and
    // fence meta (`runnable`, `illustrative`, `partial`) renders a sample
    // label. The `runnable` blocks on the first-test page are executed by
    // apps/docs/tests/first-test-snippet.test.ts.
    remarkPlugins: [statusBadges, sampleLabels],
  },
  integrations: [
    starlight({
      title: "bun-test-utils",
      description:
        "General-purpose test extension for the Bun test runner: Playwright-style typed fixtures composed with test.extend(), plus BDD, property-based, snapshot, cassette, and browser testing",
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: false,
      },
      social: {
        github: "https://github.com/Archont561/bun-test-utils",
      },
      customCss: ["./src/styles/custom.css"],
      // Freshness signals: every content page links to its source and shows
      // when it last changed (docs README carries the contract).
      editLink: {
        baseUrl:
          "https://github.com/Archont561/bun-test-utils/edit/main/apps/docs/",
      },
      lastUpdated: true,
      components: {
        Head: "./src/components/Head.astro",
        Footer: "./src/components/Footer.astro",
      },
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "What is bun-test-utils?", slug: "index" },
            {
              label: "Stability, compatibility, and support",
              slug: "overview/compatibility",
            },
          ],
        },
        {
          label: "Start here",
          items: [
            {
              label: "Install and first passing test",
              slug: "start/first-test",
            },
            {
              label: "Choose your test environment",
              slug: "start/environment",
            },
          ],
        },
        {
          label: "Fundamentals",
          items: [
            { label: "The fixture model", slug: "fundamentals/fixture-model" },
            {
              label: "Scopes and teardown",
              slug: "fundamentals/scopes-and-teardown",
            },
            {
              label: "Composition and overrides",
              slug: "fundamentals/composition",
            },
          ],
        },
        {
          label: "Capabilities",
          items: [
            { label: "Capability index", slug: "capabilities" },
            {
              label: "DOM and browser testing",
              slug: "capabilities/dom-and-browser",
              badge: { text: "Experimental", variant: "caution" },
            },
            {
              label: "HTTP mocking and test servers",
              slug: "capabilities/http-and-servers",
            },
            {
              label: "Recording HTTP cassettes",
              slug: "capabilities/cassettes",
            },
            { label: "Snapshot testing", slug: "capabilities/snapshots" },
            {
              label: "Property-based testing",
              slug: "capabilities/property-based-testing",
            },
            {
              label: "BDD scenarios",
              slug: "capabilities/scenarios",
              badge: { text: "Experimental", variant: "caution" },
            },
            {
              label: "Parameterized tests",
              slug: "capabilities/parameterized-tests",
            },
          ],
        },
        {
          label: "Recipes",
          items: [
            { label: "Database fixture", slug: "recipes/database" },
            {
              label: "Test server and HTTP mocks",
              slug: "recipes/server-and-mocks",
            },
            {
              label: "Deterministic tests",
              slug: "recipes/deterministic-tests",
            },
            { label: "CI-safe cassettes", slug: "recipes/ci-safe-cassettes" },
            {
              label: "Browser tests in CI",
              slug: "recipes/browser-tests-in-ci",
            },
            {
              label: "Debugging fixture failures",
              slug: "recipes/debugging-fixture-failures",
            },
            { label: "Troubleshooting", slug: "recipes/troubleshooting" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Core runner and fixture API", slug: "reference/core" },
            { label: "Built-in fixture API", slug: "reference/fixtures" },
            {
              label: "Snapshots and property-testing API",
              slug: "reference/snapshots-and-property",
            },
            {
              label: "HTTP, cassette, and browser API",
              slug: "reference/http-and-browser",
            },
            {
              label: "CLI, environment variables, and errors",
              slug: "reference/cli",
            },
          ],
        },
        {
          label: "Project",
          items: [
            { label: "Release notes and upgrading", slug: "project/releases" },
            {
              label: "Contributing and docs feedback",
              slug: "project/contributing",
            },
          ],
        },
      ],
      expressiveCode: {
        themes: ["github-dark", "github-light"],
      },
    }),
  ],
});
