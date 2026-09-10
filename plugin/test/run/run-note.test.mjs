/* What `ship --note` may say about the version. The number is chosen inside the step the flag is read for, from what the remote carries, so a caller naming one names it from before there was one to name — twice on master under a version another release had already taken, ee8d6ce and 0606e6a (ISS-965).
   A subject naming no version is left exactly as given, which is the half a refusal must not cost. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, GATE, git, landIn, pushed, runIn } from "./run-fixtures.mjs";

/* The release files a scratch checkout has: `package-lock.json` is not one, and asserting a file that is never there proves nothing about what a refusal left alone. */
const RELEASE = ["package.json", join("plugin", ".claude-plugin", "plugin.json")];

/** A remote at 1.0.0 and a change on top, so the release owes 1.0.1 and every note is read against a number the case knows. */
const owing = (name) => {
  const { at, work } = pushed(name);
  landIn(work, "one.txt", 1, "the change");
  return { at, work };
};

const subject = (work, rev = "HEAD") => git(work, "log", "--format=%s", "-1", rev).stdout.trim();

const versionIn = (work) => JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version;

test("a note naming the version below the one the step takes is refused, and both numbers are named", () => {
  const { work } = owing("note-below");
  const run = runIn(work, ["ship", "--note", "1.0.0, the release this note guessed"], BARE);

  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--note names 1\.0\.0 and this release takes 1\.0\.1/u, run.stderr);
  assert.match(run.stderr, /stopped at step 6 \(a version above origin\/master\)/u, run.stderr);
  assert.match(run.stderr, /ship --from 6/u, `the refusal named no way back:\n${run.stderr}`);
});

/* Judged before `npm version` writes: the gate's pass record is keyed on file content and `acrossVersion` re-keys it onto the bumped content only once the bump returns, so a refusal thrown past the write would leave a manifest no pass answers for and charge the resume a whole gate for a one-word fix. */
test("that refusal leaves the release files, the index and HEAD where the step found them", () => {
  const { work } = owing("note-unmoved");
  const was = {
    head: git(work, "rev-parse", "HEAD").stdout.trim(),
    status: git(work, "status", "--porcelain").stdout,
    files: RELEASE.map((one) => readFileSync(join(work, one), "utf8")),
  };

  const run = runIn(work, ["ship", "--note", "1.0.0, the release this note guessed"], BARE);
  assert.equal(run.status, 1, run.stdout);

  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), was.head, "the refusal moved HEAD");
  assert.equal(git(work, "status", "--porcelain").stdout, was.status, "the refusal left the index moved");
  assert.deepEqual(RELEASE.map((one) => readFileSync(join(work, one), "utf8")), was.files,
    "the refusal wrote a release file, so the content the gate's record is keyed on moved");
});

test("a note naming no version is the version commit's subject exactly as given", () => {
  const { work } = owing("note-plain");
  const said = "the clause the ceiling reads comes off the record";

  const run = runIn(work, ["ship", "--note", said], BARE);
  assert.equal(subject(work), said, run.stderr);
  assert.equal(versionIn(work), "1.0.1", `the release took no version:\n${run.stdout}`);
});

test("a note naming the version the step does take stands, bare or v-prefixed", () => {
  for (const [name, said] of [["note-bare", "1.0.1, the release this note names"],
    ["note-prefixed", "v1.0.1, the release this note names"]]) {
    const { work } = owing(name);
    const run = runIn(work, ["ship", "--note", said], BARE);
    assert.equal(subject(work), said, run.stderr);
  }
});

/* Every triple is read and not the first: a subject opening with the right number and then naming a wrong one still puts a wrong number where a person reads the release from. */
test("a note whose second triple disagrees is refused, whatever the first one says", () => {
  const { work } = owing("note-second");
  const was = git(work, "rev-parse", "HEAD").stdout.trim();

  const run = runIn(work, ["ship", "--note", "1.0.1, superseding the 1.0.0 nobody installed"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--note names 1\.0\.0 and this release takes 1\.0\.1/u, run.stderr);
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), was, "the refusal made a commit");
});

/* A bound that read any dot as a fourth component let a sentence past on either side: `Release 1.0.0.` and `Release...1.0.0` both named no version and the wrong number went on the commit behind the punctuation. Both were review findings. */
test("a triple against sentence punctuation is the version it names, either side", () => {
  for (const [name, said] of [["note-stop", "Release 1.0.0."], ["note-ellipsis", "Release...1.0.0"]]) {
    const { work } = owing(name);
    const was = git(work, "rev-parse", "HEAD").stdout.trim();

    const run = runIn(work, ["ship", "--note", said], BARE);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /--note names 1\.0\.0 and this release takes 1\.0\.1/u, run.stderr);
    assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), was, "the refusal made a commit");
  }
});

/* The refusal is only worth its cost if the command it comes with clears it, which is the half a resume pays for: nothing was written, so the gate's record still answers for this content. */
test("the resume the refusal names releases under the note it was given instead", () => {
  const { work } = owing("note-resumed");
  const refused = runIn(work, ["ship", "--note", "1.0.0, the release this note guessed"], BARE);
  assert.equal(refused.status, 1, refused.stdout);

  const said = "the clause this run wrote once it knew better";
  const run = runIn(work, ["ship", "--from", "6", "--note", said], BARE);
  assert.equal(subject(work), said, run.stderr);
  assert.equal(versionIn(work), "1.0.1", `the resume took no version:\n${run.stdout}`);
});

/* The under-reading the issue's second rule asks for: refusing these costs the flag the subjects it is for. */
test("a two-part number and a triple inside a longer numeric run name no version", () => {
  const { work } = owing("note-shapes");
  const said = "the 3.35 ceiling, the 1.2.3.4 run and the 1.0.0.1 build are numbers about the change";

  const run = runIn(work, ["ship", "--note", said], BARE);
  assert.equal(subject(work), said, run.stderr);
});

/* `nextVersion` returns null where this tree is already above the remote and the step commits the manifest it finds instead. Both numbers are in hand there too, so the note is judged there too. */
test("a note is refused where the step computes no new number and commits the manifest it finds", () => {
  const { work } = owing("note-ahead");
  runIn(work, ["ship"], BARE);
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.2", type: "module", scripts: { check: GATE } }, null, 2));

  const run = runIn(work, ["ship", "--from", "6", "--note", "1.0.1, the number this tree left behind"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--note names 1\.0\.1 and this release takes 1\.0\.2/u, run.stderr);
});

test("a release given no note carries the composed subject, which is right by construction", () => {
  const { work } = owing("note-none");

  const run = runIn(work, ["ship"], BARE);
  assert.equal(subject(work), "chore(release): 1.0.1, so the installed copy is this head", run.stderr);
});
