/* An issue whose stored record once took a test credential: every write re-sends that record, so the
   guard must tell the copy it re-sends from what the caller supplied, and there has to be a route
   that takes the copy off. Spawned, because the refusal and the line are what a developer reads
   (ISS-1380). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, projectRecord, ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;
const ISSUE = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "correct-horse-battery";
const USERNAME = "qa-admin";
const SESSION = "redact-run";

/* The shape sid-desk ISS-64 was met in: review feedback a run wrote in August, quoting the login. */
const sealed = () => ({
  reviewFeedback: ["the list renders", `signed in as ${USERNAME} with ${PASSWORD}, the form saved`, USERNAME],
  worklog: { branch: "iss-1" },
});

const held = { documentId: ISSUE, issueId: "ISS-1", status: "open", title: "one", sessionContext: sealed() };

const state = {
  issues: [held],
  comments: { [ISSUE]: [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [held], returned: 1, hasMore: false };
      if (args.action === "get") return structuredClone(held);
      if (args.action === "update") return Object.assign(held, structuredClone(args.data));
      if (args.action === "transition") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_config: () => ({ config: { baseBranch: "master", pipelineConfig: { autoProdDeploy: true } } }),
    "forge_projects.get": () => ({ project: { environments: {
      preview: { url: "https://beta.example.test" },
      testCredentials: [{ label: "Administrator", username: USERNAME, password: PASSWORD }],
    } } }),
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin" });
const env = { ...tracker.env, FORGE_SESSION_ID: SESSION };
const ask = (...argv) => ranAsync(FORGE, argv, env, ROOT);

const updates = () => (state.calls ?? []).filter((one) => one.name === "forge_issues" && one.args?.action === "update");
const created = () => (state.calls ?? []).filter((one) => one.name === "forge_comments" && one.args?.action === "create");
const fresh = (context = sealed()) => {
  held.sessionContext = context;
  held.status = "open";
  state.calls = [];
};
const note = (text) => {
  const path = join(tempHome("redact-note").path, "note.md");
  writeFileSync(path, text);
  return path;
};
const STORED_LINE = /^ISS-1: sessionContext\.reviewFeedback\.1 carries this project's test credentials · password as the tracker already stores it\. This write re-sent the stored copy unchanged and added nothing to it, so it went\./mu;

/* A comment is a finder's write and takes no lease, so it never re-sent the record: a record is the
   write whose renewal does, and the one sid-desk ISS-64 was refused on. */
test("a record on an issue whose stored record holds a credential is sent, the lease write included", async () => {
  fresh();
  const run = await ask("record", "decision", "ISS-1", "--none", "nothing ambiguous here");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(created().length, 1, "the record went up");
  assert.ok(updates().some((one) => JSON.stringify(one.args.data.sessionContext ?? {}).includes(PASSWORD)),
    "and the lease write that re-sent the stored copy went too");
  assert.match(run.stderr, STORED_LINE, "the copy is named as the tracker's stored one");
  assert.match(run.stderr, /The stored copy is taken off with:\n {2}forge issue ISS-1 --redact$/mu,
    "and the line carries the one command that takes it off");
  assert.doesNotMatch(run.stderr, /Take the value out/u, "no caller is told to remove what is not in their input");
});

test("a status move on such an issue is sent as well", async () => {
  fresh();
  const moved = await ask("advance", "ISS-1", "--set", "on_hold", "--why", "set down while the owner decides");
  assert.equal(moved.status, 0, moved.stderr);
  assert.equal(held.status, "on_hold", "the status moved");
  assert.ok(updates().some((one) => JSON.stringify(one.args.data.sessionContext ?? {}).includes(PASSWORD)),
    "through a renewal that re-sent the stored copy");
});

test("a credential the caller supplied on such an issue is refused, as it is anywhere", async () => {
  fresh();
  const run = await ask("comment", "ISS-1", note(`Signed in with ${PASSWORD} again.\n`));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's test credentials · password, at body/u);
  assert.match(run.stderr, /Take the value out and say where it is read instead:\n {2}forge doctor --credentials/u);
  assert.equal(created().length, 0, "nothing was posted");
});

test("--redact masks every credential in the stored sessionContext and leaves the rest as it was", async () => {
  fresh();
  const run = await ask("issue", "ISS-1", "--redact");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(held.sessionContext.reviewFeedback,
    ["the list renders", "signed in as qa-admin with [withheld], the form saved", "[withheld]"],
    "a short value is masked where the string is it and a long one wherever it sits: the guard's own edge");
  assert.deepEqual(held.sessionContext.worklog, { branch: "iss-1" }, "every other value stays");
  const stored = JSON.stringify(held.sessionContext);
  assert.ok(!stored.includes(PASSWORD) && !stored.includes(`"${USERNAME}"`), "a read back finds no credential the guard refuses");
  assert.match(run.stdout, /^ISS-1 {2}sessionContext\.reviewFeedback\.1 redacted: it carried this project's test credentials · password$/mu);
  assert.match(run.stdout, /^ISS-1 {2}sessionContext\.reviewFeedback\.2 redacted: it carried this project's test credentials · username$/mu);
  assert.match(run.stdout, /An earlier copy the tracker may keep is out of this CLI's reach, and a copy in a comment or in the description is not rewritten by this flag\./u);
  const [correction] = created();
  assert.ok(correction, "a correction went up");
  assert.match(correction.args.data.body,
    /moved: sessionContext\.reviewFeedback\.1, sessionContext\.reviewFeedback\.2 redacted to `\[withheld\]` by `forge issue --redact`/u);
  assert.doesNotMatch(correction.args.data.body, new RegExp(PASSWORD, "u"));
});

test("--redact on a stored record carrying no credential writes nothing and says so", async () => {
  fresh({ reviewFeedback: ["the list renders"] });
  const run = await ask("issue", "ISS-1", "--redact");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-1's sessionContext carries none of this project's test credentials, so nothing was written\.$/mu);
  assert.equal(updates().length, 0);
  assert.equal(created().length, 0);
});

test("--redact is refused while another run's live lease holds the issue, and writes nothing", async () => {
  fresh({ ...sealed(), lease: { holder: "another-run", agent: "claude", renewedAt: new Date().toISOString(), minutes: 60 } });
  const run = await ask("issue", "ISS-1", "--redact");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /another-run/u, "the refusal names the lease");
  assert.equal(updates().length, 0);
  assert.ok(JSON.stringify(held.sessionContext).includes(PASSWORD), "the field is as it was");
});

test("doctor --credentials names where the credentials are stored and the route off an issue", async () => {
  const run = await ask("doctor", "project", "--credentials");
  assert.match(run.stdout, /test credentials\s+below, printed once {2}← the tracker's project detail/u, run.stdout);
  assert.match(run.stdout, /copied onto an issue\s+a copy an issue's stored sessionContext carries is taken off with forge issue <ref> --redact/u);
});
