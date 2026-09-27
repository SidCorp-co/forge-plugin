/* The ISS-1331 run armed a landing on a branch it never pushed, and the landing's first fetch failed
   reading as a network fault (ISS-2662). The arming capture asks origin now, and the plain capture
   Phase 4 takes before the first push does not. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { BUILDER, checkpoint, declared, field, git, pushedRepo, ran, state } from "./fixture.mjs";

const BRANCH = "iss-673-6";
const PUSH = `  git push -u origin ${BRANCH}\n  forge claim ISS-673 --pushed --ready`;

const room = (name) => {
  const made = pushedRepo(["one.mjs"], `unpushed-${name}-`);
  declared(made, {});
  field(null, null);
  return made;
};
const headOf = (at) => git(at, "rev-parse", "HEAD").stdout.trim();
const said = (run) => `${run.stdout}${run.stderr}`;

test("a ready capture on a branch origin does not hold is refused, writes no checkpoint, and prints the push", async () => {
  const at = room("absent");
  git(at, "push", "-q", "origin", "--delete", BRANCH);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, at);
  assert.equal(run.status, 1, said(run));
  assert.equal(checkpoint(), null, "the checkpoint stands where it was");
  assert.ok(run.stderr.includes(`origin holds no branch of that name`), run.stderr);
  assert.ok(run.stderr.includes(`\n${PUSH}`), run.stderr);
});

test("a ready capture whose head origin does not hold at the branch is refused naming both heads", async () => {
  const at = room("behind");
  const pushed = headOf(at);
  writeFileSync(join(at, "one.mjs"), "a later change\n");
  git(at, "commit", "-qam", "not pushed");
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, at);
  assert.equal(run.status, 1, said(run));
  assert.equal(checkpoint(), null, "the checkpoint stands where it was");
  assert.ok(run.stderr.includes(`\`${BRANCH}\` at ${headOf(at).slice(0, 7)}, and origin holds it at ${pushed.slice(0, 7)}`), run.stderr);
  assert.ok(run.stderr.includes(`\n${PUSH}`), run.stderr);
});

test("a ready capture origin holds at the head writes the ready checkpoint at that head", async () => {
  const at = room("held");
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, at);
  assert.equal(run.status, 0, said(run));
  assert.equal(checkpoint()?.state, "ready");
  assert.equal(checkpoint()?.head, headOf(at));
  assert.equal(checkpoint()?.branch, BRANCH);
});

test("a ready capture where origin does not answer is refused with git's reason and writes nothing", async () => {
  const at = room("silent");
  git(at, "remote", "set-url", "origin", join(at, "no-such-origin.git"));
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, at);
  assert.equal(run.status, 1, said(run));
  assert.equal(checkpoint(), null, "no checkpoint was written");
  assert.match(run.stderr, /origin whether it holds `iss-673-6` at [0-9a-f]{7}, and it did not answer: \S.*\. Nothing was written\./u, run.stderr);
  assert.match(run.stderr, /no-such-origin\.git|Could not read from remote repository/u, "git's own reason");
});

test("a plain capture on a branch origin does not hold still writes the worklog", async () => {
  const at = room("plain");
  git(at, "push", "-q", "origin", "--delete", BRANCH);
  const run = await ran(["claim", "ISS-673", "--pushed"], BUILDER, at);
  assert.equal(run.status, 0, said(run));
  assert.equal(state.issues[0].sessionContext?.worklog?.head, headOf(at));
  assert.equal(state.issues[0].sessionContext?.worklog?.branch, BRANCH);
  assert.equal(checkpoint(), null, "and arms nothing");
});
