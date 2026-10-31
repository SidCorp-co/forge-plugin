/* A status move is one core serves from where the issue stands: the issue's standing names its legal
   moves (`GET /api/projects/:id/issues/standing/:key`, `moves`), so the ladder's move is read against
   that list before anything is sent, and one core does not serve is refused here naming the moves it
   does. A move core serves goes out in its words: the status, then the work step. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("core-moves").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HOLDER = "this-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
const ISSUE = {
  documentId: "approved-uuid",
  issueId: "ISS-91",
  projectId: "00000000-0000-4000-8000-000000000004",
  status: "approved",
  title: "a change built on a branch",
  description: "no mark here",
  complexity: "s",
  sessionContext: { lease: LEASE, worklog: { branch: "iss-91-the-work" } },
};
const state = {
  calls: [],
  issues: [ISSUE],
  comments: {},
  answer: {},
  served: [],
};
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action === "moves") return { key: args.key, status: ISSUE.status, moves: state.served.map((to) => ({ to })) };
  if (args.action === "get") return args.documentId === ISSUE.documentId ? ISSUE : {};
  if (args.action === "transition") return Object.assign(ISSUE, { status: args.data.status });
  if (args.action === "update") return Object.assign(ISSUE, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const forge = (...argv) => ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: HOLDER });
const sent = (action) => state.calls.filter((one) => one.name === "forge_issues" && one.args.action === action);

test("a move core does not serve from where the issue stands is refused before it is sent, naming what core serves", async () => {
  Object.assign(ISSUE, { status: "approved" });
  state.served = ["needs_info", "on_hold", "dropped"];
  state.calls = [];
  const run = await forge("advance", "ISS-91");
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.equal(sent("moves").length, 1, "the legal moves were read off core's standing of the issue");
  assert.equal(sent("transition").length, 0, "and the move core does not serve was never sent");
  assert.match(run.stderr, /needs_info, on_hold, dropped/u, "the refusal names the moves core serves");
  assert.match(run.stderr, /in_progress/u, "and the move that was asked for");
  assert.equal(ISSUE.status, "approved");
});

test("a move core serves goes out in its words: the status, then the work step", async () => {
  Object.assign(ISSUE, { status: "approved", workState: null });
  state.served = ["in_progress", "needs_info", "on_hold", "dropped"];
  state.calls = [];
  const run = await forge("advance", "ISS-91");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const [moved] = sent("transition");
  assert.equal(moved?.args.data.status, "in_progress", "the transition names a status core holds");
  const stepped = sent("update").find((one) => one.args.data.workState);
  assert.deepEqual(stepped?.args.data.workState, { step: "build" }, "and the step is core's work step");
  assert.match(run.stdout, /approved -> in_progress:build/u, "the reply names the place in core's words");
  assert.doesNotMatch(run.stdout + run.stderr, /\b(confirmed|developed|testing)\b/u, "and no legacy status");
});
