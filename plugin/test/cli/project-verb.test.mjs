/* The verb an agent asks before it plans a live walk, and the two seats that keep what it answers
   off the tracker. Spawned rather than called, because the answer is what a developer reads and the
   refusal has to arrive before the call goes out (ISS-92). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ISSUE = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "correct-horse-battery";

const deploy = {
  stagingUrl: "https://beta.example.test",
  testingUrls: [{ label: "shop", url: "https://shop.example.test" }],
  testCredentials: [{ username: "qa@example.test", password: PASSWORD }],
  notes: "A test account reaches the storefront only.",
};

const held = { documentId: ISSUE, issueId: "ISS-1", status: "in_progress", title: "one" };

const state = {
  issues: [held],
  comments: { [ISSUE]: [] },
  answer: {
    /* The lease is the write's own gate, so the fixture keeps what the claim puts on the issue. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [held], returned: 1, hasMore: false };
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_config: () => ({
      config: { baseBranch: "staging", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
    }),
    "forge_projects.get": () => ({ project: { previewDeploy: state.deploy } }),
  },
  deploy,
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const ask = (...argv) => ranAsync(FORGE, argv, tracker.env);
await ask("claim", "ISS-1");

test("the verb answers where a change lands and what it can be walked against", async () => {
  const run = await ask("project");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^project id: [0-9a-f-]{36} {2}← the slug in \.forge\.json$/mu);
  assert.match(run.stdout, /^staging branch: staging {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^production branch: master {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^production deploys on its own: no {2}← the tracker's project config$/mu);
  assert.match(run.stdout, /^staging deploy {2}← the tracker's project detail$/mu);
  assert.match(run.stdout, /^ {2}staging url: https:\/\/beta\.example\.test$/mu);
  assert.match(run.stdout, /^ {2}testing urls: https:\/\/shop\.example\.test$/mu);
  assert.match(run.stdout, /^ {2}notes: A test account reaches the storefront only\.$/mu);
});

test("the credential is named and not printed until the flag asks for it", async () => {
  const held = await ask("project");
  assert.match(held.stdout, /^ {2}test credentials: present, forge project --credentials$/mu);
  assert.doesNotMatch(held.stdout, new RegExp(PASSWORD, "u"));
  const asked = await ask("project", "--credentials");
  assert.equal(asked.status, 0, asked.stderr);
  assert.match(asked.stdout, new RegExp(`^ {2}test credentials · password: ${PASSWORD}$`, "mu"));
});

test("the tracker's own field names reach no reader of this verb", async () => {
  const run = await ask("project", "--credentials");
  assert.doesNotMatch(`${run.stdout}${run.stderr}`, /baseBranch|previewDeploy/u);
});

test("a comment carrying the credential is refused, and the refusal names the field", async () => {
  const room = tempHome("project-verb");
  const body = join(room.path, "note.md");
  writeFileSync(body, `Signed in with ${PASSWORD} and the screen rendered.\n`);
  const run = await ask("comment", "ISS-1", body);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at body/u);
  assert.match(run.stderr, /forge project --credentials/u);
  assert.doesNotMatch(run.stdout, /comment-uuid/u, "and nothing was posted");
  assert.equal(state.calls.filter((one) => one.args?.action === "create").length, 0);
});

test("a file carrying the credential is refused before the upload slot is minted", async () => {
  const room = tempHome("project-upload");
  const shot = join(room.path, "walk.txt");
  writeFileSync(shot, `the walk, signed in with ${PASSWORD}\n`);
  const run = await ask("attach", "issue", "ISS-1", shot);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^walk\.txt carries this project's test credentials · password\. A test/mu,
    "a file is one value, so the refusal names no field of a payload it does not have");
  assert.equal(state.calls.filter((one) => one.name === "forge_uploads").length, 0,
    "there is no delete for an upload, so a refused file leaves no document behind");
});

test("a payload holding no credential is sent, and a project holding none refuses nothing", async () => {
  const room = tempHome("project-clean");
  const body = join(room.path, "clean.md");
  writeFileSync(body, "The screen rendered and nothing secret is quoted.\n");
  const sent = await ask("comment", "ISS-1", body);
  assert.equal(sent.status, 0, sent.stderr);
  state.deploy = { stagingUrl: "https://beta.example.test", testCredentials: [] };
  const secret = join(room.path, "secret.md");
  writeFileSync(secret, `Signed in with ${PASSWORD}.\n`);
  const through = await ask("comment", "ISS-1", secret);
  assert.equal(through.status, 0, through.stderr);
  state.deploy = deploy;
});
