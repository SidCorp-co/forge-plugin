/* A plan or criteria write is cleared by the consult that read the file, whichever directory either
   command ran from: a run consults from its worktree and records from wherever its shell stands, and
   the refusal said "no consult has read" a file the log held a whole read of (ISS-904). Over a real
   `git worktree add` and an unrelated checkout, because the roots are what git writes and a stand-in
   path would pass whatever the match did. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the log's path is bound when its module loads. */
const sandbox = tempRoom("forge-codex-read-anywhere-");
process.env.XDG_CONFIG_HOME = sandbox;
delete process.env.FORGE_CODEX_DISABLE;

const { digest, locate } = await import("../../../src/codex/codex-api.mjs");
const { logConsult, logPath } = await import("../../../src/codex/codex-log.mjs");
const { repoRoot } = await import("../../../src/git/repo-root.mjs");
const { readOrRefuse } = await import("../../../src/codex/codex-read.mjs");

const refusalOf = (path, cwd) => readOrRefuse(path, cwd).refusal;

const TEXT = "1. it refuses\n";

const primaryAt = tempRoom("read-anywhere-primary-");
spawnSync("git", ["init", "-q", primaryAt], { cwd: primaryAt });
writeFileSync(join(primaryAt, "a.txt"), "a\n");
git(primaryAt, "add", ".");
git(primaryAt, "commit", "-qm", "one");
const worktreeAt = join(tempRoom("read-anywhere-sibling-"), "wt");
git(primaryAt, "worktree", "add", "-q", worktreeAt);
const strangerAt = tempRoom("read-anywhere-stranger-");
spawnSync("git", ["init", "-q", strangerAt], { cwd: strangerAt });

const PRIMARY = repoRoot(primaryAt);
const WORKTREE = repoRoot(worktreeAt);
const STRANGER = repoRoot(strangerAt);

let serial = 0;
/* The row `forge codex consult` writes, with `rel` read off `locate` from the root the consult ran in
   rather than assembled here, so the case cannot agree with itself against the code. */
const consultedFrom = (root, path, text = TEXT) => {
  const { rel } = locate(root, path);
  serial += 1;
  logConsult({
    kind: "consult",
    id: `aw${String(serial).padStart(4, "0")}`,
    at: new Date().toISOString(),
    root,
    ok: true,
    reply: "CODEX: 0 findings",
    files: [rel],
    send: "bodies",
    sent: [{ rel, sha: digest(text), chars: text.length, clipped: false }],
  });
  return rel;
};

const written = (directory, name, text = TEXT) => {
  const path = join(directory, name);
  writeFileSync(path, text);
  return path;
};

test("a write from the primary checkout is cleared by a consult of the same absolute path in a worktree", () => {
  const scratch = written(tempRoom("read-anywhere-scratch-"), "criteria.md");
  const inTree = written(WORKTREE, "plan.md");
  consultedFrom(WORKTREE, scratch);
  assert.equal(consultedFrom(WORKTREE, inTree), "plan.md", "the worktree's row names its own file by a rel");
  assert.equal(refusalOf(scratch, PRIMARY), null);
  assert.equal(refusalOf(inTree, PRIMARY), null);
});

test("a file inside one repository is cleared by a consult of it taken in an unrelated checkout", () => {
  const path = written(PRIMARY, "inside.md");
  assert.ok(consultedFrom(STRANGER, path).startsWith("/"), "the stranger's row names it by its real path");
  assert.equal(refusalOf(path, PRIMARY), null);
  assert.equal(refusalOf(path, WORKTREE), null);
});

test("a file outside every repository is cleared by a consult of it taken in an unrelated checkout", () => {
  const path = written(tempRoom("read-anywhere-scratch-"), "criteria.md");
  consultedFrom(STRANGER, path);
  assert.equal(refusalOf(path, PRIMARY), null);
  assert.equal(refusalOf(path, WORKTREE), null);
});

test("from outside every checkout, a consult of a file outside every repository clears it", () => {
  const nowhere = tempRoom("read-anywhere-nowhere-");
  const path = written(nowhere, "criteria.md");
  assert.match(refusalOf(path, nowhere), /No consult has read .*criteria\.md[\s\S]*is in no git checkout/u);
  consultedFrom(STRANGER, path);
  assert.equal(refusalOf(path, nowhere), null);
});

test("a consult of a different file holding the same bytes leaves the write refused", () => {
  const read = written(tempRoom("read-anywhere-scratch-"), "criteria.md");
  const twin = written(tempRoom("read-anywhere-scratch-"), "criteria.md");
  consultedFrom(WORKTREE, read);
  assert.match(refusalOf(twin, PRIMARY), /^No consult has read /u);
  const sameName = written(STRANGER, "twin.md");
  written(PRIMARY, "twin.md");
  consultedFrom(STRANGER, sameName);
  assert.match(refusalOf(join(PRIMARY, "twin.md"), PRIMARY), /^No consult has read twin\.md/u,
    "one rel under two roots is two files");
});

test("a relative argument still names the file under the directory the write runs from", () => {
  written(WORKTREE, "relative.md");
  const primaryCopy = written(PRIMARY, "relative.md");
  consultedFrom(PRIMARY, primaryCopy);
  assert.match(refusalOf("relative.md", WORKTREE), /^No consult has read relative\.md/u);
  assert.equal(refusalOf("relative.md", PRIMARY), null);
});

test("a file edited since another checkout's consult read it says its text changed since that consult", () => {
  const path = written(tempRoom("read-anywhere-scratch-"), "criteria.md");
  consultedFrom(WORKTREE, path);
  const id = `aw${String(serial).padStart(4, "0")}`;
  writeFileSync(path, `${TEXT}2. and one more\n`);
  assert.match(refusalOf(path, PRIMARY), new RegExp(`^Consult ${id} read .*criteria\\.md whole, and its text has changed since\\.`, "u"));
});

test("the log these cases wrote is the sandbox's, never the developer's", () => {
  assert.ok(logPath().startsWith(sandbox), `${logPath()} is outside ${sandbox}`);
});
