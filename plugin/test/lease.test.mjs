/* A run that dies mid-issue leaves nothing behind but the field, so every decision the lease makes
   is read from that field alone and each rule below fails without the check behind it (ISS-4). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "lease-"));
const {
  ADVISORY, MINUTES, RECLAIMS_BEFORE_PARK, canonical, claimRefusal, claimed, describe, expiryOf,
  historyLine, leaseOf, parksAsCrashed, reclaimsOf, sessionOf, stateOf, writeRefusal,
} = await import("../src/lease.mjs");
const { retryOf } = await import("../src/rpc.mjs");
const { parkAnswers } = await import("../src/lease.mjs");
const { USAGE } = await import("../src/claim.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;
const AT = "2026-09-02T12:00:00.000Z";
const NOW = Date.parse(AT);
const field = (lease, extra = {}) => ({ ...extra, lease });
const held = (holder, at = AT, minutes = 30, history = []) => ({ holder, renewedAt: at, minutes, history });

test("a lease is read out of the field, and anything else in it is no lease", () => {
  assert.deepEqual(leaseOf(field(held("a-run"))), { holder: "a-run", renewedAt: AT, minutes: 30, history: [] });
  assert.equal(leaseOf(null), null, "an issue nobody claimed");
  assert.equal(leaseOf({ notes: "something else" }), null, "a field another client wrote");
  assert.equal(leaseOf(field({ renewedAt: AT })), null, "a lease with no holder holds nothing");
  assert.equal(leaseOf(field({ holder: "" })), null);
  assert.equal(leaseOf(field(held("a-run", AT, 0))).minutes, MINUTES, "a duration of nothing is the default");
  assert.deepEqual(leaseOf(field(held("a-run", AT, 30, "not a list"))).history, []);
});

test("the five states, and a lease past its duration is stale for its holder too", () => {
  assert.equal(stateOf(null, "mine", NOW), "free");
  assert.equal(stateOf(held("mine"), "mine", NOW), "mine");
  assert.equal(stateOf(held("other", AT, 30), "mine", NOW + 29 * 60_000), "live");
  assert.equal(stateOf(held("other", AT, 30), "mine", NOW + 31 * 60_000), "expired");
  assert.equal(stateOf(held("mine", AT, 30), "mine", NOW + 31 * 60_000), "lapsed",
    "the holder past its own duration cannot know whether another run took over");
  assert.equal(stateOf(held("other", "not a time"), "mine", NOW), "expired", "a renew time nobody can read is past");
  assert.equal(expiryOf(held("other", AT, 30)), NOW + 30 * 60_000);
});

test("every refusal names the holder, its renew time and the one command that clears it", () => {
  const lease = held("the-other-run");
  for (const said of [claimRefusal("ISS-4", lease), writeRefusal("live", "ISS-4", lease), writeRefusal("expired", "ISS-4", lease)]) {
    assert.match(said, /the-other-run/u, said);
    assert.match(said, /2026-09-02T12:00/u, said);
    assert.match(said, /forge claim ISS-4/u, said);
  }
  const free = writeRefusal("free", "ISS-4", null);
  assert.match(free, /forge claim ISS-4/u, "and a write with no lease at all says how to take one");
  assert.match(writeRefusal("lapsed", "ISS-4", lease), /your own lease on ISS-4 has expired[\s\S]*forge claim ISS-4/u);
  assert.match(describe(lease), /session the-other-run, renewed 2026-09-02T12:00 for 30 minute\(s\)/u);
});

/* Read from the history the claim just wrote rather than from the run making it: a park whose
   transition never landed is still owed, and the next claim is what owes it. */
test("the third reclaim of one status parks the issue, and other statuses do not count", () => {
  const history = (...how) => held("a-run", AT, 30, how.map(([one, status]) => ({ holder: one, at: AT, how: "reclaim", status })));
  assert.equal(reclaimsOf(history(), "open"), 0);
  assert.ok(!parksAsCrashed(null, "open"), "an issue nobody claimed has crashed nowhere");
  assert.ok(!parksAsCrashed(history(["a", "open"]), "open"), "one reclaim is a run resumed");
  assert.ok(!parksAsCrashed(history(["a", "open"], ["b", "open"]), "open"), `${RECLAIMS_BEFORE_PARK} is not the park`);
  assert.ok(parksAsCrashed(history(["a", "open"], ["b", "open"], ["c", "open"]), "open"), "the third is");
  assert.ok(!parksAsCrashed(history(["a", "open"], ["b", "open"], ["c", "developed"]), "developed"), "counted per status");
  const claims = held("a-run", AT, 30, ["a", "b", "c"].map((one) => ({ holder: one, at: AT, how: "claim", status: "open" })));
  assert.ok(!parksAsCrashed(claims, "open"), "a first claim is nobody's crash");
});

test("a park answered is a park not repeated, and a status dying again parks again", () => {
  const entry = (how, status) => ({ holder: "a-run", at: AT, how, status });
  const three = [1, 2, 3].map(() => entry("reclaim", "open"));
  const answered = held("a-run", AT, 30, [...three, entry("parked", "open")]);
  assert.equal(reclaimsOf(answered, "open"), 0, "the park answered those three");
  assert.ok(!parksAsCrashed(answered, "open"), "or a person resuming it would park it again at once");
  assert.ok(parksAsCrashed(held("a-run", AT, 30, [...answered.history, ...three]), "open"),
    "three more after the park, and the status is dying again");
  assert.ok(parksAsCrashed(held("a-run", AT, 30, [...three, entry("parked", "developed")]), "open"),
    "a park at another status answers nothing here");
});

/* A park's third write says the history is answered, and a run can die before it. The record is
   the checkpoint: a crashed park older than the reclaims it would answer answered an earlier crash. */
test("a park older than the crashes it would answer answers none of them", () => {
  const entry = (how, status, at) => ({ holder: "a-run", at, how, status });
  const three = ["10:00", "10:30", "11:00"].map((clock) => entry("reclaim", "open", `2026-09-02T${clock}:00.000Z`));
  const lease = held("a-run", AT, 30, three);
  assert.ok(parkAnswers(lease, "open", "2026-09-02T11:30:00.000Z"), "a park written after them is theirs");
  assert.ok(!parkAnswers(lease, "open", "2026-09-02T10:45:00.000Z"), "one written among them is an earlier crash's");
  assert.ok(!parkAnswers(lease, "open", null), "and a park with no time answers nothing");
  assert.ok(!parkAnswers(held("a-run", AT, 30, three.slice(0, 2)), "open", "2026-09-02T11:30:00.000Z"),
    "two reclaims earn no park to answer");
});

test("the claim history is appended by the write that made it, and a renew appends nothing", () => {
  const first = claimed(null, { holder: "one", at: AT, minutes: 30, how: "claim", status: "open" });
  assert.deepEqual(leaseOf(first).history, [{ holder: "one", at: AT, how: "claim", status: "open" }]);
  const again = claimed(first, { holder: "two", at: AT, minutes: 45, how: "reclaim", status: "open" });
  assert.equal(leaseOf(again).history.length, 2, "the history is the record of who held it when");
  assert.equal(leaseOf(again).minutes, 45);
  const renewed = claimed(again, { holder: "two", at: "2026-09-02T13:00:00.000Z", minutes: 45 });
  assert.equal(leaseOf(renewed).history.length, 2, "a renew is not a claim");
  assert.equal(leaseOf(renewed).renewedAt, "2026-09-02T13:00:00.000Z");
  let grown = null;
  for (let one = 0; one < 30; one += 1) {
    grown = claimed(grown, { holder: `run-${one}`, at: AT, minutes: 30, how: "reclaim", status: "open" });
  }
  assert.ok(leaseOf(grown).history.length <= 12, `${leaseOf(grown).history.length} entries is a field nobody reads`);
  assert.equal(leaseOf(grown).history.at(-1).holder, "run-29", "and the newest is kept");
});

test("the field's other keys survive a claim, because the field is not the lease's alone", () => {
  const next = claimed({ notes: "another client's", lease: held("one") }, { holder: "two", at: AT, minutes: 30, how: "reclaim", status: "open" });
  assert.equal(next.notes, "another client's");
  assert.equal(leaseOf(next).holder, "two");
});

test("the history goes in the park's reason as one line, which the record can read back", () => {
  const lease = held("a-run", AT, 30, [
    { holder: "one", at: AT, how: "reclaim", status: "open" },
    { holder: "two", at: AT, how: "reclaim", status: "developed" },
  ]);
  const line = historyLine(lease, "open");
  assert.equal(line, "reclaim by one at 2026-09-02T12:00");
  assert.ok(!line.includes("\n"), "a record's field is one line");
  assert.ok(!line.includes("; "), "and the separator between repeated values is not free to appear");
  assert.match(historyLine(lease, null), /reclaim by two/u, "unfiltered, it is the whole history");
});

/* The tracker answers with the object it stored, in its own key order: a plain serialisation of
   the two differed where nothing had changed, and the compare-and-set read as a lost race. */
test("the compare is key-order-blind and still sees a changed value", () => {
  assert.equal(canonical({ a: 1, b: [1, 2] }), canonical({ b: [1, 2], a: 1 }));
  assert.notEqual(canonical({ a: 1, b: [1, 2] }), canonical({ a: 1, b: [2, 1] }), "an array keeps its order");
  assert.notEqual(canonical({ lease: held("one") }), canonical({ lease: held("two") }));
  assert.equal(canonical(null), canonical(undefined), "no field and an empty field are one state");
});

test("the holder is the harness's session, then the caller's own, then a file", () => {
  const env = { ...process.env };
  process.env.FORGE_SESSION_ID = "asked-for";
  process.env.CLAUDE_CODE_SESSION_ID = "the-harness";
  assert.equal(sessionOf(), "asked-for", "a caller that means to be a second run says so");
  delete process.env.FORGE_SESSION_ID;
  assert.equal(sessionOf(), "the-harness");
  delete process.env.CLAUDE_CODE_SESSION_ID;
  const minted = sessionOf();
  assert.match(minted, /^machine-/u, "and outside a harness, a file names the machine");
  assert.equal(sessionOf(), minted, "which is stable, or every command would be a new run");
  Object.assign(process.env, env);
});

/* Retried where the tracker said it did not process the call, and where nothing is stored either
   way. A create whose answer was lost would post twice, and only the mark is idempotent. */
test("a call that may write is retried on one status, a read on the gateway's too", () => {
  const read = { arguments: { action: "get" } };
  const stores = { arguments: { action: "create", data: { body: "x" } } };
  const edge = { arguments: { action: "set_dependency", fromIssueId: "a", toIssueId: "b" } };
  assert.equal(retryOf(429, stores), "rate-limited");
  assert.equal(retryOf(429, read), "rate-limited");
  assert.equal(retryOf(502, read), "transient");
  assert.equal(retryOf(null, read), "transient", "a dropped socket answered nothing at all");
  assert.equal(retryOf(502, stores), null, "the write may have landed, so it is not sent again");
  assert.equal(retryOf(null, stores), null);
  assert.equal(retryOf(400, read), null, "a bad argument does not become good by being asked again");
  assert.equal(retryOf(403, read), null);
  assert.equal(retryOf(502, edge), null, "an action mutating outside `data` is no read");
  assert.equal(retryOf(502, {}), "transient", "and a call with no arguments asks the server for its list");
});

test("the verb says what to type, and says the lease is advisory", () => {
  const run = spawnSync(FORGE, ["claim", "-h"], { encoding: "utf8", env: process.env });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Usage: forge claim <uuid\|ISS-45> \[--minutes n\]/u);
  assert.match(run.stdout, /--minutes/u, "every flag it takes is on the line");
  assert.ok(run.stdout.includes(ADVISORY), "the output says what the lease cannot promise");
  assert.ok(USAGE.includes(ADVISORY));
  const wrong = spawnSync(FORGE, ["claim", "--minutes", "9"], { encoding: "utf8", env: process.env });
  assert.equal(wrong.status, 1, "the issue comes first, and a flag in its place is not one");
  assert.match(wrong.stderr, /claim takes the issue first/u);
});
