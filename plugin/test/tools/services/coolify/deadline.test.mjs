/* The clock on this client, against an instance that accepts the call and then says nothing. A
   config of its own, and the client imported after it: the number the refusal names is what these
   cases assert, and on a developer's machine the live config would be deciding it. */
import assert from "node:assert/strict";
import test from "node:test";
import { clearInterval, setInterval } from "node:timers";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { patience } from "../../../patience.mjs";

const HOME = tempRoom("coolify-deadline-home-");
mkdirSync(join(HOME, "forge"));
/* A deadline that fires is what proves the refusal, the way `retrySeconds: 0` proves the ladder's
   message: every stub below answers on a microtask or never, so nothing else reaches this number. */
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ waitSeconds: 0.05 }));
process.env.XDG_CONFIG_HOME = HOME;

const { Refusal, refusing } = await import("../../../../src/resolve/settings.mjs");
const { ask, session } = await import("../../../../src/tools/services/coolify/client.mjs");

const instance = () => session({ url: "https://coolify.test/api/v1", token: "tok-1" }, {});

const stub = (t, fetching) => {
  const kept = globalThis.fetch;
  globalThis.fetch = fetching;
  t.after(() => {
    globalThis.fetch = kept;
  });
};

/* A real stalled request holds a socket open; a stubbed one holds nothing, and the timer under
   `AbortSignal.timeout` is unref'd — so without this the loop drains before the clock fires. */
const awake = (t) => {
  const timer = setInterval(() => {}, 1000);
  t.after(() => clearInterval(timer));
};

const refused = async (run) => {
  try {
    await refusing(run);
  } catch (error) {
    assert.ok(error instanceof Refusal, `threw ${error}`);
    return error.message;
  }
  return assert.fail("nothing was refused");
};

test("an instance that never answers is refused inside the deadline, naming the request and the key", async (t) => {
  awake(t);
  let cancelled = false;
  stub(t, (url, init) => new Promise((done, no) => {
    init.signal.addEventListener("abort", () => {
      cancelled = true;
      no(init.signal.reason);
    });
  }));
  const began = Date.now();
  const said = await refused(() => ask(instance(), "POST", "/deploy", { query: { uuid: "a-in" } }));
  assert.ok(Date.now() - began < patience(3000), "a Coolify instance that never answers does not hold the caller open");
  assert.ok(cancelled, "and the request is aborted rather than left in flight");
  assert.match(said, /^coolify: did not answer POST https:\/\/coolify\.test\/api\/v1\/deploy\?uuid=a-in: /u, said);
  assert.match(said, /ran out after 0\.05s \(waitSeconds in config\.json\)/u,
    "the seconds it had and the key that raises them, which is the tracker's own number and wording");
});

/* Headers describe a request the server answered; a body that never arrives describes the connection
   dying before the answer got here, so the clock covers both rather than stopping at the status. */
test("a 200 whose body never arrives runs out on the same clock", async (t) => {
  awake(t);
  stub(t, async (url, init) => ({
    ok: true,
    status: 200,
    text: () => new Promise((done, no) => {
      init.signal.addEventListener("abort", () => no(init.signal.reason));
    }),
  }));
  const began = Date.now();
  const said = await refused(() => ask(instance(), "GET", "/deployments"));
  assert.ok(Date.now() - began < patience(3000), "a body that never arrives does not hold the caller open");
  assert.match(said,
    /^coolify: did not answer GET https:\/\/coolify\.test\/api\/v1\/deployments: ran out after 0\.05s \(waitSeconds in config\.json\)$/u,
    said);
});

/* The clock is the one failure this client could not report; every other one already had words, and
   wrapping those too would reword a refused connection for a change that does not own it. */
test("a failure that is not the clock's keeps the words it arrived with", async (t) => {
  stub(t, async () => {
    throw new TypeError("fetch failed");
  });
  const said = await refused(() => ask(instance(), "GET", "/version"));
  assert.equal(said, "coolify: cannot reach https://coolify.test/api/v1/version — fetch failed");
});

/* A body read that fails for its own reason left this client unwrapped before the clock arrived and
   still does: the stage is read off the response, not off the fact that something threw. */
test("a body failure that is not the clock's is thrown on as it arrived", async (t) => {
  stub(t, async () => ({
    ok: true,
    status: 200,
    text: async () => {
      throw new TypeError("terminated");
    },
  }));
  await assert.rejects(
    () => refusing(() => ask(instance(), "GET", "/version")),
    (error) => !(error instanceof Refusal) && error.message === "terminated",
  );
});
