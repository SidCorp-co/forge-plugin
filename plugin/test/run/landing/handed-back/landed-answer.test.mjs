/* A branch handed back at `head-owed` whose answering head reached the default branch by a route
   other than the landing: the capture has no diff left to read, so `--landed` is the exit, and it
   asks the records what the capture would have. Every refusal is read for what it names and for the
   checkpoint it leaves, since the dead end this replaces was a state no command could leave
   (ISS-2311). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BRANCH, BUILDER, KEY, OWNED, builderRan, context, git, ready, seeded, sha, state, tracker, world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const landing = () => landingOf(context());
const short = (one) => one.slice(0, 7);
const said = (run) => `${run.stdout}${run.stderr}`;
const LEASE = () => ({ holder: BUILDER, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] });

/* The head the landing refused, handed back to the builder, whose lease is on the issue. */
const handedBack = () => {
  const { work, head, base } = world({ base: "other" });
  seeded({ landing: ready(head, base, { state: "head-owed" }), lease: LEASE(), earned: { acceptanceCriteria: "1. it lands" } });
  return { work, head };
};

/* The builder's answer pushed on its branch, and optionally landed on the default branch by hand, the
   way ISS-2299's head reached master before its records did. */
const answered = (work, { landed = true } = {}) => {
  git(work, "checkout", "-q", BRANCH);
  writeFileSync(join(work, OWNED), "the fix\n", { flag: "a" });
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "the fix");
  git(work, "push", "-q", "origin", BRANCH);
  const tip = sha(work, BRANCH);
  if (landed) {
    git(work, "checkout", "-q", BASE);
    git(work, "merge", "-q", "--no-ff", "-m", "landed by hand", BRANCH);
    git(work, "push", "-q", "origin", BASE);
  }
  return tip;
};

const reviewed = (commit) => builderRan(["record", "review", KEY, "--reviewer", "codex", "--commit", commit, "--outcome", "approved"]);
const judged = (commit, verdict = "pass") => builderRan(["record", "verdict", KEY, "--criterion", "1", "--verdict", verdict,
  "--commit", commit, "--evidence", commit, ...(verdict === "fail" ? ["--why", "it did not land"] : [])]);
const landed = () => builderRan(["claim", KEY, "--landed"]);

test("a landed answer ends the landing once the records judge its tip, and the checkpoint names that tip", async () => {
  const { work, head } = handedBack();
  const tip = answered(work);
  assert.equal((await reviewed(head)).status, 0);
  const unreviewed = await landed();
  assert.equal(unreviewed.status, 1, said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`judged ${short(head)}`), `the head the review names:\n${said(unreviewed)}`);
  assert.ok(unreviewed.stderr.includes(`--commit ${short(tip)} --outcome approved`), `and the review to record:\n${said(unreviewed)}`);
  assert.ok(unreviewed.stderr.includes(`forge claim ${KEY} --landed`), `then this write again:\n${said(unreviewed)}`);
  assert.equal(landing().state, "head-owed", "and nothing was written");

  assert.equal((await reviewed(tip)).status, 0);
  const unjudged = await landed();
  assert.equal(unjudged.status, 1, said(unjudged));
  assert.match(unjudged.stderr, /verdicts on criterion 1 unjudged/u, said(unjudged));
  assert.equal(landing().state, "head-owed", "and nothing was written");

  const fail = await judged(tip, "fail");
  assert.equal(fail.status, 0, said(fail));
  const failing = await landed();
  assert.equal(failing.status, 1, said(failing));
  assert.ok(failing.stderr.includes(`1 at ${short(tip)} (fail)`), said(failing));
  assert.equal(landing().state, "head-owed", "and nothing was written");

  assert.equal((await judged(tip)).status, 0);
  const done = await landed();
  assert.equal(done.status, 0, said(done));
  assert.equal(landing().state, "done", said(done));
  assert.equal(landing().head, tip, "at the head that landed, not the one the landing refused");
  assert.ok(done.stdout.includes(`carries ${short(tip)}`), said(done));
});

test("an answer the default branch does not carry is refused, naming the capture", async () => {
  const { work } = handedBack();
  const tip = answered(work, { landed: false });
  const run = await landed();
  assert.equal(run.status, 1, said(run));
  assert.ok(run.stderr.includes(`carrying ${short(tip)}`), `the tip it read:\n${said(run)}`);
  assert.ok(run.stderr.includes(`forge claim ${KEY} --pushed --ready`), `and the capture:\n${said(run)}`);
  assert.equal(landing().state, "head-owed", said(run));
});

test("a branch this checkout holds no remote-tracking ref for is refused, naming its fetch", async () => {
  const { work } = handedBack();
  answered(work);
  git(work, "update-ref", "-d", `refs/remotes/origin/${BRANCH}`);
  const run = await landed();
  assert.equal(run.status, 1, said(run));
  assert.ok(run.stderr.includes(`git fetch origin ${BRANCH}`), said(run));
  assert.equal(landing().state, "head-owed", said(run));
});

test("under an independent judge the landed answer needs its review and no verdict", async () => {
  const was = state.config;
  state.config = { ...was, pipelineConfig: { ...was.pipelineConfig, qa: "independent" } };
  try {
    const { work } = handedBack();
    const tip = answered(work);
    assert.equal((await reviewed(tip)).status, 0);
    const run = await landed();
    assert.equal(run.status, 0, said(run));
    assert.equal(landing().state, "done", said(run));
  } finally {
    state.config = was;
  }
});

test("claim -h names head-owed beside ready as a state --landed ends", async () => {
  const run = await builderRan(["claim", "-h"]);
  assert.match(run.stdout, /--landed {8}the landing over, from `ready` or `head-owed`/u, run.stdout);
});
