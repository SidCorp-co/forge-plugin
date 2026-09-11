/* The renew every payload write makes, against a stub tracker: which states it refuses and which it
   spends itself. The fifth dry run caught a dead run renewing its lease; the eleventh spent two
   rounds on `forge claim` after its own lease lapsed (ISS-65), and both rules are one decision. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { standsInNoTree, tempHome } from "../fixtures.mjs";

const HOME = tempHome("renew");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(
  join(HOME.path, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME.path;
standsInNoTree("renew");
process.env.FORGE_SESSION_ID = "this-run";
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";

const ISSUE = "22222222-2222-4222-8222-222222222222";

let field = null;
const sent = [];

const answer = (body) => ({ ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify(body) });

/* The read of the issue itself, which a case wanting to land something between two of them counts. */
const reads = (address, init = {}) =>
  (init.method ?? "GET") === "GET" && /^\/api\/issues\/[0-9a-f-]+$/u.test(new URL(address).pathname);

globalThis.fetch = async (address, init = {}) => {
  const url = new URL(address);
  if (url.pathname === "/api/projects") return answer([{ id: "p-1", slug: "forge-plugin" }]);
  if (url.pathname.endsWith("/comments")) {
    sent.push("forge_comments:list");
    return answer({ items: [], returned: 0, total: 0, limit: 0, offset: 0, hasMore: false });
  }
  if ((init.method ?? "GET") === "PATCH") {
    sent.push("forge_issues:update");
    field = JSON.parse(init.body).sessionContext ?? field;
    return answer({ id: ISSUE });
  }
  sent.push("forge_issues:get");
  return answer({ id: ISSUE, sessionContext: field });
};

const { leaseOf, renew, renewedLapsed, writeRefusal } = await import("../../src/flow/lease.mjs");

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const lease = (holder, at, history = []) =>
  ({ lease: { holder, agent: "a-test-agent", pid: "4242", renewedAt: at, minutes: 30, next: "fold F1", history } });

const said = async (run) => {
  const lines = [];
  const held = console.error;
  console.error = (line) => lines.push(line);
  try {
    return { answer: await run(), lines };
  } finally {
    console.error = held;
  }
};

const refused = async (run) => {
  const held = process.exit;
  const stderr = console.error;
  let message = null;
  process.exit = () => {
    throw new Error("exited");
  };
  console.error = (line) => {
    message ??= line;
  };
  try {
    await run();
    return null;
  } catch {
    return message;
  } finally {
    process.exit = held;
    console.error = stderr;
  }
};

test("a lease inside its window renews with nothing said about it", async () => {
  field = lease("this-run", ago(1));
  const { lines } = await said(() => renew(ISSUE, "ISS-65"));
  assert.deepEqual(lines.filter((one) => /lease/u.test(one)), [], "a renew in the ordinary case is not news");
  assert.equal(leaseOf(field).next, "fold F1", "and the line the last write left is kept");
});

/* The round this removes: the refusal named `forge claim`, which the write can make itself, because
   the field still naming this session is proof no other run took the issue. */
test("the holder's own lapsed lease is renewed at the write, and the write says so on one line", async () => {
  field = lease("this-run", ago(45));
  const { lines } = await said(() => renew(ISSUE, "ISS-65"));
  const notice = lines.find((one) => one.includes("had expired"));
  assert.ok(notice, `nothing said it renewed a lapsed lease: ${lines.join(" | ")}`);
  assert.match(notice, /your lease on ISS-65 had expired at 20\d\d-\d\d-\d\dT\d\d:\d\d/u);
  assert.match(notice, /no other run had taken the issue/u, "and why that is safe");
  assert.equal(leaseOf(field).holder, "this-run", "the lease is the same holder's");
  assert.deepEqual(leaseOf(field).history, [], "a reclaim is a handoff and this was none");
  assert.ok(Date.parse(leaseOf(field).renewedAt) > Date.now() - 60_000, "and the window starts again");
});

/* The notice says the write renewed it, so it waits for the write and its read-back: a claim printed
   before the update is one a failed update would leave standing (F1 of the last recheck). */
test("the notice is said after the write, not before it", async () => {
  field = lease("this-run", ago(45));
  const stub = globalThis.fetch;
  const order = [];
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method ?? "GET") === "PATCH") order.push("write");
    return stub(url, init);
  };
  const held = console.error;
  console.error = (line) => order.push(line.includes("had expired") ? "notice" : "other");
  try {
    await renew(ISSUE, "ISS-65");
  } finally {
    console.error = held;
    globalThis.fetch = stub;
  }
  assert.deepEqual(order.filter((one) => one !== "other"), ["write", "notice"]);
});

/* The wave case, which is the one the refusal was built for and the one it never reached: two runs
   of one dispatched wave carry the same inherited id, so `stateOf` reads the other's lease as this
   run's own. Both directions, because the refusal is reachable only once two runs are two ids
   (ISS-445). */
test("a payload write is refused across two ids and goes through across one shared", async () => {
  const env = { asked: process.env.FORGE_SESSION_ID, harness: process.env.CLAUDE_CODE_SESSION_ID };
  try {
    process.env.FORGE_SESSION_ID = "run-two";
    delete process.env.CLAUDE_CODE_SESSION_ID;
    field = lease("run-one", ago(1));
    const refusal = await refused(() => renew(ISSUE, "ISS-445"));
    assert.match(refusal, /ISS-445 is held by another run/u, "two runs, two holders, and the guard fires");
    assert.match(refusal, /run-one/u, "naming which run holds it");
    assert.equal(leaseOf(field).holder, "run-one", "and nothing of run two's was written");

    delete process.env.FORGE_SESSION_ID;
    process.env.CLAUDE_CODE_SESSION_ID = "the-dispatching-session";
    field = lease("the-dispatching-session", ago(1));
    const { lines } = await said(() => renew(ISSUE, "ISS-445"));
    assert.equal(leaseOf(field).holder, "the-dispatching-session",
      "one id between two runs, and the second writes over the first unrefused: the defect itself");
    assert.ok(Date.parse(leaseOf(field).renewedAt) > Date.now() - 60_000, "having renewed what it read as its own");
    assert.deepEqual(lines.filter((one) => /dispatched/u.test(one)), [],
      "and the write path stays silent: what a run is told about a shared id is said where it claims and reads");
  } finally {
    for (const [key, was] of [["FORGE_SESSION_ID", env.asked], ["CLAUDE_CODE_SESSION_ID", env.harness]]) {
      if (was === undefined) delete process.env[key]; else process.env[key] = was;
    }
  }
});

test("another run's lease is refused as it was, live or expired", async () => {
  field = lease("the-other-run", ago(1));
  const live = await refused(() => renew(ISSUE, "ISS-65"));
  assert.match(live, /ISS-65 is held by another run/u);
  assert.match(live, /forge claim ISS-65/u, "and the one command that clears it");
  field = lease("the-other-run", ago(45));
  const stale = await refused(() => renew(ISSUE, "ISS-65"));
  assert.match(stale, /the lease on ISS-65 is another run's and has expired/u);
  assert.equal(leaseOf(field).holder, "the-other-run", "and neither refusal wrote anything");
});

/* The state another run may legally take is the one where a takeover can land mid-check, so it is
   read twice and the second read is what the write is built on. */
test("a reclaim landing during the check is seen by the second read, and refuses", async () => {
  field = lease("this-run", ago(45));
  const held = globalThis.fetch;
  let gets = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (reads(url, init)) {
      gets += 1;
      if (gets === 2) field = lease("the-other-run", ago(0));
    }
    return held(url, init);
  };
  try {
    const said = await refused(() => renew(ISSUE, "ISS-65"));
    assert.match(said, /ISS-65 is held by another run/u, "the run that took it over is not written over");
    assert.equal(gets, 2, "two reads for a lapsed lease, and the second is the one that decides");
    assert.equal(leaseOf(field).holder, "the-other-run");
  } finally {
    globalThis.fetch = held;
  }
});

/* The read that decides has to be the last read there was: the comment gate is a round trip of its
   own, and a reclaim landing during it would be written over (F3 of the whole-set review). */
test("the comment gate runs before the read that decides, not after it", async () => {
  field = lease("this-run", ago(45));
  sent.length = 0;
  await said(() => renew(ISSUE, "ISS-65"));
  const reads = sent.filter((one) => /:get$|forge_comments:list/u.test(one));
  assert.deepEqual(reads, ["forge_issues:get", "forge_comments:list", "forge_issues:get", "forge_issues:get"],
    "the state, the gate, the state again, then the write and its read-back");
});

test("a lease inside its window is read once, because nobody may take it", async () => {
  field = lease("this-run", ago(1));
  sent.length = 0;
  await said(() => renew(ISSUE, "ISS-65"));
  assert.deepEqual(sent.filter((one) => one.endsWith(":get")), ["forge_issues:get", "forge_issues:get"],
    "the read before the write and the read-back after it, and no third");
});

/* The last read is the whole authority, or the notice claims of a lease that is gone what only that
   read could say (F1 of the final review). */
test("a lease cleared between the two reads is free, and refuses", async () => {
  field = lease("this-run", ago(45));
  const stub = globalThis.fetch;
  let gets = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (reads(url, init)) {
      gets += 1;
      if (gets === 2) field = null;
    }
    return stub(url, init);
  };
  try {
    assert.match(await refused(() => renew(ISSUE, "ISS-65")), /carries no lease/u);
    assert.equal(field, null, "and nothing was written over the cleared field");
  } finally {
    globalThis.fetch = stub;
  }
});

test("an issue nobody claimed refuses the write, because a payload is the holder's", async () => {
  field = null;
  assert.match(await refused(() => renew(ISSUE, "ISS-65")), /carries no lease/u);
});

/* The one conditional renewal, and the default that keeps it from being one. `forge comment` posts
   for the holder and for whoever found something; every other payload write asks for nothing and
   keeps the refusal, because `writeField` awaits this and reads none of what it answers. */
test("the finder option renews the holder's lease and answers that it did", async () => {
  field = lease("this-run", ago(1));
  const { answer } = await said(() => renew(ISSUE, "ISS-348", undefined, null, { finder: true }));
  assert.ok(answer, "asked for or not, a lease of this run's is renewed");
  /* The answer is the `sessionContext` this renewal SENT, which is what the write after it is
     conditional on: a boolean would say it happened and leave that write nothing to expect. */
  assert.deepEqual(answer, field, "and what it answers is the value it left, not that it left one");
  assert.equal(leaseOf(field).holder, "this-run");
  assert.ok(Date.parse(leaseOf(field).renewedAt) > Date.now() - 60_000, "and the window starts again");
});

test("the finder option answers false on another run's lease and writes nothing", async () => {
  for (const minutes of [1, 45]) {
    field = lease("the-other-run", ago(minutes));
    const before = leaseOf(field).renewedAt;
    sent.length = 0;
    const { answer } = await said(() => renew(ISSUE, "ISS-348", undefined, null, { finder: true }));
    assert.equal(answer, false, `${minutes} minute(s) old: a finder is told, not refused`);
    assert.equal(leaseOf(field).renewedAt, before, "and the other run's lease is untouched");
    assert.deepEqual(sent.filter((one) => one.endsWith(":update")), [], "no write of any kind");
  }
});

test("the finder option answers false where nobody holds it, and takes nothing", async () => {
  field = null;
  const { answer } = await said(() => renew(ISSUE, "ISS-348", undefined, null, { finder: true }));
  assert.equal(answer, false, "a comment on an issue nobody holds is nobody's claim");
  assert.equal(field, null, "and a finder claims none");
});

/* The reason the reading is inside `renew` and not in front of it: a caller that classified first
   would have one read, and a handoff landing between it and the write would pass for a renewal. */
test("a handoff landing after the finder's first read is refused, comment and lease alike", async () => {
  field = lease("this-run", ago(45));
  const stub = globalThis.fetch;
  let gets = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (reads(url, init)) {
      gets += 1;
      if (gets === 2) field = lease("the-other-run", ago(0));
    }
    return stub(url, init);
  };
  try {
    const message = await refused(() => renew(ISSUE, "ISS-348", undefined, null, { finder: true }));
    assert.match(message, /ISS-348 is held by another run/u, "the option does not reach the second read");
    assert.equal(gets, 2, "which is still made, lapsed being the state another run may take");
    assert.equal(leaseOf(field).holder, "the-other-run", "and nothing of this run's was written over it");
  } finally {
    globalThis.fetch = stub;
  }
});

/* The default is what every field write inherits, and inheriting `false` would be a licence. */
test("no caller gets the finder branch without asking, whatever else it passes", async () => {
  for (const argv of [[], [undefined, null], ["a next line", { open: ["x"] }], [undefined, null, {}]]) {
    field = lease("the-other-run", ago(1));
    const message = await refused(() => renew(ISSUE, "ISS-348", ...argv));
    assert.match(message ?? "", /ISS-348 is held by another run/u, JSON.stringify(argv));
  }
});

test("the notice names the lease and the refusals stay four", () => {
  const held = { holder: "this-run", agent: "a-test-agent", pid: "4242", renewedAt: ago(45), minutes: 30, history: [] };
  assert.match(renewedLapsed("ISS-65", held), /read before it still named this-run/u);
  for (const state of ["free", "live", "expired"]) {
    assert.match(writeRefusal(state, "ISS-65", held), /forge claim ISS-65/u, state);
  }
  assert.throws(() => writeRefusal("lapsed", "ISS-65", held), /not a function/u,
    "and `lapsed` is no longer a refusal at all, which is the change this file exists for");
});
