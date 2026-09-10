/* The rung the tracker renamed, and the claims holding it: the ladder's tail, both halves of the one
   rung, the release path's status that nothing here writes, the declared enum (ISS-1022). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("the-rung").path;
const { CHECKS, ORDER, deployedOwed, judgedOwed, nextOf, viewFrom } =
  await import("../../../src/flow/earned.mjs");
const { CLOSES_FROM } = await import("../../../src/flow/machine.mjs");
const { DECLARES } = await import("../../../src/tracker/routes.mjs");
const { declaredFor, statusKind } = await import("../../../src/tracker/rest.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const RUNG = "awaiting_release";
const RELEASING = "releasing";

/* Read off the tracker on 2026-09-10 by `forge issue --status released`, which answers the whole
   enum. Pinned to that read, never to what the ladder ought to want. */
const ANSWERED = ["open", "confirmed", "clarified", "waiting", "approved", "in_progress", "developed",
  "testing", "tested", "awaiting_release", "releasing", "closed", "reopen", "on_hold", "needs_info",
  "draft", "dropped"];

test("the ladder's tail is the one rung the tracker holds, and developed leads to it", () => {
  assert.deepEqual(ORDER, ["open", "confirmed", "clarified", "approved", "in_progress", "developed",
    RUNG, "closed"], "a member added or dropped anywhere fails this");
  assert.equal(nextOf("developed", {}), RUNG);
  assert.equal(ORDER.includes("tested"), false, "the rung the verdicts earned is this one now");
  assert.equal(ORDER.includes("released"), false, "and the tracker holds no such status at all");
});

/* Composed into one list, a half that stopped asking would leave the other's items behind and still
   read as a rung that refuses — so each half is held to asking something of its own. */
test("the rung asks both halves whole, and neither answers for the other", () => {
  const view = viewFrom("the-uuid", { acceptanceCriteria: "1. The one outcome." }, []);
  const judged = judgedOwed(view, "ISS-3");
  const deployed = deployedOwed(view, "ISS-3");
  assert.ok(judged.length, "the judging half asks for the verdict");
  assert.ok(deployed.length, "and the deploying half for the verification and the note");
  assert.deepEqual(CHECKS[RUNG](view, "ISS-3"), [...judged, ...deployed]);
});

test("closed is entered from that rung, and this change added nothing to what it owes", () => {
  assert.equal(CLOSES_FROM, RUNG, "the close reads the rung's own name");
  assert.equal(nextOf(CLOSES_FROM, {}), "closed");
  assert.deepEqual(CHECKS.closed(viewFrom("the-uuid", { status: RUNG }, []), "ISS-3"), [],
    "the rung is the whole criterion, as it was");
});

/* A write is checked against this list before its request is built, so it answers to the tracker
   rather than the ladder: `releasing` belongs in it for a read to name. */
test("the declared status list is the tracker's enum, and the ladder is a subset of it", () => {
  assert.deepEqual(declaredFor("forge_issues", "status"), ANSWERED,
    "a declared set answers with values, whatever each row carries beside its name");
  for (const status of ORDER) {
    assert.ok(ANSWERED.includes(status), `${status} is a rung this CLI writes and the tracker has no such member`);
  }
  assert.equal(ANSWERED.includes("released"), false, "and the name the tracker dropped is undeclared");
  assert.ok(ANSWERED.includes(RELEASING) && !ORDER.includes(RELEASING),
    "while the release path's own status is readable and no rung of the ladder");
});

/* Three facts in three files until ISS-1043, one column now: the row carrying nothing but a name is
   the fourth kind — readable, written by a park or a set, and no step of the flow. */
test("every declared name carries its kind where it is declared, and an undeclared name has none", () => {
  assert.deepEqual(DECLARES.forge_issues.status.map((one) => one.name), ANSWERED,
    "one row per name the tracker takes, and no row for a name it does not");
  assert.deepEqual(statusKind("tested"), { name: "tested", replacedBy: RUNG });
  assert.equal(statusKind("developed").step, true);
  assert.match(statusKind(RELEASING).writtenByNobody, /release batch alone leaves it/u);
  assert.deepEqual(statusKind("needs_info"), { name: "needs_info" },
    "a name that is no step and not retired carries nothing beside itself");
  assert.equal(statusKind("released"), null, "and a name off the table has no kind to read");
});

/* The column says which names are steps and `ORDER` in what order, so either edited alone fails
   here. Driven over a disagreeing sequence: an equality that cannot fail covers nothing. */
const stepNames = () => DECLARES.forge_issues.status.filter((one) => one.step).map((one) => one.name);
const disagreeing = (order) => {
  const steps = stepNames();
  return [...order.filter((one) => !steps.includes(one)), ...steps.filter((one) => !order.includes(one))];
};

test("the step column and ORDER name the same rungs, and either edited alone goes red", () => {
  assert.deepEqual(disagreeing(ORDER), [],
    "every name whose row carries step is a rung, and every rung's row carries step");
  assert.deepEqual(disagreeing([...ORDER, "testing"]), ["testing"],
    "a name joining the sequence whose row carries no step is named");
  assert.deepEqual(disagreeing(ORDER.filter((one) => one !== "clarified")), ["clarified"],
    "and so is a step row the sequence dropped");
});

/* A park record outlives the rename and names the status it left, so the way back is refused — and the refusal names the rung that took it over rather than a placeholder the reader fills. Not an alias: the deploying half was never earned (review F1). */
test("a park recorded from the retired rung is refused the way back, naming what replaced it", () => {
  const at = (minute, body) => ({ createdAt: `2026-09-08T10:0${minute}:00.000Z`, authorId: "agent", body });
  /* The park sits under the tracker's announcement of the move, which is what pairs the two. */
  const said = at(0, "⏸ **Waiting on a human decision** — moved from `tested`\n\nlook at it");
  const park = at(1, render("park", {
    kind: "release-decision", why: "the release waits on a person", evidence: ["43b811e"] }, "tested"));
  const view = viewFrom("the-uuid", { status: "waiting" }, [said, park]);
  assert.throws(() => targetOf(view, "ISS-96"), (error) => {
    assert.match(error.message, /names `tested` as the status it left/u);
    assert.match(error.message, /rung that took it over is `awaiting_release`/u);
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
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [SHIPPED],
  comments: {},
  answer: { forge_config: () => ({ config: state.config }) },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const transitions = () => state.calls.filter((one) =>
  one.name === "forge_issues" && one.args?.action === "transition");

/* Declaring the name is exactly what would otherwise let `--set` through, `declaredValue` being the
   only check a set passes, so the refusal is the verb's own and does not read the declaration
   (consult 8736c3, F1). The read is left working: a filter is not a write. */
test("no run writes the release path's own status, and the refusal says whose it is", async () => {
  const set = await ranAsync(FORGE,
    ["advance", "ISS-96", "--set", RELEASING, "--why", "the release is running"], tracker.env);
  assert.equal(set.status, 1, set.stdout);
  assert.match(set.stdout + set.stderr, /release path's own status/u);
  assert.match(set.stdout + set.stderr, /nothing was sent/u);
  assert.deepEqual(transitions(), [], "and no transition was requested for it");
  const to = await ranAsync(FORGE, ["advance", "ISS-96", "--to", RELEASING], tracker.env);
  assert.equal(to.status, 1, to.stdout);
  assert.match(to.stdout + to.stderr, /closed is next, not releasing/u,
    "the jump refusal names the status that is next, which is the clause it answers to");
  assert.deepEqual(transitions(), [], "neither route moved anything");
  const read = await ranAsync(FORGE, ["issue", "--status", RELEASING], tracker.env);
  assert.equal(read.status, 0, `${read.stdout}${read.stderr}`);
});

/* The hole the column closes: `tested` is declared for reading and no rung holds it, and
   `declaredValue` — membership in that list — was the only check the set passed (ISS-1043). */
test("a retired name is refused the set, and the refusal names the rung that took it over", async () => {
  const set = await ranAsync(FORGE,
    ["advance", "ISS-96", "--set", "tested", "--why", "the verdicts are all in"], tracker.env);
  const said = set.stdout + set.stderr;
  assert.equal(set.status, 1, set.stdout);
  assert.match(said, /`tested` is no step of the flow/u);
  assert.match(said, /`awaiting_release` is the rung that took it over/u);
  assert.match(said, /forge advance ISS-96 --set awaiting_release --why/u,
    "the replacement is a command to run, not a name to look up");
  assert.doesNotMatch(said, /-h\b/u, "and no caller is sent to a help text to find out what to do");
  assert.deepEqual(transitions(), [], "nothing was sent");
  const read = await ranAsync(FORGE, ["issue", "--status", "tested"], tracker.env);
  assert.equal(read.status, 0, `${read.stdout}${read.stderr}`);
});
