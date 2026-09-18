/* What a file's permission is worth to the gate's digest, on the runner's own scratch checkouts: the
   disk's bit moving under a fixed index, the index's moving under a fixed disk, a byte moving beside
   neither, and a path git stops recording at all. Driven at the ledger's own derivation, because what
   a gate does with these digests is `manifest-digest.test.mjs`'s and costs minutes to ask twice. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { digestIn, forgetContent, ledgerFor } from "../../../../tools/gates/ledger.mjs";
import { gateSteps, STEPS, TEST_FILE } from "../../../../tools/gates/steps.mjs";
import { under } from "../../../../tools/gates/scope.mjs";
import { gitFiles } from "../../../../tools/checkout.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { git, scratch, write } from "./scratch.mjs";

const SOURCE = join("plugin", "src", "one.mjs");

// The memo is cleared first, so a tree that moved under it is read again rather than replayed.
const digests = (work) => {
  forgetContent();
  const files = gitFiles(work);
  return ledgerFor(gateSteps(files.filter((one) => TEST_FILE.test(one))),
    { root: work, files, runner: join(work, "tools", "gates.mjs") }).entries
    .map((step) => `${step.label} ${step.digest}`);
};

const readingSource = () => {
  const labels = STEPS.filter((step) => step.reads.some((claim) => under(SOURCE, claim)))
    .map((step) => step.label);
  assert.ok(labels.length > 0, `no step of the table reads ${SOURCE}, so these cases cover nothing`);
  return labels;
};

const movedFor = (before, after) => {
  const was = new Map(before.map((one) => one.split(" ")));
  return after.map((one) => one.split(" ")).filter(([label, digest]) => was.get(label) !== digest)
    .map(([label]) => label);
};

const recordedMode = (work, path) =>
  git(work, "ls-files", "-s", "--", path).stdout.trim().split(" ")[0];

/* Watched failing: this is the defect itself. Two trees of one content whose umasks left different
   bits on the disk shared one gate ledger and could read nothing of each other's in it (ISS-1739). */
test("two trees of one content whose disks disagree about an execute bit derive the same digest for every step", () => {
  const one = scratch("permission-bare");
  const other = scratch("permission-marked");
  try {
    chmodSync(join(other.work, SOURCE), 0o755);
    assert.equal(recordedMode(other.work, SOURCE), recordedMode(one.work, SOURCE),
      "the case is about two trees whose index agrees and whose disk does not, so the index has to agree");
    assert.deepEqual(digests(other.work), digests(one.work),
      "a permission the repository does not record is no part of what a step's inputs hashed to");
  } finally {
    for (const room of [one.at, other.at]) rmSync(room, { recursive: true, force: true });
  }
});

/* Watched failing: without it, dropping the permission outright passes the case above for the wrong
   reason. 69031648 changed one file's mode and nothing else, and the suite spawns files by path. */
test("a permission the index records moving alone moves the digest of every step that reads the file", () => {
  const { at, work } = scratch("permission-recorded");
  try {
    const reads = readingSource();
    const before = digests(work);
    git(work, "update-index", "--chmod=+x", "--", SOURCE);
    git(work, "commit", "-m", "the source is executable now");
    assert.equal(recordedMode(work, SOURCE), "100755", "the index records the new permission");
    assert.deepEqual(movedFor(before, digests(work)).sort(), [...reads].sort(),
      "what git records about a file is what every step reading it keys on");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* Watched failing: a digest reading the permission and nothing else would pass both cases above. */
test("a byte moving under a fixed permission moves the digest of every step that reads the file", () => {
  const { at, work } = scratch("permission-bytes");
  try {
    const reads = readingSource();
    const before = digests(work);
    write(work, SOURCE, "export const one = 11;\n");
    git(work, "commit", "-am", "the source moved");
    assert.deepEqual(movedFor(before, digests(work)).sort(), [...reads].sort(),
      "content is content whatever the permission beside it says");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* Watched failing: a path the index does not hold has no recorded permission at all, and reading it
   as an unexecutable one would key a file git has stopped recording where a recorded 100644 keys. */
test("a file git stops recording does not key where it keyed while it was recorded", () => {
  const { at, work } = scratch("permission-dropped");
  try {
    const was = digestIn(work, SOURCE);
    git(work, "rm", "--cached", "--", SOURCE);
    git(work, "commit", "-m", "the source is nobody's now");
    forgetContent();
    assert.notEqual(digestIn(work, SOURCE), was,
      "a repository that records nothing about a file says something different from one that records 100644");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* The permission comes from git, so a root git will not answer for is a root with no permissions to
   read, and a digest that guessed one would bank a pass under a key nothing else derives. */
test("a root that is no checkout is refused rather than digested, and the refusal names the way past it", () => {
  const at = tempRoom("permission-unread-");
  try {
    mkdirSync(join(at, "plugin", "src"), { recursive: true });
    writeFileSync(join(at, SOURCE), "export const one = 1;\n");
    assert.throws(() => digestIn(at, SOURCE), /--full/u,
      "a listing git refused leaves every digest of that tree unknown, and says so");
  } finally {
    forgetContent();
    rmSync(at, { recursive: true, force: true });
  }
});
