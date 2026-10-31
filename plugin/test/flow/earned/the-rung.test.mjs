/* The rung the tracker renamed, and the claims holding it: the ladder's tail, both halves of the one
   rung, the names core retired that nothing here writes, the declared enum (ISS-1022). The ladder is
   core's machine now, and its tail stops at awaiting_release: core closes an issue only by its release. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("the-rung").path;
const { CHECKS, LADDER, deployedOwed, judgedOwed, nextOf, viewFrom } =
  await import("../../../src/flow/earned.mjs");
const { CLOSES_FROM } = await import("../../../src/flow/machine.mjs");
const { DECLARES } = await import("../../../src/tracker/routes.mjs");
const { declaredFor, statusKind } = await import("../../../src/tracker/rest.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");
const { Refused } = await import("../../../src/refusal.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const RUNG = "awaiting_release";
const JUDGING = "in_progress:release";
const RELEASING = "releasing";

/* Core's statuses, read off the copy of its contract the machine tests pin, never off what the
   ladder ought to want. */
const ANSWERED = JSON.parse(readFileSync(new URL("../../fixtures/dev-core/issue-machine.json", import.meta.url), "utf8")).statuses;
/* What this CLI declares: core's ten, and the four places inside `in_progress` the ladder climbs. */
const DECLARED = ["draft", "open", "reopen", "in_progress", "in_progress:plan", "approved", "in_progress:build",
  "in_progress:test", "in_progress:release", "awaiting_release", "closed", "on_hold", "needs_info", "dropped"];

test("the ladder's tail is two places, the test leads to the judging one, and nothing climbs to closed", () => {
  assert.deepEqual(LADDER, ["open", "in_progress:plan", "approved", "in_progress:build", "in_progress:test",
    JUDGING, RUNG], "a member added or dropped anywhere fails this");
  assert.equal(nextOf("in_progress:test", {}), JUDGING);
  assert.equal(nextOf(JUDGING, {}), RUNG);
  assert.equal(nextOf(RUNG, {}), null, "core closes it only by the release that ships it");
  assert.equal(LADDER.includes("tested"), false, "the place the verdicts earn is `in_progress:release` now");
  assert.equal(LADDER.includes("released"), false, "and the tracker holds no such status at all");
});

/* Each rung is entered on one half and neither may answer for the other: a rung whose check reached
   for both could not say which actor it was waiting for, which is what ISS-1065 split. */
test("each rung is entered on its own half, and neither check reaches the other's", () => {
  const view = viewFrom("the-uuid", { acceptanceCriteria: "1. The one outcome." }, []);
  const judged = judgedOwed(view, "ISS-3");
  const deployed = deployedOwed(view, "ISS-3");
  assert.ok(judged.length, "the judging half asks for the verdict");
  assert.ok(deployed.length, "and the deploying half for the verification and the note");
  assert.deepEqual(CHECKS[JUDGING](view, "ISS-3"), judged);
  assert.deepEqual(CHECKS[RUNG](view, "ISS-3"), deployed);
});

/* ISS-1480: nine issues reached `awaiting_release` with no verification record at all, or one
   naming a local stack rather than a deployment, and the close cleared every one, because it tested
   the same three record kinds whatever put the issue on the rung instead of reading what the
   verification itself said. The verification is read where the issue enters the rung, and the close
   is no advance at all: core makes it only by the release that ships it. */
test("the rung is entered on a verification naming the deployment, and closed is the release's", () => {
  assert.equal(CLOSES_FROM, RUNG, "the close reads the rung's own name");
  const releases = { staging: "master", model: "publish", said: "publish", live: null,
    strategy: null, autoProd: true, from: "the fixture" };
  const NOTE = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; "
    + "landing moved nothing; landing wrote nothing";
  const mark = { createdAt: "2026-09-02T10:00:00.000Z", authorId: "agent", body: `mark_merged target=base — ${NOTE}` };
  const verifiedAt = (commit, evidence = ["https://app.example/build/9"]) => ({ createdAt: "2026-09-02T10:01:00.000Z",
    authorId: "agent", body: render("verification", { where: "https://app.example", commit, evidence }) });
  const NOTED = { section: "Skip", userFacing: "-" };
  const entered = (comments) =>
    CHECKS[RUNG](viewFrom("the-uuid", { status: JUDGING, releaseNotes: NOTED }, comments, null, releases), "ISS-3");

  const bare = entered([mark]);
  assert.ok(bare.length, "no verification record at all still owes one, wherever the issue arrived from");
  assert.match(bare[0].what, /no verification/u);

  const stale = entered([mark, verifiedAt("eee109e")]);
  assert.ok(stale.length, "a verification naming a commit the merged mark does not is not the rung's answer either");
  assert.match(stale[0].what, /eee109e/u);
  assert.match(stale[0].what, /43b811e/u);

  /* A sha is a citation and never the deployment itself (codex F1 on ISS-1480's whole-set review). */
  const shaOnly = entered([mark, verifiedAt("43b811e", ["43b811e"])]);
  assert.ok(shaOnly.length, "every evidence item being a bare commit sha is not the rung's answer either");
  assert.match(shaOnly[0].what, /a sha names no deployment/u);

  assert.deepEqual(entered([mark, verifiedAt("43b811e")]), [],
    "the merged mark and a verification naming the deployment are the whole criterion");
  let said = "";
  try {
    targetOf(viewFrom("the-uuid", { status: RUNG }, [mark, verifiedAt("43b811e")], null, releases), "ISS-3");
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    said = error.message;
  }
  assert.match(said, /CLOSE_ONLY_BY_RELEASE/u, "and from the rung, the close is refused as no advance's");
  assert.match(said, /forge release-batch record ISS-3 /u, "naming the release's record that makes it");
});

/* A write is checked against this list before its request is built, so it answers to core rather
   than the ladder: every declared name is a status core holds or a place inside one, and no name core
   retired is offered. */
test("the declared status list is core's statuses and the ladder's places, and the ladder is a subset of it", () => {
  assert.deepEqual(declaredFor("forge_issues", "status"), DECLARED,
    "a declared set answers with values, whatever each row carries beside its name");
  for (const name of DECLARED) {
    assert.ok(ANSWERED.includes(name.split(":")[0]), `${name} stands at a status core does not hold`);
  }
  for (const status of LADDER) {
    assert.ok(DECLARED.includes(status), `${status} is a place this CLI writes and declares no row for`);
  }
  assert.equal(DECLARED.includes("released"), false, "and the name the tracker dropped is undeclared");
  assert.ok(!DECLARED.includes(RELEASING) && !LADDER.includes(RELEASING),
    "while the release path's old status is neither declared nor a place of the ladder");
});

/* Three facts in three files until ISS-1043, one column now: the row carrying nothing but a name is
   the fourth kind — readable, written by a park or a set, and no step of the flow. */
test("every declared name carries its kind where it is declared, and an undeclared name has none", () => {
  assert.deepEqual(DECLARES.forge_issues.status.map((one) => one.name), DECLARED,
    "one row per name this CLI writes, and no row for a name core does not take");
  assert.deepEqual(statusKind("tested"), { name: "tested", replacedBy: RUNG });
  assert.deepEqual(statusKind(RELEASING), { name: RELEASING, replacedBy: RUNG });
  assert.equal(statusKind("in_progress:test").step, true);
  assert.deepEqual(statusKind("needs_info"), { name: "needs_info" },
    "a name that is no step and not retired carries nothing beside itself");
  assert.equal(statusKind("released"), null, "and a name off the table has no kind to read");
});

/* The column says which names are steps and `LADDER` in what order, so either edited alone fails
   here. Driven over a disagreeing sequence: an equality that cannot fail covers nothing. */
const stepNames = () => DECLARES.forge_issues.status.filter((one) => one.step).map((one) => one.name);
const disagreeing = (order) => {
  const steps = stepNames();
  return [...order.filter((one) => !steps.includes(one)), ...steps.filter((one) => !order.includes(one))];
};

test("the step column and LADDER name the same places, and either edited alone goes red", () => {
  assert.deepEqual(disagreeing(LADDER), [],
    "every name whose row carries step is a place, and every place's row carries step");
  assert.deepEqual(disagreeing([...LADDER, "needs_info"]), ["needs_info"],
    "a name joining the sequence whose row carries no step is named");
  assert.deepEqual(disagreeing(LADDER.filter((one) => one !== "in_progress:plan")), ["in_progress:plan"],
    "and so is a step row the sequence dropped");
});

/* A park record outlives the rename and names the status it left, so the way back is refused — and the refusal names the rung that took it over rather than a placeholder the reader fills. Not an alias: the deploying half was never earned (review F1). */
test("a park recorded from the retired rung is refused the way back, naming what replaced it", () => {
  const at = (minute, body) => ({ createdAt: `2026-09-08T10:0${minute}:00.000Z`, authorId: "agent", body });
  /* The park sits under the tracker's announcement of the move, which is what pairs the two. */
  const said = at(0, "❓ **Needs info** — moved from `awaiting_release`\n\nlook at it");
  const park = at(1, render("park", {
    kind: "release-decision", why: "the release waits on a person", evidence: ["43b811e"] }, "tested"));
  const view = viewFrom("the-uuid", { status: "needs_info" }, [said, park]);
  assert.throws(() => targetOf(view, "ISS-96"), (error) => {
    assert.match(error.message, /names `tested` as the status it left/u);
    assert.match(error.message, /took it over is `awaiting_release`/u);
    assert.match(error.message, /--set awaiting_release/u, "and the command carries the name, not `<status>`");
    return true;
  });
});

const SHIPPED = {
  documentId: "rung-uuid",
  issueId: "ISS-96",
  status: RUNG,
  title: "the change a run has released",
  description: "no mark here",
};
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [SHIPPED],
  comments: {},
  answer: { forge_config: () => ({ config: state.config }) },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
const transitions = () => state.calls.filter((one) =>
  one.name === "forge_issues" && one.args?.action === "transition");

/* A name core retired is refused by the verb before anything is sent, whichever route asks for it,
   and the refusal names the place that took it over as a command to run (consult 8736c3, F1;
   ISS-1043). A filter naming one is refused too: core holds no row at it. */
test("a retired name is refused the set, the jump and the filter, naming the place that took it over", async () => {
  for (const name of ["tested", RELEASING]) {
    const set = await ranAsync(FORGE, ["advance", "ISS-96", "--set", name, "--why", "the verdicts are all in"], ENV);
    const said = set.stdout + set.stderr;
    assert.equal(set.status, 1, set.stdout);
    assert.match(said, new RegExp(`\`${name}\` is no status core holds: it refuses the name ISSUE_STATUS_LEGACY`, "u"));
    assert.match(said, /`awaiting_release` is the place that took it over/u);
    assert.match(said, /forge advance ISS-96 --set awaiting_release --why/u,
      "the replacement is a command to run, not a name to look up");
    assert.doesNotMatch(said, /-h\b/u, "and no caller is sent to a help text to find out what to do");
    const to = await ranAsync(FORGE, ["advance", "ISS-96", "--to", name], ENV);
    assert.equal(to.status, 1, to.stdout);
    const read = await ranAsync(FORGE, ["issue", "--status", name], ENV);
    assert.equal(read.status, 1, `${read.stdout}${read.stderr}`);
    assert.match(read.stderr, new RegExp(`No status named ${name}`, "u"));
  }
  assert.deepEqual(transitions(), [], "nothing was sent");
});
