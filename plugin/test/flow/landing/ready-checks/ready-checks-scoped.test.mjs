/* A ready check reads the change and not the tree: one naming `{files}` is handed the files the branch
   changed against its base (ISS-3192). And a list already green at one head is not run again by the
   next capture there, the case of a batch whose members share a branch (ISS-3191). */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import { BUILDER, CHANGED, checkpoint, declared, field, git, pushedRepo, ran } from "../fixture.mjs";

const LOG = join(tempRoom("ready-checks-scoped-log-"), "ran.log");
const logged = () => {
  try { return readFileSync(LOG, "utf8"); } catch { return ""; }
};
/* A word per test, so no two tests declare one list and the record of one is never the other's. */
const note = (word) => `printf '${word}\\n' >> '${LOG}'`;
const capture = (room) => ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, room);

/* A change that only deletes: the branch moved, and git names no file it still carries. */
const DELETES = pushedRepo([], "ready-checks-deletes-");
git(DELETES, "rm", "-q", "base.txt");
git(DELETES, "commit", "-qm", "the change deletes the base's one file");
git(DELETES, "push", "-q", "origin", "iss-673-6");

test.beforeEach(() => rmSync(LOG, { force: true }));

test("a check naming {files} is handed the files the change touched, and one naming none runs as declared", async () => {
  const scoped = `printf 'scoped %s\\n' {files} >> '${LOG}'`;
  declared(CHANGED, { ready: { checks: [scoped, note("whole-as-declared")] } });
  field(null, null);
  const run = await capture(CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(logged().split("\n").filter(Boolean), ["scoped one.mjs", "scoped two.mjs", "whole-as-declared"],
    "the scoped check read the two changed files and nothing else, and the other ran as written");
  assert.match(run.stderr, /running `printf 'scoped %s\\n' \{files\}[^`]*` over 2 changed file\(s\)/u, run.stderr);
  assert.equal(checkpoint()?.state, "ready");
});

test("a scoped check whose change touches no file is skipped and said to be, and the capture still writes", async () => {
  declared(DELETES, { ready: { checks: [`printf 'empty %s\\n' {files} >> '${LOG}'`, note("unscoped-beside-it")] } });
  field(null, null);
  const run = await capture(DELETES);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(logged().split("\n").filter(Boolean), ["unscoped-beside-it"], "the scoped check ran over nothing");
  assert.match(run.stderr, /skipping `printf 'empty %s\\n' \{files\}[^`]*`: the change touches no file it would be handed/u, run.stderr);
  assert.match(run.stdout, /1 check\(s\) green at [0-9a-f]{7,} — [^\n]*; 1 skipped, the change touching no file they read/u, run.stdout);
});

test("a list green at a head is not run again by the next capture there, and the line names the capture that ran it", async () => {
  declared(CHANGED, { ready: { checks: [note("once-per-head")] } });
  field(null, null);
  const first = await capture(CHANGED);
  assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
  field(null, null);
  const second = await capture(CHANGED);
  assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
  assert.deepEqual(logged().split("\n").filter(Boolean), ["once-per-head"], "the second capture ran the list again");
  assert.match(second.stdout, /ready\.checks: green at [0-9a-f]{7,} already, by the capture of ISS-673 at \S+, so none was run again/u,
    second.stdout);
  assert.equal(checkpoint()?.state, "ready", "and it still writes the checkpoint");
});

test("a green list is read from another worktree of the checkout, so a batch member there runs none of it", async () => {
  declared(CHANGED, { ready: { checks: [note("across-worktrees")] } });
  field(null, null);
  assert.equal((await capture(CHANGED)).status, 0);
  const linked = join(tempRoom("ready-checks-linked-"), "tree");
  git(CHANGED, "worktree", "add", "-q", "-b", "iss-673-7", linked, "HEAD");
  git(linked, "push", "-q", "-u", "origin", "iss-673-7");
  declared(linked, { ready: { checks: [note("across-worktrees")] } });
  field(null, null);
  const there = await capture(linked);
  assert.equal(there.status, 0, `${there.stdout}${there.stderr}`);
  assert.deepEqual(logged().split("\n").filter(Boolean), ["across-worktrees"], "the linked worktree ran the list again");
  assert.match(there.stdout, /green at [0-9a-f]{7,} already, by the capture of ISS-673/u, there.stdout);
});

/* Names git would print quoted: each reaches the check as the file it is. */
const ODD = pushedRepo([], "ready-checks-odd-names-");
const NAMES = ["café.mjs", "it's here.mjs", "tab\there.mjs"];
for (const one of NAMES) writeFileSync(join(ODD, one), "changed\n");
git(ODD, "add", ...NAMES);
git(ODD, "commit", "-qm", "names git quotes");
git(ODD, "push", "-q", "origin", "iss-673-6");

test("a changed file whose name git would quote reaches a scoped check as the name it has", async () => {
  declared(ODD, { ready: { checks: [`for one in {files}; do [ -f "$one" ] && printf 'found %s\\n' "$one" >> '${LOG}'; done`] } });
  field(null, null);
  const run = await capture(ODD);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(logged().split("\n").filter(Boolean).sort(), NAMES.map((one) => `found ${one}`).sort(),
    "every changed file the check was handed is one it found on disk");
});

test("a list declared differently at the same head is another question, and runs", async () => {
  declared(CHANGED, { ready: { checks: [note("first-list")] } });
  field(null, null);
  assert.equal((await capture(CHANGED)).status, 0);
  declared(CHANGED, { ready: { checks: [note("second-list")] } });
  field(null, null);
  assert.equal((await capture(CHANGED)).status, 0);
  assert.deepEqual(logged().split("\n").filter(Boolean), ["first-list", "second-list"]);
});

test("a red list leaves no record, so the next capture at that head runs it again", async () => {
  const red = `${note("red-attempt")}; exit 4`;
  declared(CHANGED, { ready: { checks: [red] } });
  field(null, null);
  assert.notEqual((await capture(CHANGED)).status, 0);
  field(null, null);
  assert.notEqual((await capture(CHANGED)).status, 0);
  /* The fixture sends a refused call twice, so each capture ran it twice: four runs, two captures, no record between. */
  assert.deepEqual(logged().split("\n").filter(Boolean), ["red-attempt", "red-attempt", "red-attempt", "red-attempt"]);
});
