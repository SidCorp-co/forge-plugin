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
