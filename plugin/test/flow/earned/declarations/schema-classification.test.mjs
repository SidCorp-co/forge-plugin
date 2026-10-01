/* A plan declaring schema coupling owes the migration risk classification at `testing`, and the
   demand once read "any attachment at all": a test log, a screenshot, any file on the issue or on a
   comment discharged a refusal whose sentence named the classification (ISS-2196). So the demand is
   discharged by the record that carries one, and the unrelated attachment is planted beside it here,
   because a case built only on an issue with no attachments exercises the path that always worked. */
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
const owed = (issue, comments = []) => judgedOwed(viewFrom("the-uuid", { ...COUPLED, ...issue }, [...JUDGED, ...comments]), "ISS-3");
const said = (issue, comments) => owed(issue, comments).map((one) => one.what);

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const UNCLASSIFIED = "the plan declares schema coupling, and no migration risk classification is on the record";

test("a schema-coupled change owes the classification record, whatever else the issue carries", () => {
  const logged = comment("the suite's log", { attachments: [{ name: "suite.txt" }] });
  const attached = said({ attachments: [{ name: "run.txt" }] }, [logged]);
  assert.equal(attached.length, 1,
    "an attachment that is not a classification, on the issue or on a comment, discharges nothing");
  assert.deepEqual(attached, [UNCLASSIFIED], "and what stands names the record it wants");
  assert.deepEqual(said({}), [UNCLASSIFIED]);
  assert.match(owed({})[0].command,
    /^forge record migration ISS-3 --reaches .+ --statement .+additive\|tightening\|destructive/u,
    "and the one command that clears it is the record's write, not an attachment");
});

test("a whole classification record discharges the demand, and one that does not read back whole does not", () => {
  const classified = recorded("migration", {
    reaches: "the entrypoint migrates at boot, so the merge is the schema change",
    statement: ["ALTER TABLE runs ADD COLUMN note text | additive"],
  });
  assert.deepEqual(said({}, [classified]), [], "with nothing attached at all");
  const thin = recorded("migration", { reaches: "the entrypoint migrates at boot" });
  assert.deepEqual(said({}, [thin]), ["the migration on the record is not a whole payload: it lacks --statement"],
    "a record with no statement is said to be one, rather than passed");
  const unclassed = recorded("migration", { reaches: "at boot", statement: ["ALTER TABLE runs DROP COLUMN note"] });
  assert.match(said({}, [unclassed])[0] ?? "", /^the migration on the record is not a whole payload/u,
    "and so is a statement carrying no classification");
});

test("a plan declaring no schema coupling owes no classification", () => {
  assert.deepEqual(said({ plan: "Screen change: no. Schema coupling: no." }), []);
});

/* Through the verb a run types and the tracker it writes to, rather than off `render`: a write whose
   dispatch or parse lost the kind would leave every case above green (consult 75e16f F1). */
const coupledIssue = {
  documentId: "coupled-uuid", issueId: "ISS-3", status: "developed", title: "a schema-coupled change",
  description: "no mark here", ...COUPLED,
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [coupledIssue],
  comments: { "coupled-uuid": [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: project.issues.length, hasMore: false };
      if (args.action === "get") return coupledIssue;
      if (args.action === "update") return Object.assign(coupledIssue, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
  },
};

test("forge record migration writes the record the demand reads, and refuses a statement with no class", async () => {
  const { tracker, env } = await trackerFor(project);
  try {
    for (const again of [1, 2]) assert.ok(again && await ranAsync(FORGE, ["claim", "ISS-3", "--unheld"], env));
    const refused = await ranAsync(FORGE, ["record", "migration", "ISS-3", "--reaches", "at boot",
      "--statement", "ALTER TABLE runs DROP COLUMN note"], env);
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /--statement takes `<statement> \| additive\|tightening\|destructive`/u);
    const wrote = await ranAsync(FORGE, ["record", "migration", "ISS-3",
      "--reaches", "the entrypoint migrates at boot, so the merge is the schema change",
      "--statement", "ALTER TABLE runs ADD COLUMN note text | additive"], env);
    assert.equal(wrote.status, 0, wrote.stderr);
    const posted = project.calls.filter((one) => one.name.startsWith("forge_comments") && one.args?.data?.body)
      .map((one) => one.args.data.body).filter((body) => body.includes("forge-record: migration"));
    assert.equal(posted.length, 1, "one migration record went up");
    assert.deepEqual(said({}, [comment(posted[0])]), [], "and the record the verb wrote discharges the demand");
  } finally {
    tracker.close();
  }
});
