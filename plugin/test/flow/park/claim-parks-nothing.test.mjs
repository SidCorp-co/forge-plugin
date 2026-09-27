/* A claim takes the lease and nothing else: it moves no status and posts no record, however many
   reclaims the history holds, because the caller is the one process that knows it is alive and a
   count cannot tell a retried dispatch from a run that died. Past the threshold it names the park
   and leaves the call to the caller (ISS-693). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("claim-parks-nothing").path;

const { render } = await import("../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const OURS = "this-run";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const reclaim = (at, status) => ({ at, how: "reclaim", holder: "a-dead-run", status, next: null });

/* Lapsed past its own duration, so the claim below is a reclaim and adds one row to those given. */
const issue = (key, status, history) => ({
  documentId: `${key}-uuid`,
  issueId: key,
  status,
  title: "the status where runs keep stopping",
  description: "no mark here",
  complexity: "s",
  sessionContext: {
    lease: { holder: "a-dead-run", agent: "a", pid: "1", renewedAt: ago(90), minutes: 30, next: null, history },
  },
});

const THIRD = issue("ISS-90", "in_progress", [reclaim(ago(300), "in_progress"), reclaim(ago(200), "in_progress")]);
const FIRST = issue("ISS-91", "in_progress", [{ ...reclaim(ago(300), "in_progress"), how: "claim" }]);
const SECOND = issue("ISS-93", "in_progress", [reclaim(ago(300), "in_progress")]);
const NOTHING = "nothing was worked under this lease";
const readingRow = (at, status) => ({ ...reclaim(at, status), next: NOTHING });
/* The shape ISS-986 was measured in: every reclaim a reading, the lease it lapsed from one too. */
const READINGS = issue("ISS-94", "in_progress", [readingRow(ago(300), "in_progress"), readingRow(ago(200), "in_progress")]);
READINGS.sessionContext.lease.next = NOTHING;
const MIXED = issue("ISS-95", "in_progress", [reclaim(ago(400), "in_progress"), readingRow(ago(300), "in_progress"),
  reclaim(ago(200), "in_progress")]);
const PARKED = issue("ISS-92", "on_hold", [reclaim(ago(400), "in_progress"), reclaim(ago(300), "in_progress"),
  reclaim(ago(200), "in_progress")]);

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [THIRD, FIRST, SECOND, PARKED, READINGS, MIXED],
  comments: {
    [PARKED.documentId]: [{ documentId: "the-park", createdAt: ago(150), authorId: "agent",
      body: render("park", { kind: "crashed", why: "three reclaims of in_progress" }, "in_progress") }],
  },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) return Object.assign(found, { status: args.data.status });
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: `comment-${state.calls.length}` };
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

/* Every call the claim made that could move a status or post a record, whatever tool it went by. */
const movesOf = (documentId) => state.calls.filter((one) =>
  (one.name === "forge_issues" && one.args.action === "transition" && one.args.documentId === documentId)
  || (one.name === "forge_comments" && one.args.action !== "list" && one.args.data?.issue === documentId));

const claim = (key) => ranAsync(FORGE, ["claim", key], { ...ENV, FORGE_SESSION_ID: OURS });

test("the third reclaim of one status moves no status, posts nothing, and names the park to its caller", async () => {
  const run = await claim("ISS-90");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(THIRD.status, "in_progress", "the issue stays at the status it stood at");
  assert.deepEqual(movesOf(THIRD.documentId), [], "no transition and no comment was sent for it");
  assert.equal(THIRD.sessionContext.lease.holder, OURS, "and the lease is this run's");
  assert.match(run.stdout, /Reclaim 3 of in_progress/u, "the count is read back");
  assert.match(run.stdout, /Claims at in_progress: reclaim by a-dead-run at .* \| reclaim by this-run at /u,
    "with the history it counted, the caller's own row last");
  assert.match(run.stdout, /forge record park ISS-90 --kind crashed --why "3 reclaims of in_progress: /u,
    "and the command that parks it, for the caller to run where it judges the runs died here");
  assert.doesNotMatch(run.stdout, /kept crashing|is a person's/u, "nothing says the issue was parked");
});

test("a first reclaim prints its count and no park command, and moves nothing either", async () => {
  const run = await claim("ISS-91");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /Reclaim 1 of in_progress/u);
  assert.doesNotMatch(run.stdout, /forge record park/u, "one reclaim is a run resumed");
  assert.equal(FIRST.status, "in_progress");
  assert.deepEqual(movesOf(FIRST.documentId), []);
});

test("a second reclaim is still under the threshold: its count, no park command, nothing moved", async () => {
  const run = await claim("ISS-93");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /Reclaim 2 of in_progress/u);
  assert.doesNotMatch(run.stdout, /forge record park/u, "two reclaims are not yet past it");
  assert.equal(SECOND.status, "in_progress");
  assert.deepEqual(movesOf(SECOND.documentId), []);
});

test("a claim of an issue parked as crashed writes its own row and no second one", async () => {
  const before = PARKED.sessionContext.lease.history.length;
  const run = await claim("ISS-92");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const history = PARKED.sessionContext.lease.history;
  assert.equal(history.length, before + 1, `one row, this claim's: ${JSON.stringify(history.slice(before))}`);
  assert.deepEqual([history.at(-1).how, history.at(-1).status, history.at(-1).holder], ["reclaim", "on_hold", OURS]);
  assert.equal(PARKED.status, "on_hold", "the park stands as the person left it");
  assert.deepEqual(movesOf(PARKED.documentId), []);
});

/* A reclaim over a reading lease is a reading that lapsed, which the help teaches a dispatcher to take as often as it needs, so none of them spends the count (ISS-1537). */
test("reclaims over leases that declared nothing was worked are not counted, however many there are", async () => {
  const run = await claim("ISS-94");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /This reclaim of in_progress went over a lease that declared nothing was worked, so it counts for none: 0 counted at in_progress\. 3 reclaim\(s\) of in_progress went over/u);
  assert.doesNotMatch(run.stdout, /forge record park|Reclaim \d/u, "three readings are not three deaths");
  assert.equal(READINGS.sessionContext.lease.next, null, "and the declaration is not carried onto this run's lease");
});

test("past the threshold the history names which reclaims were readings, and counts only the rest", async () => {
  const run = await claim("ISS-95");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /Reclaim 3 of in_progress: .* 1 reclaim\(s\) of in_progress went over a lease that declared nothing was worked, and are not counted\./u);
  const history = run.stdout.split("\n").find((one) => one.startsWith("Claims at in_progress: ")).split(" | ");
  assert.equal(history.length, 4, history.join("\n"));
  assert.deepEqual(history.map((one) => one.endsWith("so not counted")), [false, true, false, false], history.join("\n"));
  assert.match(run.stdout, /forge record park ISS-95 --kind crashed --why "3 reclaims of in_progress: /u);
});
