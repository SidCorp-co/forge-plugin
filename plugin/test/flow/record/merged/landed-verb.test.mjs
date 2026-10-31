/* A landing built by hand was recorded in four separate steps — a lease, a mark, a move and a lease
   rewrite — and the Agenfold sessions of 2026-10-30/31 saw them fail apart with NO_HOLDER and NO_OP.
   One verb makes them in the order core's direct mode names (core's `DIRECT_ORDER`): claim
   or verify the lease, mark merged at a sha the remote base branch carries, move to awaiting_release
   with the sha as the reason, comment, and hand the lease back last. Each case stands a real remote up,
   because whether the base carries the sha is the check the verb makes before the mark. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landed-verb").path;

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const HOLDER = "the-master-run";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: room, encoding: "utf8" });

/* A bare origin and a checkout of it, the change pushed to master and a second commit kept local. */
const ROOT = tempRoom("landed-verb-");
const ORIGIN = join(ROOT, "origin.git");
mkdirSync(ORIGIN);
git(ORIGIN, "init", "--bare", "-b", "master");
const WORK = join(ROOT, "work");
mkdirSync(WORK);
git(WORK, "init", "-b", "master");
git(WORK, "remote", "add", "origin", ORIGIN);
writeFileSync(join(WORK, "a.txt"), "one\n");
git(WORK, "add", "a.txt");
git(WORK, "commit", "-m", "ISS-61 the change that landed");
git(WORK, "push", "origin", "master");
const LANDED = git(WORK, "rev-parse", "HEAD").stdout.trim();
writeFileSync(join(WORK, "a.txt"), "two\n");
git(WORK, "commit", "-am", "ISS-61 a change only this disk holds");
const LOCAL = git(WORK, "rev-parse", "HEAD").stdout.trim();

const fresh = () => ({
  documentId: "landed-verb-uuid",
  issueId: "ISS-61",
  projectId: OWN.id,
  status: "open",
  title: "a change built by hand",
  description: "no mark here",
});
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [fresh()],
  comments: { "landed-verb-uuid": [] },
  refuse: {},
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  const [issue] = state.issues;
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "moves") return { moves: [] };
  if (args.action === "get") return issue;
  if (state.refuse[args.action]) return { refused: state.refuse[args.action] };
  if (args.action === "transition") {
    state.issues[0] = { ...issue, status: args.data.status };
    return state.issues[0];
  }
  if (args.action === "mark_merged") {
    state.issues[0] = { ...issue, mergedAt: "2026-10-31T00:00:00.000Z", mergedCommitSha: args.data.commit };
    return { action: "merged" };
  }
  if (args.action === "update") {
    state.issues[0] = { ...issue, ...args.data };
    return state.issues[0];
  }
  return issue;
};
state.answer.forge_comments = (args) => {
  const held = state.comments["landed-verb-uuid"];
  if (args.action !== "list") {
    held.push({ documentId: `c-${held.length + 1}`, createdAt: new Date().toISOString(), authorId: "agent", body: args.data.body });
    return { documentId: `c-${held.length}` };
  }
  return { comments: held, returned: held.length, hasMore: false };
};
const { tracker, env: ENV } = await trackerFor(state, [WORK]);
projectRoom(WORK, ENV.XDG_CONFIG_HOME, OWN);
test.after(() => tracker.close());

const forge = async (...argv) => {
  state.calls = [];
  return ranAsync(FORGE, argv, { ...ENV, FORGE_SESSION_ID: HOLDER }, WORK);
};
const WRITES = ["update", "transition", "mark_merged", "unmark", "create"];
const writes = () => state.calls.filter((one) => WRITES.includes(one.args?.action));
const step = (one) => {
  if (one.name === "forge_comments") return "comment";
  if (one.args.action === "mark_merged") return `merge ${one.args.data.commit}`;
  if (one.args.action === "transition") return `move ${one.args.data.status}`;
  if (one.args.data?.sessionContext) return "lease";
  return one.args.action;
};

test("record landed -h names the five steps in their order, and the dry run", async () => {
  const run = await forge("record", "landed", "-h");
  assert.equal(run.status, 0, run.stderr);
  const order = [/1\. the lease/u, /2\. merged/u, /3\. awaiting_release/u, /4\. the comment/u, /5\. the lease handed back/u]
    .map((step) => run.stdout.search(step));
  assert.ok(order.every((at) => at >= 0), run.stdout);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `the steps are printed in order:\n${run.stdout}`);
  assert.match(run.stdout, /--dry-run/u);
  assert.match(run.stdout, /--sha <40-hex>/u);
});

test("a sha that is not whole is refused before any request", async () => {
  const run = await forge("record", "landed", "ISS-61", "--sha", LANDED.slice(0, 7));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /40/u);
  assert.deepEqual(writes(), [], "nothing was written");
});

test("the dry run prints the planned calls in order and writes nothing", async () => {
  state.issues = [fresh()];
  const run = await forge("record", "landed", "ISS-61", "--sha", LANDED, "--dry-run");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(writes(), [], "a dry run sends no write");
  const planned = ["sessionContext", "in_progress", "/merge", "awaiting_release", "/comments", "released"]
    .map((word) => run.stdout.indexOf(word));
  assert.ok(planned.every((at) => at >= 0), run.stdout);
  assert.deepEqual([...planned].sort((a, b) => a - b), planned, `the calls are printed in order:\n${run.stdout}`);
  assert.match(run.stdout, new RegExp(LANDED, "u"));
});

test("a landing is recorded in core's order: lease, take, mark, move with the sha, comment, lease back last", async () => {
  state.issues = [fresh()];
  state.comments["landed-verb-uuid"] = [];
  const run = await forge("record", "landed", "ISS-61", "--sha", LANDED, "--reason", "built and landed by hand");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const steps = writes().map(step);
  assert.deepEqual(steps.filter((one) => one !== "lease").slice(0, 4),
    ["move in_progress", `merge ${LANDED}`, "move awaiting_release", "comment"], steps.join("\n"));
  assert.equal(steps[0], "lease", "the lease is the first write");
  assert.equal(steps.at(-1), "lease", "and handing it back is the last");
  const moved = writes().find((one) => one.args.action === "transition" && one.args.data.status === "awaiting_release");
  assert.match(moved.args.data.reason, new RegExp(LANDED, "u"), "the sha is the move's reason");
  assert.equal(state.issues[0].status, "awaiting_release");
});

test("a sha the remote base does not carry stops the verb before the mark, naming what already happened", async () => {
  state.issues = [fresh()];
  const run = await forge("record", "landed", "ISS-61", "--sha", LOCAL);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /origin\/master/u, "the base it was read against is named");
  assert.match(run.stderr, /already happened|done so far|happened before/u);
  assert.equal(writes().filter((one) => one.args.action === "mark_merged").length, 0, "no mark was sent");
});

test("a refused move stops the verb by name and says which steps had happened", async () => {
  state.issues = [fresh()];
  state.refuse = { transition: "NOT_THE_HOLDER: device x holds it" };
  const run = await forge("record", "landed", "ISS-61", "--sha", LANDED);
  state.refuse = {};
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /NOT_THE_HOLDER/u, "core's refusal, by name");
  assert.match(run.stderr, /lease/u, "and the steps that happened before it");
  assert.equal(writes().filter((one) => one.args.action === "mark_merged").length, 0, "nothing after the refusal");
});

/* Agenfold's ISS-28: the dry run at `draft` promised "taken: nothing holds it", and the call then
   stopped at the lease naming `forge claim --unheld`; getting through took a claim, an advance to
   open and the verb again. The verb now takes a draft the whole way itself, the lease written before
   the issue is opened, so the open issue is never one a dispatcher could take. */
test("a draft is taken the whole way: lease first, then open, then in_progress, and the dry run says each", async () => {
  state.issues = [{ ...fresh(), status: "draft" }];
  state.comments["landed-verb-uuid"] = [];
  const dry = await forge("record", "landed", "ISS-61", "--sha", LANDED, "--dry-run");
  assert.equal(dry.status, 0, `${dry.stdout}${dry.stderr}`);
  assert.deepEqual(writes(), [], "a dry run sends no write");
  const planned = ["taken at draft", '"open"', '"in_progress"', "/merge", '"awaiting_release"', "/comments", "released"]
    .map((word) => dry.stdout.indexOf(word));
  assert.ok(planned.every((at) => at >= 0), dry.stdout);
  assert.deepEqual([...planned].sort((a, b) => a - b), planned, `every step, in order:\n${dry.stdout}`);
  const run = await forge("record", "landed", "ISS-61", "--sha", LANDED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const steps = writes().map(step);
  assert.deepEqual(steps.slice(0, 3), ["lease", "move open", "move in_progress"], `the lease before the open:\n${steps.join("\n")}`);
  assert.deepEqual(steps.filter((one) => one !== "lease").slice(2), [`merge ${LANDED}`, "move awaiting_release", "comment"]);
  assert.equal(steps.at(-1), "lease", "and handing it back is the last");
  assert.equal(state.issues[0].status, "awaiting_release");
});

/* The dry run may say less than the call does, never more: where the call would stop, so does it. */
test("where the call would be refused, the dry run is refused the same way and promises nothing", async () => {
  const another = { holder: "another-run", agent: "a", pid: "1", renewedAt: new Date().toISOString(), minutes: 60, next: "building" };
  for (const [issue, why] of [
    [{ ...fresh(), status: "draft", sessionContext: { lease: another } }, /another-run/u],
    [{ ...fresh(), status: "needs_info" }, /nothing written\. ISS-61 is at `needs_info`[\s\S]*forge advance ISS-61 --owed/u],
  ]) {
    for (const dry of [["--dry-run"], []]) {
      state.issues = [issue];
      const run = await forge("record", "landed", "ISS-61", "--sha", LANDED, ...dry);
      assert.equal(run.status, 1, `${issue.status} ${dry}: ${run.stdout}`);
      assert.match(run.stderr, /nothing (written|is sent)/u, `${issue.status} ${dry}: it leads with what was not sent:\n${run.stderr}`);
      assert.match(run.stderr, why, run.stderr);
      assert.doesNotMatch(run.stdout, /taken: nothing holds it/u, "and promises no take");
      assert.deepEqual(writes(), [], `${issue.status} ${dry}: nothing was written`);
    }
  }
});
