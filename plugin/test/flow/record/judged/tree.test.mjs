/* A verdict and a review each name the head they judged, and a run judges the tree it has open. A
   consult remedy left uncommitted made the two differ with nothing refusing it: every verdict cited a
   head that did not carry what it judged, and only a landing script's dirty-tree check caught it
   (ISS-381). Spawned, because what is proved is that nothing reaches the tracker. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { dirtyRepo, git, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("judged-tree").path;
const { uncommittedOver } = await import("../../../../src/flow/worklog.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const head = (room) => git(room, "rev-parse", "HEAD").stdout.trim();

/* One checkout with an older commit under its head and a tracked file changed on top; one that is
   clean at its head; and a room no checkout holds. */
const DIRTY = dirtyRepo();
const OLDER = head(DIRTY);
writeFileSync(join(DIRTY, "second.txt"), "the head's own file\n");
git(DIRTY, "add", "second.txt");
git(DIRTY, "commit", "-qm", "the head");
const CLEAN = dirtyRepo();
git(CLEAN, "commit", "-qam", "the work committed");
const LOOSE = tempRoom("judged-tree-loose-");

const judging = {
  documentId: "judging-uuid",
  issueId: "ISS-7",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: "1. The one outcome.",
  mergedAt: "2026-09-05T13:49:51.777Z",
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "judging-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
  if (args.action === "update") return Object.assign(judging, args.data);
  return judging;
};
state.answer.forge_comments = (args) => {
  const held = state.comments["judging-uuid"];
  if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
  held.push({ documentId: `comment-${held.length}`, createdAt: new Date().toISOString(), body: args.data?.body });
  return { documentId: `comment-${held.length - 1}` };
};
const { tracker, env: ENV } = await trackerFor(state, [DIRTY, CLEAN]);
after(() => tracker.close());

const env = { ...ENV, FORGE_SESSION_ID: "judged-tree-session" };
const ask = (cwd, ...argv) => ranAsync(FORGE, argv, env, cwd);
const posted = () => state.comments["judging-uuid"].length;
const verdictAt = (cwd, ...commit) =>
  ask(cwd, "record", "verdict", "ISS-7", "--criterion", "1", "--verdict", "pass", "--evidence", OLDER, ...commit);

before(async () => {
  await ask(process.cwd(), "claim", "ISS-7", "--unheld");
  const claimed = await ask(process.cwd(), "claim", "ISS-7", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("a verdict citing the head of a checkout holding uncommitted work is refused, and nothing is sent", async () => {
  const before = posted();
  const run = await verdictAt(DIRTY, "--commit", head(DIRTY));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--commit [0-9a-f]{7} is the head of this checkout, and the checkout holds work that head does not carry: tracked\.txt\./u);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.match(run.stderr, /git add -A && git commit, then --commit \$\(git rev-parse HEAD\)/u, "the route that clears it");
  assert.equal(posted(), before, "refused before the write");
});

test("a review of the head of a checkout holding an untracked file is refused, and nothing is sent", async () => {
  writeFileSync(join(CLEAN, "remedy.mjs"), "a remedy nobody committed\n");
  const before = posted();
  try {
    const run = await ask(CLEAN, "record", "review", "ISS-7", "--reviewer", "codex", "--commit", head(CLEAN),
      "--outcome", "approved");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /record review: --commit [0-9a-f]{7} is the head of this checkout[\s\S]*: remedy\.mjs\./u);
    assert.equal(posted(), before, "refused before the write");
  } finally {
    git(CLEAN, "clean", "-qf");
  }
});

test("a commit read off the merged mark is held to the refusal a typed one is", async () => {
  state.comments["judging-uuid"].push({
    documentId: "the-mark",
    createdAt: new Date().toISOString(),
    body: `mark_merged target=base — merged to master at ${head(DIRTY)}`,
  });
  const before = posted();
  const run = await verdictAt(DIRTY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /from the merged mark's note/u, "the commit came off the mark");
  assert.match(run.stderr, /is the head of this checkout, and the checkout holds work/u);
  assert.equal(posted(), before);
});

/* The issue's own rule: the check is about the tree, never about the sha being the newest. */
test("an older commit is taken from a checkout holding uncommitted work", async () => {
  const before = posted();
  const run = await verdictAt(DIRTY, "--commit", OLDER);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(posted(), before + 1);
});

/* In process rather than spawned: a room no checkout holds resolves no project, so the verb refuses
   there before this reading is reached, and the reading has to stay silent on its own account. */
test("a room no checkout holds is read as holding nothing, whatever commit is named", () => {
  const was = process.cwd();
  try {
    process.chdir(LOOSE);
    assert.equal(uncommittedOver(head(DIRTY)), null);
    process.chdir(DIRTY);
    assert.deepEqual(uncommittedOver(head(DIRTY)), ["tracked.txt"], "where the same commit is a dirty checkout's head");
  } finally {
    process.chdir(was);
  }
});

test("the head of a clean checkout is taken", async () => {
  const before = posted();
  const run = await verdictAt(CLEAN, "--commit", head(CLEAN));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(posted(), before + 1);
});
