/* Under an independent judgement every verdict is read against a landing checkpoint naming the run
   that built the change, and the entry check that finds one missing runs after the merge has closed
   the window a capture is taken in. The line below says it to the builder while it can still write
   one (ISS-1798). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("checkpoint-ahead").path;
await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { checkpointAhead } = await import("../../../src/flow/route.mjs");
const { REBUILT_FORM } = await import("../../../src/flow/landing/reconstruction.mjs");
const { releaseFrom } = await import("../../../src/tracker/project-config.mjs");

const MERGED = "c8c35500000000000000000000000000000000ab";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const released = (qa) => releaseFrom({
  baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false, qa },
});
const JUDGED_APART = released("independent");
const BUILDER_JUDGES = released("builder");
const READY = {
  state: "ready", builder: "the-builder", branch: "iss-8", head: "a".repeat(40), base: "b".repeat(40),
  files: ["one.mjs"], at: "2026-09-07T12:00:00.000Z",
};
const MARK = { createdAt: "2026-09-07T13:00:00.000Z", authorId: "agent",
  body: `mark_merged target=base — merged to master at ${MERGED}` };

const ahead = ({ status = "in_progress", release = JUDGED_APART, landing = null, comments = [], issue = {} } = {}) =>
  checkpointAhead(viewFrom("the-uuid", {
    status, plan: PLAN, acceptanceCriteria: "1. The one outcome.",
    sessionContext: landing ? { landing } : {}, ...issue,
  }, comments, null, release), "ISS-8");

test("before the merge, the builder is told to capture the checkpoint and then to say the landing is over", () => {
  for (const status of ["in_progress", "developed"]) {
    const said = ahead({ status });
    assert.match(said ?? "", /^Ahead: testing is earned here by an independent judge's verdicts/u, `${status}: ${said}`);
    assert.match(said, /ISS-8 has no landing checkpoint naming a builder/u, "the missing half is named in builderProblem's words");
    assert.ok(said.endsWith("\n  forge claim ISS-8 --pushed --ready\n  forge claim ISS-8 --landed"),
      `the two commands, capture first, close the line at ${status}:\n${said}`);
  }
});

test("once the merged mark stands, the line names the late write at the merged sha, in both of its forms", () => {
  const said = ahead({ status: "developed", comments: [MARK] });
  assert.match(said ?? "", /has landed at c8c3550/u, said);
  const both = REBUILT_FORM("ISS-8", "c8c3550").split("\n").map((line) => `  ${line}`).join("\n");
  assert.ok(said.endsWith(both), `both deployment forms, indented:\n${said}`);
  assert.match(said, /--rebuilt c8c3550 --deployment </u);
  assert.match(said, /--rebuilt c8c3550 --undeployed/u);
  assert.doesNotMatch(said, /--pushed --ready/u, "and not the capture, whose window the merge closed");
});

test("the line is silent on every reading that owes the builder nothing", () => {
  assert.equal(ahead({ release: BUILDER_JUDGES }), null, "the builder is this project's judge");
  assert.equal(ahead({ release: null }), null, "a policy nobody read declares no independent judge");
  assert.equal(ahead({ landing: READY }), null, "a ready capture names the builder, which is what ship ready leaves");
  assert.equal(ahead({ status: "developed", landing: { ...READY, state: "done" } }), null, "a finished landing names it too");
  assert.equal(ahead({ issue: { landingShape: "outside_git" } }), null, "a landing outside git writes no checkpoint");
  for (const status of ["approved", "testing", "awaiting_release", "closed", "reopen"]) {
    assert.equal(ahead({ status }), null, `${status} is not where the builder can still write it`);
  }
});
