/* The project's release policy is the tracker's to answer, and the report names it in the words its
   owner uses: the staging branch, never the field's own name (ISS-90). Which values there are to
   name is the release model's, so the rows move with it (ISS-1888). */
import assert from "node:assert/strict";
import test from "node:test";

import { releaseReport } from "./fixture.mjs";

test("the three release values are reported with where they came from", async () => {
  const out = await releaseReport({
    baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ {2}ok {2}\] release model\s+publish — the release is an act on a live deploy binding, and no branch moves {2}← the tracker's project config/u);
  assert.match(out, /\[ {2}ok {2}\] staging branch\s+master {2}← the tracker's project config/u);
  assert.match(out, /\[ {2}ok {2}\] production deploy\s+automatic — a user-facing change ships without a person's look/u);
  assert.match(out, /production deploy.*← the tracker's project config, this project's own `release` key being unset/u,
    "the level that answered is named beside the answer, together with the local key that is unset");
  assert.doesNotMatch(out, /baseBranch/u, "and the tracker's own field name is not what a reader is shown");
  assert.doesNotMatch(out, /releaseModel/u);
  assert.doesNotMatch(out, /live branch/u, "nor is a branch the declared model does not have");
});

/* An automatic production deploy beside a policy nothing could read is the incoherence the schema
   warns of, and the report says which half is missing rather than that something is. */
test("an automatic production deploy with no release model declared is a finding", async () => {
  const out = await releaseReport({
    baseBranch: null, pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ note \] staging branch\s+unset on the project/u,
    "the blank itself belongs to the tracker's project config and is a note");
  assert.match(out, /\[ miss \] release policy\s+production deploys are automatic and .*no release model/u);
  assert.match(out, /a person's look is owed until that is declared/u);
  assert.match(out, /production deploy\s+automatic — a user-facing change waits for a person's look/u,
    "the strict reading is what the report says too");
});

/* The other unreadable half: a model that promotes and no branch to promote to. */
test("a promoting model with no branch to promote to is the same finding, named at the branch", async () => {
  const out = await releaseReport({
    baseBranch: "master", releaseModel: "promote", pipelineConfig: { autoProdDeploy: true },
  });
  assert.match(out, /\[ note \] live branch\s+unset on the project/u);
  assert.match(out, /\[ miss \] release policy\s+production deploys are automatic and the live branch is unset under a model that promotes to it/u);
});

/* The deploy the flow walks a change against is the other half of the same answer: a branch with no
   host behind it means the verification `released` owes cites the branch alone (ISS-92). */
test("a staging branch with no deploy behind it is a note, not a failure", async () => {
  const out = await releaseReport({
    baseBranch: "staging", releaseModel: "promote", liveBranch: "master", pipelineConfig: { autoProdDeploy: false },
  });
  assert.match(out, /\[ note \] staging deploy\s+none on record while/u);
  /* Not a verb of this CLI: no declared route writes the deploy, so the note names the screen. */
  assert.match(out, /A host is added on the tracker's own project settings screen/u,
    "and names where the value is set");
});

test("a deploy on record is reported by count, and its credential is not printed", async () => {
  const out = await releaseReport(
    { baseBranch: "staging", releaseModel: "promote", liveBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    { preview: { url: "https://beta.example.test" }, testCredentials: [{ password: "correct-horse-battery" }] },
  );
  assert.match(out, /\[ {2}ok {2}\] staging deploy\s+1 host\(s\) {2}← the tracker's project detail/u);
  assert.match(out, /\[ {2}ok {2}\] test credentials\s+present, forge doctor/u,
    "the report says where the value is read, never the value");
  assert.doesNotMatch(out, /correct-horse-battery/u);
  assert.doesNotMatch(out, /environments/u, "and the tracker's own field name is not what a reader is shown");
});
