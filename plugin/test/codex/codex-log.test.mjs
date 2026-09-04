/* The log is codex's memory and its eval set, so what it replays, what it counts and what a follow-up
   round is asked to verify are decided here — on entries handed in, never on this machine's file. */
import assert from "node:assert/strict";
import test from "node:test";
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
  logEntries,
  pairedLog,
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
