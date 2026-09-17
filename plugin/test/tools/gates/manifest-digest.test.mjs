/* What a file a release writes a version into hashes to, on the gate runner's own scratch checkout:
   the number alone moving, the number disagreeing between two of those files, and a dependency moving
   beside it. Driven at the ledger's own derivation and never through a release: what a release does
   with these digests is the ship's, and a case that cut one would cost minutes and prove less. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { digestIn, forgetContent, ledgerFor } from "../../../../tools/gates/ledger.mjs";
import { gateSteps, STEPS, TEST_FILE } from "../../../../tools/gates/steps.mjs";
import { under } from "../../../../tools/gates/scope.mjs";
import { gitFiles } from "../../../../tools/checkout.mjs";
import { git, landed, run, scratch, write } from "./scratch.mjs";

const MANIFEST = join("plugin", ".claude-plugin", "plugin.json");
const LOCK = "package-lock.json";
const PACKAGE = "package.json";
const SOURCE = join("plugin", "src", "one.mjs");

const json = (held) => `${JSON.stringify(held, null, 2)}\n`;
const read = (work, path) => JSON.parse(readFileSync(join(work, path), "utf8"));

const manifestAt = (version) => json({ name: "scratch", version });

/* Shaped like a real lock file: the root package's second copy of the number a release writes, and a
   dependency's own, which is content like any other. */
const lockAt = (version, dep = "4.10.1") => json({
  name: "scratch", version,
  packages: { "": { name: "scratch", version }, "node_modules/dep": { version: dep } },
});

/* The memo is cleared first, so a second reading of a tree that moved under it is a reading and not
   a replay of the first. */
const ledgerAt = (work) => {
  forgetContent();
  const files = gitFiles(work);
  return ledgerFor(gateSteps(files.filter((one) => TEST_FILE.test(one))),
    { root: work, files, runner: join(work, "tools", "gates.mjs") }).entries;
};

const digests = (work) => ledgerAt(work).map((step) => `${step.label} ${step.digest}`);
const greenLabels = (work) => ledgerAt(work).filter((step) => step.green).map((step) => step.label);

const bump = (work, version, { manifest = version, dep = "4.10.1" } = {}) => {
  write(work, PACKAGE, json({ ...read(work, PACKAGE), version }));
  write(work, LOCK, lockAt(version, dep));
  write(work, MANIFEST, manifestAt(manifest));
  git(work, "add", "-A");
  git(work, "commit", "-m", "chore(release)");
};

/* A checkout carrying the three files a release writes, sitting on master with nothing differing,
   which is the head a release is made on. */
const planted = (name) => {
  const { at, work } = scratch(name);
  landed(work, LOCK, lockAt("1.0.0"));
  landed(work, MANIFEST, manifestAt("1.0.0"));
  git(work, "checkout", "master");
  git(work, "merge", "work");
  return { at, work };
};

/* The same tree with the record holding every step of the table green at that content, which costs
   the one gate run the cases about a skip need and the cases about a digest do not. */
const gated = (name) => {
  const { at, work } = planted(name);
  const said = run(work);
  assert.equal(said.status, 0, said.stdout + said.stderr);
  assert.match(said.stdout, /the full gate — nothing differs from master/u, said.stdout);
  assert.equal(greenLabels(work).length, STEPS.length, "the gate left the whole table green");
  return { at, work };
};

test("a release number moving through all three files leaves every step of the record green", () => {
  const { at, work } = gated("version-only");
  try {
    bump(work, "1.0.1");
    assert.equal(greenLabels(work).length, STEPS.length,
      "a tree whose only change is the number a release writes reads green from the record it already had");
    const again = run(work);
    assert.match(again.stdout,
      new RegExp(`ledger: ${STEPS.length} of ${STEPS.length} step\\(s\\) green already`, "u"), again.stdout);
    assert.match(again.stdout, /All 0 gate step\(s\) passed/u, again.stdout);
    assert.equal(again.status, 0, again.stdout + again.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a dependency added beside that number leaves no step of the record green", () => {
  const { at, work } = gated("dependency");
  try {
    bump(work, "1.0.1", { dep: "4.11.0" });
    assert.deepEqual(greenLabels(work), [],
      "a lock file that moved in more than the number keys every step afresh");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a manifest left behind at the number the others moved past spends every step that reads it", () => {
  const { at, work } = gated("behind");
  try {
    const reads = STEPS.filter((step) => step.reads.some((claim) => under(MANIFEST, claim)))
      .map((step) => step.label);
    assert.ok(reads.length > 0, `no step of the table reads ${MANIFEST}, so this case covers nothing`);
    bump(work, "1.0.1", { manifest: "1.0.0" });
    const green = new Set(greenLabels(work));
    assert.deepEqual(reads.filter((label) => green.has(label)), [],
      "a file disagreeing with its package about the number keeps that number in every digest reading it");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("two trees alike but for the number they are at derive the same digest for every step", () => {
  const one = planted("at-one");
  const other = planted("at-three");
  try {
    bump(one.work, "1.0.0");
    bump(other.work, "3.0.0");
    assert.deepEqual(digests(other.work), digests(one.work),
      "no step's digest holds the number a release writes, so the two trees key alike");
  } finally {
    for (const room of [one.at, other.at]) rmSync(room, { recursive: true, force: true });
  }
});

/* Watched failing: the same pair with a byte outside those locations moved, so a comparison matching
   everything would pass the case above for the wrong reason. */
test("and differ where anything outside those locations moved", () => {
  const one = planted("beside-one");
  const other = planted("beside-three");
  try {
    bump(one.work, "1.0.0");
    bump(other.work, "3.0.0", { dep: "4.11.0" });
    assert.notDeepEqual(digests(other.work), digests(one.work),
      "a dependency moved with the number is content, and moves the digest");
  } finally {
    for (const room of [one.at, other.at]) rmSync(room, { recursive: true, force: true });
  }
});

test("a file outside the ones a release writes digests as what is in it", () => {
  const { at, work } = planted("bytes");
  try {
    const was = digestIn(work, SOURCE);
    write(work, SOURCE, "export const one = 11;\n");
    assert.notEqual(digestIn(work, SOURCE), was, "an ordinary file digests as its own content");
    const held = digestIn(work, PACKAGE);
    write(work, PACKAGE, json({ ...read(work, PACKAGE), version: "9.9.9" }));
    assert.equal(digestIn(work, PACKAGE), held, "and the number a release writes is out of the manifest's");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
