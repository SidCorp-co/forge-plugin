/* The compare-and-set on the wire: what each write carries, what establishes that the far end
   honours it, and which read-back stops being spent once it does. Every case drives the real
   writer against a stub tracker that answers as one of the four far ends this can meet. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("precondition");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(join(HOME.path, "forge", "config.json"), JSON.stringify({ url: "https://stub.example/mcp", token: "t" }));
process.env.XDG_CONFIG_HOME = HOME.path;
process.env.FORGE_SESSION_ID = "this-run";
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";

const ISSUE = "22222222-2222-4222-8222-222222222222";
const MOVED_SAID = "`sessionContext` no longer holds the value this write expected — another writer "
  + "moved it. Re-read it from `details.current`, decide whether your claim still stands, and send "
  + "the write again with the new `expect`.";

const leaseFor = (holder, next = null) => ({
  lease: {
    holder, agent: "a-test-agent", pid: "4242", next,
    renewedAt: new Date().toISOString(), minutes: 30, history: [],
  },
});

/* What the far end is, what it holds, and what every call it was made carried. `afterLease` is the
   hook a race needs: it runs once, after a renewal has landed and before the payload write it
   precedes — which is the window a read-back after the payload could never have refused. */
let far = "enforces";
let field = null;
let stored = {};
let sent = [];
let got = 0;
let afterLease = null;

/* Key-order-blind, as the tracker's jsonb comparison is: an order-sensitive stub would refuse a
   write the real far end takes, and a case would pass for the wrong reason. */
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

const answer = (body, status = 200) => ({
  ok: status < 400, status, headers: new Map(), text: async () => JSON.stringify(body),
});

const refusal = (code, message, details) => answer({ code, message, details }, code === "BAD_REQUEST" ? 400 : 409);

const patched = (body) => {
  sent.push(body);
  const expected = body.expect;
  if (expected && far === "strict") {
    return answer({ code: "BAD_REQUEST", message: "Invalid input",
      details: { formErrors: ["Unrecognized key: \"expect\""], fieldErrors: {} } }, 400);
  }
  if (expected && far === "down") return answer({ code: "SERVICE_UNAVAILABLE", message: "no" }, 503);
  if (expected && far === "enforces" && canonical(expected.sessionContext ?? null) !== canonical(field)) {
    return refusal("SESSION_CONTEXT_MISMATCH", MOVED_SAID, { current: field });
  }
  const columns = Object.fromEntries(Object.entries(body).filter(([key]) => key !== "expect"));
  if (columns.sessionContext !== undefined) field = columns.sessionContext;
  stored = { ...stored, ...columns };
  const landed = answer({ id: ISSUE, ...stored, sessionContext: field });
  if (columns.sessionContext !== undefined && afterLease) {
    const move = afterLease;
    afterLease = null;
    move();
  }
  return landed;
};

globalThis.fetch = async (address, init = {}) => {
  const url = new URL(address);
  if (url.pathname === "/api/projects") return answer([{ id: "p-1", slug: "forge-plugin" }]);
  if (url.pathname.endsWith("/comments")) {
    return answer({ items: [], returned: 0, total: 0, limit: 0, offset: 0, hasMore: false });
  }
  if ((init.method ?? "GET") === "PATCH") return patched(JSON.parse(init.body));
  got += 1;
  return answer({ id: ISSUE, ...stored, sessionContext: field });
};

const { enforcementOf, forgetEnforcement, writeField } = await import("../../src/tracker/field-write.mjs");

class Refused extends Error {}
const refuse = (message) => {
  throw new Refused(message);
};

const fresh = (mode, held = leaseFor("this-run")) => {
  far = mode;
  field = held;
  stored = { plan: null };
  sent = [];
  got = 0;
  afterLease = null;
  forgetEnforcement();
};

const unconditional = () => sent.filter((one) => one.expect === undefined).length;
const preconditions = () => sent.filter((one) => one.expect !== undefined).map((one) => one.expect.sessionContext);
const reads = () => got;

const claiming = (held = field, options = {}) =>
  writeField(ISSUE, "sessionContext", { ...held, lease: { ...held.lease, next: "fold F1" } },
    { ref: "ISS-9", refuse, expect: () => held, ...options });

/* Two routes out of a refused write: the caller's own `refuse`, and the transport's `fail`, which
   prints and exits. A case that reads only one of them cannot tell a refusal from a landing. */
const said = async (run) => {
  const heldExit = process.exit;
  const heldError = console.error;
  let printed = null;
  process.exit = () => {
    throw new Refused(printed ?? "exited");
  };
  console.error = (line) => {
    printed = String(line);
  };
  try {
    await run();
    return null;
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    return error.message;
  } finally {
    process.exit = heldExit;
    console.error = heldError;
  }
};

test("the lease's own write carries the value the run read, once the far end is known to enforce it", async () => {
  fresh("enforces");
  const read = field;
  await claiming(read);
  assert.equal(enforcementOf(), true, "the establishing write's refusal settled it");
  const carried = preconditions();
  assert.equal(carried.length, 2, "the establishing write and the write it was owed");
  assert.notDeepEqual(carried[0], read, "the first carried a value the field cannot be holding");
  assert.deepEqual(carried[1], read, "and the second carried exactly what was read");
  const again = field;
  await claiming(again);
  assert.deepEqual(preconditions().at(-1), again, "and every write after it carries the value it read");
  assert.equal(preconditions().length, 3, "one more write, one more precondition, and no second asking");
});

test("only the tracker's own mismatch establishes enforcement, and a write that succeeded never does", async () => {
  fresh("ignores");
  await claiming();
  assert.equal(enforcementOf(), false, "a far end that took the key and ignored it enforces nothing");
  assert.equal(preconditions().length, 1, "and the write it performed is the caller's own, not sent again");
  assert.equal(sent.filter((one) => one.expect === undefined).length, 0, "nothing went out a second time");
});

test("a refusal of the body offers it again without the key, and only a landing settles the question", async () => {
  fresh("strict");
  await claiming();
  assert.equal(enforcementOf(), false, "the second write landed, so the key was the reason");
  assert.equal(preconditions().length, 1, "one write carried the expectation");
  assert.equal(unconditional(), 1, "and one carried none");
});

test("a refusal that is neither settles nothing, sends no second write, and is the caller's", async () => {
  fresh("down");
  const message = await said(() => claiming());
  assert.equal(enforcementOf(), null, "a 503 says no more about the schema than a credential does");
  assert.match(String(message), /SERVICE_UNAVAILABLE/u, "and the far end's own refusal is what the caller reads");
  assert.equal(unconditional(), 0, "no second write with no expectation at all went out");
  assert.equal(sent.length, 1, "one write was made and no other");
});

test("the refusal on a moved field is the tracker's sentence and nothing of this CLI's after it", async () => {
  fresh("enforces");
  await claiming();
  const stale = leaseFor("some-other-run");
  const message = await said(() => claiming(stale));
  assert.match(String(message), /^SESSION_CONTEXT_MISMATCH: /u, "the code the tracker returned heads it");
  assert.ok(String(message).endsWith(MOVED_SAID), "and the tracker's own words end it, with nothing appended");
});

test("the payload write carries the sessionContext its own renewal sent, and a moved one does not land", async () => {
  fresh("enforces");
  await writeField(ISSUE, "plan", "a plan with words in it", { ref: "ISS-9", refuse });
  const carried = preconditions().at(-1);
  assert.equal(carried.lease.holder, "this-run", "the payload rode on the lease the renewal had just written");
  assert.equal(stored.plan, "a plan with words in it", "and it landed");

  fresh("enforces");
  await claiming();
  afterLease = () => {
    field = leaseFor("some-other-run");
  };
  const message = await said(() => writeField(ISSUE, "plan", "a second plan", { ref: "ISS-9", refuse }));
  assert.match(String(message), /SESSION_CONTEXT_MISMATCH/u, "the payload write is the one refused");
  assert.notEqual(stored.plan, "a second plan", "and the plan did not land");
});

test("the lease's read-back is spent only where the tracker refuses no stale write", async () => {
  fresh("enforces");
  await claiming();
  assert.equal(reads(), 0, "the tracker made the comparison, so nothing read the field back");

  fresh("ignores");
  await claiming();
  assert.equal(reads(), 1, "the read-back is the only comparison left, so it is spent");
  assert.equal(preconditions().length, 1, "the establishing write, which is the last precondition sent");

  await claiming();
  assert.equal(preconditions().length, 1, "and no write after the question was settled sends one");
});

/* A content field's read-back answers whether the text landed, which is not the question a
   precondition answers, so it is the one read that stays whichever far end this is. Counted rather
   than asserted of the landing, which would be true either way and pin nothing. */
test("a content field's read-back is spent whichever the far end is, and only the lease's stops", async () => {
  fresh("enforces");
  await writeField(ISSUE, "plan", "a plan with words in it", { ref: "ISS-9", refuse });
  assert.equal(stored.plan, "a plan with words in it", "the plan landed");
  assert.equal(reads(), 2, "the renewal's own read and the plan's read-back, the lease's having stopped");

  fresh("ignores");
  await writeField(ISSUE, "plan", "a plan with words in it", { ref: "ISS-9", refuse });
  assert.equal(stored.plan, "a plan with words in it", "the plan landed here too");
  assert.equal(reads(), 3, "and the lease's read-back is spent beside it, being the only comparison left");
});
