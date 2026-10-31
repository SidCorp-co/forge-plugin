/* The ladder a run climbs is core's issue machine, read off a copy of its contract: 25 status moves
   in the Agenfold sessions of 2026-10-30/31 were refused ISSUE_STATUS_LEGACY because the flow still
   walked open → confirmed → approved → in_progress → developed → testing → awaiting_release →
   closed, and the runs gave up on `forge advance` for hand-written REST. Every case here names a
   legacy status or a move core does not hold, and goes red the moment one comes back. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("core-ladder").path;
const machine = JSON.parse(readFileSync(new URL("../../fixtures/dev-core/issue-machine.json", import.meta.url), "utf8"));
const issueMachine = await import("../../../src/tracker/declared/issue-machine.mjs").catch(() => ({}));
const earned = await import("../../../src/flow/earned.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");
const { declaredFor, statusKind } = await import("../../../src/tracker/rest.mjs");
const { Refused } = await import("../../../src/refusal.mjs");

const edge = (from, to) => machine.edges.some((one) => one.from === from && one.to === to && !one.recovery);

test("the statuses, the legacy names and the work steps are the contract's, every one", () => {
  assert.deepEqual(issueMachine.ISSUE_STATUSES, machine.statuses, "the ten statuses core holds");
  assert.deepEqual(Object.keys(issueMachine.LEGACY_STATUSES ?? {}).sort(), [...machine.legacy].sort(),
    "the names core refuses ISSUE_STATUS_LEGACY, each with the place that took it over");
  assert.deepEqual(issueMachine.WORK_STEPS, machine.workSteps, "and the steps a run's work state carries");
});

test("every place of the ladder is a status core holds, at a step core names, and never a legacy name", () => {
  const { LADDER } = earned;
  assert.ok(Array.isArray(LADDER) && LADDER.length > 1, "the flow exports its ladder of places");
  for (const place of LADDER) {
    assert.ok(!machine.legacy.includes(place), `${place} is a legacy status`);
    const status = issueMachine.statusOfPlace(place);
    const step = issueMachine.stepOfPlace(place);
    assert.ok(machine.statuses.includes(status), `${place} stands at ${status}, which core does not hold`);
    assert.ok([null, ...machine.workSteps].includes(step), `${place} names step ${step}`);
    assert.equal(issueMachine.placeOf(status, step), place, `${status} at ${step} reads back as ${place}`);
  }
  assert.ok(!LADDER.includes("closed"), "and the ladder stops short of closed: only a release closes");
});

test("every rung up the ladder that changes the status is an edge of core's machine", () => {
  const { LADDER } = earned;
  for (const [at, place] of LADDER.slice(0, -1).entries()) {
    const from = issueMachine.statusOfPlace(place);
    const to = issueMachine.statusOfPlace(LADDER[at + 1]);
    if (from === to) continue;
    assert.ok(edge(from, to), `${place} -> ${LADDER[at + 1]} is ${from} -> ${to}, which core does not hold`);
  }
});

test("no legacy status is a value this CLI writes, and each is refused naming the place that took it over", () => {
  const offered = declaredFor("forge_issues", "status");
  assert.deepEqual(offered.filter((one) => machine.legacy.includes(one)), [],
    "the declared status set offers no legacy name");
  for (const legacy of machine.legacy) {
    const took = statusKind(legacy)?.replacedBy;
    assert.ok(took, `${legacy} names nothing that took it over`);
    assert.ok(!machine.legacy.includes(took), `${legacy} is sent to ${took}, another legacy name`);
    assert.ok(machine.statuses.includes(issueMachine.statusOfPlace(took)), `${legacy} -> ${took}`);
  }
});

test("advance offers no closed: an issue at awaiting_release has nothing next, and the refusal names the release", () => {
  const view = earned.viewFrom("the-uuid", { status: "awaiting_release", mergedAt: "2026-10-31T00:00:00.000Z" }, []);
  let said = null;
  try {
    const held = targetOf(view, "ISS-3");
    said = `next is ${held.next}`;
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    said = error.message;
  }
  assert.doesNotMatch(said, /next is closed/u, "closed was offered as the next status");
  assert.match(said, /release/u, "and the refusal names the release that closes it");
  assert.match(said, /CLOSE_ONLY_BY_RELEASE/u);
});

test("every verb form moves to a place on the ladder, and none of them to closed", async () => {
  const { MOVES, ROUTES } = await import("../../../src/resolve/handler.mjs");
  for (const place of Object.keys(MOVES)) {
    assert.ok(earned.LADDER.includes(place), `the form ${MOVES[place]} moves to ${place}, which is no place on the ladder`);
  }
  assert.ok(!Object.keys(MOVES).includes("closed"), "a form closes an issue core closes only by its release");
  assert.match(ROUTES.close?.call ?? "", /release-batch record/u, "and `close` names the release's record instead");
});
