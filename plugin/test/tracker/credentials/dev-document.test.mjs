/* forge-dev core serves a project row with no `environments` key at all and keeps the environments in
   the project document (`GET /projects/:id/config`), so a guard reading the row alone took every
   project for one whose reading did not happen and refused every write, a claim included (FB-406).
   The two answers below are recorded off that core, values replaced. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("dev-document").path;
const { documentDeploy } = await import("../../../src/tracker/project-config.mjs");

const recorded = (name) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/dev-core/${name}.json`, import.meta.url), "utf8")).rest;
const ROW = recorded("projects-get");
const DOCUMENT = recorded("config-document");

const withStaging = () => {
  const held = structuredClone(DOCUMENT);
  held.document.environments.staging = {
    tier: "staging", deploysFrom: "staging", deployment: { mode: "external" }, testing: "qa",
    url: "https://staging.example.test", services: { api: "https://api.staging.example.test" },
  };
  return held;
};

test("the recorded row carries no environments key, which is the shape the guard has to read past", () => {
  assert.equal(Object.hasOwn(ROW, "environments"), false);
  assert.equal(typeof DOCUMENT.document.environments, "object");
});

test("a document's environments are the deploy: hosts printed, production left out, nothing withheld", () => {
  const recordedDeploy = documentDeploy(DOCUMENT);
  assert.equal(recordedDeploy.refused, undefined, "a document that answered is a reading that happened");
  assert.deepEqual(recordedDeploy.withheld, [], "a tier, a branch, a binding id and a profile name are no credential");
  assert.equal(recordedDeploy.urls.some((one) => /url\.example\.test|api\.example\.test/u.test(one.url)), false,
    "the production environment is not the staging deploy");
  const staged = documentDeploy(withStaging());
  assert.deepEqual(staged.urls.map((one) => one.url).sort(),
    ["https://api.staging.example.test", "https://staging.example.test"]);
  assert.deepEqual(staged.withheld, []);
});

test("an undeclared document is a project with no deploy, and a declared one without environments is unread", () => {
  assert.equal(documentDeploy({ declared: false, document: null }).refused, undefined);
  assert.match(documentDeploy({ declared: true, revision: 1, document: {} }).refused, /named no deploy targets/u);
  assert.equal(documentDeploy({ refused: "Forge answered 503" }).refused, "Forge answered 503");
});

/* The write that was refused in the field, against a tracker answering as forge-dev core does. */
test("a claim on a project whose row carries no bindings goes through, the document read in their place", async () => {
  const away = projectRoom(tempRoom("dev-document-away-"), process.env.XDG_CONFIG_HOME, OWN);
  const issue = { documentId: "dev-doc-uuid", issueId: "ISS-406", status: "open", title: "t", description: "d", sessionContext: {} };
  const state = {
    calls: [],
    issues: [issue],
    answer: {
      "forge_projects.read": () => ({ ...ROW, id: OWN.id, slug: OWN.slug }),
      forge_config: (args) => (args.action === "document" ? DOCUMENT : { config: {} }),
      forge_issues: (args) => {
        if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
        if (args.action === "update") Object.assign(issue, args.data);
        return issue;
      },
      forge_comments: (args) => (args.action === "list" ? { comments: [], returned: 0, hasMore: false } : { documentId: "c" }),
    },
  };
  const { tracker, env } = await trackerFor(state, [away]);
  try {
    const forge = new URL("../../../bin/forge", import.meta.url).pathname;
    let run = await ranAsync(forge, ["claim", "ISS-406"], { ...env, FORGE_SESSION_ID: "dev-doc-run" }, away);
    if (run.status !== 0) run = await ranAsync(forge, ["claim", "ISS-406"], { ...env, FORGE_SESSION_ID: "dev-doc-run" }, away);
    assert.doesNotMatch(run.stderr, /test credentials could not be read|carried no deploy bindings/u, run.stderr);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.ok(state.calls.some((one) => one.name === "forge_config" && one.args.action === "document"),
      "the document was what answered for the bindings");
  } finally {
    tracker.close();
  }
});
