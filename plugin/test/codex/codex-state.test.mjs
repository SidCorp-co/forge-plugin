/* A three-file commit was refused with a demand to consult 726 paths, 243 of them another session's
   uncommitted work in a shared checkout, and `pending --drop` reported a drop that changed nothing:
   the gate compared the tree and the commit carried the index (ISS-70). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apartFrom, demandIn, demandOf, goneFrom, stagedApart, stagedIn } from "../../src/codex/codex-state.mjs";
import { digest } from "../../src/codex/codex-api.mjs";
import { tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const rooms = [];
test.after(() => {
  for (const one of rooms) rmSync(one, { recursive: true, force: true });
});

const git = (root, ...args) => {
  const run = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env: { ...process.env, ...ENV } });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout;
};

/* Three tracked documents, one staged, one modified and unstaged, one untouched. */
const tree = () => {
  const root = realpathSync(tempRoom("codex-demand-"));
  rooms.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  for (const one of ["docs/A.md", "docs/B.md", "docs/C.md"]) writeFileSync(join(root, one), `${one}\n`);
  git(root, "init", "-q", ".");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "first");
  for (const one of ["docs/A.md", "docs/B.md"]) writeFileSync(join(root, one), `${one} again\n`);
  git(root, "add", "docs/A.md");
  return root;
};

test("what a commit carries is the index, and `-a` is what adds the rest", () => {
  const root = tree();
  assert.deepEqual(stagedIn(root), ["docs/A.md"], "the file nobody staged is not this commit's");
  assert.deepEqual(stagedIn(root, { all: true }).sort(), ["docs/A.md", "docs/B.md"]);
  assert.deepEqual(stagedIn(root, { paths: ["docs/B.md"] }).sort(), ["docs/A.md", "docs/B.md"], "a pathspec commits the worktree under it");
  assert.deepEqual(stagedIn(root, { paths: ["docs/C.md"] }), ["docs/A.md"], "and names nothing where nothing changed");
});

/* A commit that stages a rename carries one path, and it is where the file went. */
test("a staged rename is carried by its new name alone", () => {
  const root = tree();
  git(root, "mv", "docs/C.md", "docs/D.md");
  assert.ok(stagedIn(root).includes("docs/D.md"));
  assert.ok(!stagedIn(root).includes("docs/C.md"));
});

test("a root git cannot answer for is not an empty index", () => {
  const room = tempRoom("codex-demand-bare-");
  rooms.push(room);
  assert.equal(stagedIn(room), null, "no repository there");
  assert.deepEqual(demandOf(room, ["docs/A.md"], {}), ["docs/A.md"], "so the record stands whole");
});

/* Two probes and not one, because the second answers about a path a commit would carry nothing of:
   `docs/B.md` differs from the index and is staged nowhere, which is why a write at the bytes read
   cannot be judged on the working copy against the index alone (ISS-1005). */
test("what a commit would carry apart from the working copy needs the index asked twice", () => {
  const root = tree();
  assert.deepEqual(apartFrom(root, ["docs/B.md"]), ["docs/B.md"], "the working copy differs from the index");
  assert.equal(stagedApart(root, "docs/B.md"), false, "and a commit with no -a carries nothing of it");
  assert.equal(stagedApart(root, "docs/A.md"), false, "the staged copy here is the copy on disk");
  assert.equal(stagedApart(root, "docs/C.md"), false, "and nothing was written to this one at all");
  writeFileSync(join(root, "docs/A.md"), "staged, then written again\n");
  assert.equal(stagedApart(root, "docs/A.md"), true, "now the index holds a copy that is not the one on disk");

  const room = tempRoom("codex-apart-bare-");
  rooms.push(room);
  assert.equal(stagedApart(room, "docs/A.md"), true, "a root git will not read says nothing is proven read");
  writeFileSync(join(room, ".git"), "gitdir: nowhere\n");
  assert.equal(stagedApart(room, "docs/A.md", { staged: ["docs/A.md"] }), true,
    "and a caller's own staged list does not stand in for the probe it cannot make");
});

/* Codex's F3: the supplementary read for `-a` or a pathspec failed into "no more files", so a
   partial answer read as a whole one and the record it should have stood on was filtered away. */
test("a supplementary read git refuses leaves no partial answer", () => {
  const root = tree();
  assert.equal(stagedIn(root, { paths: ["/etc/hosts"] }), null, "a pathspec outside the repository");
  assert.deepEqual(demandOf(root, ["docs/A.md", "docs/B.md"], { paths: ["/etc/hosts"] }), ["docs/A.md", "docs/B.md"]);
});

test("the demand is the record intersected with what the commit carries", () => {
  const root = tree();
  const record = ["docs/A.md", "docs/B.md"];
  assert.deepEqual(demandOf(root, record, {}), ["docs/A.md"]);
  assert.deepEqual(demandOf(root, record, { all: true }), record, "`-a` carries both");
  assert.deepEqual(demandOf(root, [], {}), [], "an empty record asks for nothing");
  assert.deepEqual(demandIn(record, null), record, "and an unanswerable index asks for all of it");
  assert.deepEqual(demandIn(record, []), [], "a commit with nothing staged asks for none of it");
});

const forge = (root, home, ...argv) =>
  spawnSync(process.execPath, [CLI, "codex", ...argv], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...ENV, XDG_CONFIG_HOME: home },
  });

const state = (root, files) => {
  const home = tempRoom("codex-demand-home-");
  rooms.push(home);
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex.json"), JSON.stringify({ turns: { [root]: { files, at: Date.now() - 120_000 } } }));
  return home;
};

/* `pending` reported one file, dropping it changed nothing, and the refusal named 726 others. */
test("`codex pending` prints the set a commit made now is asked for", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the staged one");
  assert.doesNotMatch(out.stdout.split("what a commit made now")[0], /docs\/B\.md/u, "not the unstaged one");
  assert.match(out.stdout, /recorded and not staged, which a commit takes only with -a or a pathspec: docs\/B\.md/u);
});

test("`codex pending --drop` drops that set and leaves the rest of the record", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending", "--drop");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /dropped 1 unconsulted file\(s\)/u);
  assert.match(out.stdout, /still recorded, unstaged: docs\/B\.md/u);
  assert.match(forge(root, home, "pending").stdout, /nothing staged that codex has not read/u);
});

/* The mailpilot session's `dropped 1 unconsulted file(s)` changed nothing the gate compared. */
test("`--drop` with nothing staged says so rather than reporting a drop", () => {
  const root = tree();
  git(root, "reset", "-q");
  const home = state(root, ["docs/A.md", "docs/B.md"]);
  const out = forge(root, home, "pending", "--drop");
  assert.match(out.stdout, /nothing to drop/u);
  assert.match(forge(root, home, "pending").stdout, /2 file\(s\) recorded/u, "and the record is still there");
});

/* A path a rename took out of the tree was reported by every later consult as work owed, and the
   only verb against it declined for not being staged (ISS-952). */
const logging = (home, root, sent) => writeFileSync(join(home, "forge", "codex-log.jsonl"), `${JSON.stringify({
  kind: "consult", id: "c1", ok: true, root, at: new Date(Date.now() - 300_000).toISOString(),
  reply: "no blocker found", files: sent.map((one) => one.rel), sent,
})}\n`);

test("a recorded path the tree no longer holds leaves the record when the listing reads it", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/GONE.md"]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the staged write is still asked for");
  assert.match(out.stdout, /no longer in the tree, so out of the record now: docs\/GONE\.md/u);
  assert.doesNotMatch(forge(root, home, "pending").stdout, /GONE/u, "and the next call is not offered it");
});

test("the record's own listing keeps a file written back to the read bytes apart from what a commit is asked for", () => {
  const root = tree();
  const home = state(root, ["docs/A.md", "docs/C.md"]);
  logging(home, root, [{ rel: "docs/C.md", sha: digest(readFileSync(join(root, "docs/C.md"), "utf8")), clipped: false }]);
  const out = forge(root, home, "pending");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /^docs\/A\.md$/mu, "the write nobody read is asked for");
  assert.match(out.stdout, /^recorded and read at the bytes a commit would carry, so none is held for them: docs\/C\.md$/mu);
  assert.doesNotMatch(out.stdout.split("what a commit made now")[0], /docs\/C\.md/u, "and it is not in the demand");
});

/* Reviewed bytes on disk with the unread write still in the index: `pending` and the gate have to
   answer alike, or a caller is told no commit is held for a file the next commit is refused for. */
test("a file whose unread write is staged is asked for however the working copy reads", () => {
  const root = tree();
  const home = state(root, ["docs/A.md"]);
  const staged = readFileSync(join(root, "docs/A.md"), "utf8");
  logging(home, root, [{ rel: "docs/A.md", sha: digest("docs/A.md\n"), clipped: false }]);
  writeFileSync(join(root, "docs/A.md"), "docs/A.md\n");
  assert.deepEqual(apartFrom(root, ["docs/A.md"]), ["docs/A.md"], `the index still holds ${staged.trim()}`);
  const out = forge(root, home, "pending");
  assert.match(out.stdout, /^docs\/A\.md$/mu, "so the commit is still asked for it");
  assert.doesNotMatch(out.stdout, /no commit is held/u, "and it is not called read");
});

/* A base that moved under the branch parts from it, and a deletion both sides made is no change
   against the ref while being real work against the point they parted at. */
test("what no write stands behind is asked of the base the review was taken from", () => {
  const root = realpathSync(tempRoom("codex-parted-"));
  rooms.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  for (const one of ["docs/A.md", "docs/C.md"]) writeFileSync(join(root, one), `${one}\n`);
  git(root, "init", "-q", ".");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "both");
  const here = git(root, "rev-parse", "--abbrev-ref", "HEAD").trim();
  git(root, "checkout", "-qb", "side");
  git(root, "rm", "-q", "docs/C.md");
  git(root, "commit", "-qm", "gone on side");
  git(root, "checkout", "-q", here);
  git(root, "rm", "-q", "docs/C.md");
  git(root, "commit", "-qm", "gone here too");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "side"), ["docs/C.md"], "against the ref it is no change");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "side", true), [], "against the parting the deletion is work");
  assert.deepEqual(goneFrom(root, ["docs/C.md"], "no-such-ref"), [], "and a git that cannot answer drops none");
});

/* A staged addition whose working copy was removed is in no diff against HEAD and in no untracked
   list, so absence alone read it as a path no write stands behind (consult c39aa9 F1). */
test("a staged addition is work nobody read, whatever became of its working copy", () => {
  const root = tree();
  writeFileSync(join(root, "docs/NEW.md"), "brand new\n");
  git(root, "add", "docs/NEW.md");
  rmSync(join(root, "docs/NEW.md"));
  assert.deepEqual(goneFrom(root, ["docs/NEW.md"]), [], "the index still holds the addition");
  const home = state(root, ["docs/NEW.md"]);
  const out = forge(root, home, "pending");
  assert.match(out.stdout, /^docs\/NEW\.md$/mu, "so a commit made now is asked for it");
  assert.doesNotMatch(out.stdout, /out of the record now/u, "and nothing dropped it");
});
