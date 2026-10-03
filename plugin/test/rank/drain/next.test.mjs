/* Whether the master a project declared drains `developed` is draining it, read off the rows standing
   there: a declaration the rows do not bear out stands nobody down. docs/cli/the-drain-key.md. */
import assert from "node:assert/strict";
import test from "node:test";

import { declaring, issue, rankRoom } from "../room.mjs";
import { drainOf, evidenceSaid } from "../../../src/rank/drain.mjs";

const { load, ran, state, close } = await rankRoom();
test.after(close);

const judged = (t, qa = "independent") => {
  state.config = { pipelineConfig: { qa } };
  state.answer.forge_config = () => ({ config: state.config });
  t.after(() => { delete state.answer.forge_config; delete state.config; });
};

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const DAYS = 3 * 24 * 60;

const stale = (issueId, held = {}) => issue(issueId, { status: "developed", updatedAt: ago(DAYS), ...held });
const leasedBy = (holder, held = {}) => ({ lease: { holder, agent: "an agent", pid: "9",
  renewedAt: new Date().toISOString(), minutes: 60, history: [], ...held } });
const claimedBy = (holder, minutes) => ({ lease: { holder: "", released: ago(DAYS),
  history: [{ holder, at: ago(minutes), how: "claim", status: "developed" }] } });

const STANDS_DOWN = /Another master leaves these standing/u;
const ANYONE = /any master that reads the queue takes the rows at developed/u;

test("a declared master over a row nobody has touched for days does not stand another master down", async (t) => {
  load([issue("ISS-1"), stale("ISS-5")]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master"));
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, STANDS_DOWN, run.stdout);
  assert.match(run.stdout, /drained by — qa-master, declared and not draining:/u);
  assert.match(run.stdout, ANYONE);
  assert.match(run.stdout, /the oldest offered, ISS-5, was last written 3 day\(s\) ago/u,
    "the age of the row that sat is said where the drainer is named");
  assert.match(run.stdout, /judged against `rank\.drainIdle` 60 minute\(s\)/u);
});

test("another session's live lease on a row at developed is a master draining", async (t) => {
  load([issue("ISS-1"), stale("ISS-5"), stale("ISS-6", { sessionContext: leasedBy("a-judging-run") })]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master"));
  assert.match(run.stdout, /drained by — qa-master, declared and draining: 1 of the 2 row\(s\) read at developed carry another session's live lease/u,
    run.stdout);
  assert.match(run.stdout, STANDS_DOWN);
});

test("a claim another session recorded at developed inside the window is a master draining", async (t) => {
  load([issue("ISS-1"), stale("ISS-5", { sessionContext: claimedBy("a-judging-run", 10) })]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master"));
  assert.match(run.stdout, /declared and draining: .*another session last claimed one at developed 10 minute\(s\) ago/u,
    run.stdout);
  assert.match(run.stdout, STANDS_DOWN);
  load([issue("ISS-1"), stale("ISS-5", { sessionContext: claimedBy("a-judging-run", DAYS) })]);
  const lapsed = await ran(["next"], declaring("qa-master"));
  assert.doesNotMatch(lapsed.stdout, STANDS_DOWN, `a claim days old is no master alive: ${lapsed.stdout}`);
});

test("a row that reached developed inside the window has not yet been missed by anybody", async (t) => {
  load([issue("ISS-1"), issue("ISS-5", { status: "developed", updatedAt: ago(5) })]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master"));
  assert.match(run.stdout, /declared and draining: .*the oldest offered, ISS-5, was last written 5 minute\(s\) ago/u,
    run.stdout);
  assert.match(run.stdout, STANDS_DOWN);
});

test("with every row leased the line says no row is offered rather than inventing an oldest", async (t) => {
  load([issue("ISS-1"), stale("ISS-5", { sessionContext: leasedBy("a-judging-run") })]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master"));
  assert.match(run.stdout, /and no row is offered\. Another master leaves these standing/u, run.stdout);
});

test("a project that has not set the key is told no master is declared and anyone takes the rows", async (t) => {
  load([issue("ISS-1"), stale("ISS-5")]);
  judged(t);
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /drained by — no master — `drainedBy` is unset, so any master that reads the queue takes the rows at developed\. 0 of the 1 row\(s\) .* the oldest offered, ISS-5/u,
    run.stdout);
  assert.doesNotMatch(run.stdout, /dispatcher/u, "a project that declared nothing is told of nobody");
  assert.doesNotMatch(run.stdout, STANDS_DOWN);
});

test("a drain key the pair does not take names no master and leaves the rows to anyone", async (t) => {
  load([issue("ISS-1"), stale("ISS-5")]);
  judged(t);
  const run = await ran(["next"], declaring("qa-mastre"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /drained by — `drainedBy` is `qa-mastre`, which is no master that drains developed: it takes dispatcher or qa-master\. No master is declared, so any master that reads the queue takes the rows at developed until it is put right/u,
    run.stdout);
  assert.match(run.stdout, /judging — 1 issue\(s\)/u,
    "and the rows are still offered: the drain says who is dispatched, never whether an issue is offered");
});

test("a window the read did not finish concludes nothing from it and says how much went unread", async (t) => {
  load([issue("ISS-1"), stale("ISS-5", { createdAt: "2026-09-01T00:00:00.000Z" }),
    issue("ISS-6", { status: "developed", createdAt: "2026-09-02T00:00:00.000Z", updatedAt: ago(5) })]);
  judged(t);
  const run = await ran(["next"], declaring("qa-master", { rank: { windowCap: 1 } }));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /declared and not draining: 0 of the 1 row\(s\) read .*and 1 further row\(s\) at developed went unread/u,
    run.stdout);
  assert.doesNotMatch(run.stdout, STANDS_DOWN, "the fresh row behind the window is not evidence nobody read");
});

test("evidence in a window the read did not finish stands nobody down either", async (t) => {
  load([issue("ISS-1"), stale("ISS-5", { createdAt: "2026-09-01T00:00:00.000Z", sessionContext: leasedBy("a-judging-run") }),
    stale("ISS-6", { createdAt: "2026-09-02T00:00:00.000Z" })]);
  judged(t);
  const room = declaring("qa-master", { rank: { windowCap: 1 } });
  const run = await ran(["next"], room);
  assert.doesNotMatch(run.stdout, STANDS_DOWN, `a lease in the front window says nothing of the row behind it: ${run.stdout}`);
  assert.match(run.stdout, /1 of the 1 row\(s\) read at developed carry another session's live lease.*1 further row\(s\) at developed went unread/u);
  const held = JSON.parse((await ran(["next", "--json"], room)).stdout).judging.drain;
  assert.deepEqual(held.evidence, ["leased"], "the evidence is still reported");
  assert.equal(held.holds, false, "and still holds nothing");
});

test("the machine-readable form carries the declared master and the evidence it was judged on", async (t) => {
  load([issue("ISS-1"), stale("ISS-5")]);
  judged(t);
  const run = await ran(["next", "--json"], declaring("qa-master"));
  assert.equal(run.status, 0, run.stderr);
  const held = JSON.parse(run.stdout).judging;
  assert.equal(held.drainedBy, "qa-master");
  assert.equal(held.drain.declared, true);
  assert.equal(held.drain.holds, false, "a program stands down on this and on nothing else");
  assert.deepEqual(held.drain.evidence, []);
  assert.equal(held.drain.leased, 0);
  assert.equal(held.drain.lastClaimAt, null);
  assert.equal(held.drain.oldest.issueId, "ISS-5");
  assert.ok(held.drain.oldest.idleMinutes >= DAYS, JSON.stringify(held.drain.oldest));
  assert.equal(held.drain.idleMinutes, 60);
  for (const [room, why] of [[declaring("qa-mastre"), "a value the key does not take"], [undefined, "no key"]]) {
    const other = JSON.parse((await ran(["next", "--json"], room)).stdout).judging;
    assert.equal(other.drainedBy, null, `${why} carries no master rather than a default`);
    assert.equal(other.drain.holds, false, `${why} stands nobody down`);
  }
  load([issue("ISS-1"), stale("ISS-5", { sessionContext: leasedBy("a-judging-run") })]);
  const none = JSON.parse((await ran(["next", "--json"], declaring("qa-master"))).stdout).judging;
  assert.equal(none.drain.oldest, null, "no row offered is no oldest row");
  assert.equal(none.drain.holds, true);
});

/* The asking session's own lease and claims, which the end-to-end cases cannot hold apart from
   another's without knowing the child's id: here the id is the argument. */
test("the asking session's own lease and claims are no evidence about another master", () => {
  const own = "this-run";
  const row = (issueId, held) => ({ issueId, row: { issueId, updatedAt: ago(DAYS) }, ...held });
  const mine = {
    offered: [row("ISS-5", { lease: { holder: "", history: [{ holder: own, at: ago(1), status: "developed" }] } })],
    left: [row("ISS-6", { held: "mine", lease: { holder: own, renewedAt: ago(1), history: [] } })],
    unreached: 0,
  };
  const drain = drainOf(mine, { idle: 60, own });
  assert.equal(drain.leased, 0, "this session's lease is its own work, not another master's");
  assert.equal(drain.lastClaimAt, null, "nor is its claim");
  assert.deepEqual(drain.evidence, []);
  assert.equal(drain.holds, false);
  const theirs = drainOf({ ...mine, left: [row("ISS-6", { held: "live", lease: { holder: "them" } })] },
    { idle: 60, own });
  assert.deepEqual(theirs.evidence, ["leased"], "while the same lease held by another session is");
});

/* The listing's own shortfall, which the cap's count does not carry: a walk the tracker ended early
   returns the rows it reached and `whole` false, and the rows it never returned are no evidence. */
test("evidence from a listing that stopped before its end holds no declaration and says so", () => {
  const judging = { offered: [], unreached: 0,
    left: [{ issueId: "ISS-6", held: "live", row: { issueId: "ISS-6" }, lease: { holder: "them" } }] };
  const short = drainOf(judging, { idle: 60, whole: false, own: "this-run" });
  assert.deepEqual(short.evidence, ["leased"], "the lease is still reported");
  assert.equal(short.holds, false, "and holds nothing over rows nobody listed");
  assert.match(evidenceSaid(short), /the listing stopped before its end, so rows at developed it never returned stand unread/u);
  assert.equal(drainOf(judging, { idle: 60, own: "this-run" }).whole, true, "a caller saying nothing read the whole listing");
});
