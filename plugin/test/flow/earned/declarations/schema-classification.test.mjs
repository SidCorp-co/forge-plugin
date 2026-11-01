/* ISS-10 (FB-23): ISS-2196 added `migration` as a plugin record kind, but forge-core never added it
   to its event kinds, so the record the plugin typed was refused (EVENT_KIND_UNKNOWN / RECORD_NOT_TYPED)
   and no rung could read it back. The kind and its release-rung demand are gone until core keeps it: a
   schema-coupled change owes no migration classification, and `forge record migration` is refused
   through absent, naming the verification or a decision as where a schema statement's risk goes now. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("schema-classification").path;
const { render } = await import("../../../../src/flow/record/page.mjs");
const { judgedOwed, viewFrom } = await import("../../../../src/flow/earned.mjs");

let clock = 0;
const comment = (body, extra = {}) => ({
  createdAt: `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`, authorId: "agent", body, ...extra,
});
const recorded = (kind, fields) => comment(render(kind, fields));

const BUILT = { sessionContext: { worklog: { branch: "iss-3-the-work" } } };
const COUPLED = {
  ...BUILT, mergedAt: "2026-09-02T13:49:51.777Z",
  acceptanceCriteria: "1. The first outcome.\n2. The second outcome.",
  plan: "Screen change: no. Schema coupling: yes.",
};
const JUDGED = [comment("mark_merged target=base — merged to master at c8c3550"), ...[1, 2].map((number) =>
  recorded("verdict", { criterion: `${number} — text`, verdict: "pass", commit: "c8c3550", evidence: ["c8c3550"] }))];
const said = (issue, comments = []) =>
  judgedOwed(viewFrom("the-uuid", { ...COUPLED, ...issue }, [...JUDGED, ...comments]), "ISS-3").map((one) => one.what);

test("a fully-judged schema-coupled change owes no migration classification — the kind core never kept is gone", () => {
  assert.deepEqual(said({}), [], "the release rung no longer demands a migration record for schema coupling");
  assert.deepEqual(said({ plan: "Screen change: no. Schema coupling: no." }), [], "and a plan with no coupling owes none either");
});

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [{ documentId: "coupled-uuid", issueId: "ISS-3", status: "developed", title: "a schema-coupled change",
    description: "no mark here", ...COUPLED }],
  comments: { "coupled-uuid": [] },
  unasked: ["forge_issues"],
  answer: {
    forge_issues: (args) => (args.action === "list"
      ? { issues: project.issues, returned: project.issues.length, hasMore: false } : project.issues[0]),
  },
};

test("forge record migration is refused through absent, naming the verification or a decision", async () => {
  const { tracker, env } = await trackerFor(project);
  try {
    const run = await ranAsync(FORGE, ["record", "migration", "ISS-3", "--reaches", "at boot"], env);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /record knows no kind `migration`/u, "the kind is gone");
    assert.match(run.stderr, /forge record verification|forge record decision/u, "pointing at where a schema statement's risk goes now");
  } finally {
    tracker.close();
  }
});
