/* What a recheck says about the findings its own set left out: the narrower set dropped them and the
   sentence then claimed the CONSULT found nothing, while the gate refused for the same F1 (ISS-1873). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so anything reading the real log path reads a sandbox. */
const sandbox = tempRoom("forge-codex-log-recheck-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  recheckMissed,
  recheckOwed,
  recheckPlan,
  recheckVia,
  verdictFromRulings,
} = await import("../../../src/codex/log/replies.mjs");
const { sameBytesSince, verdictsBy } = await import("../../../src/codex/codex-log.mjs");
const { digestsAt } = await import("../../../src/codex/codex-set.mjs");
const { bundle } = await import("../../../src/codex/codex-api.mjs");

const JUDGED = {
  kind: "consult", id: "c55", ok: true, root: "/a", at: "1", head: "38cac7b7",
  files: ["a.mjs", "docs/FORGE-CLI.md"], send: "bodies",
  sent: [{ rel: "a.mjs", chars: 9, clipped: false }, { rel: "docs/FORGE-CLI.md", chars: 9, clipped: false }],
  reply: "CODEX: 1 findings\n- **New — minor:** `docs/FORGE-CLI.md:12` — the row names a flag that is gone.",
};

test("a set that excluded the judged consult's findings says so and names what reaches them", () => {
  const narrow = recheckOwed(recheckPlan([JUDGED], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/found nothing/u.test(narrow), false, "the consult found something, and this set is not where");
  assert.match(narrow, /consult c55 made F1 on docs\/FORGE-CLI\.md/u, "the finding by the id its consult gave it, beside the file it is anchored on");
  assert.match(narrow, /othing says what became of F1/u, "and that it is the one a commit gate refuses for");
  assert.match(narrow, /forge codex consult --recheck --of c55`/u, "with the route that pins the consult the finding was made by");

  /* `judgedBy` takes the LAST consult sharing ANY of the files, so a set the route typed could select a
     newer one; the id cannot (ISS-378). */
  const newer = { kind: "consult", id: "c77", ok: true, root: "/a", at: "2", files: ["docs/FORGE-CLI.md"], send: "bodies", reply: "CODEX: 0 findings" };
  const shadowed = recheckOwed(recheckPlan([JUDGED, newer], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(shadowed, /forge codex consult --recheck --of c55`/u, "a newer consult sharing a file does not take the route from c55");
  assert.equal(recheckPlan([JUDGED, newer], "/a", JUDGED.files, JUDGED).judged.id, "c55", "and the route lands where it says");

  const ruled = recheckOwed(recheckPlan([JUDGED, { kind: "verdict", of: "c55", kept: ["F1"], dropped: {} }], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/othing says what became of/u.test(ruled), false, "a finding the author ruled on is no gate obligation");
  assert.match(ruled, /already carries your ruling/u);

  /* A reviewer reads beyond what it was sent, so a finding can be anchored where no route reaches. */
  const elsewhere = { ...JUDGED, reply: "CODEX: 1 findings\n- **New — major:** `tools/run.mjs:1` — the lock is released by path." };
  const unreachable = recheckOwed(recheckPlan([elsewhere], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.equal(/--recheck/u.test(unreachable), false, "a route that leaves the finding out again is no route");
  assert.match(unreachable, /anchored on a file that consult never recorded/u);
  assert.match(unreachable, /forge codex verdict --of c55/u);

  const empty = recheckOwed(recheckPlan([{ ...JUDGED, reply: "CODEX: 0 findings" }], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(empty, /read this set whole/u, "a consult that made no findings still gets the coverage sentence");
  assert.equal(recheckMissed(recheckPlan([JUDGED], "/a", ["a.mjs", "docs/FORGE-CLI.md"])), null, "every finding inside the set: nothing left out");
});

/* One finding inside the set and one outside: the recheck runs, and says what it does not reach. */
test("a recheck that does go ahead names the finding its set does not reach", () => {
  const both = { ...JUDGED, reply: `${JUDGED.reply}\n- **New — major:** \`a.mjs:3\` — the lock is released by path.` };
  const plan = recheckPlan([both], "/a", ["a.mjs"]);
  assert.deepEqual(plan.ids, ["F2"], "only the finding this set holds is verified");
  assert.equal(recheckOwed(plan, ["a.mjs"]), null, "there is something to recheck, so nothing is refused");
  assert.match(recheckMissed(plan), /also made F1 on docs\/FORGE-CLI\.md/u);
  /* This round writes a consult of its own over these files, which a route pinned by id cannot land on. */
  assert.match(recheckMissed(plan), /forge codex consult --recheck --of c55`/u, "the route after this round still reaches c55");
  const settled = recheckPlan([both, { kind: "verdict", of: "c55", kept: ["F1"], dropped: {} }], "/a", ["a.mjs"]);
  assert.equal(recheckMissed(settled), null, "a finding already disposed of holds no gate, so it is not named mid-round");
  const answered = { kind: "consult", id: "c99", ok: true, root: "/a", at: "3", files: ["a.mjs"], send: "bodies", reply: "CODEX: 0 findings" };
  assert.equal(recheckPlan([both, answered], "/a", ["a.mjs", "docs/FORGE-CLI.md"]).judged.id, "c99",
    "a recheck given no --of answers the last answered consult sharing any file of its set");
});

/* A plan or criteria file lies outside the checkout, so its consult records the real path and the
   reviewer anchors on the name it would write: the two have to meet, or every correction costs a
   fresh whole consult (ISS-2336). */
const OUT = "/tmp/run-9/scratch/criteria.md";
const PLAN = "/tmp/run-9/scratch/plan.md";
const outside = (reply, files = [PLAN, OUT]) => ({
  kind: "consult", id: "o1", ok: true, root: "/a", at: "1", files, send: "bodies",
  sent: files.map((rel) => ({ rel, chars: 9, clipped: false })), reply,
});

test("a recheck over a file outside the checkout reaches the findings anchored on its bare name or its tail", () => {
  const judged = outside("CODEX: 3 findings\n- **New — major:** `criteria.md:4` — two outcomes on one line.\n"
    + "- **New — minor:** `scratch/criteria.md:1` — the clause is cited without its revision.\n"
    + "- **New — minor:** `plan.md:2` — a step names no criterion.");
  const plan = recheckPlan([judged], "/a", [OUT]);
  assert.deepEqual(plan.ids, ["F1", "F2"], "the bare name and the path tail both resolve to the one recorded file");
  assert.match(plan.risks[0], /Your earlier finding F1 .*two outcomes on one line/u, "and each goes to the reviewer as a risk");
  assert.match(plan.risks[1], /Your earlier finding F2 .*without its revision/u);
  assert.equal(recheckOwed(plan, [OUT]), null, "so the recheck has something to verify and is not refused");
  assert.match(recheckMissed(plan, [OUT]), /also made F3 on plan\.md/u, "the finding on the file this set left out is still named");
});

test("a tail two recorded files share is no one's, even where the recheck names only one of them", () => {
  const other = "/tmp/run-7/criteria.md";
  const judged = outside("CODEX: 1 findings\n- **New — major:** `criteria.md:4` — two outcomes on one line.", [OUT, other]);
  const plan = recheckPlan([judged], "/a", [OUT]);
  assert.deepEqual(plan.ids, [], "attributed to neither file");
  const said = recheckOwed(plan, [OUT]);
  assert.match(said, /made F1 on criteria\.md, and this set holds no such file — it holds \/tmp\/run-9\/scratch\/criteria\.md/u,
    "the refusal names the anchor it looked for and the files the set holds");
  assert.match(said, /anchored on a file that consult never recorded — it recorded \/tmp\/run-9\/scratch\/criteria\.md \/tmp\/run-7\/criteria\.md/u);
  assert.match(said, /forge codex verdict --of o1/u, "and the route out is the verdict");
});

test("an anchor naming no recorded file stays out, and a relative path is matched whole", () => {
  const stray = outside("CODEX: 1 findings\n- **New — major:** `notes.md:4` — the lock is released by path.");
  const said = recheckOwed(recheckPlan([stray], "/a", [OUT]), [OUT]);
  assert.match(said, /made F1 on notes\.md, and this set holds no such file — it holds \/tmp\/run-9\/scratch\/criteria\.md/u);
  assert.match(said, /forge codex verdict --of o1/u);
  assert.equal(/--recheck/u.test(said), false, "no recheck reaches it, so none is offered");

  const inside = { ...JUDGED, reply: "CODEX: 1 findings\n- **New — minor:** `FORGE-CLI.md:12` — the row names a flag that is gone." };
  const bare = recheckPlan([inside], "/a", ["docs/FORGE-CLI.md"]);
  assert.deepEqual(bare.ids, [], "a bare name inside the checkout is not resolved to docs/FORGE-CLI.md");
  assert.deepEqual(recheckPlan([JUDGED], "/a", ["docs/FORGE-CLI.md"]).ids, ["F1"], "the exact relative path still matches");
});

test("a file the recheck adds is not handed a finding the consult anchored on a file it never recorded", () => {
  const notes = "/tmp/run-9/scratch/notes.md";
  const judged = outside("CODEX: 1 findings\n- **New — major:** `notes.md:4` — the lock is released by path.", [OUT]);
  const plan = recheckPlan([judged], "/a", [OUT, notes]);
  assert.deepEqual(plan.ids, [], "notes.md was never in the consult's set, so the recheck's copy of it does not reach F1");
  assert.match(recheckOwed(plan, [OUT, notes]), /forge codex verdict --of o1/u);
});

/* The ISS-513 sequence: consult 52d00e made F1, recheck a5033d over one file raised nothing of its own
   and left F1 open, and the next unpinned recheck was refused as though a5033d were a clean whole-set
   read (ISS-2643). */
const ORIGIN = {
  kind: "consult", id: "52d00e", ok: true, root: "/a", at: "1", head: "b2cd0c46", files: ["a.mjs", "b.mjs"], send: "bodies",
  sent: [{ rel: "a.mjs", chars: 9, clipped: false }, { rel: "b.mjs", chars: 9, clipped: false }],
  reply: "CODEX: 1 findings\n- **F1 — New — major:** `a.mjs:3` — the comment names the wrong rule.",
};
const FIRST = {
  kind: "consult", id: "a5033d", ok: true, root: "/a", at: "2", head: "b2cd0c46", files: ["a.mjs"], send: "bodies", recheck: true,
  sent: [{ rel: "a.mjs", chars: 9, clipped: false }],
  reply: "1. **CANNOT TELL** — the criterion's wording is on the tracker.\n\nCODEX: 0 findings",
};
const LEFT_OPEN = { kind: "verdict", of: "52d00e", from: "a5033d", kept: [], dropped: {}, reopened: ["F1"], auto: ["F1"] };

test("an unpinned recheck after a recheck that left a finding open answers the consult that finding belongs to", () => {
  const plan = recheckPlan([ORIGIN, FIRST, LEFT_OPEN], "/a", ["a.mjs"]);
  assert.equal(plan.judged.id, "52d00e", "the consult whose finding is open, not the recheck that left it open");
  assert.deepEqual(plan.ids, ["F1"]);
  assert.equal(recheckOwed(plan, ["a.mjs"]), null, "there is a finding to verify, so nothing is refused");
  assert.match(recheckVia(plan), /^recheck a5033d left F1 of consult 52d00e open, so this recheck answers 52d00e,/u);

  /* A recheck that ruled nothing wrote no verdict, so its own row is what names the consult. */
  const silent = recheckPlan([ORIGIN, { ...FIRST, rechecked: "52d00e" }], "/a", ["a.mjs"]);
  assert.equal(silent.judged.id, "52d00e", "the row's own link is followed where no verdict carries one");
  assert.equal(recheckVia(recheckPlan([ORIGIN], "/a", ["a.mjs"])), null, "a recheck that followed nothing says nothing of it");
});

test("the verdict a followed recheck records is the one the log reads for that consult afterwards", () => {
  const entries = [ORIGIN, FIRST, LEFT_OPEN];
  const plan = recheckPlan(entries, "/a", ["a.mjs"]);
  const prior = verdictsBy(entries).get("52d00e");
  const auto = verdictFromRulings(plan, 0, "1. **REFUTED** — the comment now names the rule.", "e71c02", prior);
  assert.equal(auto.record.of, "52d00e", "recorded on the consult it answers");
  const read = verdictsBy([...entries, auto.record]).get("52d00e");
  assert.equal(read.from, "e71c02", "the newer verdict is the one read, not a5033d's");
  assert.deepEqual([read.kept, read.reopened], [["F1"], undefined], "and it closes what the earlier one left open");
});

test("a recheck after a recheck that left nothing open is refused naming both, and never as a whole-set read", () => {
  const settled = { ...LEFT_OPEN, kept: ["F1"], reopened: undefined };
  const refused = recheckOwed(recheckPlan([ORIGIN, FIRST, settled], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(refused, /^consult a5033d is a recheck of consult 52d00e and raised no finding of its own, and 52d00e has nothing left open/u);
  assert.equal(/read this set whole/u.test(refused), false, "a recheck read no set whole");
  const unlinked = recheckOwed(recheckPlan([ORIGIN, FIRST], "/a", ["a.mjs"]), ["a.mjs"]);
  assert.match(unlinked, /the log does not say which consult it answered/u);
  assert.match(unlinked, /forge codex consult --send bodies a\.mjs`/u, "with the read that earns the review");
  const pinned = recheckOwed(recheckPlan([ORIGIN, FIRST, LEFT_OPEN], "/a", ["a.mjs"], FIRST), ["a.mjs"]);
  assert.match(pinned, /52d00e still has F1 open/u, "a recheck pinned to the recheck follows nothing, so the open finding is named");
  assert.match(pinned, /forge codex consult --recheck --of 52d00e`/u, "with the route to the consult it belongs to");
  assert.equal(/nothing left open/u.test(pinned), false);
  const clean = recheckOwed(recheckPlan([{ ...ORIGIN, reply: "CODEX: 0 findings" }], "/a", ORIGIN.files), ORIGIN.files);
  assert.match(clean, /^consult 52d00e read this set whole and found nothing, taken at b2cd0c46: that is the whole-set read a review is earned by, and a recheck has nothing to verify against it\./u,
    "a consult that found nothing keeps the refusal written for it");
});

/* A recheck's REFUTED means "fixed, or never real", and only the bytes can tell which: with nothing
   moved since the consult no fix exists, so the finding goes on the record as rejected rather than as
   the accepted the eval counts as a finding worth having (ISS-2641). */
const REFUTING = {
  id: "0183fa", files: ["a.mjs", "b.mjs"],
  reply: "CODEX: 2 findings\n- **F1 — New — major:** `a.mjs:1` — the importer points at the old path.\n- **F2 — New — minor:** `b.mjs:2` — y.",
};
const REFUTED_PLAN = { judged: REFUTING, ids: ["F1", "F2"], risks: [] };
const REFUTED = "1. **REFUTED** — no stale importer was found.\n2. **CONFIRMED** — still there.\n\nCODEX: 0 findings";

test("a refutation over a set unchanged since its consult records the finding as rejected, naming the recheck", () => {
  const auto = verdictFromRulings(REFUTED_PLAN, 0, REFUTED, "6b2a83", null, true);
  assert.deepEqual(auto.record.kept, [], "nothing the recheck refuted over unmoved bytes is accepted");
  assert.deepEqual(Object.keys(auto.record.dropped), ["F1"]);
  assert.match(auto.record.dropped.F1, /recheck 6b2a83 refuted it over files unchanged since consult 0183fa/u);
  assert.deepEqual(auto.record.auto, ["F2", "F1"], "the rejection is the recheck's own word, which a later recheck or the author may move");
  assert.deepEqual(auto.record.reopened, ["F2"], "a CONFIRMED ruling stays open whatever the bytes say");
  assert.match(auto.said, /accepted: none; rejected: F1, refuted over files unchanged since 0183fa; still open: F2\./u);
});

test("a refutation after the set changed records the finding as accepted, as before", () => {
  const auto = verdictFromRulings(REFUTED_PLAN, 0, REFUTED, "6b2a83", null, false);
  assert.deepEqual(auto.record.kept, ["F1"]);
  assert.deepEqual(auto.record.dropped, {});
  assert.match(auto.said, /accepted: F1; still open: F2\./u);
});

test("the author's own ruling still stands over a refutation on unmoved bytes", () => {
  const auto = verdictFromRulings(REFUTED_PLAN, 0, REFUTED, "6b2a83", { kept: ["F1"], dropped: {} }, true);
  assert.deepEqual(auto.record.kept, ["F1"], "the author accepted it, and a recheck does not rewrite that");
  assert.deepEqual(auto.record.stood, { F1: "REFUTED" });
});

test("a set is unchanged only where every file it was sent carries a sha that the digest now matches", () => {
  const row = { sent: [{ rel: "a.mjs", sha: "aaa" }, { rel: "b.mjs", sha: "bbb" }] };
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"], ["b.mjs", "bbb"]])), true);
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"], ["b.mjs", "ccc"]])), false, "one file moved");
  assert.equal(sameBytesSince(row, new Map([["a.mjs", "aaa"]])), false, "a file no digest answers is not proven unmoved");
  assert.equal(sameBytesSince({ sent: [{ rel: "a.mjs", sha: "aaa" }, { rel: "b.mjs" }] }, new Map([["a.mjs", "aaa"], ["b.mjs", undefined]])), false,
    "a row carrying no sha for a file reads as moved");
  assert.equal(sameBytesSince({ files: ["a.mjs"] }, new Map([["a.mjs", "aaa"]])), false, "a row from before `sent` proves nothing");
});

test("the digests at a recheck are of the files' bytes: the recheck's own send first, the disk for the rest", () => {
  const root = tempRoom("forge-codex-digests-");
  writeFileSync(join(root, "a.mjs"), "export const a = 1;\n");
  writeFileSync(join(root, "b.mjs"), "export const b = 2;\n");
  const consult = { sent: bundle(root, ["a.mjs", "b.mjs"]).map(({ rel, sha }) => ({ rel, sha })) };
  assert.equal(sameBytesSince(consult, digestsAt(root, consult)), true, "nothing moved on disk");
  writeFileSync(join(root, "b.mjs"), "export const b = 3;\n");
  assert.equal(sameBytesSince(consult, digestsAt(root, consult)), false, "an edit to one file of the set moves the set");
  const carried = [{ rel: "b.mjs", sha: consult.sent[1].sha }];
  assert.equal(sameBytesSince(consult, digestsAt(root, consult, carried)), true,
    "what the recheck itself sent answers for that file, being the bytes the reviewer was shown");
});
