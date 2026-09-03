/* A run that dies mid-issue leaves nothing behind but the field, so every decision the lease makes
   is read from that field alone and each rule below fails without the check behind it (ISS-4). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { tempHome } from "./fixtures.mjs";

const HOME = tempHome("lease");
process.env.XDG_CONFIG_HOME = HOME.path;
/* Fixed here, so what the lease says about its writer is the fixture's and not the suite runner's. */
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";
const {
  ADVISORY, MINUTES, RECLAIMS_BEFORE_PARK, agentOf, canonical, claimRefusal, claimed, describe,
  expiryOf, historyLine, leaseOf, nextLine, parksAsCrashed, pidOf, reclaimsOf, sessionOf, stateOf,
  writeRefusal,
} = await import("../src/flow/lease.mjs");
const { retryOf } = await import("../src/tracker/rpc.mjs");
const { parkAnswers } = await import("../src/flow/lease.mjs");
const { USAGE, nextLines, parkWrite } = await import("../src/flow/claim.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;
const AT = "2026-09-02T12:00:00.000Z";
const NOW = Date.parse(AT);
const field = (lease, extra = {}) => ({ ...extra, lease });
const held = (holder, at = AT, minutes = 30, history = []) =>
  ({ holder, agent: "a-test-agent", pid: "4242", renewedAt: at, minutes, next: null, history });

test("a lease is read out of the field, and anything else in it is no lease", () => {
  assert.deepEqual(leaseOf(field(held("a-run"))), {
    holder: "a-run", agent: "a-test-agent", pid: "4242", renewedAt: AT, minutes: 30, next: null, history: [],
  });
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
  assert.match(describe(lease), /session the-other-run \(a-test-agent, pid 4242\), renewed 2026-09-02T12:00 for 30 minute\(s\)/u);
});

/* A uuid places nobody: the run whose shell died in ISS-26 was named by one, and a person deciding
   whether to wait for it or take the issue could not tell what it was or whether it still ran. */
test("every refusal that names the holder names its agent and its process too", () => {
  const lease = leaseOf(field({ holder: "the-other-run", agent: "claude-code_2-1-258_agent", pid: 3830915, renewedAt: AT, minutes: 30 }));
  assert.equal(lease.pid, "3830915", "read back as a string, because printing it is all anything does");
  const said = [claimRefusal("ISS-4", lease), writeRefusal("live", "ISS-4", lease), writeRefusal("expired", "ISS-4", lease), writeRefusal("lapsed", "ISS-4", lease)];
  for (const one of said) {
    assert.match(one, /the-other-run/u, one);
    assert.match(one, /claude-code_2-1-258_agent/u, one);
    assert.match(one, /pid 3830915/u, one);
  }
  const older = leaseOf(field({ holder: "a-run", renewedAt: AT, minutes: 30 }));
  assert.equal(older.agent, "unknown", "a lease written before this change is still a lease");
  assert.equal(older.pid, "unknown");
  assert.equal(older.next, null, "and carries no line");
  assert.equal(leaseOf(field({ holder: "a-run", renewedAt: AT, minutes: 30, pid: "" })).pid, "unknown");
  assert.equal(agentOf(), "a-test-agent", "and what the writer is comes from the environment, never a file");
  assert.equal(pidOf(), "4242");
});

test("the next line is one line, trimmed, and an empty value clears it", () => {
  assert.equal(nextLine(undefined), undefined, "silence leaves whatever is there alone");
  assert.equal(nextLine(null), null, "and a caller that means to clear it says so");
  assert.equal(nextLine("  fold F2, then recheck the four files  "), "fold F2, then recheck the four files");
  assert.equal(nextLine(""), null);
  assert.equal(nextLine("   "), null);
});

/* claimed() rebuilds the lease from the keys it names, so a key it did not name was dropped by
   every renew: an input read and silently lost, the family ISS-2 found six of. */
test("a renew keeps the line the lease already held, and only a caller that says so clears it", () => {
  const first = claimed(null, { holder: "one", at: AT, minutes: 30, next: "write the review record", how: "claim", status: "in_progress" });
  assert.equal(leaseOf(first).next, "write the review record");
  const renewed = claimed(first, { holder: "one", at: AT, minutes: 30 });
  assert.equal(leaseOf(renewed).next, "write the review record", "a payload write is not a new step");
  const replaced = claimed(renewed, { holder: "one", at: AT, minutes: 30, next: "recheck the eight files" });
  assert.equal(leaseOf(replaced).next, "recheck the eight files");
  const cleared = claimed(replaced, { holder: "one", at: AT, minutes: 30, next: null });
  assert.equal(leaseOf(cleared).next, null, "which is what a transition passes, because that step is over");
});

/* Where each attempt died is the line the run that died left, never the one its successor is about
   to set: the sixth dry run lost only which codex round it was in, and this is that fact. */
test("the history entry carries the line current before the reclaim, not the one after it", () => {
  const first = claimed(null, { holder: "one", at: AT, minutes: 30, next: "fold F1", how: "claim", status: "in_progress" });
  const second = claimed(first, { holder: "two", at: AT, minutes: 30, next: "start over", how: "reclaim", status: "in_progress" });
  const entries = leaseOf(second).history;
  assert.equal(entries[0].next, null, "nobody had left a line when the issue was first claimed");
  assert.equal(entries[1].next, "fold F1", "the reclaim records where the run it took over from was");
  assert.equal(leaseOf(second).next, "start over", "while the lease itself carries the new holder's");
});

test("the lease says which agent and which process wrote it, whatever holder it is given", () => {
  const written = leaseOf(claimed(null, { holder: "one", at: AT, minutes: 30, how: "claim", status: "open" }));
  assert.equal(written.agent, "a-test-agent");
  assert.equal(written.pid, "4242", "read here, so no caller can write an identity it does not have");
});

/* A reclaim takes over a line and may set its own, and the two are not one fact: saying the dead
   run left the note its successor wrote is the provenance falsified. */
test("a reclaim reads out the line it took over and the line it took on, and tells them apart", () => {
  assert.deepEqual(nextLines("reclaim", "fold F1", "fold F1"), ["Next, left by the run before: fold F1"],
    "carried on unchanged, it is one line and one provenance");
  assert.deepEqual(nextLines("reclaim", "fold F1", "start over"),
    ["Next, left by the run before: fold F1", "Next: start over"]);
  assert.deepEqual(nextLines("reclaim", null, "start over"), ["Next: start over"],
    "a run that left nothing is not quoted as having left something");
  assert.deepEqual(nextLines("claim", null, null), [], "and an issue with no line says nothing about one");
  assert.deepEqual(nextLines("claim", null, "write the plan"), ["Next: write the plan"]);
});

/* Three writes make a park and the third carried the field it read before the second: it put back
   the line the transition had just cleared. */
test("the write that acknowledges a park clears the line, as its transition did", () => {
  const holding = claimed(null, { holder: "one", at: AT, minutes: 30, next: "fold F1", how: "claim", status: "in_progress" });
  const parked = claimed(holding, { ...parkWrite(leaseOf(holding)), how: "parked", status: "in_progress" });
  assert.equal(leaseOf(parked).next, null, "a park is a transition, and the step it left is over");
  assert.equal(leaseOf(parked).history.at(-1).next, "fold F1", "while the history keeps where it died");
  const asked = claimed(holding, { ...parkWrite(leaseOf(holding), "read the history first"), how: "parked", status: "in_progress" });
  assert.equal(leaseOf(asked).next, "read the history first",
    "and a line this claim asked for survives the park, or the claim printed one it then took away");
});

/* Two runs of this suite left 6198 temp directories behind, and one run of it filled the mount a
   shell needed (ISS-42). The fixture that makes one owns removing it. */
test("the temporary config directory a fixture makes is gone once it is asked to go", () => {
  const one = tempHome("lease-proof");
  assert.ok(existsSync(one.path), "the fixture hands back a directory that is really there");
  one.remove();
  assert.ok(!existsSync(one.path), "and the same removal is what it registered to run at exit");
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
  assert.deepEqual(leaseOf(first).history, [{ holder: "one", at: AT, how: "claim", status: "open", next: null }]);
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
  assert.match(run.stdout, /--next <line>/u, "the line a successor starts on among them");
  assert.ok(run.stdout.includes(ADVISORY), "the output says what the lease cannot promise");
  assert.ok(USAGE.includes(ADVISORY));
  const wrong = spawnSync(FORGE, ["claim", "--minutes", "9"], { encoding: "utf8", env: process.env });
  assert.equal(wrong.status, 1, "the issue comes first, and a flag in its place is not one");
  assert.match(wrong.stderr, /claim takes the issue first/u);
  const folded = spawnSync(FORGE, ["claim", "ISS-1", "--next", "one\ntwo"], { encoding: "utf8", env: process.env });
  assert.equal(folded.status, 1, "and a line that is two lines is refused before anything is read");
  assert.match(folded.stderr, /--next takes one line/u);
});
