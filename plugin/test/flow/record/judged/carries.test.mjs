/* The verdict write asks this checkout's git whether the commit judged carries the merged commit and
   puts the answer on the record, because the `testing` rung reads no repository (ISS-1302). Spawned,
   because what is proved is the record the tracker receives and the line its author reads. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("judged-carries").path;
const { commitCarries } = await import("../../../../src/git/carries.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const head = (room) => git(room, "rev-parse", "HEAD").stdout.trim();
const short = (sha) => sha.slice(0, 7);
const commit = (room, name) => {
  writeFileSync(join(room, name), `${name}\n`);
  git(room, "add", name);
  git(room, "commit", "-qm", name);
  return head(room);
};

/* A base, the landing on top of it and a later commit on top of that; beside them a commit cut from
   the base, which carries no landing. The checkout is left clean at the later commit. */
const ROOM = tempRoom("judged-carries-");
git(ROOM, "init", "-q", "-b", "master");
const BASE = commit(ROOM, "base.txt");
const MERGED = commit(ROOM, "landed.txt");
const LATER = commit(ROOM, "later.txt");
git(ROOM, "checkout", "-q", "-b", "aside", BASE);
const ASIDE = commit(ROOM, "aside.txt");
git(ROOM, "checkout", "-q", "master");
const NOWHERE = "0123456789abcdef0123456789abcdef01234567";

const judging = {
  documentId: "carries-uuid",
  issueId: "ISS-8",
  status: "developed",
  title: "the change being judged",
  description: "judged after its landing",
  /* Two, and only the first judged, so no write here earns the rung and moves the status. */
  acceptanceCriteria: "1. The one outcome.\n2. The other outcome.",
  mergedAt: "2026-09-05T13:49:51.777Z",
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "carries-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "update") return Object.assign(judging, args.data);
  return judging;
};
state.answer.forge_comments = (args) => {
  const held = state.comments["carries-uuid"];
  if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
  held.push({ documentId: `comment-${held.length}`, createdAt: new Date().toISOString(), body: args.data?.body });
  return { documentId: `comment-${held.length - 1}` };
};
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
after(() => tracker.close());

const env = { ...ENV, FORGE_SESSION_ID: "judged-carries-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env, ROOM);
const page = () => state.comments["carries-uuid"];
const lastBody = () => page().at(-1)?.body ?? "";
const landAt = (sha) => page().push({
  documentId: `mark-${page().length}`,
  createdAt: new Date().toISOString(),
  body: `mark_merged target=base — merged to master at ${sha}`,
});
const verdictAt = (sha, ...more) =>
  ask("record", "verdict", "ISS-8", "--criterion", "1", "--verdict", "pass", "--evidence", BASE, "--commit", sha, ...more);

before(async () => {
  await ask("claim", "ISS-8", "--unheld");
  const claimed = await ask("claim", "ISS-8", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
  landAt(MERGED);
});

test("a verdict at a later commit records the merged commit it carries, and says so", async () => {
  const run = await verdictAt(LATER);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stderr.includes(`--commit ${short(LATER)} carries the merged commit ${short(MERGED)}, as this checkout's git reads it`), run.stderr);
  assert.ok(lastBody().split("\n").includes(`carries: ${MERGED}`), "the record names the merged commit it carries");
});

test("a verdict at the merged commit asks git nothing and records nothing more", async () => {
  const run = await verdictAt(MERGED);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /the merged commit [0-9a-f]{7}/u);
  assert.doesNotMatch(lastBody(), /^carries:/mu);
});

test("a verdict at a commit that does not carry the landing records nothing, and says why", async () => {
  const run = await verdictAt(ASIDE);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stderr.includes(`--commit ${short(ASIDE)} does not carry the merged commit ${short(MERGED)}: ${short(MERGED)} is no ancestor of ${short(ASIDE)}.`), run.stderr);
  assert.doesNotMatch(lastBody(), /^carries:/mu);
});

test("a checkout that cannot answer records nothing, and says what it lacked", async () => {
  landAt(NOWHERE);
  try {
    const run = await verdictAt(LATER);
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.stderr.includes(`This checkout cannot say whether --commit ${short(LATER)} carries the merged commit ${short(NOWHERE)}: this checkout holds no one commit named ${NOWHERE}`), run.stderr);
    assert.doesNotMatch(lastBody(), /^carries:/mu);
  } finally {
    landAt(MERGED);
  }
});

test("the field is no flag, so a caller cannot type the ancestry", async () => {
  const before = page().length;
  const run = await verdictAt(ASIDE, "--carries", MERGED);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No record verdict flag named --carries\./u);
  assert.equal(page().length, before, "nothing was sent");
});

test("the verdict's help says a later commit carrying the landing earns the rung, and how", async () => {
  const run = await ask("record", "verdict", "-h");
  assert.match(run.stdout + run.stderr, /A later --commit carrying the merged one earns `testing`: the write records what git says of it\./u);
});

test("a shallow history and a directory no checkout holds settle nothing", () => {
  const loose = tempRoom("judged-carries-loose-");
  assert.deepEqual(commitCarries(MERGED, LATER, loose), { carries: null, why: "this directory is no git checkout" });
  const shallow = tempRoom("judged-carries-shallow-");
  git(shallow, "clone", "-q", "--depth", "1", `file://${ROOM}`, ".");
  assert.equal(commitCarries(MERGED, head(shallow), shallow).carries, null);
  assert.match(commitCarries(MERGED, head(shallow), shallow).why, /shallow/u);
  assert.deepEqual(commitCarries(MERGED, LATER, ROOM), { carries: true, why: null });
  assert.deepEqual(commitCarries(MERGED, MERGED, ROOM), { carries: true, why: null }, "a commit carries itself");
});

/* The deployment half. A staging host serves the branch's tip, a later commit than the merge the
   checkpoint names whenever another change landed after it, and the judge cites what it exercised
   (ISS-2587, anhome ISS-525). */
const deployedAt = async (deployment, take) => {
  judging.sessionContext = { ...judging.sessionContext, landing: { state: "done", head: MERGED, deployment, files: [] } };
  try {
    return await take();
  } finally {
    delete judging.sessionContext.landing;
  }
};
const cites = (...evidence) => ask("record", "verdict", "ISS-8", "--criterion", "1", "--verdict", "pass",
  "--commit", MERGED, ...evidence.flatMap((one) => ["--evidence", one]));

test("a verdict citing a later commit that carries the checkpoint's deployment records it, whichever of its commits does", async () => {
  for (const evidence of [[LATER], [ASIDE, LATER], [NOWHERE, LATER], [LATER, ASIDE]]) {
    const run = await deployedAt(MERGED, () => cites(...evidence));
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.stderr.includes(`--evidence ${short(LATER)} carries the deployment ${short(MERGED)} the landing checkpoint names`),
      `${evidence.map(short).join(", ")}:\n${run.stderr}`);
    assert.ok(lastBody().split("\n").includes(`carries-deployment: ${MERGED}`),
      `the record names the deployment it carries, for ${evidence.map(short).join(", ")}:\n${lastBody()}`);
  }
});

test("a verdict citing no commit that carries the deployment records nothing, and names the citation owed", async () => {
  const run = await deployedAt(MERGED, () => cites(ASIDE));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stderr.includes(`No commit this verdict cites carries the deployment ${short(MERGED)} the landing checkpoint names`), run.stderr);
  assert.ok(run.stderr.includes(`so \`testing\` refuses it unless it cites ${short(MERGED)} itself.`), run.stderr);
  assert.doesNotMatch(lastBody(), /^carries-deployment:/mu);
});

test("a checkout that cannot settle the deployment's ancestry records nothing, and names both ways past it", async () => {
  const run = await deployedAt(MERGED, () => cites(NOWHERE));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stderr.includes(`This checkout cannot say whether --evidence ${short(NOWHERE)} carries the deployment ${short(MERGED)}`), run.stderr);
  assert.ok(run.stderr.includes(`add \`--evidence ${short(MERGED)}\`, or write it from a checkout holding both commits.`), run.stderr);
  assert.doesNotMatch(lastBody(), /^carries-deployment:/mu);
});

test("a verdict citing the deployment itself, or a checkpoint naming none, asks git nothing about it", async () => {
  const direct = await deployedAt(MERGED, () => cites(MERGED));
  assert.equal(direct.status, 0, direct.stderr);
  assert.doesNotMatch(direct.stderr, /the deployment [0-9a-f]{7} the landing checkpoint names/u);
  assert.doesNotMatch(lastBody(), /^carries-deployment:/mu);
  const none = await cites(LATER);
  assert.equal(none.status, 0, none.stderr);
  assert.doesNotMatch(none.stderr, /the landing checkpoint names/u);
  assert.doesNotMatch(lastBody(), /^carries-deployment:/mu);
});

test("the deployment stamp is no flag, so a caller cannot type that ancestry either", async () => {
  const before = page().length;
  const run = await deployedAt(MERGED, () => verdictAt(MERGED, "--carries-deployment", MERGED));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No record verdict flag named --carries-deployment\./u);
  assert.equal(page().length, before, "nothing was sent");
});
