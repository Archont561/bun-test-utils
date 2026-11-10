Feature: Test modifiers and tag filtering
  As a developer whose tests are not valid on every platform or in every run
  I want Bun's skip/only/todo modifiers and semantic tags on the fixture-aware test
  So that I can select tests without abandoning fixtures or renaming them

  @modifiers
  Scenario: Skipping a test keeps its fixtures unbuilt
    Given a project with bun-test-utils preloaded
    And the file "modifiers.test.ts":
      """
      import { test as base } from "@archont561/bun-test-utils";

      const test = base.extend({
        expensive: {
          setup: async (use) => {
            console.log("SETUP");
            await use({ ready: true });
          },
        },
      });

      test.skip("not today", async ({ expensive }) => {
        console.log("BODY", expensive.ready);
      });

      test("still runs", () => {
        console.log("RAN");
      });
      """
    When I run the test suite
    Then 1 test passes
    And the output contains "1 skip"
    And the output contains "RAN"
    And the output does not contain "SETUP"
    And the output does not contain "BODY"

  @modifiers
  Scenario: A condition decides at runtime whether a test runs with fixtures
    Given a project with bun-test-utils preloaded
    And the file "modifiers.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";

      test.skipIf(process.platform === "plan9")("runs here", async ({ tmpdir }) => {
        tmpdir.write("value.txt", "hello");
        expect(tmpdir.read("value.txt")).toBe("hello");
      });
      """
    When I run the test suite
    Then 1 test passes

  @modifiers
  Scenario: A skipped test does not fail the run on a misspelled fixture
    Given a project with bun-test-utils preloaded
    And the file "modifiers.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";

      test.skip("names a fixture that does not exist", async ({ tmpdri }) => {
        console.log("BODY", tmpdri);
      });

      test("runs", () => {});
      """
    When I run the test suite
    Then 1 test passes
    And the output does not contain "unknown fixture"

  @modifiers
  Scenario: test.only selects a single test and keeps its fixtures
    Given a project with bun-test-utils preloaded
    And the file "modifiers.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";

      test.only("selected", async ({ tmpdir }) => {
        tmpdir.write("a.txt", "selected");
        console.log("SELECTED", tmpdir.read("a.txt"));
      });

      test("not selected", () => {
        console.log("OTHER");
      });
      """
    When I run the test suite with CI disabled
    Then the output contains "SELECTED selected"
    And the output does not contain "OTHER"

  @tags
  Scenario: A positive tag filter selects tests and reports the rest as skipped
    Given a project with bun-test-utils preloaded
    And the file "tags.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";

      test("untagged", () => {
        console.log("UNTAGGED");
      });

      test("fast", async ({ tmpdir }) => {
        tmpdir.write("fast.txt", "yes");
        console.log("FAST", tmpdir.read("fast.txt"));
      }, { tags: ["fast"] });

      test("slow", () => {
        console.log("SLOW");
      }, { tags: ["slow"] });
      """
    When I run the test suite with BUN_TEST_UTILS_TAGS set to "fast"
    Then 1 test passes
    And the output contains "FAST yes"
    And the output contains "2 skip"
    And the output does not contain "UNTAGGED"
    And the output does not contain "SLOW"

  @tags
  Scenario: An exclusion skips only the excluded tag
    Given a project with bun-test-utils preloaded
    And the file "tags.test.ts":
      """
      import { test } from "@archont561/bun-test-utils";

      test("untagged", () => {
        console.log("UNTAGGED");
      });

      test("slow", () => {
        console.log("SLOW");
      }, { tags: ["slow"] });
      """
    When I run the test suite with BUN_TEST_UTILS_TAGS set to "!slow"
    Then 1 test passes
    And the output contains "UNTAGGED"
    And the output contains "1 skip"
    And the output does not contain "SLOW"
