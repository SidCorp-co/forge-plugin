/* forge-dev core serves a project row with no `environments` key at all and keeps the environments in
   the project document (`GET /projects/:id/config`), so a guard reading the row alone took every
   project for one whose reading did not happen and refused every write, a claim included (FB-406).
   The two answers below are recorded off that core, values replaced. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

/* The guarded write that was refused in the field, against a tracker answering as forge-dev core does.
   A comment is author content, so it passes the credential seat — the one reader that reaches for the
   bindings — which finds them in the document the dev core keeps them in rather than on the row (FB-406).
   A claim does not reach the seat, the lease being unguarded; that is the case below. */
test("a guarded write reads the deploy from the document where the row carries no bindings", async () => {
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
    const notePath = join(tempHome("dev-document-note").path, "note.md");
    writeFileSync(notePath, "a plain note, no credential in it\n");
    const run = await ranAsync(forge, ["comment", "ISS-406", notePath], { ...env, FORGE_SESSION_ID: "dev-doc-run" }, away);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.doesNotMatch(run.stderr, /test credentials could not be read|carried no deploy bindings/u, run.stderr);
    assert.ok(state.calls.some((one) => one.name === "forge_config" && one.args.action === "document"),
      "the document was what answered for the bindings");
  } finally {
    tracker.close();
  }
});

/* The lease is the CLI's own session state and carries no deploy credential, so a claim write does not
   read the deploy to be allowed: a core serving the bindings neither on the row nor in the document — or
   a reading of them that did not answer — refused `forge claim` before it ever took the lease (FB-36). */
test("a claim takes the lease though the deploy reading did not answer, the lease write unguarded", async () => {
  const away = projectRoom(tempRoom("dev-document-unread-"), process.env.XDG_CONFIG_HOME, OWN);
  const issue = { documentId: "dev-unread-uuid", issueId: "ISS-407", status: "open", title: "t", description: "d", sessionContext: {} };
  const state = {
    calls: [],
    issues: [issue],
    /* The guard's two deploy readings, registered to refuse so that a lease write that reached the seat
       would both fail and trip this allowance — which proves the lease write never reaches it (FB-36). */
    unasked: ["forge_projects.read", "forge_config"],
    answer: {
      "forge_projects.read": () => ({ ...ROW, id: OWN.id, slug: OWN.slug }),
      forge_config: (args) => (args.action === "document"
        ? { refused: "Forge answered 503\nno available server" }
        : { config: {} }),
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
    let run = await ranAsync(forge, ["claim", "ISS-407"], { ...env, FORGE_SESSION_ID: "dev-unread-run" }, away);
    if (run.status !== 0) run = await ranAsync(forge, ["claim", "ISS-407"], { ...env, FORGE_SESSION_ID: "dev-unread-run" }, away);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.doesNotMatch(run.stderr, /could not be read|carried no deploy bindings|named no deploy targets/u, run.stderr);
    assert.ok(!state.calls.some((one) => one.name === "forge_config" && one.args.action === "document"),
      "the lease write never read the deploy to be allowed");
  } finally {
    tracker.close();
  }
});
