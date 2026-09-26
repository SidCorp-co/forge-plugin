/* The whole-set reads an issue's run has taken, counted off the consult log (ISS-1090). The count
   exists to tell a run that iterated from a run that forgot, so each case below is one of the two
   shapes a counter that ignored heads, files or ownership would read the same way. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("forge-reads-");
const { FIRST, PASS, RECHECK, REPEAT, classified, isWholeRead, placeLine, readFigures, readsIn, readsSaid, rowsOf } =
  await import("../../../src/codex/log/reads.mjs");
const { REVIEW_READS, SPARES, readsAllowed } = await import("../../../src/ladder.mjs");
const { readsLine } = await import("../../../src/codex/stats/lines.mjs");

const HERE = { root: "/a", repo: null };
const sent = (rels) => rels.map((rel) => ({ rel, chars: 9, clipped: false }));
let ids = 0;
const READ = (head, rels = ["a.mjs", "b.mjs"], extra = {}) => ({
  kind: "consult", id: `c${(ids += 1)}`, ok: true, root: "/a", at: String(ids), files: rels, sent: sent(rels),
  send: "bodies", head, run: "r1", issues: ["ISS-7"], reply: "CODEX: 0 findings", ...extra,
});
const kinds = (rows) => readsIn(rows).map((one) => [one.head, one.kind]);

test("two passes by one run at one clean head over different files are one whole-set read", () => {
  const passes = [READ("aaaaaaa", ["a.mjs"]), READ("aaaaaaa", ["b.mjs"])];
  assert.deepEqual(kinds(passes), [["aaaaaaa", FIRST]], "the second pass read as a second read");
  assert.equal(readsIn(passes)[0].passes, 2, "and the read says how many passes it took");
  assert.equal(classified(passes)[1].kind, PASS);
});

test("two reads at one head carrying a common file are a repeat", () => {
  const rows = [READ("aaaaaaa"), READ("aaaaaaa", ["b.mjs"])];
  assert.deepEqual(kinds(rows), [["aaaaaaa", FIRST], ["aaaaaaa", REPEAT]]);
});

test("two runs reading halves of a set at one head each took a read, and no pass is folded across them", () => {
  const rows = [READ("aaaaaaa", ["a.mjs"], { run: "r1" }), READ("aaaaaaa", ["b.mjs"], { run: "r2" })];
  assert.deepEqual(kinds(rows), [["aaaaaaa", FIRST], ["aaaaaaa", REPEAT]]);
  const interleaved = [...rows, READ("aaaaaaa", ["c.mjs"], { run: "r1" })];
  assert.deepEqual(classified(interleaved).map((one) => one.kind), [FIRST, REPEAT, PASS],
    "another run's read at the head leaves this run's own read to be continued");
  assert.equal(readsIn(interleaved)[0].passes, 2);
  const nameless = [READ("aaaaaaa", ["a.mjs"], { run: undefined }), READ("aaaaaaa", ["b.mjs"], { run: undefined })];
  assert.equal(readsIn(nameless).length, 2, "rows naming no run are no sequence anybody declared");
});

test("a read, a commit, and a read at the new head are a recheck and not a repeat", () => {
  const rows = [READ("aaaaaaa"), READ("bbbbbbb")];
  assert.deepEqual(kinds(rows), [["aaaaaaa", FIRST], ["bbbbbbb", RECHECK]]);
});

test("a run that took one read is reported as having spent one", () => {
  const reads = readsIn([READ("aaaaaaa")]);
  assert.equal(reads.length, 1);
  assert.match(readsSaid(reads, { ref: "ISS-7", rung: "fix" }), /: 1, and the 1 a `fix` allows\.\n {2}aaaaaaa {2}first$/u);
});

test("a diff consult, a recheck, a dirty tree and a read of outside paths alone are no whole-set read", () => {
  assert.equal(isWholeRead(READ("aaaaaaa")), true);
  assert.equal(isWholeRead(READ("aaaaaaa", undefined, { send: "diffs" })), false, "a diff read judges the diff");
  assert.equal(isWholeRead(READ("aaaaaaa", undefined, { recheck: true })), false, "a recheck verifies findings");
  assert.equal(isWholeRead(READ("aaaaaaa", undefined, { dirty: true })), false, "a working tree is no head");
  assert.equal(isWholeRead(READ("aaaaaaa", ["/tmp/p/plan.md", "/tmp/p/criteria.md"])), false,
    "a plan and criteria read is not a read of the set");
  assert.equal(isWholeRead(READ("aaaaaaa", ["/tmp/p/plan.md", "a.mjs"])), true,
    "a scratch file beside the set leaves it a read of the set");
  assert.equal(isWholeRead(READ("aaaaaaa", ["a.mjs"], { sent: [{ rel: "a.mjs", chars: 9, clipped: true }] })), false,
    "a clipped file was not read whole");
  assert.equal(isWholeRead(READ("aaaaaaa", undefined, { ok: false, reply: null })), false, "the consult failed");
});

test("an issue's rows are this repository's naming its key or written under the run given", () => {
  const named = READ("aaaaaaa", undefined, { run: "other" });
  const byRun = READ("bbbbbbb", undefined, { issues: undefined });
  const elsewhere = READ("ccccccc", undefined, { root: "/b" });
  const nobody = READ("ddddddd", undefined, { run: "other", issues: ["ISS-8"] });
  const rows = rowsOf([named, byRun, elsewhere, nobody], { keys: ["iss-7"], run: "r1", here: HERE });
  assert.deepEqual(rows, [named, byRun]);
  assert.deepEqual(rowsOf([byRun], { keys: ["ISS-7"], run: null, here: HERE }), [],
    "a caller with no run is owed only the rows naming the key");
});

test("the allowance printed and the rung's round line are one constant", () => {
  assert.equal(readsAllowed("fix"), REVIEW_READS);
  assert.equal(readsAllowed("trivial"), REVIEW_READS);
  assert.equal(readsAllowed("feature"), null);
  assert.match(SPARES.fix[1], /^one review consult/u);
  assert.match(readsSaid([], { ref: "ISS-7", rung: "feature" }), /none yet, and a `feature` states no allowance\.$/u);
  const over = readsSaid(readsIn([READ("aaaaaaa"), READ("bbbbbbb"), READ("bbbbbbb")]), { ref: "ISS-7", rung: "trivial" });
  assert.match(over, /: 3, and the 1 a `trivial` allows\. That is past the allowance, and nothing refuses it\./u);
  assert.match(over, /\n {2}bbbbbbb {2}recheck — the head moved since the read before it\n/u);
  assert.match(over, /\n {2}bbbbbbb {2}repeat — this head was already read, with no commit between$/u);
});

test("a consult that read whole says which read it was, and one that did not says nothing", () => {
  const log = [READ("aaaaaaa"), READ("bbbbbbb", ["a.mjs"])];
  const said = (row, held = {}) => placeLine(log, row, { keys: ["ISS-7"], run: "r1", here: HERE, ...held });
  assert.match(said(READ("bbbbbbb", ["a.mjs"])), /^codex: whole-set read 3, at bbbbbbb — repeat — .* of ISS-7 and this run; a trivial or a fix allows 1 and a feature states none\. `forge advance ISS-7 --owed` counts them against its rung\.$/u);
  assert.match(said(READ("ccccccc")), /^codex: whole-set read 3, at ccccccc — recheck — /u);
  assert.match(said(READ("bbbbbbb", ["b.mjs"])), /^codex: a further pass of whole-set read 2 at bbbbbbb, pass 2, /u);
  assert.match(said(READ("ccccccc", undefined, { issues: undefined }), { keys: [] }), / of this run; /u);
  assert.equal(said(READ("ccccccc", undefined, { send: "diffs" })), null, "a diff consult is no read to place");
  assert.equal(said(READ("ccccccc"), { keys: [], run: null }), null, "a read owned by nobody is counted for nobody");
});

test("codex stats counts the window's reads, rechecks and repeats apart, one run at a time", () => {
  const rows = [
    READ("aaaaaaa"), READ("aaaaaaa", ["a.mjs"]),
    READ("aaaaaaa", undefined, { run: "r2" }), READ("bbbbbbb", undefined, { run: "r2" }),
    READ("ccccccc", undefined, { run: undefined }), READ("ccccccc", undefined, { run: undefined }),
  ];
  assert.deepEqual(readFigures(rows), { reads: 6, rechecks: 1, repeats: 1, runs: 4 },
    "a row naming no run is tied to no other, so two of them at one head are two firsts");
  assert.equal(readsLine(readFigures(rows)),
    "whole-set reads   6 over 4 run(s), 1 recheck(s) at a head not read before, 1 repeat(s) of a head already read");
});

test("a window is classified against the history before it, and counts only its own rows", () => {
  const first = READ("aaaaaaa");
  const again = READ("aaaaaaa");
  assert.deepEqual(readFigures([again], [first, again]), { reads: 1, rechecks: 0, repeats: 1, runs: 1 },
    "a repeat whose first read fell before the window is still a repeat");
  const opening = READ("bbbbbbb", ["a.mjs"]);
  const pass = READ("bbbbbbb", ["b.mjs"]);
  assert.deepEqual(readFigures([pass], [opening, pass]), { reads: 0, rechecks: 0, repeats: 0, runs: 0 },
    "a further pass of a read begun before the window is no read of its own");
  assert.deepEqual(readFigures([again], [first, again, READ("ccccccc", undefined, { run: "r9" })]).runs, 1,
    "a run with no row in the window is not counted");
});
