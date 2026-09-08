/* A run that dies mid-issue leaves nothing behind but the field, so every decision the lease makes
   is read from that field alone and each rule below fails without the check behind it (ISS-4). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { tempHome } from "../fixtures.mjs";

const HOME = tempHome("lease");
process.env.XDG_CONFIG_HOME = HOME.path;
/* Fixed here, so what the lease says about its writer is the fixture's and not the suite runner's. */
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";
const {
  ADVISORY, MINUTES, RECLAIMS_BEFORE_PARK, SHARED_HOLDER, agentOf, canonical, claimRefusal, claimed,
  describe, expiryOf, historyLine, leaseOf, nextLine, parksAsCrashed, pidOf, reclaimsOf,
  sharedHolder, stateOf, writeRefusal, writtenBy,
} = await import("../../src/flow/lease.mjs");
const {
  MINTED, sessionAsked, sessionHeld, sessionOf, sessionPath, sessionSourced, sessionWriting,
} = await import("../../src/resolve/config.mjs");
const { sessionKey } = await import("../../src/tracker/comments.mjs");
const { retryOf } = await import("../../src/tracker/rpc.mjs");
const { ROUTES } = await import("../../src/tracker/rest.mjs");
const { parkAnswers } = await import("../../src/flow/lease.mjs");
const { USAGE, nextLines, parkWrite } = await import("../../src/flow/claim.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
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

test("the five states, and a lease past its duration is another run's to take", () => {
  assert.equal(stateOf(null, "mine", NOW), "free");
  assert.equal(stateOf(held("mine"), "mine", NOW), "mine");
  assert.equal(stateOf(held("other", AT, 30), "mine", NOW + 29 * 60_000), "live");
  assert.equal(stateOf(held("other", AT, 30), "mine", NOW + 31 * 60_000), "expired");
  assert.equal(stateOf(held("mine", AT, 30), "mine", NOW + 31 * 60_000), "lapsed",
    "the holder past its own duration, with the field still naming it, so nobody took over");
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
  assert.match(describe(lease), /session the-other-run \(a-test-agent, pid 4242\), renewed 2026-09-02T12:00 for 30 minute\(s\)/u);
});

/* A uuid places nobody: the run whose shell died in ISS-26 was named by one, and a person deciding
   whether to wait for it or take the issue could not tell what it was or whether it still ran. */
test("every refusal that names the holder names its agent and its process too", () => {
  const lease = leaseOf(field({ holder: "the-other-run", agent: "claude-code_2-1-258_agent", pid: 3830915, renewedAt: AT, minutes: 30 }));
  assert.equal(lease.pid, "3830915", "read back as a string, because printing it is all anything does");
  const said = [claimRefusal("ISS-4", lease), writeRefusal("live", "ISS-4", lease), writeRefusal("expired", "ISS-4", lease)];
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

/* The same four in the same order, said as where each came from: a reader that has to act on an id
   a whole wave shares cannot tell from the value alone (ISS-445). */
test("each source of the holder is named, and naming it changes no holder", () => {
  const env = { ...process.env };
  delete process.env.FORGE_SESSION_ID;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  const saved = sessionOf();
  const named = (ev) => { const { id, source } = sessionSourced(ev); return { id, source }; };
  assert.deepEqual(named(), { id: saved, source: "saved" }, "the file the mint left");
  assert.deepEqual(named({ session_id: "the-event" }), { id: "the-event", source: "event" },
    "which the event a call is answering outranks, since the saved id outlives a run");
  process.env.CLAUDE_CODE_SESSION_ID = "the-harness";
  assert.deepEqual(named({ session_id: "the-event" }), { id: "the-harness", source: "inherited" }, "which outranks it");
  process.env.FORGE_SESSION_ID = "asked-for";
  assert.deepEqual(named(), { id: "asked-for", source: "asked" }, "and a run saying which it is outranks both");
  assert.ok(sessionSourced().said.includes("FORGE_SESSION_ID"),
    "and each row says what it means, so no second table is kept beside this one");
  for (const [asked, harness, want] of [
    ["asked-for", "the-harness", "asked-for"], [undefined, "the-harness", "the-harness"], [undefined, undefined, saved],
  ]) {
    if (asked) process.env.FORGE_SESSION_ID = asked; else delete process.env.FORGE_SESSION_ID;
    if (harness) process.env.CLAUDE_CODE_SESSION_ID = harness; else delete process.env.CLAUDE_CODE_SESSION_ID;
    assert.equal(sessionOf(), want, "every combination answers as it did before the source was readable");
    assert.equal(sessionHeld(), want);
    assert.equal(sessionAsked(), harness || asked ? want : null,
      "and only the environment answers this one, which is what keys a comment as shown");
    assert.equal(sessionKey(), want, "so the delivery reader is left where it was");
    assert.equal(sessionKey({ session_id: "the-event" }), harness || asked ? want : "the-event",
      "and the event is a row of the same table rather than a fourth source beside it");
  }
  Object.assign(process.env, env);
});

/* What a payload's `written` field is filled from, in one read of the session: `sessionOf` saves
   what it mints, so a source asked for after it would say `saved` about an id that did not exist a
   call earlier, and a record would claim a run was resumed where it was invented (ISS-705). */
test("a written field is filled from the id and its source together, and a minted id says so", () => {
  const env = { ...process.env };
  process.env.XDG_CONFIG_HOME = tempHome("writing-pair").path;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  process.env.FORGE_SESSION_ID = "asked-for";
  assert.deepEqual(sessionWriting(), { id: "asked-for", source: "asked" });
  const shape = { fields: [{ flag: "judge", written: "id" }, { flag: "judge-from", written: "source" }, { flag: "why" }] };
  assert.deepEqual(writtenBy(shape), { judge: "asked-for", "judge-from": "asked" },
    "each field taking the half its marker names, and a field with no marker filled by no session");
  delete process.env.FORGE_SESSION_ID;
  const minted = sessionWriting();
  assert.match(minted.id, /^machine-/u, "with nothing held at all, the mint answers");
  assert.equal(minted.source, MINTED, "as the mint rather than as the file it went on to write");
  assert.deepEqual(sessionWriting(), { id: minted.id, source: "saved" },
    "which is what the call after it reads, that file now being where the id is held");
  Object.assign(process.env, env);
});

/* A hook is handed no `FORGE_SESSION_ID` and the run inside the command it judges has one, so the
   command text is where that row is read. Everything the text does not show the grant reaching is
   the inherited id and one hold, which is what a reader that never looked would cost (ISS-497). */
test("the id a command grants the writer is a source, and every shape that does not show it reaching is not", () => {
  const env = { ...process.env };
  delete process.env.FORGE_SESSION_ID;
  process.env.CLAUDE_CODE_SESSION_ID = "the-harness";
  const named = (command) => {
    const { id, source } = sessionSourced({ tool_name: "Bash", tool_input: { command } });
    return { id, source };
  };
  const grants = { id: "a-run", source: "granted" };
  const falls = { id: "the-harness", source: "inherited" };
  for (const command of [
    "export FORGE_SESSION_ID=a-run && cd /elsewhere && ./plugin/bin/forge advance ISS-29",
    "export FORGE_SESSION_ID=a-run; forge advance ISS-29",
    `export FORGE_SESSION_ID='a-run'; forge advance ISS-29`,
    `  cd /elsewhere && export FORGE_SESSION_ID="a-run" && forge advance ISS-29`,
    "FORGE_SESSION_ID=a-run forge advance ISS-29",
    "env FORGE_SESSION_ID=a-run ./plugin/bin/forge advance ISS-29",
  ]) assert.deepEqual(named(command), grants, command);
  for (const [command, why] of [
    ["export FORGE_SESSION_ID=a-run 2>&1 | tee run.log; forge advance ISS-29", "a pipeline stage keeps its own environment"],
    ["export FORGE_SESSION_ID=a-run &", "and so does a background job"],
    ["export FORGE_SESSION_ID=a-run > run.log", "a redirection is where the exporting line ended"],
    ["export FORGE_SESSION_ID=a-run; unset FORGE_SESSION_ID; forge advance ISS-29", "taken back before the write"],
    ["export FORGE_SESSION_ID=a-run && sudo forge advance ISS-29", "handed to a launcher that need not pass it on"],
    ["FORGE_SESSION_ID=a-run true && forge advance ISS-29", "a prefix reaches the one command it prefixes"],
    ["FORGE_SESSION_ID=a-run npm run check", "which is this CLI or it is not this CLI's id to read"],
    ["(export FORGE_SESSION_ID=a-run) && forge advance ISS-29", "and a subshell's export dies with it"],
    [`FORGE_SESSION_ID=a-run echo "$(forge advance ISS-29)"`, "the substitution runs before the prefix reaches echo"],
    ["FORGE_SESSION_ID=a-run sudo forge advance ISS-29", "and the prefix names a launcher, not the writer"],
    ["export FORGE_SESSION_ID=a-run && forge comment ISS-29 <<EOF\nFORGE_SESSION_ID=b-run was the old id\nEOF",
      "a second value has no single answer, one key covering every target of the event"],
    [`FORGE_SESSION_ID="$CLAUDE_CODE_SESSION_ID" forge advance ISS-29`,
      "a value the shell expands is not the value the text spells"],
    ["export FORGE_SESSION_ID=a-run; (unset FORGE_SESSION_ID; forge advance ISS-29)",
      "and a bracket opens a command position, where taking it back still takes it back"],
    ["export FORGE_SESSION_ID=a-run; { unset FORGE_SESSION_ID; forge advance ISS-29; }",
      "a brace group running in this very shell most of all"],
    ["forge advance ISS-29", "and a command granting nothing grants nothing"],
    [`  export FORGE_SESSION_ID="a-run"`, "an export this CLI is nowhere behind reaches no writer of ours"],
    [`export FORGE_SESSION_ID='run#1'; forge advance ISS-29`,
      "an id outside the class this reads costs the round it would have cost unread, never a wrong key"],
  ]) assert.deepEqual(named(command), falls, why);
  assert.deepEqual(named(["export FORGE_SESSION_ID=a-run && forge advance ISS-29"]), grants,
    "a command handed over as a list is the one text its parts make");
  for (const prose of [
    `export FORGE_SESSION_ID=a-run && forge record confirmation ISS-29 --is "the source of the id"`,
    `export FORGE_SESSION_ID=a-run; forge claim ISS-29 --next 'explain (unset FORGE_SESSION_ID)'`,
  ]) assert.deepEqual(named(prose), grants,
    "a run's own prose travels through as an argument, and a withdrawal quoted inside one runs nothing");
  assert.deepEqual(sessionSourced({ session_id: "the-event" }), sessionSourced({}),
    "an event carrying no command is read exactly where it was");
  Object.assign(process.env, env);
});

/* `stateOf` reads an inherited holder as this run's own, so what is said instead is decided on both
   halves — the source AND the id. A predicate testing the source alone would warn about a lease that
   is somebody else's, which is the opposite of what the sentence claims (ISS-445). */
test("the shared-holder caveat is said for this run's own inherited id, and for no other lease", () => {
  const env = { ...process.env };
  const mine = (holder, source) => sharedHolder(holder === null ? null : { holder }, { id: "wave-id", source });
  assert.equal(mine("wave-id", "inherited"), true, "the wave's id, held by a lease naming it");
  assert.equal(mine("another-run", "inherited"), false, "an inherited id that is not this lease's holder");
  assert.equal(mine("wave-id", "asked"), false, "a run that said which run it is shares nothing");
  assert.equal(mine("wave-id", "saved"), false, "and neither does the id this machine kept");
  assert.equal(mine(null, "inherited"), false, "and there is no lease to be shared");
  process.env.CLAUDE_CODE_SESSION_ID = "the-harness";
  delete process.env.FORGE_SESSION_ID;
  assert.equal(sharedHolder({ holder: "the-harness" }), true, "and the session is read where none is passed");
  assert.equal(sharedHolder({ holder: "somebody" }), false);
  assert.match(SHARED_HOLDER, /names a wave and not a run/u, "the words stay beside the predicate");
  Object.assign(process.env, env);
});

/* A reader asking whose lease this is must not write a file to find out, or a diagnostic answers
   its own question and a wave of runs races one path. */
test("reading the holder without one held mints nothing", () => {
  const env = { ...process.env };
  const home = tempHome("no-mint");
  process.env.XDG_CONFIG_HOME = home.path;
  delete process.env.FORGE_SESSION_ID;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  assert.equal(sessionHeld(), null, "nobody's, and no file behind it");
  assert.deepEqual(sessionSourced(), { id: null, source: null, said: null, environment: false });
  assert.equal(existsSync(sessionPath()), false, "and the read left none");
  assert.match(sessionOf(), /^machine-/u, "which the mint, and only the mint, then writes");
  assert.equal(existsSync(sessionPath()), true);
  Object.assign(process.env, env);
});

/* Retried where the tracker said it did not process the call, and where nothing is stored either
   way. A create whose answer was lost would post twice, and only the mark is idempotent. Whether a
   call may be sent again is the route table's own word on the row, never a reading of the payload:
   an action that mutated outside `data` was a write the payload reading called a read. */
test("a call that may write is retried on one status, a read on the gateway's too", () => {
  const again = true;
  const once = false;
  assert.equal(retryOf(429, once), "rate-limited");
  assert.equal(retryOf(429, again), "rate-limited");
  assert.equal(retryOf(502, again), "transient");
  assert.equal(retryOf(null, again), "transient", "a dropped socket answered nothing at all");
  assert.equal(retryOf(502, once), null, "the write may have landed, so it is not sent again");
  assert.equal(retryOf(null, once), null);
  assert.equal(retryOf(400, again), null, "a bad argument does not become good by being asked again");
  assert.equal(retryOf(403, again), null);
  for (const key of ["forge_issues.create", "forge_issues.transition", "forge_comments.create"]) {
    assert.equal(ROUTES[key].writes, true, `${key} is a write and its row has to say so`);
  }
  assert.equal(ROUTES["forge_issues.get"].writes, undefined, "and a read declares none");
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

/* The lease's write is the field writer's (ISS-451), and the field writer borrows this module's
   comparator and its sentence, so the two import each other. A cycle holds only while nothing is
   read across it while a body runs: a row naming `leaseLandedAs` instead of wrapping it, or a table
   key written `[FIELD]`, dies in exactly one of the two orders and looks clean in the other. */
const LEASE = new URL("../../src/flow/lease.mjs", import.meta.url).href;
const WRITER = new URL("../../src/tracker/field-write.mjs", import.meta.url).href;

const entering = (first) => spawnSync(process.execPath, ["--input-type=module", "-e", `
  await import(${JSON.stringify(first)});
  const lease = await import(${JSON.stringify(LEASE)});
  const writer = await import(${JSON.stringify(WRITER)});
  if (typeof lease.setLease !== "function") throw new Error("setLease did not resolve");
  if (typeof writer.writeField !== "function") throw new Error("writeField did not resolve");
  if (lease.leaseLandedAs({ a: 1, b: 2 }, { b: 2, a: 1 }) !== true) throw new Error("the comparator is not the lease's");
  process.stdout.write("both");
`], { encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: HOME.path } });

for (const [name, first] of [["the lease", LEASE], ["the field writer", WRITER]]) {
  test(`a process entering the cycle at ${name} resolves both modules`, () => {
    const run = entering(first);
    assert.equal(run.status, 0, `${run.stderr}`);
    assert.equal(run.stdout, "both", run.stderr);
  });
}
