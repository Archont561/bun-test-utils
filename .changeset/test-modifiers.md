---
"@archont561/bun-test-utils": minor
---

`test` now carries Bun's test modifiers, so a test can be skipped, focused, or
marked as todo without giving up fixtures: `test.skip`, `test.only`,
`test.todo`, `test.failing`, `test.concurrent`, `test.serial`, and the
conditional `test.if`, `test.skipIf`, `test.todoIf`, `test.failingIf`,
`test.concurrentIf`, and `test.serialIf`. Each takes the same
`(name, fn, options?)` triple as `test`, so fixtures are injected and torn down
exactly as before, and skipped declarations never resolve their fixtures — a
`test.skipIf(process.platform !== "linux")` test may name a Linux-only fixture.
`test.each` and `describe.each` are not part of this change.
