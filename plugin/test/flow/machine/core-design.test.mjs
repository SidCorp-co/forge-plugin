/* ISS-28 / FB-33: a design hold surfaced only after core refused the move into build. `advance --owed`
   now reads the project's gate profile and, where a design gate is on `enforce`, the issue's design,
   so the gap is named at the rung the build is next — not two statuses later at core's refusal. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("core-design").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HOLDER = "this-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-258_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
const ISSUE = {
  documentId: "design-uuid",
  issueId: "ISS-92",
  projectId: "00000000-0000-4000-8000-000000000004",
  status: "approved",
  title: "a change core gates on a design",
  description: "no design here",
  acceptanceCriteria: "1. The first outcome.",
  complexity: "s",
  sessionContext: { lease: LEASE },
};
const state = { calls: [], issues: [ISSUE], comments: {}, answer: {}, gates: null, design: null };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  return { documentId: args.documentId };
};
state.answer.forge_config = (args) => (args.action === "gates" ? state.gates : undefined);
state.answer["forge_issues.design"] = () => state.design;
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const owed = () => ranAsync(FORGE, ["advance", "ISS-92", "--owed"], { ...ENV, FORGE_SESSION_ID: HOLDER });

const gatesWith = (mode) => ({ declared: true, profile: "strict", gates: [{ id: "design_record", mode }] });
const MISSING = { design: null, check: { passed: false, code: "DESIGN_RECORD_MISSING",
  gaps: [{ part: "design" }], detail: "ISS-92 has no design. Record it (PUT /api/issues/:id/design), then move it." } };

test("where the design gate enforces and no design is recorded, the move into build names the gap and the record verb", async () => {
  state.gates = gatesWith("enforce");
  state.design = MISSING;
  const run = await owed();
  const said = `${run.stdout}${run.stderr}`;
  assert.match(said, /has no design/u, said);
  assert.match(said, /forge record design ISS-92/u, said);
  assert.ok(state.calls.some((one) => one.path === `/api/issues/${ISSUE.documentId}/design`), "the design was read");
});

test("the raw PUT aside in core's detail is dropped, so the owed line reads as one route to type", async () => {
  state.gates = gatesWith("enforce");
  state.design = MISSING;
  const said = `${(await owed()).stdout}`;
  assert.doesNotMatch(said, /PUT \/api\/issues/u, said);
});

test("where the design gate is off, nothing about a design is owed", async () => {
  state.gates = gatesWith("off");
  state.design = MISSING;
  const said = `${(await owed()).stdout}${(await owed()).stderr}`;
  assert.doesNotMatch(said, /design/u, said);
});

test("where core counts a design recorded, nothing about a design is owed", async () => {
  state.gates = gatesWith("enforce");
  state.design = { design: { revision: 1 }, check: { passed: true, gaps: [] } };
  const said = `${(await owed()).stdout}${(await owed()).stderr}`;
  assert.doesNotMatch(said, /has no design|forge record design/u, said);
});

test("where the design read is refused, the owed list says the design was not counted rather than ending", async () => {
  state.gates = gatesWith("enforce");
  state.design = { refused: "the design read failed" };
  const run = await owed();
  assert.equal(run.status, 0, run.stderr);
  assert.match(`${run.stdout}${run.stderr}`, /design read was refused/u, run.stdout);
});
