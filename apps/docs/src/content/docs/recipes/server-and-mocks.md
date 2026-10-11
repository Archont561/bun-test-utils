---
title: Test server and HTTP mocks
description: Serve your own routes on an ephemeral port and mock the third-party APIs behind them, in one test.
status: stable
since: 0.1.0
---

The integration shape most services need: your own code answers real HTTP
requests, and everything outside your boundary is mocked. `testServer` provides
the first half, `httpMock` the second, and neither needs a browser.

## The route module

```ts title="app.ts" runnable
export function routes(req: Request): Response {
  const url = new URL(req.url);
  if (url.pathname === "/users") {
    return Response.json({ users: [{ id: 1, name: "Ada" }] });
  }
  return new Response("Not found", { status: 404 });
}
```

Keep the handler a plain function of `Request` → `Response`. That is what
`Bun.serve` takes, and it is also what makes the handler testable without a
socket at all: you can call `routes(request)` directly and assert on the
`Response`.

## The test

```ts title="api.test.ts" runnable
import { expect, test } from "@archont561/bun-test-utils";
import { routes } from "./app";

test("serves a route and mocks an upstream", async ({ testServer, httpMock }) => {
  testServer.handle(routes);

  const response = await fetch(`${testServer.url}/users`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ users: [{ id: 1, name: "Ada" }] });

  httpMock.get(/^https:\/\/billing\.example\.com\//, () =>
    Response.json({ plan: "pro" }),
  );
  const plan = await fetch("https://billing.example.com/plan").then((r) => r.json());
  expect(plan.plan).toBe("pro");

  expect((await fetch(`${testServer.url}/missing`)).status).toBe(404);
});
```

What each fixture contributes:

- **`testServer`** binds a real socket on a random free port for the duration of
  the test, so parallel test files cannot collide and no port has to be
  configured. `handle(fn)` installs the handler; `url` and `port` are there when
  the code under test needs an origin.
- **`httpMock`** intercepts `globalThis.fetch` for the test, so the call to
  `billing.example.com` never leaves the process. The `RegExp` matcher is used
  deliberately: a bare `"https://billing.example.com"` string would be compared
  as a whole URL and would not match `/plan`.
- **`serverUrl`** exists for fixtures that need the origin as a dependency
  rather than the server object:

```ts title="client.ts" illustrative
import { test as base } from "@archont561/bun-test-utils";

export const test = base.extend({
  apiClient: {
    setup: async (use, { serverUrl }) => {
      await use(createClient({ baseUrl: serverUrl }));
    },
  },
});
```

## Real socket or mock?

| Question | `testServer` | `httpMock` |
| :-- | :-- | :-- |
| Is the code under test the HTTP layer? | Yes: it exercises real sockets, status codes, headers, streaming, and aborts | No: the request never becomes a socket |
| Does it need an origin for the code to talk to? | Yes | Only for absolute-URL matching |
| Is the third party involved? | No | Yes |
| Does it work with a browser page? | Yes, the page can `goto` the server's URL | With `httpMock.install(page)` or `browserHttpMock` |

Mixing them in one test is normal: your routes on the server, the internet
mocked.

## Testing the handler without a socket

For route-level unit tests, skip `testServer` and pass a `Request` directly:

```ts title="routes.test.ts" partial
import { expect, test } from "@archont561/bun-test-utils";
import { routes } from "./app";

test("an unknown route is a 404", async () => {
  const response = routes(new Request("http://localhost/missing"));
  expect(response.status).toBe(404);
});
```

That is faster and gives a clearer failure when the route itself is wrong.
Reach for `testServer` when the socket, the client, or concurrency is part of
what you are testing.

## Related

- [HTTP mocking and test servers](/bun-test-utils/capabilities/http-and-servers/): matcher semantics, `passthrough`, `calls()`, and combining with `networkGuard`.
- [Database fixture](/bun-test-utils/recipes/database/): the same shape for a data store.
- [HTTP, cassette, and browser API](/bun-test-utils/reference/http-and-browser/): every member of the server and mock fixtures.
