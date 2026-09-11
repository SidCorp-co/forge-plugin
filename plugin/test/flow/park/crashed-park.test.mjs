/* The third reclaim of one status parks the issue, and that park is three writes: the record, the
   move, and the acknowledgement that says the park was answered. The acknowledgement reads the field
   again because the two before it renewed the lease — and what it reads is another run's as often as
   its own, which is the case below (ISS-1216). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("crashed-park").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "crashing-uuid";
const OURS = "this-run";
const THEIRS = "the-other-run";

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const reclaim = (at) => ({ at, how: "reclaim", holder: "a-dead-run", status: "in_progress", next: null });

/* Dead, so this claim is the reclaim that makes the third; the two before it are on the history. */
const CRASHING = {
  documentId: UUID,
  issueId: "ISS-90",
  status: "in_progress",
  title: "the status where runs keep dying",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-09~1: the one outcome.",
  complexity: "s",
  sessionContext: {
    lease: {
      holder: "a-dead-run", agent: "a", pid: "1", renewedAt: ago(90), minutes: 30, next: null,
      history: [reclaim(ago(300)), reclaim(ago(200))],
    },
  },
};

const theirs = () => ({
  lease: {
    holder: THEIRS, agent: "a", pid: "2", renewedAt: new Date().toISOString(), minutes: 30,
    next: "mine now", history: CRASHING.sessionContext.lease.history,
  },
});

/* The window: the record and the move both renew, and the acknowledgement reads the field after
   them. A run that took the issue in that gap is what the read answers with. */
let moved = false;
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [CRASHING],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "get") {
        if (moved) return { ...found, sessionContext: theirs() };
        return found ?? {};
      }
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) {
        found.status = args.data.status;
        moved = true;
        return { ...found };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = { documentId: `comment-${state.calls.length}`, createdAt: new Date().toISOString(),
          authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const updates = () => state.calls
  .filter((one) => one.name === "forge_issues" && one.args.action === "update")
  .map((one) => one.args.data?.sessionContext?.lease?.holder);

test("the acknowledgement a crashed park owes is refused where the field it read back is another run's", async () => {
  const run = await ranAsync(FORGE, ["claim", "ISS-90"], { ...tracker.env, FORGE_SESSION_ID: OURS });
  assert.equal(run.status, 1, `the run should have been refused:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, new RegExp(`held by another run: session ${THEIRS}`, "u"),
    "the refusal names the run that took it, its renew time and the command that clears it");
  assert.ok(!run.stdout.includes("The lease is yours"),
    "and nothing tells this run it holds an issue another run took");
  assert.ok(!updates().includes(THEIRS),
    `no write put the other run's holder back under this run's acknowledgement: ${updates().join(", ")}`);
});
