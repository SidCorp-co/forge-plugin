/* The verb end to end against a tracker whose whole state a case sets: the two things the live
   backlog cannot show — a prose edge where the relation is absent, and a chain — are here. */
import assert from "node:assert/strict";
import test from "node:test";

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

import { DEFAULTS } from "../../src/rank/weights.mjs";
import { claims, declaring, issue, rankRoom, recordOf, standing } from "./room.mjs";
import { bounded, waveUnder, wanted } from "../../src/rank/next.mjs";

const { load, ran, state, close } = await rankRoom();
test.after(close);

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
  load(
    ["ISS-1", "ISS-2", "ISS-3", "ISS-4"].map((key) => issue(key, { complexity: "s", priority: "high" })),
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

/* The paths a body names are claims about code, read against the tree the wave would be built in.
   ISS-1363: a `+` line grouped three issues on plugin/src/tools/issues.mjs, which no branch of this
   repository has ever held, and the batch was dispatched on it. */
const standingInTree = (...files) => {
  const room = standing(null);
  spawnSync("git", ["-C", room, "init", "-q"], { cwd: room, encoding: "utf8" });
  for (const rel of files) {
    mkdirSync(join(room, dirname(rel)), { recursive: true });
    writeFileSync(join(room, rel), "");
  }
  return room;
};

const naming = (key, ...paths) => issue(key, {
  complexity: "s",
  priority: "high",
  description: `## Why\n\nIt edits ${paths.map((one) => `\`${one}\``).join(" and ")}.\n`,
});

test("a wave is not grouped on a path the checkout has not got, and the line names the path", async () => {
  const room = standingInTree("plugin/src/rank/batch.mjs");
  load([naming("ISS-1", "plugin/src/tools/issues.mjs"), naming("ISS-2", "plugin/src/tools/issues.mjs")]);
  const run = await ran(["next", "--count", "1"], room);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /\+ ISS-2/u, "nothing is grouped on a path that resolves to nothing");
  assert.match(run.stdout, /~ ISS-2\s+not related by module: it names plugin\/src\/tools\/issues\.mjs,/u);
  assert.match(run.stdout, /which this checkout has not got/u);
});

/* The path is said nowhere else, so the filter that stops an issue printing twice may not take it. */
test("the path a pair failed to meet on is still named where that issue heads a batch of its own", async () => {
  const room = standingInTree("plugin/src/rank/batch.mjs");
  load([naming("ISS-1", "plugin/src/tools/issues.mjs"), naming("ISS-2", "plugin/src/tools/issues.mjs")]);
  const run = await ran(["next"], room);
  assert.equal(run.status, 0, run.stderr);
  const heads = run.stdout.split("\n").filter((line) => line.startsWith("ISS-")).map((line) => line.slice(0, 5));
  assert.deepEqual(heads, ["ISS-1", "ISS-2"], "neither was absorbed by the other");
  assert.match(run.stdout, /~ ISS-2\s+not related by module: it names plugin\/src\/tools\/issues\.mjs,/u);
  const json = await ran(["next", "--json"], room);
  const [head] = JSON.parse(json.stdout).candidates;
  assert.deepEqual(head.related.map((one) => one.why),
    ["names plugin/src/tools/issues.mjs, which this checkout has not got"], "and the json carries it too");
});

/* The cap exists to keep a batch readable, and an unresolvable path is not a batch member. */
test("the cap on related issues does not take a missing-path line with it", async () => {
  const room = standingInTree("plugin/src/rank/batch.mjs");
  load([
    naming("ISS-1", "plugin/src/tools/issues.mjs", "plugin/src/rank/phantom.mjs"),
    naming("ISS-2", "plugin/src/tools/issues.mjs"),
    naming("ISS-3", "plugin/src/tools/issues.mjs"),
    naming("ISS-4", "plugin/src/tools/issues.mjs"),
    naming("ISS-5", "plugin/src/rank/phantom.mjs"),
  ]);
  const run = await ran(["next", "--count", "1"], room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /~ ISS-5\s+not related by module: it names plugin\/src\/rank\/phantom\.mjs,/u,
    "the fourth aside is the fifth issue's, and the cap on related issues must not reach it");
  const json = await ran(["next", "--json", "--count", "1"], room);
  assert.equal(JSON.parse(json.stdout).candidates[0].related.length, 4, "and the json carries all four");
});

test("a body naming a path that is gone and one the tree holds is grouped on the one it holds", async () => {
  const room = standingInTree("plugin/src/rank/batch.mjs");
  const both = ["plugin/src/tools/issues.mjs", "plugin/src/rank/batch.mjs"];
  load([naming("ISS-1", ...both), naming("ISS-2", ...both)]);
  const run = await ran(["next", "--count", "1"], room);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /\+ ISS-2\s+names plugin\/src\/rank\/batch\.mjs, as ISS-1 does/u);
});

test("a related issue at the top rung is named rather than batched", async () => {
  load(
    [issue("ISS-1", { complexity: "s", priority: "high" }), issue("ISS-2", { complexity: "xl", priority: "high" })],
    { semantic: [["ISS-2", 0.9]] },
  );
  const run = await ran(["next", "--count", "1"]);
  assert.match(run.stdout,
    /~ ISS-2\s+related, not batched: it reads like ISS-1 at 0\.90, and a batch stays below the top rung/u);
});

/* The mark is a word; the line beside it is where its meaning is stated, and a signal whose
   sentence names a tree is one a reader takes for a rule about directories. */
test("the restart line says what a session cannot pick up, not which tree the file sits in", async () => {
  load([issue("ISS-1", { priority: "critical", description: "It edits `plugin/hooks/gate.mjs`." })]);
  const run = await ran(["next", "--why"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /restart: its body names a file no open session can pick up/u);
});

/* The gap a wave has to close before the brief, and the column cannot: `unset` says a lead was never
   weighed and not what to do about it, so the line carries the write. Where the field holds one it
   prints nothing — a fourth line per candidate repeating the column is what this asks to be told
   apart from. */
test("--why names the write that sets a complexity the tracker holds none of", async () => {
  load([issue("ISS-1", { priority: "critical" })]);
  const run = await ran(["next", "--why"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}unset {2}this lead holds no complexity, so the ladder runs it as a feature\./mu);
  assert.match(run.stdout, /forge issue ISS-1 --set complexity=<xs\|s\|m\|l\|xl> --why "<what you read to judge it>"/u,
    "the write is on the line, so the dispatcher needs no second call to learn the values");
});

test("a lead the field already holds a value for earns no line of its own", async () => {
  load([issue("ISS-1", { priority: "critical", complexity: "s" })]);
  const run = await ran(["next", "--why"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /this lead holds no complexity/u);
  assert.match(run.stdout, /^issue {4}.*\bcomplexity\b/mu, "the column heads the field in the tracker's own word");
  assert.match(run.stdout, /· complexity s 6 ·/u, "and the breakdown says the value with no gloss beside it");
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
  assert.equal(first.parts.complexity.points, 0, "it declares no size, which is the bottom of that table");
  assert.equal(first.parts.kind.points, 0);
  assert.equal(first.restart, true, "its body names a file no open session picks up");
  assert.equal(first.complexityFrom, "none on the tracker");
  assert.deepEqual(Object.keys(first.cost).sort(), ["complexity", "minutes", "over"]);
  assert.equal(held.weightsFrom, "the built-in table");
  assert.equal(held.weights.priority.critical, 40);
});

/* The order could not surface a large new capability at any priority and any age, so the six issues
   describing one deploy surface were never once in the eligible set and waiting could not put them
   there. Read through the verb rather than through `scoreOf`, because eligibility is what the issue
   is about and the score is only how it is reached (ISS-1397). */
test("a large aged feature reaches the order over a cheap fresh bug, holding no edge to get there", async () => {
  const filed = (days) => new Date(Date.now() - (days * 86_400_000)).toISOString();
  load([
    issue("ISS-2", { priority: "high", category: "bug", complexity: "xs", createdAt: filed(0),
      title: "the cheap fresh thing" }),
    issue("ISS-1", { priority: "high", category: "feature", complexity: "l", createdAt: filed(100),
      title: "the large old thing" }),
  ]);
  const run = await ran(["next", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.deepEqual(held.candidates.map((one) => one.issueId), ["ISS-1", "ISS-2"], run.stdout);
  const [big] = held.candidates;
  assert.equal(big.parts.age.points, 100, "the age term is what carried it, not an edge it does not hold");
  assert.equal(big.parts.blocks.points, 0);
});

/* A fixed window truncated the candidate a body would have promoted, and one whose whole width a
   filter dropped reported nothing eligible while eligible issues sat below it (consult 2026-09-05). */
test("the read goes on until the bodies settle the order, not for a fixed number of them", async () => {
  const fix = "## Why\n\nA small thing.\n\n## Outcome\n\nFixed.\n\n## Out of scope\n\nNothing.\n";
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

/* The complexity rides on the list row, so a candidate the score promotes is promoted in the first pass:
   what a body once had to be opened for is a column of the list the rank already read. */
test("the complexity field promotes a candidate, no body of it having been read", async () => {
  const plain = Array.from({ length: 14 }, (_, at) =>
    issue(`ISS-${at + 20}`, { priority: "critical", createdAt: "2026-09-01T00:00:00.000Z" }));
  load([...plain, issue("ISS-91", { priority: "critical", createdAt: "2026-09-01T00:00:00.000Z", complexity: "xs" })]);
  const run = await ran(["next", "--count", "1"]);
  assert.equal(run.status, 0, run.stderr);
  const [head] = run.stdout.split("\n").filter((line) => line.startsWith("ISS-"));
  assert.match(head, /^ISS-91\b/u, "xs is worth five points over unset and nothing else separates them");
  assert.match(head, /\bxs\b/u, "and what it was scored at is the field's own value, printed as it stands");
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
  const room = standing({ priority: { none: 99 } });
  const run = await ran(["next", "--json"], room);
  const answer = JSON.parse(run.stdout);
  assert.equal(answer.weightsFrom, recordOf(room));
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
  assert.equal(bounded(plenty, [scored(30)], 5, DEFAULTS), true, "43 - 30 is more than that weight's spread");
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

/* The judging side end to end: what a wave reads to dispatch a second run at a landed change. The
   declaration is the tracker's own project config, so a case sets it there rather than in the
   checkout's file. */
const judged = (t, qa) => {
  state.config = { pipelineConfig: { qa } };
  state.answer.forge_config = () => ({ config: state.config });
  t.after(() => { delete state.answer.forge_config; delete state.config; });
};

test("a developed issue with no live lease is offered as judging work, apart from the ranked rows", async (t) => {
  load([issue("ISS-1", { priority: "critical" }), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /judging — 1 issue\(s\) at developed with no live lease,/u);
  assert.match(run.stdout, /ISS-5[^\n]*\n\nissue\s+pts/u, "and a blank line between the two");
  assert.match(run.stdout, /judging[\s\S]*ISS-5[\s\S]*issue\s+pts/u,
    "the section stands above the ranked table rather than inside it");
  assert.match(run.stdout, /independent run's/u, "and says which declaration offered them");
  assert.match(run.stdout, /1 eligible of 1 takeable/u,
    "the ranked count is the building side's and a judging candidate is not in it");
});

test("a project that declared the judgement the builder's own is offered no judging section", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  for (const qa of ["builder", null]) {
    judged(t, qa);
    const run = await ran(["next"]);
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /judging —/u, `qa ${qa} names nobody to hand a landed issue to`);
  }
});

/* The soft filter is the building side's — two runs writing one tree is what it is for — and a
   judging run writes none, so the same collision that sets a builder aside leaves it offered. */
test("a file another run's plan holds sets a builder aside and leaves a judging candidate offered", async (t) => {
  const names = "It rewrites `plugin/src/flow/record.mjs` and nothing else.";
  load([
    issue("ISS-9", { plan: "It edits `plugin/src/flow/record.mjs`." }),
    issue("ISS-2", { description: names }),
    issue("ISS-5", { status: "developed", description: names }),
  ]);
  judged(t, "independent");
  const run = await ran(["next", "--holding", "ISS-9"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ISS-2\s+holds plugin\/src\/flow\/record\.mjs with ISS-9/u,
    "the builder is set aside by the path its body names");
  assert.match(run.stdout, /judging[\s\S]*ISS-5/u, "and the judging candidate naming the same path is not");
});

test("a judging read that spent its bound says so on the error stream, in either output form", async (t) => {
  const rows = [issue("ISS-1")];
  for (let n = 10; n < 24; n += 1) rows.push(issue(`ISS-${n}`, { status: "developed" }));
  load(rows);
  judged(t, "independent");
  for (const argv of [["next"], ["next", "--json"]]) {
    const run = await ran(argv);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /2 further issue\(s\) at developed went unread/u, argv.join(" "));
    assert.match(run.stderr, /windowCap 12[\s\S]*rank\.windowCap/u, argv.join(" "));
  }
  const run = await ran(["next", "--json"]);
  assert.equal(JSON.parse(run.stdout).judging.unreached, 2, "and the count is a field a machine reads");
});

/* A project that declares an independent judgement and a config call the tracker refuses must not
   print what a deliberate opt-out prints, which is nothing at all. Only the config read is refused
   here — the issue reads answer, which is what makes such a silence invisible (ISS-1663). */
test("a config read the tracker refused says so rather than printing the judging section away", async (t) => {
  load([issue("ISS-1", { priority: "critical" }), issue("ISS-5", { status: "developed" })]);
  state.config = { pipelineConfig: { qa: "independent" } };
  state.answer.forge_config = () => ({ refused: "no available server" });
  t.after(() => { delete state.answer.forge_config; delete state.config; });

  const run = await ran(["next"]);
  assert.equal(run.status, 0, `a failed configuration read refused the whole verb: ${run.stderr}`);
  assert.match(run.stdout, /judging — this project's declaration about who judges went unread/u,
    "the section says the declaration went unread instead of standing down as an opt-out");
  assert.match(run.stdout, /BAD_REQUEST: no available server/u, "carrying the tracker's own sentence");
  assert.doesNotMatch(run.stdout, /1 issue\(s\) at developed/u, "and offers nothing it could not know");
  assert.match(run.stderr, /release policy: the project config could not be read/u,
    "said once at the read, for every reader that answers with a boolean and has nowhere to put it");
  assert.match(run.stdout, /ISS-1/u, "and the ranking this verb was asked for is unchanged");
  assert.match(run.stdout, /1 eligible of 1 takeable/u);

  const json = await ran(["next", "--json"]);
  assert.equal(json.status, 0, json.stderr);
  const held = JSON.parse(json.stdout);
  assert.match(held.judging.unread, /BAD_REQUEST: no available server/u,
    "and the machine-readable form carries the refusal where it used to carry null");
  assert.deepEqual(held.candidates.map((one) => one.issueId), ["ISS-1"]);
});

test("the machine-readable form carries the judging candidates under a key of their own", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next", "--json"]);
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout);
  assert.deepEqual(held.judging.offered.map((one) => one.issueId), ["ISS-5"]);
  assert.deepEqual(held.judging.left, []);
  assert.equal(held.judging.unreached, 0);
  assert.deepEqual(held.candidates.map((one) => one.issueId), ["ISS-1"],
    "and the ranked list is untouched by it");
});

/* The second key, which decides who is dispatched and never whether an issue is offered: a master
   reads at the queue whether the set in front of it is its own. docs/cli/next.md. */
test("the judging section names the master the project declared drains it", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next"], declaring("qa-master"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /drained by — qa-master, declared\./u, run.stdout);
  assert.match(run.stdout, /Another master leaves these standing\./u,
    "the line says what the declaration costs the master it does not name");
});

test("a project that declared nothing is told which master the rows fall to and that it is a default", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /drained by — dispatcher, absent the key, dispatcher being what a project that has not decided gets\./u,
    run.stdout);
});

test("a drain key the pair does not take names no master at the queue either", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next"], declaring("qa-mastre"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /drained by — `drainedBy` is `qa-mastre`, which is no master that drains developed/u,
    run.stdout);
  assert.match(run.stdout, /nothing here says whose these are/u,
    "a fallback on a typo would put a wave and a QA master on one issue");
  assert.match(run.stdout, /judging — 1 issue\(s\)/u,
    "and the rows are still offered: the drain says who is dispatched, never whether an issue is offered");
});

test("the machine-readable form carries the declared master beside the candidates", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed" })]);
  judged(t, "independent");
  const run = await ran(["next", "--json"], declaring("qa-master"));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).judging.drainedBy, "qa-master");
  const typo = await ran(["next", "--json"], declaring("qa-mastre"));
  assert.equal(JSON.parse(typo.stdout).judging.drainedBy, null,
    "and a value the key does not take carries no master rather than the default");
});
