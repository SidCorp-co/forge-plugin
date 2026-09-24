/* A records turn whose review finds the landed change short, followed through to the landing after
   it: the review asking for changes at the commit that landed, the fix, the capture that takes it
   and the landing that merges it. Before ISS-2406 the capture was refused at `records-owed` with a
   refusal naming no way out, and its `--pushed` line read as a capture that had been written. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BRANCH, KEY, OWNED, builderRan, context, forgetInstall, git, landingRan, marks, ready, seeded, sha,
  tracker, world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = () => landingOf(context());
const said = (run) => `${run.stdout}${run.stderr}`;
const short = (one) => one.slice(0, 7);
const PLAN = { acceptanceCriteria: "1. it lands" };

/** The first landing, which leaves the records turn to the builder, and the builder's take of it. */
const landedOnce = async () => {
  /* Each case its own release history: an install record a case before this one wrote is newer
     than anything this world ships. */
  forgetInstall();
  const { at, work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base), earned: PLAN });
  const first = await landingRan([KEY], work);
  assert.equal(landing().state, "records-owed", first);
  const took = await builderRan(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, said(took));
  return { at, work, head, landed: marks()[0].body.match(/at ([0-9a-f]{40})/u)[1] };
};

/** The builder's answer: a commit on top of the branch the first landing merged, pushed. */
const fixed = (work) => {
  git(work, "checkout", "-q", BRANCH);
  writeFileSync(join(work, OWNED), "the fix\n", { flag: "a" });
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "the fix the records turn found owed");
  git(work, "push", "-q", "origin", BRANCH);
  return sha(work, BRANCH);
};

test("a records turn whose review asks for changes captures the fix, and the next landing merges it", async () => {
  const { at, work, landed } = await landedOnce();
  const tip = fixed(work);

  const unasked = await builderRan(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unasked.status, 1, said(unasked));
  assert.ok(unasked.stderr.includes(`forge claim ${KEY} --recorded\n`), `the records written hand the turn back:\n${said(unasked)}`);
  assert.ok(unasked.stderr.includes(`forge record review ${KEY} --reviewer codex --commit ${short(landed)} --outcome changes-requested`),
    `and a change found short is said at the commit that landed:\n${said(unasked)}`);
  assert.equal(landing().state, "records-owed", "nothing was written");
  assert.match(unasked.stderr, new RegExp(`--pushed: ${BRANCH} at ${short(tip)}, base \\w+, 1 file\\(s\\) touched — read and not written, because the call was refused above`, "u"),
    `the capture says it was not written:\n${said(unasked)}`);
  assert.doesNotMatch(said(unasked), /file\(s\) touched\.$/mu, `and prints no line reading as a capture written:\n${said(unasked)}`);

  const short1 = await builderRan(["record", "review", KEY, "--reviewer", "codex", "--commit", landed,
    "--outcome", "changes-requested", "--finding", "F1 accepted"]);
  assert.equal(short1.status, 0, said(short1));
  const unreviewed = await builderRan(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unreviewed.status, 1, said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`forge record review ${KEY} --reviewer codex --commit ${short(tip)} --outcome`),
    `a head no review approved is refused with the review that answers it:\n${said(unreviewed)}`);
  assert.equal(landing().state, "records-owed", "and nothing was written");

  const review = await builderRan(["record", "review", KEY, "--reviewer", "codex", "--commit", tip, "--outcome", "approved"]);
  assert.equal(review.status, 0, said(review));
  const verdict = await builderRan(["record", "verdict", KEY, "--criterion", "1", "--verdict", "pass",
    "--commit", tip, "--evidence", tip]);
  assert.equal(verdict.status, 0, said(verdict));
  const captured = await builderRan(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(captured.status, 0, said(captured));
  assert.equal(landing().state, "ready", said(captured));
  assert.equal(landing().head, tip, "at the head the records judged");
  assert.equal(landing().intended, undefined, "and nothing of the first landing is carried into the second");
  assert.match(captured.stderr, new RegExp(`^--pushed: ${BRANCH} at ${short(tip)}, base \\w+, 1 file\\(s\\) touched\\.$`, "mu"),
    `the capture a write carried says so:\n${said(captured)}`);
  assert.doesNotMatch(said(captured), /not written/u, said(captured));

  git(work, "checkout", "-q", BASE);
  const second = await landingRan([KEY], work);
  const now = sha(join(at, "origin.git"), `refs/heads/${BASE}`);
  assert.notEqual(now, landed, `the second landing moved ${BASE}:\n${second}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", tip, now).status, 0, `and it is the fix that landed:\n${second}`);
});

test("a capture on a call that writes no worklog says it was not written", async () => {
  await landedOnce();
  const back = await builderRan(["claim", KEY, "--pushed", "--recorded"]);
  assert.equal(back.status, 0, said(back));
  assert.equal(landing().state, "marked", said(back));
  assert.match(back.stderr, /read and not written, since nothing this call wrote carries the worklog/u, said(back));
  assert.doesNotMatch(said(back), /file\(s\) touched\.$|and the touched set is cleared/mu, said(back));
});
