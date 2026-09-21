/* The release states on the remote the version it shipped, because a box's own install record says
   which copies are on it and never which is current (ISS-1324). These are `ship`'s half of that:
   `run-script.test.mjs` holds the rest of the release path and `tools/services/doctor/release.test.mjs` the reading. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, git, landIn, LAST_STEP, pushed, ROOT, runIn } from "../run-fixtures.mjs";

const released = (name) => {
  const { at, work } = pushed(name);
  landIn(work, "one.txt", 1, "the change");
  return { at, work, origin: join(at, "origin.git") };
};

const tagsOn = (origin) => git(ROOT, "ls-remote", "--tags", origin).stdout;

test("the release leaves the version it shipped readable on the remote without a fetch", () => {
  const { work, origin } = released("tagged");
  const run = runIn(work, ["ship"], BARE);
  assert.match(run.stdout, /origin carries v1\.0\.1 at [0-9a-f]{7}/u, run.stdout);
  const held = tagsOn(origin);
  assert.match(held, /refs\/tags\/v1\.0\.1/u, `the remote states no version:\n${held}`);
  assert.equal(held.split(/\s+/u)[0], git(work, "rev-parse", "HEAD").stdout.trim(),
    "the tag names a commit other than the one the release shipped");
});

/* The branch push and the tag push are two receives, so a hook refusing tags leaves the first alone. */
const refusesTags = (origin) => {
  const at = join(origin, "hooks", "pre-receive");
  writeFileSync(at, "#!/bin/sh\nwhile read old new ref; do\n  case \"$ref\" in refs/tags/*) "
    + "echo 'tags are refused here' >&2; exit 1;; esac\ndone\nexit 0\n");
  chmodSync(at, 0o755);
};

test("a release that cannot publish its version stops and names the resume that publishes it", () => {
  const { work, origin } = released("tag-refused");
  refusesTags(origin);
  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 7 \(push to origin\/master\)/u, run.stderr);
  assert.match(run.stderr, /the branch is pushed and v1\.0\.1 is not/u, run.stderr);
  assert.match(run.stderr, /ship --from 7/u, run.stderr);
  assert.ok(!run.stdout.includes("Released."), "a release whose version nobody can read is not released");
});

test("a release re-run over a tag the remote already holds at that commit is not refused", () => {
  const { work, origin } = released("tag-again");
  runIn(work, ["ship"], BARE);
  const before = tagsOn(origin);
  const again = runIn(work, ["ship", "--from", "7"], BARE);
  assert.match(again.stdout, /origin already states 1\.0\.1, at [0-9a-f]{7}/u, again.stdout);
  assert.match(again.stderr, /stopped at step 9 \(install/u, `the push step refused a tag already its own:\n${again.stderr}`);
  assert.equal(tagsOn(origin), before, "a re-run moved the tag it had already published");
});

/* The row asks the remote for the version and never for the commit under it, so a tag already
   carrying this version states the right thing and a release recovered after a reset is not stranded. */
test("a version the remote already states at another commit is said and not published again", () => {
  const { work, origin } = released("tag-elsewhere");
  git(origin, "tag", "v1.0.1", "master");
  const before = tagsOn(origin);
  const run = runIn(work, ["ship"], BARE);
  assert.match(run.stdout, /origin states 1\.0\.1 at [0-9a-f]{7}, which this release is not/u, run.stdout);
  assert.match(run.stderr, /stopped at step 9 \(install/u, `the publication refused a version already stated:\n${run.stderr}`);
  assert.equal(tagsOn(origin), before, "a tag this release did not write was moved");
});

/* A resume aimed past the push step skips the publication, which is why the last step asks again. */
test("a release whose published version went missing stops at its last step", () => {
  const { work, origin } = released("tag-gone");
  runIn(work, ["ship"], BARE);
  git(origin, "tag", "-d", "v1.0.1");
  const run = runIn(work, ["ship", "--from", String(LAST_STEP)], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /origin states no 1\.0\.1/u, run.stderr);
  assert.match(run.stderr, /ship --from 7/u, run.stderr);
});

/* The last step's own read goes through the same join as the push step's, so a resume aimed at it
   alone — skipping the push, which already published a real tag from the right directory — still
   meets a manifest that is not where this tree looks for it, and must not read that the same way it
   would read a release that published nothing (ISS-2025). */
test("a release's last step refuses a version it cannot read from a subdirectory, even where the remote already carries the real tag", () => {
  const { work, origin } = released("tag-subdir-last");
  runIn(work, ["ship"], BARE);
  const before = tagsOn(origin);
  assert.match(before, /refs\/tags\/v1\.0\.1/u, `the release ahead of this case did not tag:\n${before}`);

  const run = runIn(work, ["ship", "--from", String(LAST_STEP)], BARE, "plugin");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 10 \(the copy the next session loads\)/u, run.stderr);
  assert.ok(run.stderr.includes(`this tree's package.json names no version, read from `
    + `${join(work, "plugin", "package.json")}`),
    `the refusal does not name the path it joined:\n${run.stderr}`);
  /* The remote genuinely carries the tag here — the release ahead of this case published it from
     the right directory — so a refusal that claimed "none was published" would be false, not merely
     unhelpful: this tree's own failed read cannot tell published from unpublished at all. */
  assert.ok(!run.stderr.includes("none was published"),
    `the refusal claims certainty about publication a failed local read cannot have:\n${run.stderr}`);
  assert.equal(tagsOn(origin), before, "a read that failed for the wrong directory moved a tag it never read");
});

/* `--from 7` skips step 6, the only one of the four sites that refuses, and lands straight on the
   two silent ones: `tree` is `process.cwd()`, so a resume typed from a subdirectory joins a manifest
   that is not there, reads no version and — before this fix — logged past it as though the release
   had nothing to publish, while the branch it just pushed sat on the remote with no tag naming it
   (ISS-2025). This is that resume, from the wrong directory, proving the run now refuses instead of
   reporting the release the tag never named. */
test("a ship resumed with --from 7 from a subdirectory refuses a version it cannot read, rather than pushing an untagged release to the remote and saying nothing", () => {
  const { work, origin } = released("tag-subdir");
  /* The first attempt never reaches the version step at all — exactly the state a stalled ship
     leaves behind, and the one `--from 7` is for. */
  const unreachable = join(work, "no-such-origin.git");
  git(work, "remote", "set-url", "origin", unreachable);
  const first = runIn(work, ["ship"], BARE);
  assert.equal(first.status, 1, first.stdout);
  assert.match(first.stderr, /stopped at step 2 \(fetch origin\/master\)/u, first.stderr);

  git(work, "remote", "set-url", "origin", origin);
  const before = git(origin, "rev-parse", "master").stdout.trim();
  const run = runIn(work, ["ship", "--from", "7"], BARE, "plugin");

  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 7 \(push to origin\/master\)/u, run.stderr);
  assert.ok(run.stderr.includes(`this tree's package.json names no version to publish, read from `
    + `${join(work, "plugin", "package.json")}`),
    `the refusal does not name the path it joined:\n${run.stderr}`);
  assert.ok(!run.stdout.includes("Released."), `a release nobody could tag reported success:\n${run.stdout}`);
  assert.doesNotMatch(tagsOn(origin), /refs\/tags\/v1\.0\.1/u,
    `an untagged release is stated as tagged on the remote:\n${tagsOn(origin)}`);
  /* The version is read and judged before the push, not after, so a tree that cannot say what it is
     about to publish never reaches the remote at all — nothing here needs rolling back. */
  assert.equal(git(origin, "rev-parse", "master").stdout.trim(), before,
    "a version this tree could not read pushed the branch anyway");
});
