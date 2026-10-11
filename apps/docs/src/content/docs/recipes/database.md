---
title: Database fixture
description: A database that opens once per file, a user fixture that depends on it, and a teardown that runs even when a test fails.
status: stable
since: 0.1.0
---

This recipe builds the shape most suites need first: one connection pool per
test file, one row or record per test, and cleanup that runs whatever the test
does. The samples below use an in-memory store so they run as written; the
[real driver](#swapping-in-a-real-driver) swap is three lines.

## The fixture module

```ts title="test.ts" runnable
import { test as base } from "@archont561/bun-test-utils";

export interface User {
  id: number;
  name: string;
}

export interface Database {
  insertUser(name: string): Promise<User>;
  findUser(id: number): Promise<User | undefined>;
  close(): Promise<void>;
}

export function createDatabase(): Database {
  const users = new Map<number, User>();
  let nextId = 1;
  return {
    async insertUser(name) {
      const user = { id: nextId++, name };
      users.set(user.id, user);
      return user;
    },
    async findUser(id) {
      return users.get(id);
    },
    async close() {
      users.clear();
    },
  };
}

export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const database = createDatabase();
      await use(database);
      await database.close();
    },
  },
  user: {
    setup: async (use, { database }) => {
      await use(await database.insertUser("Ada"));
    },
  },
});
```

Three decisions are visible in that file, and each is deliberate:

- **`database` is `file`-scoped.** One connection pool per file is the usual
  trade: the pool's setup cost is paid once per file instead of once per test,
  while files stay isolated from each other.
- **`user` is `test`-scoped (the default) and depends on `database`.** Each
  test gets its own row, inserted before the test body and cleaned up with it.
  Because `user` names `database` in its `setup` signature, the engine builds
  the database first.
- **Teardown lives after `await use(...)`.** Deleting the row, rolling back the
  transaction, or closing the pool happens in reverse order of setup.

## The tests

```ts title="users.test.ts" runnable
import { expect } from "@archont561/bun-test-utils";
import { test } from "./test";

test("the user fixture is stored", async ({ database, user }) => {
  expect(await database.findUser(user.id)).toEqual({ id: user.id, name: "Ada" });
});

test("the database is shared by the whole file", async ({ database }) => {
  expect(await database.findUser(1)).toBeDefined();
});
```

The second test passes because `database` is file-scoped: it is the same
instance the first test wrote to. Had `database` been test-scoped, this test
would see an empty store — which is exactly the isolation some suites want. The
[scopes decision table](/bun-test-utils/fundamentals/scopes-and-teardown/#the-decision)
covers the trade.

## Cleanup the tests cannot leak

Two failure modes are worth designing for up front:

- **A test that fails mid-transaction.** Teardown after `use` still runs, so a
  `rollback()` there is reached even when the body throws.
- **A test that leaves a row behind after a failed teardown.** If the teardown
  itself throws while the test already failed, the test's own error is the one
  reported, and the teardown error is attached as `suppressed` — see
  [When a teardown fails](/bun-test-utils/fundamentals/scopes-and-teardown/#when-a-teardown-fails).
  Fix the teardown rather than ignoring it: a swallowed cleanup error turns into
  cross-test pollution later.

Sessions are usually the wrong scope for a pool in a suite with many files:
`session` teardown runs after the last file, so every file shares one pool and
one rollback boundary. Use `file` unless the pool is genuinely expensive to
create.

## Swapping in a real driver

Replace the in-memory helpers with your client's, keeping the two fixture
shapes. With a SQL driver, the only structural change is that setup awaits a
connection and teardown closes it:

```ts title="test.ts" illustrative
import { test as base } from "@archont561/bun-test-utils";
import { SQL } from "bun"; // or pg, mysql2, better-sqlite3, …

export const test = base.extend({
  database: {
    scope: "file",
    setup: async (use) => {
      const sql = new SQL(process.env.DATABASE_URL!);
      await sql`create table if not exists users (
        id serial primary key, name text not null
      )`;
      await use(sql);
      await sql.close();
    },
  },
  user: {
    setup: async (use, { database }) => {
      const [user] = await database`insert into users (name) values ('Ada') returning *`;
      await use(user);
      await database`delete from users where id = ${user.id}`;
    },
  },
});
```

The migration or schema step is what usually pushes a suite from `test` scope
to `file` scope: running DDL per test is slow, and running it once per file is
the smallest change that fixes it.

## Next steps

- [Scopes and teardown](/bun-test-utils/fundamentals/scopes-and-teardown/): the full decision table and cleanup rules.
- [Test server and HTTP mocks](/bun-test-utils/recipes/server-and-mocks/): the same shape for an HTTP API.
- [Debugging fixture failures](/bun-test-utils/recipes/debugging-fixture-failures/): what the errors mean when a fixture does not build.
