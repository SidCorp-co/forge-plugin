/* What a reply says and what a round makes of it: what is replayed, what is counted, what a verdict
   decides and what a follow-up round is asked to verify — on entries handed in, never on a file. */
import assert from "node:assert/strict";
import test from "node:test";
import { jsonlOf, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so anything reading the real log path reads a sandbox. */
const sandbox = tempRoom("forge-codex-log-replies-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  verdictsBy,
} = await import("../../../src/codex/codex-log.mjs");
const {
  countedIn,
  digestOf,
  findingsIn,
  historyFor,
  modelKey,
  numbered,
  outcomeOf,
  recheckOwed,
  authorNote,
  recheckPlan,
  recheckSaid,
  recheckRange,
  recheckRisks,
  rulingsIn,
  rulingsUnread,
  ruledOn,
  scoreOf,
  undecidedIn,
  unverdicted,
  verdictFromRulings,
  verdictRecord,
} = await import("../../../src/codex/log/replies.mjs");

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

/* Five issues were filed on this one parser and three runs wrote a false verdict to clear the commit
   gate, because `--only blocker,major` is what puts those words in front of the reviewer and a clean
   summary echoes them back to say none was found. The labels below are three of the fourteen the log
   actually held; the count line was the reading that was right for all fourteen. ISS-651. */
test("a reply that counts itself at zero made no findings, whatever its bullets are labelled", () => {
  const clean = [
    "- **Shared primitives — no blocker or major regression found in the supplied diffs.** The JSONL helper preserves directory selection.",
    "- **Blocker floor is `developed`:** Matches the stated intent; the contract was not independently checked.",
    "- **Tech Lead — không thấy blocker/major mới:** mốc đọc giữ được cả một nhịp trước hiện tại.",
    "",
    "CODEX: 0 findings",
  ].join("\n");
  assert.deepEqual(numbered(clean), [], "three labels naming a severity, and the reply counted itself at zero");
  assert.deepEqual(findingsIn(clean), [], "so the round is handed none of them");

  const own = `- **F1 — Still open — major:** \`a.mjs:12\` — the lock is released by path.\n${clean}`;
  assert.deepEqual(numbered(own).map((one) => one.id), ["F1"], "an id the reviewer wrote stands whatever the count says");

  const headerless = "- **New — major:** `a.mjs:1` — a.\n- **New — minor:** `a.mjs:2` — b.";
  assert.deepEqual(numbered(headerless).map((one) => one.id), ["F1", "F2"], "no count line, so the positional fallback is untouched");
  assert.deepEqual(numbered(`CODEX: 2 findings (2 major)\n${headerless}`).map((one) => one.id), ["F1", "F2"], "a count above zero leaves the fallback alone");

  const last = { id: "c1", at: "1", files: ["a.mjs"], reply: clean };
  const bare = verdictRecord(last, { note: "nothing to decide" });
  assert.deepEqual([bare.record.accepted, bare.record.rejected, bare.undecided], [0, 0, 0], "a bare note closes it rather than being refused over F1");
  assert.match(verdictRecord(last, { rejected: "F1=the reply made none" }).problem, /made no finding F1; it made none/u, "and the id it never gave is refused");
  assert.equal(
    unverdicted(jsonlOf([{ kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply: clean }]), "/a"),
    null,
    "so the commit gate holds nothing on it",
  );
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
  assert.equal(row.median, 40, "two timed consults at 60s and 20s: the mean of the two middles, not the upper of them (ISS-364)");
  const untimed = scoreOf([...entries, { kind: "consult", id: "4", ok: true, root: "/a", at: "4", model: "m", reply: "CODEX: 0 findings" }]);
  assert.equal(untimed[0].median, 40, "a consult that recorded no duration is left out of the median, not counted as nought");
  const [none] = scoreOf([{ kind: "consult", id: "5", ok: true, root: "/a", at: "5", model: "n", reply: "CODEX: 0 findings" }]);
  assert.equal(none.median, 0, "and a row no consult of which was timed pads a number into the column, never the word null");
  assert.equal(row.cached, 50);
  assert.equal(row.input, 150, "every input token, cached ones included");
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
  assert.match(recheckSaid(auto.record), /still open: F2/u, "CONFIRMED stays open, CANNOT TELL is neither");
  assert.match(auto.said, /verdict --of c1/u);
  const shifted = verdictFromRulings(plan, 1, RECHECK_REPLY, "r1");
  assert.deepEqual(shifted.record.kept, [], "a --verify risk before the list shifts the numbering");
  assert.match(recheckSaid(shifted.record), /still open: F1/u);
  assert.equal(verdictFromRulings(plan, 0, "CODEX: 0 findings", "r1"), null, "no rulings, no verdict");
  const prior = { kept: ["F3", "F9"], dropped: { F2: "by design" } };
  const merged = verdictFromRulings(plan, 0, RECHECK_REPLY, "r2", prior);
  assert.deepEqual(merged.record.kept, ["F3", "F9", "F1"], "what an earlier verdict kept survives the recheck's, and the recheck decides the rest");
  assert.deepEqual(merged.record.dropped, { F2: "by design" }, "a finding the recheck confirms keeps the ruling the author gave it");
  assert.equal(merged.record.reopened, undefined, "CONFIRMED and CANNOT TELL reopen nothing the author decided");
  assert.deepEqual(merged.record.stood, { F2: "CONFIRMED", F3: "CANNOT TELL" }, "what the recheck said of them is kept beside the rulings, not over them");
  const unsure = verdictFromRulings(plan, 0, "1. **CANNOT TELL** — a\n2. **CANNOT TELL** — b\n3. **CANNOT TELL** — c", "r3", { kept: ["F1", "F2", "F3"], dropped: {} });
  assert.deepEqual([unsure.record.kept, unsure.record.reopened], [["F1", "F2", "F3"], undefined], "a recheck sure of nothing takes nothing back");
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

/* The incident ISS-1881 was filed from, at 3.36.142: the author accepted F2 and rejected F1 with a
   reason, and the recheck that refuted F2 and confirmed F1 wrote 1 accepted, 0 rejected over both. */
test("a recheck leaves the author's ruling and its reason standing, and says what it newly found anyway", () => {
  const judged = { id: "95d1dc", files: ["a.mjs"], reply: "- **F1 — New — minor:** `a.mjs:1` — x.\n- **F2 — New — minor:** `a.mjs:2` — y." };
  const plan = { judged, ids: ["F1", "F2"], risks: [] };
  const ruled = verdictRecord(judged, { accepted: "F2", rejected: "F1=routed to the issue that owns it", note: "both minor" });
  const after = verdictFromRulings(plan, 0, "1. **CONFIRMED** — still there.\n2. **REFUTED** — fixed.", "e433e1", ruled.record);
  assert.deepEqual(after.record.dropped, { F1: "routed to the issue that owns it" },
    "a confirmation is the reviewer standing by its finding, never the author withdrawing a rejection");
  assert.deepEqual([after.record.accepted, after.record.rejected], [1, 1], "the counts stay the ones the author recorded");
  assert.deepEqual(after.record.stood, { F1: "CONFIRMED", F2: "REFUTED" }, "and what the recheck found survives beside them");
  assert.equal(after.record.note, "both minor", "the author's note on the consult as a whole survives the write, and nothing is folded into it");
  assert.equal(recheckSaid(after.record), "from recheck e433e1; your ruling stands on F1 (CONFIRMED), F2 (REFUTED)",
    "the clause naming the recheck is composed from the row, so the two writes stay apart in the log");
  assert.match(after.said, /F1 \(rejected, and the recheck said CONFIRMED\)/u, "the run is told, rather than reading the log to find out");
  assert.match(after.said, /verdict --of 95d1dc/u, "with the one command that settles it");
  assert.deepEqual(undecidedIn(["F1", "F2"], after.record), [], "and the commit gate reads a review with nothing standing");

  /* Provenance is per finding, so a recheck may revise its own earlier word and never the author's. */
  const first = verdictFromRulings(plan, 0, "1. **CONFIRMED** — still there.\n2. **CONFIRMED** — still there.", "r1", null);
  assert.deepEqual(first.record.auto, ["F1", "F2"], "a recheck marks the ids it decided as its own");
  const second = verdictFromRulings(plan, 0, "1. **REFUTED** — fixed now.\n2. **REFUTED** — fixed now.", "r2", first.record);
  assert.deepEqual([second.record.kept, second.record.stood], [["F1", "F2"], undefined], "a later recheck revises what an earlier one ruled");
  const taken = verdictRecord(judged, { rejected: "F1=by design", accepted: "F2" }, first.record);
  assert.equal(taken.record.auto, undefined, "the author ruling on them takes both ids out of the recheck's");
  const third = verdictFromRulings(plan, 0, "1. **REFUTED** — fixed now.\n2. **REFUTED** — fixed now.", "r3", taken.record);
  assert.deepEqual(third.record.dropped, { F1: "by design" }, "so the recheck after it moves nothing");

  /* A status folded into the note outlives the write it was true of: r2 accepted what r1 left open,
     and a note carrying r1's clause would have said both at once, for every recheck after it. */
  assert.equal(second.record.note, undefined, "no recheck's status reaches the next record's note");
  assert.equal(recheckSaid(second.record), "from recheck r2", "and the row's own clause names only the recheck that wrote it");
  const noted = verdictFromRulings(plan, 0, "1. **CONFIRMED** — still there.\n2. **CONFIRMED** — still there.", "r4", { note: "both minor" });
  const twice = verdictFromRulings(plan, 0, "1. **REFUTED** — fixed.\n2. **REFUTED** — fixed.", "r5", noted.record);
  assert.equal(twice.record.note, "both minor", "the author's line is carried whole however many rechecks follow it");
  assert.equal(recheckSaid(twice.record), "from recheck r5", "with no clause of r4's left saying they are still open");
  assert.equal(recheckSaid({ from: "r6", note: "from recheck r6; still open: F1" }), "",
    "a row of the older shape folded the clause into its note, and printing it twice is not a second write");

  /* Carrying an older row's note whole would have put that row's clause on the next recheck's. */
  const legacy = { of: "c1", from: "r7", accepted: 0, rejected: 0, kept: [], dropped: {}, reopened: ["F1", "F2"], note: "both minor; from recheck r7; still open: F1, F2" };
  const onto = verdictFromRulings(plan, 0, "1. **REFUTED** — fixed.\n2. **REFUTED** — fixed.", "r8", legacy);
  assert.equal(onto.record.note, "both minor", "the author's line is kept and the older row's own clause is not");
  assert.equal(recheckSaid(onto.record), "from recheck r8", "so the row says what this recheck did and nothing of the last one's");
  assert.deepEqual(onto.record.kept, ["F1", "F2"], "and a ruling no author made is still the recheck's to revise");
  const plain = verdictRecord(judged, { accepted: "F1,F2" }, legacy);
  assert.equal(plain.record.note, "both minor", "an author write naming no note keeps theirs, not the older row's clause");

  /* The older shape is read as a whole clause, so an author's prose naming a recheck is their line. */
  const prose = { of: "c1", from: "r9", auto: [], kept: [], dropped: {}, note: "Evidence from recheck r9 supports my rejection" };
  assert.equal(authorNote(prose), "Evidence from recheck r9 supports my rejection", "a substring inside a sentence is not the composed clause");
  assert.equal(verdictFromRulings(plan, 0, "1. **REFUTED** — fixed.", "r10", prose).record.note,
    "Evidence from recheck r9 supports my rejection", "so the carry keeps every word of it");
  assert.equal(verdictRecord(judged, { accepted: "F1,F2" }, prose).record.note, "Evidence from recheck r9 supports my rejection",
    "and so does the author's own next write");
  assert.equal(recheckSaid(prose), "from recheck r9", "and the row's clause is still printed, not suppressed by their prose");
});

test("the commit gate asks about the last consult that made findings and heard nothing", () => {
  const withFindings = { kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], reply: "- **F1 — New — major:** `a.mjs:1` — x." };
  const quiet = { kind: "consult", id: "c2", ok: true, root: "/a", at: "2", files: ["b.mjs"], reply: "CODEX: 0 findings" };
  assert.deepEqual(unverdicted(jsonlOf([withFindings, quiet]), "/a"), { id: "c1", ids: ["F1"], open: ["F1"], files: ["a.mjs"], at: "1" }, "a later empty consult does not answer for it");
  assert.equal(unverdicted(jsonlOf([withFindings, quiet, { kind: "verdict", of: "c1", accepted: 1, rejected: 0 }]), "/a"), null, "a count-form verdict decided everything");
  const two = { ...withFindings, reply: `${withFindings.reply}\n- **F2 — New — minor:** \`a.mjs:2\` — y.` };
  const partial = { kind: "verdict", of: "c1", accepted: 1, rejected: 0, kept: ["F1"], dropped: {}, from: "r1" };
  assert.deepEqual(unverdicted(jsonlOf([two, partial]), "/a").open, ["F2"], "a recheck's partial verdict leaves what it confirmed open");
  assert.equal(unverdicted(jsonlOf([two, { ...partial, dropped: { F2: "by design" } }]), "/a"), null);
  const merged = verdictRecord({ id: "c1", files: ["a.mjs"], reply: two.reply }, { rejected: "F2=by design" }, partial);
  assert.deepEqual([merged.record.kept, merged.record.dropped, merged.undecided], [["F1"], { F2: "by design" }, 0], "a later verdict adds to the recheck's");
  const flipped = verdictRecord({ id: "c1", files: ["a.mjs"], reply: two.reply }, { rejected: "F1=wrong after all" }, partial);
  assert.deepEqual([flipped.record.kept, Object.keys(flipped.record.dropped)], [[], ["F1"]], "the newer word wins");
  assert.equal(unverdicted(jsonlOf([withFindings]), "/b"), null, "another root's consult is not this tree's");
});

test("history replays the findings, rulings and outcomes, not the prose", () => {
  const held = { kept: ["F1"], dropped: { F2: "by design" } };
  const digest = digestOf(`## Tech Lead\n\n${RECHECK_REPLY}\n\nLong preamble that costs tokens.\n- **F2 — New — minor:** \`a.mjs:70\` — small.`, held);
  assert.match(digest, /^1\. \*\*REFUTED\*\*/u, "rulings first");
  /* 870 of 931 logged rechecks opened with the ruling and 11 more with the angle's heading; none put prose
     in front of it. So prose in front is read as ruling nothing, which the recheck says rather than hides. */
  assert.doesNotMatch(digestOf(`Some framing first.\n\n${RECHECK_REPLY}`, held), /^1\. \*\*REFUTED\*\*/u,
    "an answer opens the reply, so prose in front of it costs the rulings rather than being skipped past");
  assert.match(digest, /CODEX: 1 findings/u);
  assert.match(digest, /- F1 — New — major: `a.mjs:60` — something new\. → accepted/u);
  assert.match(digest, /- F2 — .* → rejected — by design/u);
  assert.doesNotMatch(digest, /Long preamble/u);
  assert.equal(digestOf("Nothing material here.", null), "Nothing material here.", "prose with no structure is replayed as it was");
  assert.equal(digestOf("## Tech Lead\n\nA paragraph of reasons.\n\nCODEX: 0 findings\n\nMore prose after.", null), "CODEX: 0 findings", "a converged reply is one line");
  const [replayed] = historyFor([{ kind: "consult", id: "c1", ok: true, root: "/a", at: "1", files: ["a.mjs"], intent: "x", reply: "Preamble.\n- **F1 — New — major:** `a.mjs:1` — x." }], "/a", 3, ["a.mjs"]);
  assert.equal(replayed.reply, "CODEX: 1 findings\n- F1 — New — major: `a.mjs:1` — x.", "what travels is the digest");
});

/* A row from before the effort moved onto the model states a level the gateway never read, so it is a
   treatment of its own however much of its label matches one written after. */
test("the channel is part of the key, and a row recording none keys apart from one that does", () => {
  assert.equal(modelKey({ model: "cx/gpt-6-astra-high", effort: "low" }), "cx/gpt-6-astra-high @low via unrecorded");
  assert.equal(modelKey({ model: "cx/gpt-6-astra-high", effort: "high", effortVia: "model" }), "cx/gpt-6-astra-high via model");
  assert.equal(modelKey({ model: "cx/gpt-5.6-sol", effort: "medium", effortVia: "parameter" }),
    "cx/gpt-5.6-sol @medium via parameter");
  assert.notEqual(modelKey({ model: "cx/gpt-5.6-sol", effort: "medium" }),
    modelKey({ model: "cx/gpt-5.6-sol", effort: "medium", effortVia: "parameter" }),
    "the same model at the same level either side of the change is two treatments, not one");
  assert.equal(modelKey({ slot: "codex" }), "codex via unrecorded");
});

/* Where the model carried the effort its id already says which rung answered, so the level the rule
   asked for is not repeated in the key: `--effort high` falling back to the base rung's model is the
   same treatment as a consult that resolved that rung outright. */
test("two consults answered by one rung score as one group, whatever level each asked for", () => {
  const rows = ["high", "medium"].map((effort, at) => ({
    kind: "consult", id: `${at}`, ok: true, root: "/a", at: `${at}`,
    model: "cx/gpt-6-astra-medium", effort, effortVia: "model", reply: "CODEX: 0 findings",
  }));
  const scored = scoreOf(rows);
  assert.equal(scored.length, 1, "one rung is one treatment");
  assert.equal(scored[0].consults, 2);
});

/* The fifteen rows ISS-651 left in the developer's log ruled on an id the parser invented for a reply
   counting itself at zero; the log keeps them, and the score counts only what the reply made. */
test("a verdict on a finding the consult never made counts for nothing, and the row stays", () => {
  const zero = { kind: "consult", id: "z", ok: true, root: "/a", at: "1", model: "m", reply: "CODEX: 0 findings\n\n- **Blocker:** none found." };
  const made = { kind: "consult", id: "r", ok: true, root: "/a", at: "2", model: "m",
    reply: "CODEX: 2 findings\n- **F1 — New — major:** `a.mjs:1` — a.\n- **F2 — New — minor:** `a.mjs:2` — b." };
  const phantom = { kind: "verdict", of: "z", at: "3", accepted: 2, rejected: 1, kept: ["F1", "F2"], dropped: { F3: "no" } };
  const real = { kind: "verdict", of: "r", at: "4", accepted: 1, rejected: 1, kept: ["F1"], dropped: { F2: "wrong" } };
  const [row] = scoreOf([zero, made, phantom, real]);
  assert.equal(row.accepted, 1, "the phantom row's two acceptances are not counted, the real one is");
  assert.equal(row.rejected, 1, "nor its rejection");
  assert.deepEqual(ruledOn(phantom, zero), { accepted: 0, rejected: 0, sound: 0, misreasoned: 0 });
  assert.deepEqual(ruledOn(real, made), { accepted: 1, rejected: 1, sound: 0, misreasoned: 0 }, "a row naming only ids the reply made reads as its own totals");
  assert.equal(verdictsBy([zero, phantom]).get("z"), phantom, "the row itself is still read back whole");
  const counted = { kind: "verdict", of: "z", accepted: 3, rejected: 1 };
  assert.deepEqual(ruledOn(counted, zero), { accepted: 3, rejected: 1, sound: 0, misreasoned: 0 }, "a count-form row names no id, so its totals stand");
  assert.deepEqual(ruledOn({ ...counted, counted: true, kept: ["F9"], dropped: {} }, zero), { accepted: 3, rejected: 1, sound: 0, misreasoned: 0 },
    "and a count-form row a later word added ids to keeps its totals too");
  assert.deepEqual(ruledOn(phantom, undefined), { accepted: 2, rejected: 1, sound: 0, misreasoned: 0 }, "with no consult to read, the totals are all there is");
});

/* Every shape logged against ISS-1336 and ISS-1681 in one case, plus the one the head grammar refuses:
   a ruling word reached through prose is a recollection and not an answer, and closing on it would be
   worse than leaving the finding open. */
test("a ruling is the word at the head of a numbered line, whatever the reply wraps it in", () => {
  const judged = { id: "c1", files: ["a.mjs"], reply: "- **F1 — New — blocker:** `a.mjs:12` — x." };
  const plan = { judged, ids: ["F1"], risks: [] };
  const keptOf = (reply) => verdictFromRulings(plan, 0, reply, "r1")?.record.kept ?? null;
  assert.deepEqual(keptOf("1. **F1 — REFUTED (resolved).**"), ["F1"], "the id in front of the word, inside the bold run");
  assert.deepEqual(keptOf("1. **REFUTED — F1 resolved.**"), ["F1"], "the word first and the resolution behind it");
  assert.deepEqual(keptOf("1. **F1 - REFUTED (Resolved).**\nCODEX: 0 findings"), ["F1"], "a hyphen, a capital, and a zero count under it");
  assert.deepEqual(keptOf("1. REFUTED"), ["F1"], "no bold anywhere on the line");
  assert.deepEqual(keptOf("1. F1 — REFUTED (resolved)"), ["F1"], "the id in front and no bold at all");
  assert.equal(keptOf("1. The earlier answer was REFUTED; my ruling is CONFIRMED."), null,
    "a ruling word only prose reaches is not a ruling, so nothing is closed on it");
  assert.deepEqual(keptOf("1. **F1** — **REFUTED**"), ["F1"], "the id emphasised apart from the dash that follows it");
  const quoted = ["1. **CONFIRMED** — the defect is still there.", "", "```", "1. F1 - REFUTED", "```"].join("\n");
  assert.deepEqual(keptOf(quoted), [], "a fenced example of a ruling is shown, not made, and cannot overwrite the answer above it");
  assert.match(recheckSaid(verdictFromRulings(plan, 0, quoted, "r1").record), /still open: F1/u, "the CONFIRMED above the fence is the answer that stands");
  assert.doesNotMatch(digestOf(quoted, null), /F1 - REFUTED/u, "and the fence is not replayed as a second ruling either");
  const inner = ["```markdown", "    ```", "1. F1 - REFUTED", "```", "1. **CONFIRMED** — the defect remains."].join("\n");
  assert.deepEqual(keptOf(inner), [], "an indented fence run is literal content, so it closes nothing and the answer below the real fence stands");
  const indented = ["Example (not my ruling):", "", "    1. F1 - REFUTED", "", "1. **CONFIRMED** — the defect remains.", "CODEX: 0 findings"].join("\n");
  assert.equal(keptOf(indented), null, "four spaces is how markdown shows code, and prose ahead of it opens no answer block either");
  assert.doesNotMatch(digestOf(indented, null), /F1 - REFUTED/u, "and the indent is not stripped into a replayed ruling");
  assert.deepEqual(keptOf("1. **Tech Lead / Business Analyst — F1: REFUTED — Resolved.**"), ["F1"],
    "the angle's own name is a wrapper like the id is; this shape alone was 50 of 931 logged rechecks");
  const two = { judged: { id: "c4", files: [], reply: "- **F1 — New — major:** `a.mjs:1` — x.\n- **F2 — New — minor:** `a.mjs:2` — y." }, ids: ["F1", "F2"], risks: [] };
  const nestedAnswer = "1. CONFIRMED — F1 remains. I cannot assess F2; the nested line is an example only:\n   2. F2 — REFUTED";
  assert.deepEqual(verdictFromRulings(two, 0, nestedAnswer, "rA").record.kept, [],
    "three spaces is a nested list item under the answer, so the example inside it rules nothing");
  assert.equal(keptOf("1. Previous answer: REFUTED; my ruling is CANNOT TELL."), null,
    "only the angle's own name stands in front of a ruling; prose ending in a colon is still prose");
  assert.equal(keptOf(" Example only; I cannot decide the finding:\n\n1. F1 - REFUTED"), null,
    "one leading space does not make a disclaimer a continuation line: the block opens with a ruling or there is none");
  assert.equal(keptOf("## Tech Lead — Example only; I cannot decide the finding:\n\n1. F1 - REFUTED"), null,
    "the label is matched whole, so an angle's name in front of a disclaimer buys it nothing");
  assert.equal(keptOf("## Example only; I cannot decide the finding:\n\n1. F1 - REFUTED"), null,
    "a disclaimer is as free to be a heading as a label is, so only the angle's own name opens ahead of the block");
  const disclaimed = ["CODEX: 0 findings", "", "Example only; I cannot decide the finding:", "", "1. F1 - REFUTED"].join("\n");
  assert.equal(keptOf(disclaimed), null, "a ruling-shaped line the reply disclaims is not in the block it opens with, so it rules nothing");
  assert.doesNotMatch(digestOf(disclaimed, null), /F1 - REFUTED/u, "and the disclaimer is not stripped off it in replay");
  assert.deepEqual(verdictFromRulings({ judged: { id: "c3", files: [], reply: judged.reply }, ids: ["F1"], risks: [] }, 0,
    "### Tech Lead\n\n1. **REFUTED** — fixed.", "r0")?.record.kept, ["F1"], "the angle's own heading opens the block, which 11 of 931 logged rechecks needed");
  const nested = ["````markdown", "```text", "1. F1 - REFUTED", "```", "````", "1. **CONFIRMED** — the defect is still there."].join("\n");
  assert.deepEqual(keptOf(nested), [], "an inner fence inside a longer one is part of the example, not the end of it");
  assert.doesNotMatch(digestOf(nested, null), /F1 - REFUTED/u, "and the nested example is not replayed as a ruling either");
  assert.deepEqual(keptOf("1. **REFUTED** — fixed.\n1. **CONFIRMED** — quoting my earlier answer."), ["F1"],
    "the block asks the reviewer to lead with the rulings, so the first answer under a number stands");
  const seven = { id: "c2", files: ["a.mjs"], reply: "- **F7 — New — major:** `a.mjs:9` — y." };
  const byPlace = verdictFromRulings({ judged: seven, ids: ["F7"], risks: [] }, 0, "1. **F3 — REFUTED (resolved).**", "r2");
  assert.deepEqual(byPlace.record.kept, ["F7"], "the ruling answers the risk of its number; the id it names is wrapper, not mapping");
});

/* Nothing else prints a recheck's own id, so a run ruling by hand had the judged consult's and wrote a
   placeholder for this one; and silence where no ruling was read is what sent five runs to a later door. */
test("a recheck the reader could not rule from says so, naming itself and the way out", () => {
  const judged = { id: "c1", files: ["a.mjs"], reply: "- **F1 — New — blocker:** `a.mjs:12` — x." };
  const plan = { judged, ids: ["F1"], risks: [] };
  const prose = rulingsUnread(plan, 0, "1. The earlier answer was REFUTED; my ruling is CONFIRMED.\nCODEX: 0 findings", "r7");
  assert.match(prose, /recheck r7 ruled on none of F1 of consult c1/u, "the recheck, the findings and the consult");
  assert.match(prose, /The earlier answer was REFUTED/u, "the numbered line it could not rule from, quoted back");
  assert.match(prose, /is not an answer the reader could take/u, "and why that line ruled nothing");
  assert.match(prose, /forge codex verdict --of c1/u, "the one command that clears it");
  assert.match(rulingsUnread(plan, 0, "It all reads fine to me now.", "r8"), /numbered no line at all/u,
    "a reply that numbered nothing has no line to quote and says that instead");
  assert.match(rulingsUnread(plan, 1, "1. **REFUTED** — the caller's own risk", "r9"), /numbered rulings 1, and F1 answer 2 to 2/u,
    "a --verify risk ahead of the list shifts the numbering, which is a third reason and not a missing line");
  assert.match(verdictFromRulings(plan, 0, "1. **REFUTED** — a", "r9").said, /from recheck r9/u,
    "a recorded verdict names the recheck too, so the id is printed either way");
});
