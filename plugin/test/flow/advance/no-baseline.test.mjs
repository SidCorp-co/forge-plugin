/* `in_progress` is earned by the branch and the blockers alone: the landing's gate measures the tree,
   every commit reaching the default branch through it, so a build owes no measurement of its own
   (ISS-3184). Spawned at every rung, because a rung's report and lane are what `--owed` prints
   around the shortfall and either could still hand over a gate. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("advance-no-baseline").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HOLDER = "this-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
/* One approved issue per rung, each built on a branch and holding no record at all. */
const BUILDING = [["xs", "ISS-81"], ["s", "ISS-82"], ["m", "ISS-83"]].map(([complexity, issueId]) => ({
  documentId: `building-${complexity}-uuid`,
  issueId,
  status: "approved",
  title: "a change built on a branch",
  description: "no mark here",
  complexity,
  sessionContext: { lease: LEASE, worklog: { branch: `${issueId.toLowerCase()}-the-work` } },
}));
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: BUILDING,
  comments: {},
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: BUILDING, returned: BUILDING.length, hasMore: false };
  const held = BUILDING.find((one) => one.documentId === args.documentId);
  if (args.action === "get") return held ?? {};
  if (args.action === "transition" && held) return Object.assign(held, { status: args.data.status });
  if (args.action === "update" && held) return Object.assign(held, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const forge = (...argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: HOLDER });

test("--owed on an approved issue on a branch names no baseline and no gate, at every rung", async () => {
  for (const one of BUILDING) {
    const run = await forge("advance", one.issueId, "--owed");
    assert.match(run.stdout, /in_progress is next and the record earns it/u, `${one.complexity}:\n${run.stdout}${run.stderr}`);
    assert.doesNotMatch(run.stdout, /baseline/iu, `${one.complexity} names no baseline:\n${run.stdout}`);
    assert.doesNotMatch(run.stdout, /--gate|npm run check|tools\/gates|run of the gate/u,
      `${one.complexity} hands over no gate command:\n${run.stdout}`);
  }
});

test("an approved issue on a branch holding no baseline moves to in_progress, at every rung", async () => {
  for (const one of BUILDING) {
    const run = await forge("advance", one.issueId);
    assert.equal(run.status, 0, `${one.complexity}:\n${run.stdout}${run.stderr}`);
    assert.equal(one.status, "in_progress", `${one.complexity}:\n${run.stdout}`);
  }
});
