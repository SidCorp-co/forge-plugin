/* The verb end to end against a tracker whose whole state a case sets: the two things the live
   backlog cannot show — a prose edge where the relation is absent, and a chain — are here. */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULTS } from "../../src/rank/weights.mjs";
import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";
import { bounded, waveUnder, wanted } from "../../src/rank/next.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

/* The weights are read out of the checkout the caller stands in and from nowhere else, so a case
   about them stands somewhere else: writing this repository's own file would leave a run that died
   mid-case with a backlog ranked by a weight nobody set. */
const OWN = JSON.parse(readFileSync(`${ROOT}.forge.json`, "utf8"));
const standing = (rank) => {
  const room = tempRoom("rank-project-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: OWN.slug, ...(rank ? { rank } : {}) }));
  return room;
};

const issue = (issueId, held = {}) => ({
  issueId,
  documentId: `u-${issueId}`,
  status: "open",
  priority: "medium",
  category: "feature",
  complexity: null,
  reopenCount: 0,
  mergedAt: null,
  createdAt: `2026-09-0${(Number(issueId.slice(4)) % 9) + 1}T00:00:00.000Z`,
  touched: Number(issueId.slice(4)),
  title: `${issueId} as it was filed`,
  description: "## Why\n\nSomething is wrong.\n\n## Outcome\n\nIt is right.\n\n## Out of scope\n\nNothing.\n",
  ...held,
});

/* The convention prose-edges.mjs reads, in the tracker's own built-in English: the marker sentence
   is what makes a body a carrier, and the phrase inside it is what names the other end. */
const claims = (phrase) => `It is blocked by the ${phrase} issue, and those edges are recorded.`;

const state = { issues: [], comments: {}, calls: [], answer: {}, memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* Every case stands in a directory it owns, so what the rank reads is what the case set and never
   what this checkout's own `rank` block happens to hold (ISS-395). */
const PLAIN = standing(null);
const ran = (argv, cwd = PLAIN) => ranAsync(FORGE, argv, tracker.env, cwd);

const load = (issues, memory = {}) => {
  state.issues = issues;
  state.memory = memory;
};

test("the rank prints the eligible issues and writes nothing at all", async () => {
  load([issue("ISS-1", { priority: "critical" }), issue("ISS-2", { priority: "low" })]);
  state.calls.length = 0;
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-1[\s\S]*ISS-2/u, "critical before low");
  assert.match(run.stdout, /nothing was written/u);
  const wrote = state.calls.filter((call) => ["create", "update"].includes(call.args?.action));
  assert.deepEqual(wrote, [], `a read-only verb made a write: ${JSON.stringify(wrote)}`);
});

/* The whole reason the prose reader is imported rather than rewritten: the tracker returns no
   relation here, and the edge is a sentence in a body. */
test("a blocked-by written as prose is read where the relation is absent", async () => {
  load([
    issue("ISS-1", { priority: "critical", title: "the first thing",
      description: `${claims("second thing")} More prose.` }),
    issue("ISS-2", { title: "the second thing" }),
  ]);
  const run = await ran(["next", "--why"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-1\s+.*blocked by ISS-2 \(open\)/su, "ISS-1 is left out by the prose edge");
  assert.match(run.stdout, /left out/u);
});

test("a blocker prints the wave it frees, a two-deep chain as a chain", async () => {
  load([
    issue("ISS-1", { priority: "critical", title: "the first thing" }),
    issue("ISS-2", { title: "the second thing", description: `${claims("first thing")} It waits.` }),
    issue("ISS-3", { title: "the third thing", description: `${claims("second thing")} It waits too.` }),
  ]);
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /unblocks ISS-2 \(eligible after this lands\); behind them ISS-2 -> ISS-3/u,
    "ISS-3 waits on ISS-2, so this landing reaches it and does not free it");
  assert.match(run.stdout, /ISS-2\s+.*blocked by ISS-1 \(open\)/su, "and what waits says what it waits on");
});

/* The line promised eligibility for everything the chain reached, which a second blocker makes
   false: landing this one leaves that issue exactly where it was (consult 2026-09-05). */
test("an issue with a second blocker is named with it rather than promised", async () => {
  load([
    issue("ISS-1", { priority: "critical", title: "the first thing" }),
    issue("ISS-7", { title: "the seventh thing" }),
    issue("ISS-2", { title: "the second thing",
      description: `${claims("first thing")} ${claims("seventh thing")}` }),
  ]);
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /unblocks ISS-2 once ISS-7 lands too/u);
  assert.doesNotMatch(run.stdout, /ISS-2 \(eligible after this lands\)/u);
});

/* An issue being worked, waiting on a person, or released and not yet closed still holds up what
   waits on it: the chain's stop and the eligibility filter read one set or they disagree. */
test("the chain counts through an issue that is in flight and stops at one the flow lets through", async () => {
  for (const [status, points] of [["in_progress", 6], ["waiting", 6], ["developed", 0], ["closed", 0]]) {
    load([
      issue("ISS-1", { priority: "low", title: "the first thing" }),
      issue("ISS-2", { status, title: "the second thing", description: claims("first thing") }),
      issue("ISS-3", { title: "the third thing", description: claims("second thing") }),
    ]);
    const run = await ran(["next", "--json"]);
    assert.equal(run.status, 0, run.stderr);
    const head = JSON.parse(run.stdout).candidates.find((one) => one.issueId === "ISS-1");
    assert.equal(head.parts.blocks.points, points, `a blocker in ${status}`);
  }
});

test("a live lease drops the issue and names the session holding it", async () => {
  const lease = { lease: { holder: "another-run", agent: "an agent", pid: "9",
    renewedAt: new Date().toISOString(), minutes: 60, history: [] } };
  load([issue("ISS-1", { priority: "critical", sessionContext: lease }), issue("ISS-2")]);
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-1\s+lease held by session another-run/u);
  assert.doesNotMatch(run.stdout.split("left out")[0], /ISS-1/u, "and it is not a candidate");
});

/* The near-duplicate search of the filing route, asked with the candidate rather than with a
   filing: the fold's own threshold is the floor a hit is read back as related at. */
test("a batch of three rides together and the fourth prints as related", async () => {
  const fix = "## Why\n\nA small thing.\n\n## Outcome\n\nFixed.\n\n## Out of scope\n\nNothing.\n\nSize: fix.\n";
  load(
    ["ISS-1", "ISS-2", "ISS-3", "ISS-4"].map((key) => issue(key, { description: fix, priority: "high" })),
    { semantic: [["ISS-2", 0.91], ["ISS-3", 0.9], ["ISS-4", 0.89]] },
  );
  const run = await ran(["next", "--count", "1"]);
  assert.equal(run.status, 0, run.stderr);
  const [head] = run.stdout.split("\n").filter((line) => line.startsWith("ISS-"));
  assert.match(head, /^ISS-1\b/u);
  assert.match(run.stdout, /\+ ISS-2\s+reads like ISS-1 at 0\.91/u);
  assert.match(run.stdout, /\+ ISS-3\s+reads like ISS-1 at 0\.90/u);
  assert.match(run.stdout, /~ ISS-4\s+related, not batched: the batch is full/u);
  assert.doesNotMatch(run.stdout, /\+ ISS-4/u, "the cap is three members, and it holds");
});

test("a related issue that is not fix-size is named rather than batched", async () => {
  const fix = "## Why\n\nA small thing.\n\n## Outcome\n\nFixed.\n\n## Out of scope\n\nNothing.\n\nSize: fix.\n";
  load(
    [issue("ISS-1", { description: fix, priority: "high" }), issue("ISS-2", { priority: "high" })],
    { semantic: [["ISS-2", 0.9]] },
  );
  const run = await ran(["next", "--count", "1"]);
  assert.match(run.stdout, /~ ISS-2\s+related, not batched: it reads like ISS-1 at 0\.90, and a batch is fix-size/u);
});

/* The mark is a word; the line beside it is where its meaning is stated, and a signal whose
   sentence names a tree is one a reader takes for a rule about directories. */
test("the restart line says what a session cannot pick up, not which tree the file sits in", async () => {
  load([issue("ISS-1", { priority: "critical", description: "It edits `plugin/hooks/gate.mjs`." })]);
  const run = await ran(["next", "--why"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /restart: its body names a file no open session can pick up/u);
});

test("--json carries the score, its parts and every signal as its own column", async () => {
  load([issue("ISS-1", { priority: "critical", description: "It edits `plugin/hooks/gate.mjs`." })]);
  const run = await ran(["next", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  const [first] = held.candidates;
  assert.equal(first.issueId, "ISS-1");
  /* Age is the one weight a clock moves, so the total is judged against its own parts. */
  assert.equal(first.score, Object.values(first.parts).reduce((sum, one) => sum + one.points, 0));
  assert.equal(first.parts.priority.points, 40);
  assert.equal(first.parts.band.points, 3);
  assert.equal(first.parts.kind.points, 0);
  assert.equal(first.restart, true, "its body names a file no open session picks up");
  assert.equal(first.bandFrom, "neither source");
  assert.deepEqual(Object.keys(first.cost).sort(), ["band", "minutes", "over"]);
  assert.equal(held.weightsFrom, "the built-in table");
  assert.equal(held.weights.priority.critical, 40);
});

/* A fixed window truncated the candidate a body would have promoted, and one whose whole width a
   filter dropped reported nothing eligible while eligible issues sat below it (consult 2026-09-05). */
test("the read goes on until the bodies settle the order, not for a fixed number of them", async () => {
  const fix = "## Why\n\nA small thing.\n\n## Outcome\n\nFixed.\n\n## Out of scope\n\nNothing.\n\nSize: fix.\n";
  const lease = { lease: { holder: "another-run", agent: "an agent", pid: "9",
    renewedAt: new Date().toISOString(), minutes: 60, history: [] } };
  /* Fifteen ahead of it by age, every one of them held, and the sixteenth is the only answer. A
     read of one fixed pass sees none of it and reports nothing eligible. */
  const many = Array.from({ length: 15 }, (_, at) => issue(`ISS-${at + 10}`,
    { priority: "critical", createdAt: "2026-08-01T00:00:00.000Z", sessionContext: lease }));
  load([...many, issue("ISS-90", { priority: "critical", createdAt: "2026-09-05T00:00:00.000Z", description: fix })]);
  const run = await ran(["next", "--count", "1"]);
  assert.equal(run.status, 0, run.stderr);
  const [head] = run.stdout.split("\n").filter((line) => line.startsWith("ISS-"));
  assert.match(head, /^ISS-90\b/u, `every issue above it is leased, and the read stopped short: ${run.stdout}`);
  assert.match(run.stdout, /left out — 15 of the 16 candidate\(s\) judged/u,
    "so the read went past its first pass rather than reporting nothing eligible");
});

test("a candidate a body would promote is read even where it sits below the first pass", async () => {
  const fix = "## Why\n\nA small thing.\n\n## Outcome\n\nFixed.\n\n## Out of scope\n\nNothing.\n\nSize: fix.\n";
  const plain = Array.from({ length: 14 }, (_, at) =>
    issue(`ISS-${at + 20}`, { priority: "critical", createdAt: "2026-09-01T00:00:00.000Z" }));
  load([...plain, issue("ISS-91", { priority: "critical", createdAt: "2026-09-01T00:00:00.000Z", description: fix })]);
  const run = await ran(["next", "--count", "1"]);
  assert.equal(run.status, 0, run.stderr);
  const [head] = run.stdout.split("\n").filter((line) => line.startsWith("ISS-"));
  assert.match(head, /^ISS-91\b/u, "its Size line is worth five points and nothing else separates them");
});

/* The budget is the one thing that can leave the order wrong, so it is disclosed in both forms:
   a warning only the human form prints hides it from whatever dispatches on the json. */
test("an order the read budget cut says so on stderr and in the json alike", async () => {
  const many = Array.from({ length: 8 }, (_, at) =>
    issue(`ISS-${at + 40}`, { priority: "critical", createdAt: "2026-08-01T00:00:00.000Z" }));
  load(many);
  const run = await ran(["next", "--json"], standing({ readCap: 4, windowCap: 2 }));
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.deepEqual(held.read, { unresolvedEdges: 0, judged: 4, takeable: 8, settled: false,
    bounded: false, relationsSeen: 0, readCap: 4 });
  assert.match(run.stderr, /this order is not bounded — 4 of 8 takeable issue\(s\) were read whole/u);
  assert.match(run.stderr, /stopped at readCap/u);
  assert.match(run.stderr, /rank\.readCap/u, "and the way to raise it");
});

test("a weight this project sets is folded over the table, and one it does not hold is refused", async () => {
  load([issue("ISS-1", { priority: "low" }), issue("ISS-2", { priority: "none" })]);
  const run = await ran(["next", "--json"], standing({ priority: { none: 99 } }));
  const answer = JSON.parse(run.stdout);
  assert.equal(answer.weightsFrom, ".forge.json");
  assert.equal(answer.candidates[0].issueId, "ISS-2", "the weight this project set decided the order");
  const refused = await ran(["next"], standing({ urgency: 3 }));
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /rank\.urgency/u);
  const plain = await ran(["next", "--json"], standing(null));
  assert.equal(JSON.parse(plain.stdout).weightsFrom, "the built-in table");
});

test("a carrier reading the tracker cut says eligible means no blocker was found", async () => {
  load([issue("ISS-1", { priority: "critical", description: claims("second thing") }), issue("ISS-2")]);
  state.answer.forge_issues = (args) => {
    if (args.action !== "list") return state.issues.find((one) => one.documentId === args.documentId) ?? {};
    if (!args.filters?.search) return { issues: state.issues, returned: state.issues.length, hasMore: false };
    /* A route counting a carrier it will not hand over: the walk pages to the end of nothing. */
    return { issues: [], returned: 0, hasMore: false, beyond: 1 };
  };
  const run = await ran(["next"]);
  delete state.answer.forge_issues;
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /issues claiming an edge/u);
  assert.match(run.stderr, /eligible here means only that no blocker was found/u);
});

const scored = (total) => ({ score: { total } });

/* The bound is over the candidates the PRINTING can need, not the batches asked for: a batch takes
   members out of the eligible list, so `count` batches can consume `count` times the cap. */
test("the read is bounded against every candidate a batch could consume", () => {
  assert.equal(wanted(5, DEFAULTS), 15);
  const eligible = Array.from({ length: 5 }, () => scored(43));
  assert.equal(bounded(eligible, [scored(30)], 5, DEFAULTS), false,
    "five eligible cannot settle five batches: one batch can absorb three of them");
  const plenty = Array.from({ length: 15 }, () => scored(43));
  assert.equal(bounded(plenty, [scored(30)], 5, DEFAULTS), true, "43 - 30 is more than the band's spread");
  assert.equal(bounded(plenty, [scored(36)], 5, DEFAULTS), false, "36 + 8 reaches 43, so it is still open");
  assert.equal(bounded(plenty, [], 5, DEFAULTS), true, "nothing unread bounds it whatever the scores");
});

/* A body carrying a blocking relation can raise any score by any amount, and an unread body's
   relations are unknown, so no bound over the unread rows survives one (consult 2026-09-05). */
test("a relation found in a body bounds nothing, and a whole read is the only settled one", async () => {
  const plenty = Array.from({ length: 15 }, () => scored(43));
  assert.equal(bounded(plenty, [scored(0)], 5, DEFAULTS, 1), false);
  assert.equal(bounded(plenty, [], 5, DEFAULTS, 1), true, "unless there is nothing left unread");
  /* The two answers certify different things: the bound covers the size a body declares and can
     never cover a relation in a body nobody opened, which is what settled is for. */
  const day = "2026-09-01T00:00:00.000Z";
  load(Array.from({ length: 8 }, (_, at) =>
    issue(`ISS-${at + 60}`, { priority: at < 3 ? "critical" : "none", createdAt: day })));
  const run = await ran(["next", "--json", "--count", "1"], standing({ windowCap: 2, readCap: 60 }));
  const read = JSON.parse(run.stdout).read;
  assert.equal(read.bounded, true, "the size bound held after the first passes");
  assert.equal(read.settled, false, "and it is not settled: five bodies were never opened");
  assert.equal(run.stderr, "", "a bound that held is no warning");
  assert.match(await ran(["next", "--count", "1"], standing({ windowCap: 2, readCap: 60 }))
    .then((one) => one.stdout), /this reading did not open them/u);
});

test("what a landing frees is told apart from what it reaches", () => {
  const blocks = new Map([["ISS-1", ["ISS-2", "ISS-5"]], ["ISS-2", ["ISS-3"]]]);
  const blockedBy = new Map([["ISS-2", ["ISS-1"]], ["ISS-5", ["ISS-1", "ISS-7"]], ["ISS-3", ["ISS-2"]]]);
  const alive = new Set(["ISS-1", "ISS-2", "ISS-3", "ISS-5", "ISS-7"]);
  const held = waveUnder("ISS-1", { blocks, blockedBy, alive });
  assert.deepEqual(held.frees, ["ISS-2"]);
  assert.deepEqual(held.waiting, [{ issueId: "ISS-5", on: ["ISS-7"] }]);
  assert.deepEqual(held.behind, [["ISS-2", "ISS-3"]]);
});

/* The tracker answers the ordering on the edge itself, and `relations.blockedBy` carries mentions
   beside orderings: reading the wrong field loses every relation edge silently. */
test("a blocked-by the tracker returned is read in its own shape, and a mention is not one", async () => {
  const edge = (status, held = {}) =>
    ({ otherDisplayId: "ISS-9", otherStatus: status, kind: "blocks", ...held });
  load([
    issue("ISS-1", { priority: "critical", relations: { blockedBy: [edge("open")], blocks: [] } }),
    issue("ISS-9", { priority: "low" }),
  ]);
  const held = JSON.parse((await ran(["next", "--json"])).stdout);
  assert.equal(held.read.relationsSeen, 1, "the edge was read, so the order is not certified on a bound");
  assert.deepEqual(held.dropped.map((one) => one.reason), ["blocked by ISS-9 (open)"]);
  load([
    issue("ISS-1", { priority: "critical",
      relations: { blockedBy: [edge("open", { gatesDispatch: false })], blocks: [] } }),
    issue("ISS-9", { priority: "low" }),
  ]);
  const other = JSON.parse((await ran(["next", "--json"])).stdout);
  assert.equal(other.read.relationsSeen, 0, "a mention orders nothing and is not counted as an edge");
  assert.equal(other.candidates[0].issueId, "ISS-1");
});

/* A phrase deps.mjs could not pin is dependency evidence that failed to resolve, not an absence. */
test("a blocker phrase matching no title leaves the issue out and is counted", async () => {
  load([
    issue("ISS-1", { priority: "critical", title: "the first thing", description: claims("nowhere at all") }),
    issue("ISS-2", { title: "the second thing" }),
  ]);
  const run = await ran(["next", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.equal(held.read.unresolvedEdges, 1);
  assert.deepEqual(held.dropped.map((one) => one.reason),
    ['names "nowhere at all" as a blocker, matching no title']);
  assert.match((await ran(["next"])).stdout, /1 dependency phrase\(s\) in a body matched no title/u);
});

test("a flag this verb does not take is refused, and an argument is not a flag", async () => {
  load([issue("ISS-1")]);
  for (const [argv, matching] of [
    [["next", "--conut", "3"], /--conut/u],
    /* The name this verb's checkout argument had before one verb answered which project. */
    [["next", "--project", "/tmp/x"], /No next flag named --project\./u],
    [["next", "ISS-1"], /names no flag/u],
    [["next", "--count", "0"], /whole number/u],
    [["next", "--holding", "ISS-99"], /not on this project's tracker/u],
  ]) {
    const run = await ran(argv);
    assert.equal(run.status, 1, `${argv.join(" ")} was not refused: ${run.stdout}`);
    assert.match(run.stderr, matching);
  }
});

test("a file a held issue's plan names sets a candidate aside, and the line says which", async () => {
  load([
    issue("ISS-1", { priority: "critical", description: "It rewrites `plugin/src/flow/record.mjs`." }),
    issue("ISS-2", { priority: "high" }),
    issue("ISS-9", { status: "in_progress", plan: "This one holds `plugin/src/flow/`." }),
  ]);
  const run = await ran(["next", "--holding", "ISS-9"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-1\s+holds plugin\/src\/flow\/ with ISS-9/u);
  assert.match(run.stdout.split("left out")[0], /ISS-2/u, "and the one that does not collide still ranks");
});

/* The two stores under one flag, each under its own heading: an edge the tracker holds orders a
   dispatch and a sentence in a body orders nothing, so a reader who cannot tell them apart has been
   told the wrong thing about both. Which is which: docs/cli/next-the-edges.md. */
/* One edge has one id and both ends' rows carry it, which is how a reading of both ends knows it
   read one edge: a fixture giving each end its own id models two edges and proves nothing. */
const edge = (other, held = {}) => ({
  edgeId: `e-${other}`,
  kind: "blocks",
  otherIssueId: `u-${other}`,
  otherDisplayId: other,
  otherStatus: "open",
  otherMergedAt: null,
  validUntil: null,
  ...held,
});

test("--graph prints the ordering edges the tracker holds and counts the rest", async () => {
  load([
    issue("ISS-1", { title: "the first thing",
      relations: { blocks: [edge("ISS-2", { edgeId: "e-12" })], blockedBy: [] } }),
    issue("ISS-2", { title: "the second thing",
      relations: { blocks: [], blockedBy: [edge("ISS-1", { edgeId: "e-12" })] } }),
    issue("ISS-3", { title: "the third thing",
      relations: { blocks: [edge("ISS-1", { kind: "relates", edgeId: "e-31" })], blockedBy: [] } }),
  ]);
  const run = await ran(["next", "--graph"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.match(/^ {2}ISS-1\s+-> ISS-2\s+blocks$/gmu)?.length, 1,
    "the one edge that orders a dispatch, printed once however many of its ends were read");
  assert.match(run.stdout, /^edges the ranking reads — 2 on this reading$/mu);
  assert.match(run.stdout, /^ {2}and 1 that order nothing: a relates edge/mu,
    "a whole backlog's mentions are a count, the ones that order being what a dispatch turns on");
  assert.doesNotMatch(run.stdout, /ISS-3\s+-> ISS-1/u);
  assert.match(run.stdout, /issue\(s\) read whole, takeable first and capped at readCap/u,
    "and the reading says what it covered, an edge outside it not being absent");
});

test("--graph on one issue prints every edge it has, a mention included", async () => {
  load([
    issue("ISS-1", { title: "the first thing", relations: { blocks: [edge("ISS-2")], blockedBy: [] } }),
    issue("ISS-2", { title: "the second thing",
      relations: { blocks: [edge("ISS-3", { kind: "relates" })], blockedBy: [edge("ISS-1")] } }),
    issue("ISS-3", { title: "the third thing" }),
  ]);
  const run = await ran(["next", "--graph", "iss-2"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}ISS-1\s+-> ISS-2\s+blocks$/mu);
  assert.match(run.stdout, /^ {2}ISS-2\s+-> ISS-3\s+relates, ordering nothing \(a relates edge orders none\)$/mu,
    "an issue's own edges are few and every one of them is worth a line");
  assert.match(run.stdout, /ISS-2 read whole; \d+ issue\(s\) on the backlog carry the sentence/u);
});

/* The status the tracker answers is the far end's, whichever end was read, so an edge whose blocker
   is already developed orders nothing — and says so identically from either end, or the row that
   was read first decides what a dispatch is told. */
test("a developed blocker's edge orders nothing, read from its own end or from the end it held", async () => {
  const done = { edgeId: "e-45", otherStatus: "developed" };
  for (const order of [["ISS-4", "ISS-5"], ["ISS-5", "ISS-4"]]) {
    const rows = {
      "ISS-4": issue("ISS-4", { title: "the blocker itself", status: "developed",
        relations: { blocks: [edge("ISS-5", { edgeId: "e-45" })], blockedBy: [] } }),
      "ISS-5": issue("ISS-5", { title: "the thing it held up",
        relations: { blocks: [], blockedBy: [edge("ISS-4", done)] } }),
    };
    load(order.map((key) => rows[key]));
    for (const [argv, matching] of [
      /* Focused on the blocker itself is the reading whose row carries the status: the edge is the
         blocker's own outgoing one, and the far end it names is the open issue it held up. */
      [["next", "--graph", "ISS-4"], /^ {2}ISS-4\s+-> ISS-5\s+blocks, ordering nothing \(the blocker is developed\)$/mu],
      [["next", "--graph", "ISS-5"], /^ {2}ISS-4\s+-> ISS-5\s+blocks, ordering nothing \(the blocker is developed\)$/mu],
      [["next", "--graph"], /^ {2}and 1 that order nothing/mu],
    ]) {
      const run = await ran(argv);
      assert.equal(run.status, 0, run.stderr);
      assert.doesNotMatch(run.stdout, /^ {2}ISS-4\s+-> ISS-5\s+blocks$/mu,
        `${argv.join(" ")} after ${order.join(",")}: a developed blocker still ordering a dispatch`);
      assert.match(run.stdout, matching, `${argv.join(" ")} after ${order.join(",")}: ${run.stdout}`);
    }
  }
});

/* A relation the two ends state in opposite directions, with no id to tie them: the reading that
   counts it twice reports a backlog with more relations than it has. A pair of `blocks` edges is
   the case that keeps the fallback directional — two of those are two edges, ordering or not. */
test("an edge the tracker named no id for is one edge where its kind has no direction", async () => {
  /* Authored in the shape the route serves, which is the pair of lists `sided` reads: what tells a
     `relates` edge apart is the kind on it, and the projection is what files it under its own list. */
  const loose = { edgeId: null, kind: "relates" };
  load([
    issue("ISS-6", { title: "one end", relations: { blocks: [edge("ISS-7", loose)], blockedBy: [] } }),
    issue("ISS-7", { title: "the other end", relations: { blocks: [edge("ISS-6", loose)], blockedBy: [] } }),
  ]);
  const run = await ran(["next", "--graph"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^edges the ranking reads — 1 on this reading$/mu, run.stdout);
  assert.match(run.stdout, /^ {2}and 1 that order nothing: a relates edge/mu);

  const cycle = { edgeId: null, otherStatus: "developed" };
  load([
    issue("ISS-6", { title: "one end", status: "developed",
      relations: { blocks: [edge("ISS-7", cycle)], blockedBy: [edge("ISS-7", cycle)] } }),
    issue("ISS-7", { title: "the other end", status: "developed",
      relations: { blocks: [edge("ISS-6", cycle)], blockedBy: [edge("ISS-6", cycle)] } }),
  ]);
  const both = await ran(["next", "--graph", "ISS-6"]);
  assert.equal(both.status, 0, both.stderr);
  assert.match(both.stdout, /^edges the ranking reads — 2 on this reading$/mu,
    `two opposite blocks edges are two edges, whatever their blockers' status: ${both.stdout}`);
});

test("a name no issue on the tracker carries is refused rather than read as an empty graph", async () => {
  load([issue("ISS-1")]);
  const run = await ran(["next", "--graph", "ISS-404"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /--graph names ISS-404, which is not on this project's tracker/u);
});

test("a claim only a body makes is under its own heading, and one both sides make says so", async () => {
  load([
    issue("ISS-1", { title: "the first thing" }),
    issue("ISS-2", { title: "the second thing", description: `${claims("first thing")} It waits.` }),
    issue("ISS-3", { title: "the third thing", description: `${claims("nothing anyone filed")} It waits.` }),
  ]);
  const run = await ran(["next", "--graph"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^claims found only in prose, which gate nothing — 1$/mu);
  assert.match(run.stdout, /^ {2}ISS-1\s+-> ISS-2\s+blocks, stated by ISS-2 only$/mu);
  assert.match(run.stdout, /^ {2}unresolved: ISS-3 names "nothing anyone filed", matching no title$/mu,
    "a phrase resolving to nothing is printed as written rather than guessed at");
});

/* The seam the two stores exist to show: the tracker holds the edge AND a body claims it, so the
   claim is not news and the prose heading stays empty. */
test("a claim the tracker already holds is not printed twice", async () => {
  load([
    issue("ISS-1", { title: "the first thing", relations: { blocks: [edge("ISS-2")], blockedBy: [] } }),
    issue("ISS-2", { title: "the second thing", description: `${claims("first thing")} It waits.`,
      relations: { blocks: [], blockedBy: [edge("ISS-1")] } }),
  ]);
  const run = await ran(["next", "--graph"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^claims found only in prose, which gate nothing — 0$/mu);
  assert.match(run.stdout, /^ {2}none$/mu);
});

/* The edge that answers a blocking claim is a blocking edge. A `relates` edge on the same pair
   orders nothing, so a claim standing beside one is still a claim only prose makes — and it is the
   same answer from either end, the relation being one the two ends state in opposite directions. */
test("a relates edge does not retire a blocking claim on the same pair", async () => {
  const loose = { kind: "relates", edgeId: "e-12" };
  load([
    issue("ISS-1", { title: "the first thing", relations: { blocks: [edge("ISS-2", loose)], blockedBy: [] } }),
    issue("ISS-2", { title: "the second thing", description: `${claims("first thing")} It waits.`,
      relations: { blocks: [edge("ISS-1", loose)], blockedBy: [] } }),
  ]);
  for (const argv of [["next", "--graph"], ["next", "--graph", "ISS-1"], ["next", "--graph", "ISS-2"]]) {
    const run = await ran(argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^claims found only in prose, which gate nothing — 1$/mu,
      `${argv.join(" ")}: an edge that orders nothing retired the claim: ${run.stdout}`);
    assert.match(run.stdout, /^ {2}ISS-1\s+-> ISS-2\s+blocks, stated by ISS-2 only$/mu);
  }
});
