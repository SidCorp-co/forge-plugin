/* ISS-467. A wave's agents share the dispatching session's id, and a delegated run is handed no
   variable to say otherwise, so the tree it was given is what names it. The gate has to read the
   same tree the write will stand in: its own directory is the session's, not the command's. */
import assert from "node:assert/strict";
import test from "node:test";
import { accessSync, chmodSync, constants, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

import { RUN_ID, besideGit, gitDirAt, runHeldWhere, runIdAt } from "../../../src/resolve/session/run-id.mjs";
import { mintRunId } from "../../../../tools/run/workspace/run-id.mjs";

const root = () => {
  const at = tempRoom("forge-run-id-");
  mkdirSync(join(at, "checkout", ".git", "worktrees", "wt-one"), { recursive: true });
  mkdirSync(join(at, "wt-one", "deep", "deeper"), { recursive: true });
  writeFileSync(join(at, "wt-one", ".git"), `gitdir: ${join(at, "checkout", ".git", "worktrees", "wt-one")}\n`);
  return at;
};

const idIn = (at, id) =>
  writeFileSync(join(at, "checkout", ".git", "worktrees", "wt-one", RUN_ID), `${id}\n`);

test("the git directory is read off the disk: a checkout's own, and the one a worktree's .git file names", () => {
  const at = root();
  assert.equal(gitDirAt(join(at, "checkout")), join(at, "checkout", ".git"));
  assert.equal(gitDirAt(join(at, "wt-one")), join(at, "checkout", ".git", "worktrees", "wt-one"));
  assert.equal(gitDirAt(join(at, "wt-one", "deep", "deeper")),
    join(at, "checkout", ".git", "worktrees", "wt-one"));
  assert.equal(gitDirAt(at), null);
});

test("a relative gitdir resolves against the file that named it, not against the process", () => {
  const at = root();
  writeFileSync(join(at, "wt-one", ".git"), "gitdir: ../checkout/.git/worktrees/wt-one\n");
  assert.equal(gitDirAt(join(at, "wt-one", "deep")),
    join(at, "checkout", ".git", "worktrees", "wt-one"));
});

test("the id answers from the worktree's root and from a subdirectory of it, and a tree with no file names none", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  assert.equal(runIdAt(join(at, "wt-one")), "iss-467-abcd1234");
  assert.equal(runIdAt(join(at, "wt-one", "deep", "deeper")), "iss-467-abcd1234");
  assert.equal(runIdAt(join(at, "checkout")), null);
  assert.equal(besideGit(join(at, "wt-one"), RUN_ID),
    join(at, "checkout", ".git", "worktrees", "wt-one", RUN_ID));
});

test("an id minted by the tools is the id the plugin resolves, from the root and from below it", () => {
  const at = root();
  const minted = mintRunId(join(at, "wt-one"), "ISS-467");
  assert.match(minted, /^iss-467-[0-9a-f]{8}$/u);
  assert.equal(runIdAt(join(at, "wt-one")), minted);
  assert.equal(runIdAt(join(at, "wt-one", "deep")), minted);
});

const event = (command, cwd) => ({ cwd, tool_input: { command } });

test("the gate reads the tree the write will stand in, and not the tree the hook itself stands in", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  const wt = join(at, "wt-one");
  const here = join(at, "checkout");
  for (const command of [
    `cd ${wt} && ./plugin/bin/forge comment ISS-467 -`,
    `cd ${wt}; ./plugin/bin/forge comment ISS-467 -`,
    `cd ${wt} && echo hi && /a/b/plugin/bin/forge issue ISS-467`,
  ]) {
    assert.deepEqual(runHeldWhere(event(command, here)), { id: "iss-467-abcd1234", at: wt }, command);
  }
});

test("a command standing where it started reads that tree, and one outside every checkout reads none", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  assert.equal(runHeldWhere(event("./plugin/bin/forge issue ISS-467", join(at, "wt-one"))).id,
    "iss-467-abcd1234");
  assert.equal(runHeldWhere(event("./plugin/bin/forge issue ISS-467", join(at, "checkout"))).id, null);
  assert.equal(runHeldWhere(event("echo nothing here", join(at, "wt-one"))).id, "iss-467-abcd1234");
});

test("two `forge` calls standing in trees that answer differently name no id at all", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  const wt = join(at, "wt-one");
  const here = join(at, "checkout");
  assert.equal(runHeldWhere(event(`forge issue ISS-1; cd ${wt} && forge issue ISS-2`, here)).id, null);
  assert.equal(runHeldWhere(event(`cd ${wt} && forge issue ISS-1 && forge issue ISS-2`, here)).id,
    "iss-467-abcd1234");
});

test("a move this reader cannot place names no id rather than the wrong one", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  assert.equal(runHeldWhere(event('cd "$WT" && forge issue ISS-467', join(at, "wt-one"))).id, null);
});

/* The table's own order, read here because the row is this file's and the order is what a run that
   says which run it is, one that only stands somewhere, and one that does neither each get. */
test("the tree's id outranks the wave's, the variable outranks the tree, and a tree naming none moves nothing", async () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  process.env.XDG_CONFIG_HOME = join(at, "a-home");
  const { sessionSourced } = await import("../../../src/resolve/config.mjs");
  const pick = () => ({ id: sessionSourced().id, source: sessionSourced().source });
  const was = { cwd: process.cwd(), asked: process.env.FORGE_SESSION_ID, wave: process.env.CLAUDE_CODE_SESSION_ID };
  try {
    process.env.CLAUDE_CODE_SESSION_ID = "the-whole-wave";
    delete process.env.FORGE_SESSION_ID;
    process.chdir(join(at, "wt-one"));
    assert.deepEqual(pick(), { id: "iss-467-abcd1234", source: "worktree" },
      "a run told nothing holds the id of the tree it was given");
    assert.match(sessionSourced().said, new RegExp(RUN_ID, "u"), "and doctor's row names the file");
    process.env.FORGE_SESSION_ID = "this-run-says-so";
    assert.deepEqual(pick(), { id: "this-run-says-so", source: "asked" }, "a run that says which run it is is believed");
    delete process.env.FORGE_SESSION_ID;
    process.chdir(join(at, "checkout"));
    assert.deepEqual(pick(), { id: "the-whole-wave", source: "inherited" },
      "and a tree naming no run answers exactly as it did before this row existed");
  } finally {
    process.chdir(was.cwd);
    if (was.asked === undefined) delete process.env.FORGE_SESSION_ID;
    else process.env.FORGE_SESSION_ID = was.asked;
    if (was.wave === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = was.wave;
  }
});


/* The three a review of this change found, each one a tree the walk names that the write is not in
   or a read that escapes as an exception instead of an answer. */
test("the walk starts at the physical path, so a symlink into another repository names that one", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  const other = join(at, "other");
  mkdirSync(join(other, ".git"), { recursive: true });
  mkdirSync(join(other, "sub"), { recursive: true });
  writeFileSync(join(other, ".git", RUN_ID), "iss-999-ffff0000\n");
  symlinkSync(join(other, "sub"), join(at, "wt-one", "link"));
  assert.equal(runIdAt(join(at, "wt-one", "link")), "iss-999-ffff0000",
    "lexically this ascends into wt-one, and the write standing there is in the other repository");
  assert.equal(runHeldWhere(event(`cd ${join(at, "wt-one", "link")} && forge issue ISS-467`, join(at, "checkout"))).id,
    "iss-999-ffff0000");
});

test("a .git that stats and will not read answers with no directory rather than throwing", () => {
  const at = root();
  const dot = join(at, "wt-one", ".git");
  chmodSync(dot, 0o000);
  let readable = true;
  try {
    accessSync(dot, constants.R_OK);
  } catch {
    readable = false;
  }
  try {
    assert.doesNotThrow(() => runIdAt(join(at, "wt-one")), "a resolver that throws takes every verb with it");
    if (!readable) assert.equal(gitDirAt(join(at, "wt-one")), null, "and names no directory it could not read");
  } finally {
    chmodSync(dot, 0o644);
  }
});

test("a writer inside a span the shell would run is left unread, not credited to the outer tree", () => {
  const at = root();
  idIn(at, "iss-467-abcd1234");
  const wt = join(at, "wt-one");
  for (const command of [
    `echo "$(cd /elsewhere && forge comment ISS-467 -)"`,
    `forge issue ISS-467 && echo $(cd /elsewhere && forge comment ISS-467 -)`,
  ]) {
    assert.equal(runHeldWhere(event(command, wt)).id, null, command);
  }
});
