/* The tracker's work-evidence refusal names two fields a branch may be recorded in, one of which no
   verb here writes, and the merged mark's commit, and never the command that records any of them;
   the transport adds both commands, so a run refused a status move or a merged mark is sent to the
   capture rather than to a field `forge issue --set` refuses (ISS-2775), and a run whose change
   landed on the base branch itself to the mark that carries its commit (ISS-1488). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, neutralRoom, projectRecord, ranAsync } from "../../fixtures.mjs";
import { callTool } from "../../../src/tracker/rest.mjs";
import { mergedForm } from "../../../src/flow/record/merged.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const ROOT = neutralRoom();
const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const tracker = await fakeTracker({ issues: [], comments: {}, calls: [] });
test.after(() => tracker.close());
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, OWN);

/* The deployed tracker's own sentence, as its transition and merge routes answer it. */
const SENTENCE = "no branch, commit or code handoff is recorded for this issue — record the branch in "
  + "sessionContext.branch or sessionContext.worklog.branch, or write the implementation step "
  + "handoff with commitSha/filesModified, before advancing.";
const CAPTURE = /`forge claim u-7 --pushed`: it writes sessionContext\.worklog\.branch/u;
const MARK = `Where the change landed on the base branch itself, mark it merged at the commit it landed at, `
  + `which the tracker checks against the project's repository:\n  ${mergedForm("u-7")}\n`;
const OPENS_WITH = /^forge record merged u-7 --at <[^>]+> --reviewed <[^>]+> --judged <[^>]+> --wrote <[^>]+>$/u;

const answering = async ([status, body], call) => {
  const held = globalThis.fetch;
  globalThis.fetch = async () =>
    ({ ok: status < 400, status, headers: new Map(), text: async () => JSON.stringify(body) });
  try {
    return await call();
  } finally {
    globalThis.fetch = held;
  }
};

test("a status move refused for want of work evidence names the capture of the issue it was sent for", async () => {
  const answer = await answering(
    [409, { code: "NO_WORK_EVIDENCE", message: SENTENCE, details: { issueId: "u-7", toStatus: "developed" } }],
    () => callTool("forge_issues", { action: "transition", documentId: "u-7", data: { status: "developed" } }, true));
  assert.match(answer.refused, CAPTURE, answer.refused);
  assert.ok(answer.refused.startsWith(`NO_WORK_EVIDENCE: ${SENTENCE}\n`),
    `the tracker's own sentence, whole and under its code, ahead of the command: ${answer.refused}`);
});

test("the same refusal names the whole merged mark of that issue, for a change that landed on the base branch itself", async () => {
  const answer = await answering(
    [409, { code: "NO_WORK_EVIDENCE", message: SENTENCE, details: { issueId: "u-7", toStatus: "developed" } }],
    () => callTool("forge_issues", { action: "transition", documentId: "u-7", data: { status: "developed" } }, true));
  assert.ok(answer.refused.includes(MARK), answer.refused);
  assert.match(mergedForm("u-7"), OPENS_WITH, "the form carries --at and every flag the verb requires");
  assert.ok(answer.refused.indexOf(MARK) > answer.refused.indexOf(SENTENCE), "the route comes after the tracker's sentence");
});

test("the merged mark refused the same way names the same capture", async () => {
  const answer = await answering([422, { code: "NO_WORK_EVIDENCE", message: SENTENCE }],
    () => callTool("forge_issues", { action: "mark_merged", data: { issueId: "u-7", target: "base" } }, true));
  assert.match(answer.refused, CAPTURE, answer.refused);
  assert.ok(answer.refused.includes(MARK), answer.refused);
  assert.ok(answer.refused.startsWith(`NO_WORK_EVIDENCE: ${SENTENCE}\n`), answer.refused);
});

test("a refusal carrying another code names no capture", async () => {
  const answer = await answering([422, { code: "ENTRY_CRITERIA_UNMET", message: "`developed` requires a record" }],
    () => callTool("forge_issues", { action: "transition", documentId: "u-7", data: { status: "developed" } }, true));
  assert.equal(answer.refused, "ENTRY_CRITERIA_UNMET: `developed` requires a record");
});

test("the --set row of the verb's help names the tracker's check that still applies and both records that meet it", async () => {
  const run = await ranAsync(FORGE, ["advance", "-h"], tracker.env, ROOT, null);
  assert.equal(run.status, 0, run.stderr);
  const row = run.stdout.slice(run.stdout.indexOf("  --set "), run.stdout.indexOf("\n\n", run.stdout.indexOf("  --set ")));
  assert.match(row.replace(/\s+/gu, " "),
    /work-evidence check still holds developed and testing to a captured branch, which `forge claim <ref> --pushed` writes, or to a merged mark carrying the commit a change landed at on the base branch itself, which `forge record merged` sends/u,
    row);
});
