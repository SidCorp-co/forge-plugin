/* A flow may change what a plan is required to declare and never what a rung demands, so a project
   changing its flow may not reinterpret a plan already written. The declarations are parsed out of
   the issue's persisted plan text with no flow as an input, and this is the case that fails the day
   one is threaded through: one plan, one set of evidence, two flows, one verdict (ISS-902). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";
import { flowJudgeConflict, flowPolicyConflict } from "../../../src/flow/earned.mjs";
import { judgeOf } from "../../../src/guides/flow.mjs";

const SRC = new URL("../../../src/", import.meta.url).pathname;

/* One persisted plan, declaring a screen change and nothing else, and the criterion a verdict would
   answer. The entry check for `testing` is what charges for the screen's evidence. */
const PLAN = [
  "## Files touched", "one.mjs",
  "## Before", "it did not",
  "## After", "it does",
  "## Deliberately unchanged", "everything else",
  "## Verified in code", "one.mjs:1 is the line",
  "## Conventions reversed", "none",
  "## Declarations",
  "- screen change: yes",
  "- schema coupling: no",
  "- deploy coupling: no",
  "- user-facing outcome: no",
  "## Steps", "1. Do it. criteria: 1",
  "## The way back", "revert",
].join("\n\n");

const ISSUE = {
  description: "`forge issue` should take the `data.relations` route.",
  plan: PLAN,
  acceptanceCriteria: "1. The one check that fails without the change.",
};

/* A resolver answers once per process, so each flow is its own run: two in one would both read
   whichever was resolved first. The verdict is printed as JSON and compared, not eyeballed. */
const owed = (keys) => {
  const room = tempRoom("flow-entry-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "entry-fixture", ...keys }));
  const home = tempRoom("flow-entry-home-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"),
    JSON.stringify({ url: "https://nowhere.invalid/mcp", token: "a-throwaway-token" }));
  const code = `
    const { CHECKS, viewFrom } = await import(${JSON.stringify(join(SRC, "flow", "earned.mjs"))});
    const { planFlags, unwrap } = await import(${JSON.stringify(join(SRC, "flow", "machine.mjs"))});
    const { render } = await import(${JSON.stringify(join(SRC, "flow", "record", "page.mjs"))});
    const issue = ${JSON.stringify(ISSUE)};
    /* The verdict is what puts the screen's evidence in front of the check: without one, testing
       stops at the criterion nobody judged and the flags are never reached. */
    const comments = [{ createdAt: "2026-09-02T10:01:00.000Z", body: render("verdict", {
      criterion: "1. The one check that fails without the change.",
      verdict: "pass", commit: "43b811e", evidence: ["43b811e"],
    }) }];
    const view = viewFrom("the-uuid", issue, comments);
    const owed = Object.fromEntries(Object.entries(CHECKS)
      .map(([status, ask]) => [status, ask(view, "ISS-3").map((one) => one.what).sort()]));
    console.log(JSON.stringify({
      owed, flags: planFlags(unwrap(issue.plan)), names: Object.keys(planFlags("")),
    }));
  `;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    encoding: "utf8", cwd: room, env: { ...process.env, XDG_CONFIG_HOME: home },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

test("one persisted plan earns one entry-check verdict under two different flows", () => {
  const base = owed({ flow: "default" });
  assert.deepEqual(base.flags, { screen: "yes", schema: "no", deploy: "no", look: "no" },
    "the flags are parsed out of the plan text, and nothing else decides them");
  assert.deepEqual(base.names, ["screen", "schema", "deploy", "look"],
    "the declaration vocabulary is one table, and a flow may neither add a name nor take one out");
  const held = base.owed.testing;
  assert.ok(held.length > 0, `testing owes nothing under this plan: ${JSON.stringify(base.owed)}`);
  assert.ok(held.some((one) => /screen/u.test(one)),
    `the declared screen change is what testing charges for: ${JSON.stringify(held)}`);
  for (const keys of [{ flow: "screen" }, { flow: "erp-flow" }, { method: 1 }, {}]) {
    assert.deepEqual(owed(keys).owed, base.owed,
      `the same plan and the same evidence under ${JSON.stringify(keys)}`);
  }
});

const WAIVES = { staging: "develop", production: "main", autoProd: true, from: "the fixture" };
const WAITS = { staging: "main", production: "main", autoProd: false, from: "the fixture" };

/* The other half of the same boundary: what a flow may require is reported against the project's
   release policy rather than reconciled with it, because there is no precedence rule to introduce
   between a flow's demand and a project's own. Only `default` ships and it requires nothing, so the
   declaration is handed in — a case reading the shipped set alone would pass on no check at all. */
test("a flow requiring a look the release policy waives is a reported conflict, not a reconciliation", () => {
  const said = flowPolicyConflict("erp-flow", ["screen"], WAIVES);
  assert.match(said, /flow erp-flow requires a screen change of every plan/u);
  assert.match(said, /waives a person's look/u);
  assert.match(said, /change the flow, or the project's release policy/u, "and both sources are named");
  assert.equal(flowPolicyConflict("erp-flow", ["screen"], WAITS), null,
    "a policy that does wait for a person takes the look the flow asked for");
  assert.equal(flowPolicyConflict("erp-flow", ["deploy"], WAIVES), null,
    "and a declaration that asks for no look is no conflict with a policy that waives one");
  assert.equal(flowPolicyConflict("default", [], WAIVES), null, "which is the shipped flow's answer");
});

const JUDGED = { qa: "independent" };
const BUILT = { qa: "builder" };

/* The same shape for the other thing a flow may ask the project for. Who judges is one key, and a
   flow that decided it a second time would be a precedence rule with nothing to settle it, so the
   clash is reported against both sources and neither is rewritten (ISS-1088, 784e57 F2). */
test("a flow asking for a judgement the project's key does not name is a reported conflict", () => {
  const said = flowJudgeConflict("erp-flow", "independent", BUILT);
  assert.match(said, /flow erp-flow asks for independent judgement between developed and testing/u);
  assert.match(said, /this project's configuration says builder/u, "and the other source, in its own value");
  assert.match(said, /change the flow, or the project's qa configuration/u, "and both ways out");
  assert.match(flowJudgeConflict("erp-flow", "independent", {}), /says not stated/u,
    "a project that has answered nothing is a conflict too, and is told which answer is missing");
  assert.equal(flowJudgeConflict("erp-flow", "independent", JUDGED), null,
    "a project whose key already says independent is refused a conflict it does not have");
  assert.equal(flowJudgeConflict("default", judgeOf("default"), BUILT), null,
    "and a flow that asks for no judgement reads the project's key not at all");
  assert.equal(judgeOf("screen"), "independent",
    "the shipped flow that asks for one, which is what makes the check reachable");
});
