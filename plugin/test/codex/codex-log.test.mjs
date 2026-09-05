/* The log is codex's memory and its eval set, so what it replays, what it counts and what a follow-up
   round is asked to verify are decided here — on entries handed in, never on this machine's file. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";

import { tempRoom } from "../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so the two tests that read the real log path read a sandbox. */
const sandbox = tempRoom("forge-codex-log-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  answered,
  countedIn,
  findingsIn,
  numbered,
  outcomeOf,
  digestOf,
  rulingsIn,
  undecidedIn,
  unverdicted,
  verdictFromRulings,
  verdictRecord,
  historyFor,
  logConsult,
  logEntries,
  loggedWithMark,
  markOf,
  markedAt,
  logLine,
  LOG_PATH,
  pairedLog,
  recheckOwed,
  recheckPlan,
  recheckRange,
  recheckRisks,
  scoreOf,
  startedState,
  verdictsBy,
} = await import("../../src/codex/codex-log.mjs");

/* A verdict is a separate record; replaying advice without what was done with it made resolved /
   still open a guess. */
test("a verdict is joined back to the consult it scored", () => {
  const entries = [
    { kind: "consult", id: "aa", ok: true, root: "/a", at: "1", files: ["x"], intent: "i", reply: "r" },
    { kind: "verdict", of: "aa", accepted: 2, rejected: 1, note: "kept the blocker" },
  ];
  assert.equal(verdictsBy(entries).get("aa").accepted, 2);
  assert.match(historyFor(entries, "/a")[0].verdict, /2 accepted, 1 rejected — kept the blocker/);
});

test("prior exchanges replay this repository's answered consults, with the intent judged", () => {
  const entries = [
    { kind: "consult", ok: true, root: "/a", at: "1", files: ["x"], intent: "first go", reply: "first" },
    { kind: "consult", ok: false, root: "/a", at: "2", files: ["y"], error: "boom" },
    { kind: "consult", ok: true, root: "/b", at: "3", files: ["z"], reply: "elsewhere" },
    { kind: "consult", ok: true, root: "/a", at: "4", files: ["w"], reply: "second" },
  ];
  const held = historyFor(entries, "/a");
  assert.deepEqual(held.map((one) => one.reply), ["first", "second"]);
  assert.equal(held[0].intent, "first go");
  assert.equal(held[1].intent, "(none given)");
  assert.deepEqual(historyFor(entries, "/a", 1).map((one) => one.reply), ["second"]);
  assert.deepEqual(historyFor(entries, "/c"), []);
});

/* Recency was the only order, so a consult on one file carried three about another. */
test("a consult sharing a file is replayed before a newer one that does not", () => {
  const entries = [
    { kind: "consult", ok: true, root: "/a", at: "1", files: ["x"], reply: "on x" },
    { kind: "consult", ok: true, root: "/a", at: "2", files: ["y"], reply: "on y, older" },
    { kind: "consult", ok: true, root: "/a", at: "3", files: ["z"], reply: "on z" },
    { kind: "consult", ok: true, root: "/a", at: "4", files: ["w"], reply: "on w" },
  ];
  assert.deepEqual(historyFor(entries, "/a", 2, ["y"]).map((one) => one.reply), ["on y, older", "on w"]);
  assert.deepEqual(historyFor(entries, "/a", 3, ["nothing"]).map((one) => one.reply), ["on y, older", "on z", "on w"]);
});

/* Six open rounds on one patch each found a narrower hole; a round asked to confirm or refute what it
   already said is the shape a reviewer is reliable in. */
test("a recheck turns the last consult's findings on these files into the verification list", () => {
  const reply = [
    "CODEX: 3 findings (1 blocker, 2 major, 0 minor)",
    "## Tech Lead",
    "- **New — blocker:** `a.mjs:12` — the lock is released by path.",
    "- **Still open — major:** `a.mjs:40` — the cap is not the loop's.",
    "- **Resolved — major:** `a.mjs:9` — fixed since.",
    "## End User",
    "Nothing material.",
    "Verification:",
    "- **Risk 1 — CONFIRMED:** `a.mjs:12` — it does.",
    "- **Earlier major finding — REFUTED:** `a.mjs:40` — it does not.",
    "- **New — minor:** `other.mjs:3` — about a file this round is not on.",
  ].join("\n");
  assert.deepEqual(findingsIn(reply, ["a.mjs"]), [
    "New — blocker: `a.mjs:12` — the lock is released by path.",
    "Still open — major: `a.mjs:40` — the cap is not the loop's.",
  ]);
  assert.equal(findingsIn(reply).length, 3, "unfiltered, the other file's finding is one too");
  assert.equal(findingsIn("- **New — major:** no anchor here", ["a.mjs"]).length, 1, "unanchored, it stays");
  assert.equal(findingsIn("- **New — major:** calling `saveConfig()` loses data", ["a.mjs"]).length, 1, "a code span is not a path");
  assert.deepEqual(numbered(reply, ["a.mjs"]).map((one) => one.id), ["F1", "F2"], "an unnumbered reply is numbered by order");
  const ids = numbered([
    "- **F1 — New — blocker:** `a.mjs:1` — one.",
    "- **F3 — Still open — major:** `a.mjs:2` — three.",
    "- **F2 - New - minor:** `a.mjs:3` — two.",
  ].join("\n"));
  assert.deepEqual(ids.map((one) => one.id), ["F1", "F3", "F2"], "the reply's own ids win over order");
  assert.equal(ids[0].text, "New — blocker: `a.mjs:1` — one.", "the id leaves the text");
  const twoFiles = "- **New — major:** `a.mjs:1` — a.\n- **New — major:** `b.mjs:1` — b.";
  assert.deepEqual(numbered(twoFiles, ["b.mjs"]).map((one) => one.id), ["F2"], "filtering a file keeps the whole reply's numbering");
  assert.equal(numbered("- **F1 — New — major:** x\n- **F1 — New — minor:** y").length, 1, "an id the reply gave twice names one finding");
  const entries = [
    { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply },
    { kind: "consult", id: "c2", ok: true, root: "/a", at: "2", files: ["b.mjs"], reply: "CODEX: 1 findings\n- **New — minor:** `b.mjs:1` — b." },
    { kind: "verdict", of: "c1", accepted: 1, rejected: 1, note: "took the lock, kept the cap" },
  ];
  const risks = recheckRisks(entries, "/a", ["a.mjs"]);
  assert.equal(risks.length, 2, "the consult sharing the file, not the newest");
  assert.match(risks[0], /still stands.*released by path.*What I then did: took the lock/u);
  assert.deepEqual(recheckRisks(entries, "/a", ["c.mjs"]), [], "none sharing these files: nothing to re-verify");
  assert.deepEqual(recheckRisks(entries, "/z", ["a.mjs"]), []);
});

/* One sentence answered two unlike situations and named no route out of either, so the way past it —
   a fresh whole-set consult — travelled in every delegated brief by hand instead (ISS-51). */
test("a recheck with nothing to verify names the pass a review is earned by", () => {
  const clean = { kind: "consult", id: "c9", ok: true, root: "/a", at: "9", files: ["a.mjs", "b.mjs"], send: "diffs", reply: "CODEX: 0 findings" };
  const rels = ["a.mjs", "b.mjs"];

  const none = recheckOwed(null, rels);
  assert.match(none, /no consult in the log has answered on/u, "nothing has reviewed these files");
  assert.match(none, /--send bodies a\.mjs b\.mjs/u, "and the route is the consult it never had");

  const diffed = recheckOwed(recheckPlan([clean], "/a", rels), rels);
  assert.match(diffed, /consult c9/u, "which consult found nothing, by its id");
  assert.match(diffed, /nothing to recheck/u);
  assert.match(diffed, /--send bodies a\.mjs b\.mjs/u, "the whole-set read is what earns the review");

  /* It reports what the log holds and routes; what is owed is the contract's judgement and the
     run's to make, since only the run knows whether the tree has moved since that pass. */
  const bodied = { ...clean, send: "bodies", sent: rels.map((rel) => ({ rel, chars: 9, clipped: false })) };
  const whole = recheckOwed(recheckPlan([bodied], "/a", rels), rels);
  assert.match(whole, /read this set whole and found nothing/u, "the pass a review is earned by, reported");
  assert.match(whole, /only where the tree has moved since/u, "and the route made conditional, not prescribed");
  assert.equal(/owed/u.test(whole), false, "the CLI does not rule on what a review owes");

  /* recheckPlan takes the last consult sharing ANY of the files, so a whole-set pass over half the
     set is not a whole-set pass over this one, and saying so would close a review on a file nobody read. */
  const half = recheckOwed(recheckPlan([{ ...bodied, files: ["a.mjs"] }], "/a", rels), rels);
  assert.equal(/read this set whole/u.test(half), false, "it read a.mjs whole, not this set");
  assert.match(half, /b\.mjs was not among them/u, "and it names the file that went unread");
  assert.match(half, /--send bodies a\.mjs b\.mjs/u, "so the whole-set read is still owed");

  /* The earning pass is over the WHOLE set, so a command listing six of thirty is a route to a pass
     that does not earn it. Only the sentence around the command counts paths. */
  const command = recheckOwed(null, ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.match(command, /--send bodies 1 2 3 4 5 6 7 8`/u, "every path the pass has to cover");

  /* A clipped body is a file nobody read, and a file the row never recorded sending is one nobody
     can say was read: what `files` names is what the consult was ABOUT, `sent` what it carried. */
  const cut = recheckOwed(recheckPlan([{
    ...clean, send: "bodies", sent: [{ rel: "a.mjs", chars: 9, clipped: true }, { rel: "b.mjs", chars: 9, clipped: false }],
  }], "/a", rels), rels);
  assert.equal(/read this set whole/u.test(cut), false, "one of the two was sent clipped");
  assert.match(cut, /a\.mjs, so that much of the set is unread/u, "and it names which");
  assert.match(cut, /--send bodies a\.mjs b\.mjs/u);

  /* `bundle` records a part for a file it could not read, so the row carries a `sent` entry with no
     `chars`: an entry is not a body, and a deletion has none to be read whole. */
  const deleted = recheckOwed(recheckPlan([{
    ...bodied, sent: [{ rel: "a.mjs", chars: 12 }, { rel: "b.mjs", clipped: false }],
  }], "/a", rels), rels);
  assert.equal(/read this set whole/u.test(deleted), false, "b.mjs carries no body, only a record of one");
  assert.match(deleted, /b\.mjs, so that much of the set is unread/u);

  const silent = recheckOwed(recheckPlan([{ ...clean, send: "bodies", sent: [{ rel: "a.mjs", chars: 9, clipped: false }] }], "/a", rels), rels);
  assert.equal(/read this set whole/u.test(silent), false, "b.mjs is in files, and the row never says it was sent");
  assert.match(silent, /b\.mjs, so that much of the set is unread/u);

  const held = recheckOwed(recheckPlan([{
    ...clean, send: "bodies", sent: [{ rel: "a.mjs", chars: 9, clipped: false }, { rel: "b.mjs", chars: 9, clipped: false }],
  }], "/a", rels), rels);
  assert.match(held, /read this set whole/u, "every one of them carried, whole");

  /* A path is the repository's to name, and one with a space in it splits the copied command in two. */
  const spaced = recheckOwed(null, ["a.mjs", "docs/two words.md", "--diff"]);
  assert.match(spaced, /--send bodies a\.mjs 'docs\/two words\.md' \.\/--diff`/u,
    "quoted where a shell would split it, and pathed where this CLI's own parser would eat it");

  assert.match(command, /answered on 1 2 3 4 5 6 and 2 more\./u, "and a sentence that stays readable");
});

/* A recheck with findings to verify is untouched by any of that. */
test("a recheck with findings still has a plan to verify", () => {
  const entries = [{
    kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], head: "abc1234",
    reply: "CODEX: 1 findings\n- **New — major:** `a.mjs:1` — the lock is released by path.",
  }];
  const plan = recheckPlan(entries, "/a", ["a.mjs"]);
  assert.deepEqual(plan.ids, ["F1"]);
  assert.equal(plan.judged.head, "abc1234", "the head its findings were made against");
  assert.equal(recheckOwed(plan, ["a.mjs"]), null, "there is something to recheck, so nothing is owed");
});

/* A base ref that aged widened a 15-file recheck to 38 and clipped 18 of them, the rechecked files
   among them (ISS-272). The range the judged consult recorded is the one that travels. */
test("a recheck's range is the range the consult it verifies was given", () => {
  const plan = recheckPlan([{
    kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs", "b.mjs"],
    reply: "CODEX: 1 findings\n- **New — major:** `a.mjs:1` — the lock is released by path.",
  }], "/a", ["a.mjs"]);

  assert.deepEqual(
    recheckRange(plan, ["another/run.mjs", "a.mjs", "z.mjs", "b.mjs"]),
    ["a.mjs", "b.mjs"],
    "what another run landed between the base and now is dropped; the judged consult's own range travels",
  );
  assert.equal(recheckRange(plan, ["a.mjs", "b.mjs"]), null, "already that range: nothing to say and nothing to drop");
  assert.equal(recheckRange(plan, ["a.mjs"]), null, "narrowed, never widened — a file the tree no longer offers is not put back");
  assert.equal(recheckRange(null, ["a.mjs"]), null, "no plan, no range of its own");
  assert.equal(recheckRange({ judged: { files: [] } }, ["a.mjs"]), null, "a consult that recorded no range narrows nothing");
});

test("the log scores itself per model", () => {
  const entries = [
    { kind: "consult", id: "1", ok: true, root: "/a", at: "1", model: "m", ms: 60000, reply: "CODEX: 2 findings", usage: { input_tokens: 100, cache_read_input_tokens: 50 } },
    { kind: "consult", id: "2", ok: true, root: "/a", at: "2", model: "m", ms: 20000, reply: "CODEX: 0 findings" },
    { kind: "consult", id: "3", ok: false, root: "/a", at: "3", model: "m", error: "x" },
    { kind: "verdict", of: "1", accepted: 1, rejected: 1 },
  ];
  const [row] = scoreOf(entries);
  assert.equal(row.consults, 2);
  assert.equal(row.findings, 2);
  assert.equal(row.zero, 1);
  assert.equal(row.accepted, 1);
  assert.equal(row.rejected, 1);
  assert.equal(row.median, 60);
  const untimed = scoreOf([...entries, { kind: "consult", id: "4", ok: true, root: "/a", at: "4", model: "m", reply: "CODEX: 0 findings" }]);
  assert.equal(untimed[0].median, 60, "a consult that recorded no duration is left out of the median, not counted as nought");
  assert.equal(row.cached, 50);
  assert.equal(row.input, 150, "every input token, cached ones included");
});

/* A verdict against an error entry would read as "3 accepted" on a gateway timeout. */
test("only an answered consult can carry a verdict", () => {
  const entries = [
    { kind: "consult", ok: true, reply: "said something" },
    { kind: "consult", ok: false, error: "timed out" },
    { kind: "consult", ok: true, reply: "" },
  ];
  assert.deepEqual(answered(entries).map((one) => one.reply), ["said something"]);
});

/* An unpaired start is a consult that died; a paired one is replaced by what it answered. */
test("the log pairs a start with its result on the id", () => {
  const entries = [
    { kind: "started", id: "aa", at: "A", files: ["docs/A.md"] },
    { kind: "consult", id: "aa", at: "A", ok: true, reply: "x" },
    { kind: "started", id: "bb", at: "B", files: ["docs/B.md"] },
  ];
  assert.deepEqual(pairedLog(entries).map((one) => `${one.kind}:${one.id}`), ["consult:aa", "started:bb"]);
});

test("a start inside the budget reads as running, past it as lost", () => {
  const at = "2026-08-31T08:00:00.000Z";
  const base = Date.parse(at);
  assert.match(startedState({ at }, base + 30_000), /running for 30s/);
  assert.match(startedState({ at }, base + 1_000_000), /never reported back/);
});

test("nothing consulted yet reads as an empty log, never a throw", () => {
  assert.deepEqual(logEntries(), []);
});

/* A verdict typed by hand against a review nobody counted is accounting by vibes. */
test("a review counts itself, and a malformed header counts as nothing", () => {
  const held = countedIn("CODEX: 5 findings (1 blocker, 3 major, 1 minor)\n\n## Tech Lead");
  assert.deepEqual(held, { total: 5, blocker: 1, major: 3, minor: 1 });
  assert.deepEqual(countedIn("CODEX: 0 findings"), { total: 0 });
  assert.deepEqual(countedIn("CODEX: 2 findings (2 major)"), { total: 2, major: 2 });
  assert.equal(countedIn("## Tech Lead\n- blocker: something"), null);
  assert.equal(countedIn(undefined), null);
});

test("a verdict names findings by id, and a name the reply never gave is refused", () => {
  const reply = [
    "- **F1 — New — blocker:** `a.mjs:12` — one.",
    "- **F2 — New — major:** `a.mjs:40` — two.",
    "- **F3 — New — minor:** `a.mjs:50` — three.",
  ].join("\n");
  const last = { id: "c1", at: "1", files: ["a.mjs"], reply };
  const byId = verdictRecord(last, { accepted: "F1,F3", rejected: "F2=the cap is the loop's" });
  assert.deepEqual(byId.record.kept, ["F1", "F3"]);
  assert.deepEqual(byId.record.dropped, { F2: "the cap is the loop's" });
  assert.equal(byId.record.accepted, 2);
  assert.equal(byId.record.rejected, 1);
  assert.equal(byId.undecided, 0);
  assert.match(verdictRecord(last, { accepted: "F4" }).problem, /no finding F4; it made F1, F2, F3/u);
  assert.match(verdictRecord(last, { accepted: "F1", rejected: "F1=no" }).problem, /F1 cannot be both/u);
  assert.equal(verdictRecord(last, { accepted: "F1" }).undecided, 2, "two left undecided");
  assert.match(verdictRecord(last, { accepted: "1", rejected: "F2=why" }).problem, /not counts/u, "a count on either side is refused");
  const comma = verdictRecord(last, { rejected: "F2=not reproducible, the shell rejects it,F3=fine" });
  assert.deepEqual(comma.record.dropped, { F2: "not reproducible, the shell rejects it", F3: "fine" }, "a comma in a reason stays");
  assert.match(verdictRecord(last, { accepted: "2", rejected: "1" }).problem, /names findings, not counts .* it made F1, F2, F3/u, "the count form is gone");
  assert.match(verdictRecord(last, { note: "did it" }).problem, /made F1, F2, F3: say which/u, "a note alone does not decide findings");
  const none = verdictRecord({ ...last, reply: "CODEX: 0 findings" }, { note: "nothing to decide" });
  assert.deepEqual([none.record.accepted, none.record.rejected, none.record.kept, none.record.note], [0, 0, [], "nothing to decide"], "a note alone closes a consult with no findings");
  const twice = verdictRecord(last, { accepted: "F1,F1" });
  assert.deepEqual(twice.record.kept, ["F1"], "one id said twice is one finding");
  assert.equal(twice.undecided, 2);
  const held = byId.record;
  assert.equal(outcomeOf(held, "F2"), "rejected — the cap is the loop's");
  assert.equal(outcomeOf(held, "F1"), "accepted");
  assert.equal(outcomeOf({ ...held, kept: [], dropped: {}, note: "did it" }, "F1"), "did it", "unnamed, the note stands for all");
  assert.equal(outcomeOf(null, "F1"), null);
});

test("a recheck carries each finding's own outcome, and history prints the ids", () => {
  const reply = [
    "- **F1 — New — blocker:** `a.mjs:12` — one.",
    "- **F2 — New — major:** `a.mjs:40` — two.",
  ].join("\n");
  const entries = [
    { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], intent: "x", reply },
    { kind: "verdict", of: "c1", accepted: 1, rejected: 1, kept: ["F1"], dropped: { F2: "by design" } },
  ];
  const risks = recheckRisks(entries, "/a", ["a.mjs"]);
  assert.match(risks[0], /finding F1 still stands.*What I then did: accepted \(CONFIRMED/u);
  assert.match(risks[1], /finding F2 still stands.*What I then did: rejected — by design \(CONFIRMED/u);
  const [history] = historyFor(entries, "/a", 3, ["a.mjs"]);
  assert.equal(history.verdict, "1 accepted (F1), 1 rejected (F2: by design)");
});

const RECHECK_REPLY = [
  "1. **REFUTED** — `a.mjs:12` — the lock is now taken by owner.",
  "2. **CONFIRMED** — `a.mjs:40` — the cap is still the gateway's.",
  "3. **CANNOT TELL** — no test was reachable.",
  "",
  "CODEX: 1 findings (0 blocker, 1 major, 0 minor)",
  "- **F1 — New — major:** `a.mjs:60` — something new.",
].join("\n");

test("a recheck's rulings become the verdict on the consult it judged, by position", () => {
  assert.deepEqual(rulingsIn(RECHECK_REPLY).map((one) => [one.n, one.ruling]), [[1, "REFUTED"], [2, "CONFIRMED"], [3, "CANNOT TELL"]]);
  const judged = { id: "c1", files: ["a.mjs"], reply: "- **F1 — New — blocker:** `a.mjs:12` — x.\n- **F2 — New — major:** `a.mjs:40` — y.\n- **F3 — New — minor:** `a.mjs:50` — z." };
  const plan = { judged, ids: ["F1", "F2", "F3"], risks: [] };
  const auto = verdictFromRulings(plan, 0, RECHECK_REPLY, "r1");
  assert.deepEqual(auto.record.kept, ["F1"], "REFUTED is a finding the tree no longer shows");
  assert.equal(auto.record.accepted, 1);
  assert.equal(auto.record.of, "c1");
  assert.equal(auto.record.from, "r1");
  assert.match(auto.record.note, /still open: F2/u, "CONFIRMED stays open, CANNOT TELL is neither");
  assert.match(auto.said, /verdict --of c1/u);
  const shifted = verdictFromRulings(plan, 1, RECHECK_REPLY, "r1");
  assert.deepEqual(shifted.record.kept, [], "a --verify risk before the list shifts the numbering");
  assert.match(shifted.record.note, /still open: F1/u);
  assert.equal(verdictFromRulings(plan, 0, "CODEX: 0 findings", "r1"), null, "no rulings, no verdict");
  const prior = { kept: ["F3", "F9"], dropped: { F2: "by design" } };
  const merged = verdictFromRulings(plan, 0, RECHECK_REPLY, "r2", prior);
  assert.deepEqual(merged.record.kept, ["F9", "F1"], "what an earlier verdict kept survives the recheck's, unless the recheck reopens it");
  assert.deepEqual(merged.record.dropped, {}, "a finding the recheck confirms is open again, whatever was said before");
  assert.deepEqual(merged.record.reopened, ["F2", "F3"], "CONFIRMED and CANNOT TELL both reopen");
  const unsure = verdictFromRulings(plan, 0, "1. **CANNOT TELL** — a\n2. **CANNOT TELL** — b\n3. **CANNOT TELL** — c", "r3", { kept: ["F1", "F2", "F3"], dropped: {} });
  assert.deepEqual([unsure.record.kept, unsure.record.reopened], [[], ["F1", "F2", "F3"]], "all CANNOT TELL reopens everything it had closed");
  const legacy = verdictFromRulings(plan, 0, RECHECK_REPLY, "r4", { accepted: 3, rejected: 0 });
  assert.equal(legacy.record.counted, true);
  assert.deepEqual(undecidedIn(["F1", "F2", "F3"], legacy.record), ["F2", "F3"], "a count-form prior decided F3 by count; only what this recheck reopened is open");
  assert.deepEqual(undecidedIn(["F1", "F2", "F3"], verdictFromRulings(plan, 0, "1. **REFUTED** — a", "r5", { accepted: 3, rejected: 0 }).record), [], "nothing reopened, nothing open");
  const scored = verdictFromRulings(plan, 0, "1. **CANNOT TELL** — a", "r6", { accepted: 10, rejected: 2 }).record;
  assert.deepEqual([scored.accepted, scored.rejected, scored.reopened], [1, 2, ["F1"]], "a count-form prior's totals survive the merge, capped at the findings made");
  const moved = verdictRecord({ id: "c1", files: ["a.mjs"], reply: judged.reply }, { rejected: "F1=wrong" }, { accepted: 3, rejected: 0 });
  assert.deepEqual([moved.record.accepted, moved.record.rejected], [2, 1], "a later rejection moves one out of the count, and the two never exceed three");
  assert.match(recheckRisks([{ kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply: judged.reply }], "/a", ["a.mjs"])[0],
    /^Your earlier finding F1 still stands in the tree as it is now — .*\(CONFIRMED = the defect is still there; REFUTED = it is fixed, or was never real\.\)$/u,
    "the risk is the defect, and the legend rides with it");
});

test("the commit gate asks about the last consult that made findings and heard nothing", () => {
  const withFindings = { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const quiet = { kind: "consult", id: "c2", ok: true, root: "/a", at: "2", files: ["b.mjs"], reply: "CODEX: 0 findings" };
  assert.deepEqual(unverdicted([withFindings, quiet], "/a"), { id: "c1", ids: ["F1"], open: ["F1"], files: ["a.mjs"], at: "1" }, "a later empty consult does not answer for it");
  assert.equal(unverdicted([withFindings, quiet, { kind: "verdict", of: "c1", accepted: 1, rejected: 0 }], "/a"), null, "a count-form verdict decided everything");
  const two = { ...withFindings, reply: `${withFindings.reply}\n- **F2 — New — minor:** \`a.mjs:2\` — y.` };
  const partial = { kind: "verdict", of: "c1", accepted: 1, rejected: 0, kept: ["F1"], dropped: {}, from: "r1" };
  assert.deepEqual(unverdicted([two, partial], "/a").open, ["F2"], "a recheck's partial verdict leaves what it confirmed open");
  assert.equal(unverdicted([two, { ...partial, dropped: { F2: "by design" } }], "/a"), null);
  const merged = verdictRecord({ id: "c1", files: ["a.mjs"], reply: two.reply }, { rejected: "F2=by design" }, partial);
  assert.deepEqual([merged.record.kept, merged.record.dropped, merged.undecided], [["F1"], { F2: "by design" }, 0], "a later verdict adds to the recheck's");
  const flipped = verdictRecord({ id: "c1", files: ["a.mjs"], reply: two.reply }, { rejected: "F1=wrong after all" }, partial);
  assert.deepEqual([flipped.record.kept, Object.keys(flipped.record.dropped)], [[], ["F1"]], "the newer word wins");
  assert.equal(unverdicted([withFindings], "/b"), null, "another root's consult is not this tree's");
});

test("history replays the findings, rulings and outcomes, not the prose", () => {
  const held = { kept: ["F1"], dropped: { F2: "by design" } };
  const digest = digestOf(`## Tech Lead\n\nLong preamble that costs tokens.\n${RECHECK_REPLY}\n- **F2 — New — minor:** \`a.mjs:70\` — small.`, held);
  assert.match(digest, /^1\. \*\*REFUTED\*\*/u, "rulings first");
  assert.match(digest, /CODEX: 1 findings/u);
  assert.match(digest, /- F1 — New — major: `a.mjs:60` — something new\. → accepted/u);
  assert.match(digest, /- F2 — .* → rejected — by design/u);
  assert.doesNotMatch(digest, /Long preamble/u);
  assert.equal(digestOf("Nothing material here.", null), "Nothing material here.", "prose with no structure is replayed as it was");
  assert.equal(digestOf("## Tech Lead\n\nA paragraph of reasons.\n\nCODEX: 0 findings\n\nMore prose after.", null), "CODEX: 0 findings", "a converged reply is one line");
  const [replayed] = historyFor([{ kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], intent: "x", reply: "Preamble.\n- **F1 — New — major:** `a.mjs:1` — x." }], "/a", 3, ["a.mjs"]);
  assert.equal(replayed.reply, "CODEX: 1 findings\n- F1 — New — major: `a.mjs:1` — x.", "what travels is the digest");
});

/* The log is a file on disk and `forge codex log` prints it back into a session, so a credential a
   reviewed file carried into the reply must not survive the write. A fake shape, at three depths:
   the last real leak of this kind got through a redaction that missed one level. */
const FAKE = "7|notarealtokennotarealtokennotarealtoken";

test("a credential in a consult record is masked before the line is written", () => {
  const long = `A paragraph of review prose. ${"x".repeat(400)}`;
  const record = {
    kind: "consult",
    id: "mask-1",
    at: "2026-09-04T00:00:00.000Z",
    root: "/a",
    ok: true,
    ms: 1200,
    files: ["a.mjs"],
    sent: [{ rel: "a.mjs", sha: "9f2c", chars: 812, clipped: false }],
    usage: { input_tokens: 5, cache_read_input_tokens: 7 },
    intent: `check the header we send with --token ${FAKE}`,
    risks: [`Your earlier finding F1 still stands — COOLIFY_TOKEN=${FAKE} is committed.`],
    reply: `CODEX: 1 findings\n- **F1 — major:** \`a.mjs:3\` — hardcodes COOLIFY_TOKEN=${FAKE}. ${long}`,
  };
  logConsult(record);
  assert.ok(!readFileSync(LOG_PATH, "utf8").includes("notarealtoken"), "no part of the value is on disk");
  const entry = logEntries().at(-1);
  assert.equal(entry.intent, "check the header we send with --token ***");
  assert.deepEqual(entry.risks, ["Your earlier finding F1 still stands — COOLIFY_TOKEN=*** is committed."]);
  /* To the next space, punctuation included: masking less leaves most of a passphrase behind. */
  assert.match(entry.reply, /hardcodes COOLIFY_TOKEN=\*\*\* A paragraph/u);
  /* The refusal log clips at 220 characters; a reply is the eval set this log is kept for. */
  assert.ok(entry.reply.endsWith(long.slice(-40)), "the reply comes back whole, not clipped");
  assert.deepEqual(numbered(entry.reply).map((one) => one.id), ["F1"], "and it is still read for its findings");
  const blanked = { intent: null, risks: null, reply: null };
  assert.deepEqual({ ...entry, ...blanked }, { ...record, ...blanked },
    "everything a reader is keyed on — the shas, the numbers, the nested usage — survives field for field");
});

test("a credential two levels into a record is masked, and the ids around it are not", () => {
  logConsult({
    kind: "verdict",
    at: "2026-09-04T00:01:00.000Z",
    of: "mask-1",
    files: ["a.mjs"],
    accepted: 1,
    rejected: 1,
    kept: ["F1"],
    dropped: { F2: `not ours: the fixture logs in with ${FAKE}` },
  });
  assert.ok(!readFileSync(LOG_PATH, "utf8").includes("notarealtoken"), "a rejection reason is caller prose");
  const entry = logEntries().at(-1);
  assert.equal(entry.dropped.F2, "not ours: the fixture logs in with ***");
  assert.deepEqual([entry.of, entry.kept, entry.accepted], ["mask-1", ["F1"], 1], "the record is otherwise itself");
});

/* The write-side mask above reaches nothing written before it, and the log is append-only with no
   pass that rewrites it (ISS-266). So the printer masks what it prints: an entry stored unmasked —
   every entry before 3.35.88 — comes back masked whichever way this verb is asked for it. */
const STORED_UNMASKED = {
  kind: "consult",
  id: "old-1",
  at: "2026-08-01T00:00:00.000Z",
  root: "/a",
  ok: true,
  ms: 2000,
  head: "abc1234",
  files: ["a.mjs"],
  sent: [{ rel: "a.mjs", sha: "9f2c", chars: 812 }],
  reply: `CODEX: 2 findings (1 major, 1 minor)\n- **F1 — major:** \`a.mjs:3\` — it ships --token ${FAKE} in the header.`,
};

test("an entry written before the write-side mask is masked on the way out", () => {
  const said = logLine(STORED_UNMASKED, true);
  assert.ok(!said.includes("notarealtoken"), "no part of the value reaches the session");
  assert.match(said, /it ships --token \*\*\* in the header/u, "and the prose around it is still readable");
});

test("a verdict's note is masked too, which is the other stored string this verb prints", () => {
  const said = logLine({
    kind: "verdict",
    at: "2026-08-01T00:01:00.000Z",
    of: "old-1",
    accepted: 1,
    rejected: 1,
    note: `kept F1: the fixture really did log in with ${FAKE}`,
  }, false);
  assert.ok(!said.includes("notarealtoken"));
  assert.match(said, /verdict on old-1: 1 accepted, 1 rejected {2}kept F1: the fixture really did log in with \*\*\*/u);
});

/* Masking shortens a reply, so a count taken off the masked copy would report a smaller eval set
   than was reviewed. The prose is the masked copy's; the numbers are the entry's own. */
test("the counts are read off the entry and not off what printed", () => {
  const said = logLine(STORED_UNMASKED, false);
  assert.match(said, new RegExp(`\\s${STORED_UNMASKED.reply.length}ch\\s`, "u"),
    "the reply's own length, not the masked one's");
  assert.match(said, /2 finding\(s\)/u);
});

/* What licenses masking at both ends: they answer different questions — what accumulates on disk
   from here, and what reaches a transcript now — and running both changes nothing twice. */
test("an entry already masked at the write passes through unchanged", () => {
  const clean = { ...STORED_UNMASKED, reply: STORED_UNMASKED.reply.replace(FAKE, "***") };
  const said = logLine(clean, true);
  assert.ok(said.includes(clean.reply), "a record written since 3.35.88 prints its stored prose verbatim");
  assert.match(said, new RegExp(`\\s${clean.reply.length}ch\\s`, "u"), "and reports its own length");
});

/* The counter's whole evidence: the live log is 78 consults short of its next mark, so a crossing is
   proven on a planted one. The fixture is answered consults and asserted to be, because a bare
   `{kind:"consult"}` counts zero and would let both halves of this pass without a mark existing. */
const PLANTED = (n) => ({
  kind: "consult",
  ok: true,
  id: `p${n}`,
  at: new Date(Date.UTC(2026, 8, 5) + n * 60_000).toISOString(),
  root: "/planted",
  reply: "CODEX: 0 findings",
});

test("the consult that takes the log onto a hundred-mark names the eval; the one before it says nothing", () => {
  const kept = readFileSync(LOG_PATH, "utf8");
  const plant = (many) => writeFileSync(LOG_PATH, `${Array.from({ length: many }, (one, n) => JSON.stringify(PLANTED(n))).join("\n")}\n`);
  try {
    plant(199);
    assert.equal(answered(logEntries()).length, 199, "planted as answered consults, which is what the counter counts");
    const said = loggedWithMark(PLANTED(199));
    assert.equal(answered(logEntries()).length, 200, "and the consult's own write is what crossed it");
    assert.match(said, /200 answered consults in the log/u);
    assert.match(said, /`forge codex eval`/u);

    plant(198);
    assert.equal(loggedWithMark(PLANTED(198)), null, "199 is short of the mark");

    plant(199);
    assert.equal(loggedWithMark({ ...PLANTED(199), ok: false, reply: undefined, error: "gateway" }), null,
      "a failed consult is not in the population the eval compares, so it crosses nothing");
  } finally {
    writeFileSync(LOG_PATH, kept);
  }
});

/* Counted around the write, two consults finishing together both read 199 before and 201 after, and
   both announced 200 (codex F1, this change). The mark belongs to the record that landed on it. */
test("two consults finishing together, only the one that landed on the mark says so", () => {
  const kept = readFileSync(LOG_PATH, "utf8");
  try {
    writeFileSync(LOG_PATH, `${Array.from({ length: 199 }, (one, n) => JSON.stringify(PLANTED(n))).join("\n")}\n`);
    assert.match(loggedWithMark(PLANTED(199)), /200 answered consults/u, "the 200th");
    assert.equal(loggedWithMark(PLANTED(200)), null, "and the one right behind it announces nothing");
  } finally {
    writeFileSync(LOG_PATH, kept);
  }
});

test("a mark is an ordinal in the log, so nothing has to remember the last crossing", () => {
  assert.equal(markedAt(100), 100);
  assert.equal(markedAt(101), null, "the same mark is never announced twice");
  assert.equal(markedAt(1), null);
  assert.equal(markedAt(0), null, "a record the log would not take is no crossing at all");
});

/* Three random bytes is what an id is, so two consults can share one; found by the id alone, the
   199th would read the 200th's place as its own and announce a mark it never landed on (codex F3). */
test("a co-tenant sharing this record's id does not lend it their ordinal", () => {
  const mine = { ...PLANTED(198), id: "abc" };
  const theirs = { ...PLANTED(199), id: "abc", root: "/another-checkout" };
  const log = [...Array.from({ length: 198 }, (one, n) => PLANTED(n)), mine, theirs];
  assert.equal(markOf(log, mine), null, "mine is the 199th, whatever id the 200th shares with it");
  assert.match(markOf(log, theirs), /200 answered consults/u, "and theirs is the one that landed on it");
});
