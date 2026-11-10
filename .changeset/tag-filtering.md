---
"@archont561/bun-test-utils": minor
---

Tests can be tagged and selected without renaming or regexes. Declare
`test("name", fn, { tags: ["fast", "filesystem"] })` and select a subset with
`BUN_TEST_UTILS_TAGS`:

```bash
BUN_TEST_UTILS_TAGS=fast bun test            # only fast tests
BUN_TEST_UTILS_TAGS='!slow' bun test         # everything except slow
BUN_TEST_UTILS_TAGS='fast,!slow' bun test    # fast, excluding anything also slow
```

Filtered-out tests are reported as skipped and never resolve their fixtures.
Under a positive filter untagged tests are skipped too; with exclusions only
they keep running. Tags are per declaration — `describe` is not wrapped, so
there is no inheritance.
