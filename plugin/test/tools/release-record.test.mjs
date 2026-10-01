/* `forge release-batch` past status and clear: the reads a release is decided by, the writes that put
   one on the record, and what a refusal of one says. Spawned against a fakeTracker, every case reading
   the method, path and body its HTTP server received rather than what the verb meant to send
   (ISS-1992). */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../fixtures.mjs";
import { OWN } from "../fixtures/own-keys.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const RUN_ID = "cccccccc-0000-4000-8000-000000000003";
const ONE = "dddddddd-0000-4000-8000-000000000001";
const TWO = "eeeeeeee-0000-4000-8000-000000000002";
const SHA = "0ad77c2a5f00000000000000000000000000beef";
const ACCOUNT = "deployed by hand through the live Coolify binding, the batch being refused";

const state = {
  issues: [
    { documentId: ONE, issueId: "ISS-1", title: "one", status: "awaiting_release" },
    { documentId: TWO, issueId: "ISS-2", title: "two", status: "awaiting_release" },
  ],
  release: {},
  answer: {
    forge_release_batch: (args) => {
      const held = state.release[args.action];
      if (held === undefined) throw new Error(`release double asked for an action it does not know: ${args.action}`);
      return typeof held === "function" ? held(args) : held;
    },
  },
};

const tracker = await fakeTracker(state);
after(() => tracker.close());
const room = projectRoom(tempRoom("release-record-cwd-"), tracker.env.XDG_CONFIG_HOME, { slug: OWN.slug });

const ran = async (...argv) => {
  state.calls = [];
  const answer = await ranAsync(FORGE, ["release-batch", ...argv], tracker.env, room);
  const calls = (state.calls ?? []).map((one) => ({
    route: `${one.method} ${String(one.path).replace(/\/projects\/[^/]+\//u, "/projects/:id/")}`,
    args: one.args,
  }));
  const released = calls.filter((one) => /release-(batches|records|readiness)/u.test(one.route));
  return { ...answer, calls, released, routes: released.map((one) => one.route) };
};

const blocker = (code, message) => ({ code, message, httpStatus: 409, evaluated: true });

test("1. readiness prints each reason the tracker gives, by its code and the tracker's own sentence", async () => {
  state.release.readiness = { hasReleaseGate: true, releaseModel: "promote", warnings: [],
    blockers: [blocker("RELEASE_POOL_EMPTY", "No runner carries the release label."),
      blocker("RELEASE_RECORD_MISSING", "ISS-1 has no release note.")] };
  const run = await ran("readiness");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /blocked\s+2 reason\(s\)/u);
  assert.match(run.stdout, /^ {2}RELEASE_POOL_EMPTY: No runner carries the release label\.$/mu);
  assert.match(run.stdout, /^ {2}RELEASE_RECORD_MISSING: ISS-1 has no release note\.$/mu);
  assert.deepEqual(run.routes, ["GET /api/projects/:id/release-readiness"]);
});

test("2. readiness says in one line that nothing blocks a release where the tracker lists no reason", async () => {
  state.release.readiness = { hasReleaseGate: true, releaseModel: "promote", blockers: [], warnings: [] };
  const run = await ran("readiness");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^blocked\s+nothing: the tracker lists no reason a release would be refused now$/mu);
});

test("3. roster prints each waiting issue in the tracker's order, with its key, days waiting and the run holding it", async () => {
  state.release.roster = { gateStatus: "awaiting_release", currentVersion: "1.4.0", issues: [
    { id: TWO, displayId: "ISS-2", title: "two", waitingDays: 6, claimedByRunId: RUN_ID },
    { id: ONE, displayId: "ISS-1", title: "one", waitingDays: 2, claimedByRunId: null },
  ] };
  const run = await ran("roster");
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.split("\n").filter((line) => /^ {2}ISS-/u.test(line));
  assert.deepEqual(lines, [`  ISS-2  6 day(s)  two  held by run ${RUN_ID}`, "  ISS-1  2 day(s)  one"]);
  assert.deepEqual(run.routes, ["GET /api/projects/:id/release-batches/roster"]);
});

test("4. roster on a project with no release gate says it has none", async () => {
  state.release.roster = { gateStatus: null, issues: [] };
  const run = await ran("roster");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /gate\s+none: this project has no release gate/u);
});

const recorded = (extra = {}) => ({ runId: RUN_ID, commit: SHA, identity: SHA, readings: [],
  verification: "probed", closed: [ONE, TWO], failed: [], issues: [], ...extra });

test("5, 6. record sends the ids, the commit and the account to release-records and sends no transition", async () => {
  state.release.record = recorded();
  const run = await ran("record", "ISS-1", "ISS-2", "--commit", SHA, "--account", ACCOUNT);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.routes, ["POST /api/projects/:id/release-records"]);
  assert.deepEqual(run.released[0].args.data, { issueIds: [ONE, TWO], commit: SHA, account: ACCOUNT });
  const moves = run.calls.filter((one) => /transition|PATCH \/api\/issues/u.test(one.route));
  assert.deepEqual(moves, [], "the tracker closes them; this CLI moves no status");
});

test("7. record sends --provider-ref as the provider handle, and no handle without the flag", async () => {
  state.release.record = recorded();
  const given = await ran("record", "ISS-1", "--commit", SHA, "--account", ACCOUNT, "--provider-ref", "deploy-77");
  assert.equal(given.status, 0, given.stderr);
  assert.equal(given.released[0].args.data.providerRef, "deploy-77");
  const bare = await ran("record", "ISS-1", "--commit", SHA, "--account", ACCOUNT);
  assert.equal(bare.status, 0, bare.stderr);
  assert.ok(!("providerRef" in bare.released[0].args.data), JSON.stringify(bare.released[0].args.data));
});

test("8. a recorded release prints its run id, how the commit was verified, and each closed issue by key", async () => {
  state.release.record = recorded();
  const run = await ran("record", "ISS-1", "ISS-2", "--commit", SHA, "--account", ACCOUNT);
  assert.match(run.stdout, new RegExp(`^runId\\s+${RUN_ID}$`, "mu"));
  assert.match(run.stdout, new RegExp(`^verified\\s+probed: the deployment's probes read ${SHA}$`, "mu"));
  assert.match(run.stdout, /^closed\s+2 issue\(s\): ISS-1, ISS-2$/mu);
  state.release.record = recorded({ verification: "unverified", identity: null });
  const unverified = await ran("record", "ISS-1", "ISS-2", "--commit", SHA, "--account", ACCOUNT);
  assert.match(unverified.stdout, /^verified\s+unverified: the project declares no live verify probe/mu);
});

test("9. an issue the tracker could not close is printed by key with its reason, and the command exits non-zero", async () => {
  state.release.record = recorded({ closed: [ONE], failed: [{ id: TWO, reason: "TRANSITION_DENIED: held" }] });
  const run = await ran("record", "ISS-1", "ISS-2", "--commit", SHA, "--account", ACCOUNT);
  assert.equal(run.status, 1);
  assert.match(run.stdout, /^closed\s+1 issue\(s\): ISS-1$/mu);
  assert.match(run.stderr, /^ {2}ISS-2: TRANSITION_DENIED: held$/mu);
});

test("10. record missing --commit, --account or every key is refused before any request", async () => {
  for (const [argv, owed] of [
    [["ISS-1", "--account", ACCOUNT], /--commit, the whole sha/u],
    [["ISS-1", "--commit", SHA], /--account, how the release was performed/u],
    [["--commit", SHA, "--account", ACCOUNT], /at least one issue key is owed/u],
  ]) {
    const run = await ran("record", ...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.match(run.stderr, owed);
    assert.deepEqual(run.calls, [], `${argv.join(" ")} sent nothing`);
  }
});

test("11. start with no key is refused before any request", async () => {
  const run = await ran("start");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /at least one issue key is owed, and nothing was sent/u);
  assert.deepEqual(run.calls, []);
});

test("12. recorded reads a recorded release back and prints its commit, verification, account and issues", async () => {
  state.release.recorded = { runId: RUN_ID, projectId: "p", recordedAt: "2026-09-20T15:00:00.000Z", commit: SHA,
    identity: null, providerRef: null, account: ACCOUNT, readings: [], verification: "unverified",
    issues: [{ id: ONE, mergedAt: "2026-09-19T00:00:00.000Z", mergedCommitSha: SHA }] };
  const run = await ran("recorded", RUN_ID);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.routes, [`GET /api/projects/:id/release-records/${RUN_ID}`]);
  assert.match(run.stdout, new RegExp(`^commit\\s+${SHA}$`, "mu"));
  assert.match(run.stdout, /^verified\s+unverified:/mu);
  assert.match(run.stdout, new RegExp(`^account\\s+${ACCOUNT}$`, "mu"));
  assert.match(run.stdout, new RegExp(`^ {2}${ONE} {2}merged 2026-09-19`, "mu"));
});

test("13. start sends exactly the named issues' ids to batch create and prints the run id and the version", async () => {
  state.release.create = { runId: RUN_ID, jobId: "j", issueIds: [ONE], gateStatus: "awaiting_release",
    version: "1.5.0", ownerDeadlineAt: "2026-10-01T12:00:00.000Z" };
  const run = await ran("start", "ISS-1");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.routes, ["POST /api/projects/:id/release-batches"]);
  assert.deepEqual(run.released[0].args.data, { issueIds: [ONE] });
  assert.match(run.stdout, new RegExp(`^runId\\s+${RUN_ID}$`, "mu"));
  assert.match(run.stdout, /^version\s+1\.5\.0$/mu);
});

test("14. finish sends the commit to that run's finish route and prints the state the tracker answered", async () => {
  state.release.finish = { runId: RUN_ID, finish: { state: "verifying", commit: SHA } };
  const run = await ran("finish", RUN_ID, "--commit", SHA);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.routes, [`POST /api/projects/:id/release-batches/${RUN_ID}/finish`]);
  assert.deepEqual(run.released[0].args.data, { commit: SHA });
  assert.match(run.stdout, /^finish\s+verifying$/mu);
});

test("15. finish without --commit sends a body carrying no commit", async () => {
  state.release.finish = { runId: RUN_ID, finish: { state: "accepted", commit: null } };
  const run = await ran("finish", RUN_ID);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!("commit" in (run.released[0].args.data ?? {})), JSON.stringify(run.released[0].args.data));
});

test("16. a refused write prints the first reason and every alsoBlocking one, and names readiness", async () => {
  state.release.record = { refused: "No runner carries the release label.", code: "RELEASE_POOL_EMPTY",
    details: { alsoBlocking: [blocker("RELEASE_RECORD_MISSING", "ISS-2 has no release note.")] } };
  const run = await ran("record", "ISS-1", "ISS-2", "--commit", SHA, "--account", ACCOUNT);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /RELEASE_POOL_EMPTY: No runner carries the release label\./u);
  assert.match(run.stderr, /^ {2}RELEASE_RECORD_MISSING: ISS-2 has no release note\.$/mu);
  assert.match(run.stderr, /forge release-batch readiness/u);
});

test("18. a flag a subcommand does not declare is refused before any request", async () => {
  for (const argv of [["record", "ISS-1", "--commit", SHA, "--account", ACCOUNT, "--force", "x"],
    ["finish", RUN_ID, "--reason", "x"], ["roster", "--limit", "3"], ["readiness", "--all", "x"]]) {
    const run = await ran(...argv);
    assert.equal(run.status, 1, argv.join(" "));
    assert.deepEqual(run.calls, [], `${argv.join(" ")} sent nothing`);
  }
});

test("19. -h lists every subcommand beside status and clear", async () => {
  const run = await ran("-h");
  assert.equal(run.status, 0, run.stderr);
  for (const sub of ["status", "readiness", "roster", "start", "finish", "record", "recorded", "clear"]) {
    assert.match(run.stdout, new RegExp(`^ {2}${sub}\\b`, "mu"), sub);
  }
});
