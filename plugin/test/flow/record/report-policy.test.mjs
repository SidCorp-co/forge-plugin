/* AC-05-7-13: the release policy's line on the report, on every status and not the closing rung's
   alone. Where the policy owes nobody, the line carries the doctor's own row details, taken from
   `projectRows` here rather than copied, so a wording that drifts on either side goes red; where
   somebody is owed, the act is named on that line and the closing rung's line points at it
   (ISS-1656). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("report-policy-");
const { personOwedForRelease, projectRows, releaseAnswer, releaseFrom } =
  await import("../../../src/tracker/project-config.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const standing = (status, number) => ({
  documentId: `${status}-uuid`,
  issueId: `ISS-${number}`,
  status,
  title: `an issue standing at ${status}`,
  description: "no mark here",
  acceptanceCriteria: "1. The first outcome.",
});
const ISSUES = [standing("in_progress", 3), standing("awaiting_release", 4), standing("closed", 5)];
const NO_RELEASE_STEP = { baseBranch: "master", releaseModel: "none", pipelineConfig: { autoProdDeploy: true } };
const PUBLISHES_ITSELF = { ...NO_RELEASE_STEP, releaseModel: "publish" };
const OWES_A_PERSON = { ...PUBLISHES_ITSELF, pipelineConfig: { autoProdDeploy: false } };
const project = {
  calls: [],
  config: NO_RELEASE_STEP,
  unread: false,
  issues: ISSUES,
  comments: Object.fromEntries(ISSUES.map((one) => [one.documentId, []])),
  answer: {
    forge_config: () => (project.unread
      ? { refused: "Error: the tracker would not answer for this project" }
      : { config: project.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: project.issues.length, hasMore: false };
      return project.issues.find((one) => one.documentId === args.documentId) ?? {};
    },
  },
};
const { tracker, env: ENV } = await trackerFor(project);
test.after(() => tracker.close());

const reported = async (key) => {
  const run = await ranAsync(FORGE, ["resume", key, "--report"], ENV);
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};
const policyLines = (out) => out.split("\n").filter((one) => one.startsWith("Release policy  "));
const policyLine = async (key) => {
  const out = await reported(key);
  const lines = policyLines(out);
  assert.equal(lines.length, 1, `one policy line on ${key}:\n${out}`);
  return lines[0];
};
/* The detail `forge doctor` prints for one row of the same configuration. */
const rowOf = (config, label) => projectRows({ policy: releaseFrom(config), deploy: null,
  landing: { value: null, from: null } }).find((one) => one.label === label).detail;

test("the report names the policy it read wherever the issue stands", async () => {
  project.config = NO_RELEASE_STEP;
  for (const key of ["ISS-3", "ISS-4", "ISS-5"]) {
    const line = await policyLine(key);
    assert.ok(line.includes(`release model  ${rowOf(NO_RELEASE_STEP, "release model")}`), line);
    assert.match(line, /nobody owes this release an act/u, line);
    assert.doesNotMatch(line, /production deploy/u, "the model alone decides where it has no release step");
  }
});

test("a policy owing nobody because production deploys itself names both rows it read", async () => {
  project.config = PUBLISHES_ITSELF;
  const line = await policyLine("ISS-3");
  assert.ok(line.includes(`release model  ${rowOf(PUBLISHES_ITSELF, "release model")}`), line);
  assert.ok(line.includes(`production deploy  ${rowOf(PUBLISHES_ITSELF, "production deploy")}`), line);
  assert.match(line, /nobody owes this release an act/u, line);
});

test("a policy that could not be read, names no project or declares an unknown model says which", async () => {
  project.config = { ...PUBLISHES_ITSELF, releaseModel: "hand-carried" };
  const unknown = await policyLine("ISS-3");
  assert.match(unknown, /declares the release model `hand-carried`, which this CLI does not know/u, unknown);
  project.unread = true;
  const unread = await policyLine("ISS-3").finally(() => { project.unread = false; });
  assert.match(unread, /the project config could not be read, .*the tracker would not answer/u, unread);
  const nameless = releaseAnswer(null);
  assert.match(nameless, /^this checkout names no project/u, nameless);
  assert.equal(new Set([unknown, unread, nameless]).size, 3, "two unread states answered alike");
  for (const one of [unknown, unread, nameless]) {
    assert.doesNotMatch(one, /nobody owes|release model {2}/u, `a declaration named where none was read: ${one}`);
  }
});

test("where the policy owes a person, the act is named once and on the policy's own line", async () => {
  project.config = OWES_A_PERSON;
  const act = personOwedForRelease(releaseFrom(OWES_A_PERSON));
  for (const key of ["ISS-3", "ISS-4"]) {
    const out = await reported(key);
    assert.equal(out.split(act).length - 1, 1, `the act named other than once on ${key}:\n${out}`);
    assert.ok(policyLines(out)[0].includes(act), out);
  }
  const closing = await reported("ISS-4");
  assert.match(closing, /^Owed: the release, which is a person's\. The line above says whose act it is/mu, closing);
  assert.match(closing, /^ {2}forge advance ISS-4 --set closed --why "<[^"]+>"$/mu, closing);
});
