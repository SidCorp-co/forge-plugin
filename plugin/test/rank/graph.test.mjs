import assert from "node:assert/strict";
import test from "node:test";

import { claims, issue, rankRoom } from "./room.mjs";

const { load, ran, close } = await rankRoom();
test.after(close);

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

/* A kind the tracker serves and this CLI has no row for: it keeps a direction, so two rows stating
   it in opposite directions are two edges as a pair of `blocks` edges is, and it orders nothing, so
   it neither gates a dispatch nor answers a blocking claim somebody wrote in prose (ISS-769). */
test("an edge of a kind the table does not name is directed, orders nothing, and retires no claim", async () => {
  const strange = { kind: "duplicates", edgeId: "e-9" };
  load([
    issue("ISS-1", { title: "the first thing", relations: { blocks: [edge("ISS-2", strange)], blockedBy: [] } }),
    issue("ISS-2", { title: "the second thing", description: `${claims("first thing")} It waits.`,
      relations: { blocks: [], blockedBy: [edge("ISS-1", strange)] } }),
  ]);
  const run = await ran(["next", "--graph"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^edges the ranking reads — 1 on this reading$/mu,
    `one edge read from both its ends is one edge whatever its kind: ${run.stdout}`);
  assert.match(run.stdout, /^ {2}none of them orders a dispatch$/mu,
    `a kind with no row gated a dispatch on a guess: ${run.stdout}`);
  assert.match(run.stdout, /^claims found only in prose, which gate nothing — 1$/mu,
    `an edge that orders nothing retired the claim: ${run.stdout}`);
  const one = await ran(["next", "--graph", "ISS-1"]);
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /a duplicates edge orders none/u,
    "and the reading names the kind it read rather than inventing one it has a row for");
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
