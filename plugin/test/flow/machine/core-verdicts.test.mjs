/* adminhub-api on 3.36.649: a verdict written through core's verdict route (`POST /api/issues/:id/
   verdicts`) posts no comment, so `advance --owed`, reading the thread alone, called its criterion
   "no verdict" while core's criteria read counted it. The owed list now reads core's criteria too, the
   read core's gate decides by, so the CLI and core agree on which criteria carry a verdict. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

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
  assert.match(said, /a run declared --role reviewer records it through its review: POST \/api\/issues\/judged-uuid\/review/u, said);
});
