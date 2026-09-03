/* The renew every payload write makes, against a stub tracker: which states it refuses and which it
   spends itself. The fifth dry run caught a dead run renewing its lease; the eleventh spent two
   rounds on `forge claim` after its own lease lapsed (ISS-65), and both rules are one decision. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("renew");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(
  join(HOME.path, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME.path;
process.env.FORGE_SESSION_ID = "this-run";
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";

const ISSUE = "22222222-2222-4222-8222-222222222222";
const DECLARED = [
  { name: "forge_issues", inputSchema: { properties: {} } },
  { name: "forge_comments", inputSchema: { properties: {} } },
];

let field = null;
const sent = [];

globalThis.fetch = async (url, init) => {
  const call = JSON.parse(init.body);
  const args = call.params?.arguments ?? {};
  let result = { tools: DECLARED };
  if (call.method === "tools/call") {
    sent.push(`${call.params.name}:${args.action}`);
    if (args.action === "list") result = { structuredContent: { comments: [], returned: 0, limit: 200 } };
    if (args.action === "get") result = { structuredContent: { documentId: ISSUE, sessionContext: field } };
    if (args.action === "update") {
      field = args.data.sessionContext ?? field;
      result = { structuredContent: { documentId: ISSUE } };
    }
  }
  return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result }) };
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
  globalThis.fetch = async (url, init) => {
    const call = JSON.parse(init.body);
    if (call.params?.arguments?.action === "get") {
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

test("a lease inside its window is read once, because nobody may take it", async () => {
  field = lease("this-run", ago(1));
  sent.length = 0;
  await said(() => renew(ISSUE, "ISS-65"));
  assert.deepEqual(sent.filter((one) => one.endsWith(":get")), ["forge_issues:get", "forge_issues:get"],
    "the read before the write and the read-back after it, and no third");
});

test("an issue nobody claimed refuses the write, because a payload is the holder's", async () => {
  field = null;
  assert.match(await refused(() => renew(ISSUE, "ISS-65")), /carries no lease/u);
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
