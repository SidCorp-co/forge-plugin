/* Where `finish` sends commits the default branch lacks, under each ship mode (ISS-2543). A run under
   `ready` lands nothing of its own, so the route the refusal names is read off the ship mode and the
   landing checkpoint, and whether the commits die with the tree off `origin/<branch>`. The refusal's
   other readings are `finish.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BARE, OWN_SLUG, declared, git, noBacklog, pushed, runIn } from "../run-fixtures.mjs";

const KEY = "ISS-88";
const UUID = "finish-ready-uuid";

/** A tree `start` made for the key, one commit ahead of origin's default branch, pushed to its own
 *  remote branch or not, under a project whose ship mode is the case's. */
const ahead = (name, { ship, push = true }) => {
  const { work } = pushed(name);
  writeFileSync(join(work, ".gitignore"), "node_modules\n");
  git(work, "add", ".gitignore");
  git(work, "commit", "-m", "what a linked worktree borrows");
  git(work, "push", "origin", "HEAD:master");
  declared(work, ship ? { ship } : {});
  const started = runIn(work, ["start", KEY, "ready"], BARE);
  assert.equal(started.status, 0, started.stderr + started.stdout);
  const tree = join(dirname(work), `wt-${OWN_SLUG}-${KEY}`);
  const branch = "iss-88-ready";
  writeFileSync(join(tree, "landed.md"), "the change a landing lands\n");
  git(tree, "add", "landed.md");
  git(tree, "-c", "user.email=t@example.test", "-c", "user.name=Test", "commit", "-m", "the change");
  if (push) git(tree, "push", "origin", `HEAD:${branch}`);
  return { work, tree, branch, head: git(tree, "rev-parse", "HEAD").stdout.trim() };
};

/** The issue on the tracker, carrying the checkpoint the case is about or none. */
const onTracker = (landing) => noBacklog({ issues: [{
  documentId: UUID, issueId: KEY, status: "developed", title: "the change", description: "a body.\n",
  sessionContext: landing ? { landing } : {},
}] });

const checkpoint = (branch, head, state = "ready") => ({
  state, builder: "the-builder-run", branch, head, base: "1".repeat(40), files: ["landed.md"],
  at: new Date().toISOString(),
});

const refused = (work, tree) => {
  const run = runIn(work, ["finish", KEY], BARE);
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.ok(existsSync(tree), `the tree was removed:\n${run.stdout}${run.stderr}`);
  return run.stderr;
};

test("under ship ready, a checkpoint at the lander's turn and a pushed branch, finish names the landing and not ship", () => {
  const { work, tree, branch, head } = ahead("finish-ready-lander", { ship: "ready" });
  onTracker(checkpoint(branch, head));
  const said = refused(work, tree);
  assert.match(said, new RegExp(`clear it: node \\S+tools/run\\.mjs land-ready ${KEY}`, "u"), said);
  assert.doesNotMatch(said, /run\.mjs ship/u, said);
  assert.match(said, new RegExp(`which origin/${branch} carries for the landing to build from`, "u"), said);
  assert.doesNotMatch(said, /die with the tree/u, said);
});

test("under ship ready, a checkpoint at another turn names forge resume and not ship", () => {
  const { work, tree, branch, head } = ahead("finish-ready-builder", { ship: "ready" });
  onTracker(checkpoint(branch, head, "builder-owed"));
  const said = refused(work, tree);
  assert.match(said, new RegExp(`clear it: forge resume ${KEY}`, "u"), said);
  assert.match(said, /reads `builder-owed`, the builder's turn/u, said);
  assert.doesNotMatch(said, /run\.mjs ship/u, said);
  assert.doesNotMatch(said, /die with the tree/u, said);
});

test("under ship ready, a head origin/<branch> does not carry dies with the tree and is cleared by a push", () => {
  const { work, tree, branch, head } = ahead("finish-ready-unpushed", { ship: "ready", push: false });
  onTracker(checkpoint(branch, head));
  const said = refused(work, tree);
  assert.match(said, /which die with the tree/u, said);
  assert.match(said, new RegExp(`clear it: git -C \\S+ push origin ${branch}`, "u"), said);
  assert.doesNotMatch(said, /run\.mjs ship/u, said);
});

test("under ship ready, a checkpoint the tracker cannot answer for names forge resume and not ship", () => {
  const { work, tree } = ahead("finish-ready-unread", { ship: "ready" });
  noBacklog();
  const said = refused(work, tree);
  assert.match(said, /could not be read/u, said);
  assert.match(said, new RegExp(`clear it: forge resume ${KEY}`, "u"), said);
  assert.doesNotMatch(said, /run\.mjs ship/u, said);
});

const shipStands = (said) => {
  assert.match(said, /holds 1 commit\(s\) origin\/master does not carry, which die with the tree/u, said);
  assert.match(said, /clear it: node \S+run\.mjs ship/u, said);
};

test("under ship self the refusal keeps the ship route whatever the checkpoint says", () => {
  const { work, tree, branch, head } = ahead("finish-self", { ship: "self" });
  onTracker(checkpoint(branch, head));
  shipStands(refused(work, tree));
});

test("under ship ready with no checkpoint on the issue the refusal keeps the ship route", () => {
  const { work, tree } = ahead("finish-ready-none", { ship: "ready" });
  onTracker(null);
  shipStands(refused(work, tree));
});

test("under ship ready with a checkpoint naming another branch the refusal keeps the ship route", () => {
  const { work, tree, head } = ahead("finish-ready-other", { ship: "ready" });
  onTracker(checkpoint("iss-99-elsewhere", head));
  shipStands(refused(work, tree));
});
