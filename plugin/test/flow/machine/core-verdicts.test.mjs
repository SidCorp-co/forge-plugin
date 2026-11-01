/* adminhub-api on 3.36.649: a verdict written through core's verdict route (`POST /api/issues/:id/
   verdicts`) posts no comment, so `advance --owed`, reading the thread alone, called its criterion
   "no verdict" while core's criteria read counted it. The owed list now reads core's criteria too, the
   read core's gate decides by, so the CLI and core agree on which criteria carry a verdict. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";
import { render } from "../../../src/flow/record/page.mjs";

process.env.XDG_CONFIG_HOME = tempHome("core-verdicts").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HOLDER = "this-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
const ISSUE = {
  documentId: "judged-uuid",
  issueId: "ISS-92",
  projectId: "00000000-0000-4000-8000-000000000004",
  status: "in_progress",
  workState: { step: "test" },
  title: "a change judged through the verdict route",
  description: "no mark here",
  acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  complexity: "s",
  sessionContext: { lease: LEASE },
};
const state = { calls: [], issues: [ISSUE], comments: {}, answer: {}, core: null };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  return { documentId: args.documentId };
};
state.answer["forge_issues.criteria"] = () => state.core;
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const owed = () => ranAsync(FORGE, ["advance", "ISS-92", "--owed"], { ...ENV, FORGE_SESSION_ID: HOLDER });

const row = (n, latest, judge = "qa") => ({ n, statement: `outcome ${n}`, latest, judge, weighing: { earned: latest ? true : null } });

let clock = 0;
const at = () => `2026-10-31T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const verdictComment = (n, over = {}) => ({ id: `c-${n}`, createdAt: at(),
  body: render("verdict", { criterion: `${n} — outcome ${n}`, verdict: "pass", commit: "65979a2",
    evidence: ["stg-vm-checks.txt"], ...over }) });

test("a verdict core holds through its route, with no comment, is no criterion the owed read calls unjudged", async () => {
  state.core = { criteria: [row(1, { verdict: "pass", id: "v-1" }), row(2, null)], retired: [] };
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.match(said, /criterion 2 has no verdict/u, said);
  assert.doesNotMatch(said, /criterion 1 has no verdict|criteria 1, 2 have no verdict/u, `criterion 1 is core's: ${said}`);
  assert.ok(state.calls.some((one) => one.path === `/api/issues/${ISSUE.documentId}/criteria`), "core's criteria were read");
});

test("both judged through the route, the owed read names no criterion as unjudged", async () => {
  state.core = { criteria: [row(1, { verdict: "pass" }), row(2, { verdict: "pass" })], retired: [] };
  const run = await owed();
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /no verdict/u, run.stdout);
});

test("where core's criteria read is refused, the list is the thread's and says so", async () => {
  state.core = { refused: "the criteria read failed" };
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.match(said, /criteria 1, 2 have no verdict/u, said);
  assert.match(said, /Core's criteria read was refused \(.*\), so a verdict written through its verdict route alone is not counted/u, said);
});

/* FB-425 on sidcorp-mail: a criterion the design classes a code property is the review's, judged
   against the diff, and core refuses a verdict on it (VERDICT_JUDGED_BY_REVIEW); the owed read asked
   for one anyway. Core's criteria read names each criterion's judge, so the read sets those apart and
   says the review owes them. */
test("a criterion core routes to the review is owed by the review, never asked of a verdict", async () => {
  state.core = { criteria: [row(1, null, "qa"), row(2, null, "review")], retired: [] };
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.match(said, /criterion 1 has no verdict/u, said);
  assert.doesNotMatch(said, /criterion 2 has no verdict|criteria 1, 2 have no verdict/u, `a verdict is asked for criterion 2: ${said}`);
  assert.doesNotMatch(said, /record verdict ISS-92[^\n]*--criterion 2\b/u, "and no verdict command names it");
  assert.match(said, /criterion 2 is a code property core routes to the review[^\n]*the review owes it[^\n]*VERDICT_JUDGED_BY_REVIEW/u, said);
  assert.match(said, /a run declared --role reviewer records it in its review: forge record review ISS-92 --base <sha> --head <sha> --criterion 2 --result pass\|fail/u, said);
});

/* FB-19 on adminhub-api ISS-78: core wrote criterion 1's latest verdict through its own route and
   counts it earned, while the thread still carries the older comment-fenced row core superseded. The
   owed read trimmed its "no verdict" list by core's weighing but still weighed the stale row, so it
   asked for work — here, evidence the row cannot resolve — on a criterion core had already earned. */
test("a criterion core holds a latest verdict on is not weighed off the thread's superseded row", async () => {
  state.core = { criteria: [row(1, { verdict: "pass" }), row(2, null)], retired: [] };
  state.comments = { [ISSUE.documentId]: [verdictComment(1)] };
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.doesNotMatch(said, /criterion 1 lacks|verdict on criterion 1/u,
    `criterion 1 is core's, so its superseded thread row is not weighed: ${said}`);
  assert.match(said, /criterion 2 has no verdict/u, `and a criterion core has not judged is still owed: ${said}`);
  state.comments = {};
});

/* A latest verdict is not an earned one: core holds a fail on criterion 1 and its weighing counts it
   unearned, so the thread's fail is still the CLI's to surface. Weighing off the latest alone, not the
   earned set, would read the fail as judged and drop a criterion core says is not met. */
test("a criterion core counts unearned keeps its failing thread verdict weighed", async () => {
  state.core = { criteria: [{ n: 1, statement: "outcome 1", latest: { verdict: "fail" }, judge: "qa", weighing: { earned: false } },
    row(2, { verdict: "pass" })], retired: [] };
  state.comments = { [ISSUE.documentId]: [verdictComment(1, { verdict: "fail", evidence: ["65979a2"], why: "the outcome was not met" })] };
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.match(said, /criterion 1 failed its verdict/u, `a fail core counts unearned is still surfaced: ${said}`);
  state.comments = {};
});
