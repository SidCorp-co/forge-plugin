/* A flow says what a plan must declare, and the plan write is where that is read: at a rung it
   would make one persisted plan earn different statuses under two flows, which is the boundary
   docs/cli/the-flow-axis.md draws and plugin/test/flow/earned/flow-is-not-read.test.mjs holds from
   the other side. Planted flows here, because no shipped flow requires anything (ISS-1088). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("plan-requires").path;
const { requiresRefusal } = await import("../../../src/flow/record/fields.mjs");
const { FLOWS, FLOW_SLUGS, requiresOf } = await import("../../../src/guides/flow.mjs");
const { planFlags } = await import("../../../src/flow/machine.mjs");

const PLAN = (screen) => [
  "## Declarations",
  `- screen change: ${screen}`,
  "- schema coupling: no",
  "- deploy coupling: no",
  "- user-facing outcome: no",
].join("\n\n");

const said = (plan, requires) => requiresRefusal("erp-flow", planFlags(plan), requires);

test("a plan answering anything but yes to what its flow requires is refused, and told the line to write", () => {
  for (const [what, plan] of [["`no`", PLAN("no")], ["nothing", "## Declarations\n\n- schema coupling: no"]]) {
    const held = said(plan, ["screen"]);
    assert.ok(held, `a plan declaring ${what} under a flow that requires a screen change is taken`);
    assert.match(held, /^Flow erp-flow requires screen change of every plan/u, "the flow and the declaration are named");
    assert.match(held, /^ {2}screen change: yes$/mu, "and the line to write, in the plan's own words");
    assert.match(held, /so nothing\s+was written/u, "and that the field is untouched");
    assert.match(held, /run a flow that does not require it/u, "and the other way out, which is the flow itself");
  }
});

test("the same plan answering yes is taken, and a flow requiring nothing takes either", () => {
  assert.equal(said(PLAN("yes"), ["screen"]), null,
    "a plan that answers what the flow requires is refused, so the flow can never be satisfied");
  assert.equal(said(PLAN("no"), []), null, "a flow requiring nothing refuses a plan anyway");
  assert.equal(requiresRefusal(null, planFlags(PLAN("no")), ["screen"]), null,
    "a flow this copy cannot serve is refused where the key is read, not a second time at the plan");
});

/* The shipped half of the same rule: `screen` asks the project for a judge and asks a plan for
   nothing, so no plan written today meets this refusal — the decision is on ISS-1088. */
test("no flow this copy ships requires a declaration of a plan", () => {
  for (const flow of FLOW_SLUGS) {
    assert.deepEqual(requiresOf(flow), [], `${flow} requires a declaration, and no case here covers what that costs a run`);
    assert.equal(requiresRefusal(flow, planFlags(PLAN("no"))), null,
      `${flow} refuses a plan that declares no screen, which no shipped project expects`);
  }
  assert.ok(Object.hasOwn(FLOWS.screen, "judge"), "screen asks for nothing at all, so this file guards a dead list");
});
