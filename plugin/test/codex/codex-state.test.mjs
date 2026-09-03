/* A three-file commit was refused with a demand to consult 726 paths, 243 of them another session's
   uncommitted work in a shared checkout, and `pending --drop` reported a drop that changed nothing:
   the gate compared the tree and the commit carried the index (ISS-70). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { demandIn, demandOf, stagedIn } from "../../src/codex/codex-state.mjs";

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
  const root = realpathSync(mkdtempSync(join(tmpdir(), "codex-demand-")));
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
  const room = mkdtempSync(join(tmpdir(), "codex-demand-bare-"));
  rooms.push(room);
  assert.equal(stagedIn(room), null, "no repository there");
  assert.deepEqual(demandOf(room, ["docs/A.md"], {}), ["docs/A.md"], "so the record stands whole");
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
  const home = mkdtempSync(join(tmpdir(), "codex-demand-home-"));
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
