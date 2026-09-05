/* The verb end to end against a tracker whose whole state a case sets: the two things the live
   backlog cannot show — a prose edge where the relation is absent, and a chain — are here. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

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

/* The convention deps.mjs reads, in the tracker's own built-in English: the marker sentence is what
   makes a body a carrier, and the phrase inside it is what names the other end. */
const claims = (phrase) => `It is blocked by the ${phrase} issue, and those edges are recorded.`;

const state = { issues: [], comments: {}, calls: [], answer: {}, memory: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv) => ranAsync(FORGE, argv, tracker.env, ROOT);

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
  assert.match(run.stdout, /unblocks ISS-2 -> ISS-3 \(eligible after this lands\)/u);
  assert.match(run.stdout, /ISS-2\s+.*blocked by ISS-1 \(open\)/su, "and what waits says what it waits on");
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

test("--json carries the score, its parts and every signal as its own column", async () => {
  load([issue("ISS-1", { priority: "critical", description: "It edits `plugin/hooks/gates/shell.mjs`." })]);
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
  assert.equal(first.restart, true, "its body names a hook");
  assert.equal(first.bandFrom, "neither source");
  assert.deepEqual(Object.keys(first.cost).sort(), ["band", "minutes", "over"]);
  assert.equal(held.weightsFrom, "the built-in table");
  assert.equal(held.weights.priority.critical, 40);
});

test("a flag this verb does not take is refused, and an argument is not a flag", async () => {
  load([issue("ISS-1")]);
  for (const [argv, matching] of [
    [["next", "--conut", "3"], /--conut/u],
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
