/* Every verb that takes `ISS-nn` shares one lookup, and its refusal exits the process — so both
   halves are judged by spawning the verb against a tracker that cuts a page the way the real one
   does, and never by calling the lookup in this process. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, pageOf, ranAsync } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

const day = (one) => `2026-09-0${one}T00:00:00.000Z`;
const at = (number, touched) => ({
  issueId: `ISS-${number}`,
  documentId: `u-${number}`,
  status: "open",
  priority: "medium",
  title: `issue ${number}`,
  createdAt: day(number),
  touched,
});

/* Six issues in a page that carries two: ISS-4 is on it, ISS-5 is younger than ISS-4 and is not. */
const BACKLOG = [at(1, 1), at(2, 2), at(3, 3), at(4, 6), at(5, 4), at(6, 5)];
const ONE_TIMESTAMP = BACKLOG.map((one) => ({ ...one, createdAt: day(1) }));

const state = { issues: BACKLOG, comments: {}, calls: [], answer: {} };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv, stdin = null) => ranAsync(FORGE, argv, tracker.env, ROOT, stdin);
const cutTo = (rows, fits) => {
  const listed = pageOf(rows, fits);
  state.issues = rows;
  state.answer.forge_issues = (args) =>
    (args.action === "list" ? listed(args) : rows.find((one) => one.documentId === args.documentId) ?? {});
};

test("the read verb reaches a key the first page could not carry", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "ISS-1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /"issueId": "ISS-1"/u);
});

/* The route this defect cost a run: a finder writing to an issue it does not hold. It takes no
   lease by design, and a lease is the one thing that must not appear on the way through. */
test("a finder reaches the same key through --into, and is asked for no lease", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["new", "-", "--title", "what the finder had nowhere to put", "--into", "ISS-1"],
    "a line for an issue nobody could reach");
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /lease|forge claim/u);
});

test("the holder's verbs reach it too, the lookup being one", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["comment", "ISS-1", "-"], "a line for an issue nobody could reach");
  assert.match(run.stderr, /ISS-1 carries no lease/u,
    "refused for the lease it wanted, which is a key it had already resolved");
});

test("a key the tracker does not hold is refused as a fact about the tracker", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "ISS-99"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ISS-99 is not on this project's tracker/u);
  assert.match(run.stderr, /6 issue\(s\) over \d+ page\(s\) read, which is the whole backlog/u);
});

test("a refusal names no limit, the limit having never been what cut the page", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "ISS-99"]);
  assert.doesNotMatch(run.stderr, /500|newest/u, "raising a limit is the one thing that cannot help");
});

/* A key nothing holds has no issue to recover, so the route is to the keys that do exist — and it
   has to be runnable by a reader who holds a wrong key and nothing else. */
test("a refusal over a covered backlog routes to the keys the tracker does hold", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "ISS-99"]);
  assert.match(run.stderr, /`forge issues`/u);
  assert.doesNotMatch(run.stderr, /words from its title/u, "which a reader holding only a key has not got");
});

/* Every row on one timestamp: an interval one millisecond wide is the only indivisible one, so this
   is the only shape that reaches the branch, and it has to end rather than halve forever. */
test("a reading that stayed cut says so, and claims no absence", async () => {
  cutTo(ONE_TIMESTAMP, 2);
  const run = await ran(["issue", "ISS-99"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /the reading is incomplete/u);
  assert.match(run.stderr, /the lookup's ceiling and not the issue's absence/u);
  assert.doesNotMatch(run.stderr, /whole backlog/u);
});

test("that refusal routes to a set narrow enough to come back whole, and names no limit", async () => {
  cutTo(ONE_TIMESTAMP, 2);
  const run = await ran(["issue", "ISS-99"]);
  assert.match(run.stderr, /forge issues --status open/u, "the one route a reader holding only a key can run");
  assert.doesNotMatch(run.stderr, /500/u);
});

/* ISS-36. The wider shape sent a citation through the whole walk — measured live at 7 windows and
   210 rows, identical to a key the tracker does not hold — and then called a clause an absent issue,
   routing its reader to `forge issues`, where a specification clause was never going to be. */
const asked = () => state.calls.filter((one) => one.name === "forge_issues").length;

test("a requirements citation is refused before the tracker is asked anything at all", async () => {
  cutTo(BACKLOG, 2);
  state.calls = [];
  const run = await ran(["issue", "FR-05"]);
  assert.equal(run.status, 1);
  assert.equal(asked(), 0, "the walk it used to pay for reads the whole backlog");
});

test("that refusal routes to the verb that does read a clause", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "FR-05"]);
  assert.match(run.stderr, /forge spec FR-05/u);
  assert.match(run.stderr, /requirements citation/u);
});

test("that refusal claims no absence, a clause not being an issue the tracker lacks", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "FR-05"]);
  assert.doesNotMatch(run.stderr, /not on this project's tracker|whole backlog/u);
  assert.doesNotMatch(run.stderr, /`forge issues`/u, "the keys it holds is no answer to a citation");
});

/* Every family, through the verb rather than the predicate: the refusal is what a reader meets. */
test("one case per identifier family the tree has, each refused with the same route", async () => {
  cutTo(BACKLOG, 2);
  for (const id of ["UC-05", "AC-05", "NFR-02", "BR-03", "EI-01", "G-1", "M-2", "C-3", "A-4", "R-5"]) {
    const run = await ran(["issue", id]);
    assert.equal(run.status, 1, id);
    assert.match(run.stderr, new RegExp(`forge spec ${id}`, "u"), id);
  }
});

/* A nested identifier was never matched by the old shape either, so it reached the same refusal by
   a different door; it must still name the clause route rather than only the key shape. */
test("a nested clause identifier is routed too", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "FR-05-2"]);
  assert.match(run.stderr, /forge spec FR-05-2/u);
});

/* Not every wrong argument is a citation: one that looks like nothing gets the key shape and no
   advice about clauses, because a route that does not fit is a refusal a reader cannot act on. */
test("an argument shaped like neither is told what a key is, and sent nowhere else", async () => {
  cutTo(BACKLOG, 2);
  const run = await ran(["issue", "not-a-key-at-all"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /this tracker keys issues ISS and digits/u);
  assert.doesNotMatch(run.stderr, /forge spec/u);
});

test("the lowercase form of a key still resolves, and to the same issue", async () => {
  cutTo(BACKLOG, 2);
  const upper = await ran(["issue", "ISS-1"]);
  const lower = await ran(["issue", "iss-1"]);
  assert.equal(lower.status, 0, lower.stderr);
  assert.equal(lower.stdout, upper.stdout, "the lookup upper-cases, and nothing covered this before");
});

/* The walk itself is untouched: a real key below the cut page still costs the windows it needs. */
test("a key the first page cannot carry still resolves through the walk", async () => {
  cutTo(BACKLOG, 2);
  state.calls = [];
  const run = await ran(["issue", "ISS-1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(asked() > 1, `${asked()} request(s) — the oldest key is under the waterline`);
});
