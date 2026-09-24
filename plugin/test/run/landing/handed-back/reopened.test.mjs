/* An issue landed once and reopened on a finding, followed through its second landing: the finished
   checkpoint the first landing left, the `--landed` that cannot end it, the brief naming which head
   each block answers for, the capture that starts the second landing and the landing that merges it.
   Before ISS-2073 the capture was refused at `done` whatever the issue's status, and the checkpoint
   went on naming the first landing's head for good. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BRANCH, BUILDER, KEY, OWNED, builderRan, comments, context, earning, forgetInstall, git, issue, landingRan, ready, seeded,
  sha, tracker, world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = () => landingOf(context());
const said = (run) => `${run.stdout}${run.stderr}`;
const short = (one) => one.slice(0, 7);
const LEASE = () => ({ holder: BUILDER, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] });

/** The first landing, walked to its end, then the finding that sends the change back to be built. */
const reopened = async () => {
  forgetInstall();
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base), earned: earning(head) });
  const first = await landingRan([KEY], work);
  assert.equal(landing().state, "done", first);
  /* What the tracker's reopen and the triage after it leave: the status the finding routed the
     change back to, the checkpoint as a transition leaves it, and the builder's lease on the rework. */
  Object.assign(issue(), { status: "in_progress", sessionContext: { ...context(), lease: LEASE() } });
  return { at, work, first: landing() };
};

/** The fix, a commit on top of the branch the first landing merged, pushed. */
const fixed = (work) => {
  git(work, "checkout", "-q", BRANCH);
  writeFileSync(join(work, OWNED), "the fix the finding asked for\n", { flag: "a" });
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "the fix the finding asked for");
  git(work, "push", "-q", "origin", BRANCH);
  return sha(work, BRANCH);
};

test("a reopened issue's second landing captures the fix over the first one's done, and lands it", async () => {
  const { at, work, first } = await reopened();

  const landed = await builderRan(["claim", KEY, "--landed"]);
  assert.equal(landed.status, 1, said(landed));
  assert.ok(landed.stderr.includes(`\`in_progress\`, being built again`), said(landed));
  assert.ok(landed.stderr.includes(`  forge claim ${KEY} --pushed --ready\n  forge claim ${KEY} --landed`),
    `the capture, then this write:\n${said(landed)}`);
  assert.equal(landing().state, "done", "and nothing was written");

  const tip = fixed(work);
  const pushed = await builderRan(["claim", KEY, "--pushed"]);
  assert.equal(pushed.status, 0, said(pushed));
  const brief = await builderRan(["resume", KEY]);
  assert.equal(brief.status, 0, said(brief));
  assert.ok(brief.stdout.includes(`heads: the checkpoint answers for the landing it names at \`done\`, at `
    + `${short(first.head)}, and the worklog for a later capture, at ${short(tip)}, which the second landing begins with:\n`
    + `      forge claim ${KEY} --pushed --ready`), `the brief says which head each block answers for:\n${brief.stdout}`);
  /* And with no lease on the issue, which is how a finished run leaves it. */
  const { lease, ...unleased } = context();
  issue().sessionContext = unleased;
  const bare = await builderRan(["resume", KEY]);
  issue().sessionContext = { ...unleased, lease };
  assert.equal(bare.status, 0, said(bare));
  assert.ok(bare.stdout.includes(`the worklog for a later capture, at ${short(tip)}, which the second landing begins with:`),
    `the brief says it with no lease on the issue too:\n${bare.stdout}`);

  const captured = await builderRan(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(captured.status, 0, said(captured));
  assert.equal(landing().state, "ready", said(captured));
  assert.equal(landing().head, tip, "at the head the fix was pushed at");
  for (const name of ["intended", "candidate", "release", "reconciled", "deployment"]) {
    assert.equal(landing()[name], undefined, `and nothing of the first landing's ${name} is carried into the second`);
  }
  const again = await builderRan(["resume", KEY]);
  assert.doesNotMatch(again.stdout, /heads: /u, `one head, so nothing to tell apart:\n${again.stdout}`);

  /* The records the second landing walks by, judged at the fix, as the rebuilt issue earns them. */
  const { said: bodies, ...fields } = earning(tip);
  Object.assign(issue(), fields);
  for (const body of bodies) {
    comments().push({ documentId: `c-${comments().length + 1}`, createdAt: new Date().toISOString(), authorId: "agent", body });
  }
  git(work, "checkout", "-q", BASE);
  const second = await landingRan([KEY], work);
  const now = sha(join(at, "origin.git"), `refs/heads/${BASE}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", tip, now).status, 0, `the second landing merged the fix:\n${second}`);
});
