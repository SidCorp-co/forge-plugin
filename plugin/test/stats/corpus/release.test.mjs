/* What Phase 7 asks a project for, and which answer puts a row in the class table. */
import assert from "node:assert/strict";
import test from "node:test";

import { ACTS, NO_ENDPOINT, phase7From } from "../../../src/stats/corpus/release.mjs";
import { DEPLOY, classOf, classesFor } from "../../../src/stats/corpus/classes.mjs";
import { releaseFrom, unreadFrom } from "../../../src/tracker/project-config.mjs";

const policy = (releaseModel, autoProdDeploy) =>
  releaseFrom({ baseBranch: "master", releaseModel, pipelineConfig: { autoProdDeploy } });

const READ = "coolify deployment get --uuid abc";

test("the phase-7 act is the release model's answer, one case per model", () => {
  for (const [key, arms, model, autoProd, why] of [
    ["promotion", false, "promote", true, "the release is a promotion the run commands"],
    ["promotion", false, "promote", false, "and a promotion nobody automated is still that command"],
    ["binding", false, "publish", false, "an act on the live deploy binding is a person's"],
    ["deploy", true, "publish", true, "a publication nobody commands is the act with no command"],
    ["deploy", true, "none", true, "and so is a landing whose production deploys off it"],
    ["none", false, "none", false, "while a project that ships nothing has no act here at all"],
  ]) {
    const act = phase7From(policy(model, autoProd));
    assert.deepEqual({ key: act.key, deploy: act.deploy }, { key, deploy: arms },
      `${model} with production ${autoProd ? "automatic" : "a person's"}: ${why}`);
    assert.equal(classesFor(null, act).some(([label]) => label === DEPLOY), arms,
      "the row is in the table on exactly the answer that says nobody commands the release");
  }
});

test("a model this CLI does not know, and a config that did not read, arm nothing and name which", () => {
  const unknown = phase7From(policy("cut-over", true));
  assert.deepEqual({ key: unknown.key, deploy: unknown.deploy }, { key: "undeclared", deploy: false },
    "a fourth word is no declaration rather than a fourth behaviour");
  assert.match(unknown.said, /cut-over/u, "and the word itself is what a reader is owed");
  const unread = phase7From(unreadFrom("the endpoint refused"));
  assert.deepEqual({ key: unread.key, deploy: unread.deploy }, { key: "undeclared", deploy: false });
  assert.equal(phase7From(null).key, "undeclared", "as is a checkout that names no project");
  for (const one of [unknown, unread, phase7From(null)]) {
    assert.ok(ACTS[one.key], "every answer has a line the reading prints for it");
    assert.equal(classOf("Bash", READ, classesFor(null, one)), "shell",
      "and an unarmed table leaves the deploy act where it fell before");
  }
});

test("silence is stated rather than left as an empty row", () => {
  const ships = phase7From(policy("none", false));
  assert.equal(ships.deploy, false, "nothing deploys, so there is no act to count");
  assert.match(ACTS[ships.key], /no release step at all/u,
    "and the reading says which, a zero row reading exactly like a project whose deploys went uncounted");
  assert.equal(NO_ENDPOINT.length > 0, true, "the credential's own answer is a named one too");
});
