/* A branch the landing hands back for a fault of its own, followed through to the landing after it:
   the red gate ISS-2291 met, the new head its builder pushed, and the capture that takes that head
   once the records judge it. Every refusal is read for what it names, since the dead end this
   replaces was three refusals each naming a state nobody could leave (ISS-2299). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, BRANCH, BUILDER, KEY, LANDER, OWNED, context, ctx, git, ready, seeded, sha, tracker, world,
} from "../fixture.mjs";
import { ranAsync } from "../../../fixtures.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const { landReady } = await import("../../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../../tools/checkout.mjs");
const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");
const { leaseOf } = await import("../../../../src/flow/lease.mjs");

test.after(() => tracker.close());

/* Red over any tree whose change carries no fix, green over one that does: the fault is the branch's
   and only a new head of it clears the gate, which is the case the hand-back is for. */
const GATE = `node -e "process.exit(require('fs').readFileSync('${OWNED}','utf8').includes('the fix') ? 0 : 1)"`;

let exited = 0;
const ran = async (keys, work) => {
  const out = [];
  const kept = [console.log, console.error];
  console.log = (...said) => out.push(said.join(" "));
  console.error = (...said) => out.push(said.join(" "));
  try {
    await landReady({ flags: new Map(), words: keys }, ctx(work));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    out.push(error.message);
  } finally {
    [console.log, console.error] = kept;
    exited = process.exitCode ?? 0;
    process.exitCode = 0;
  }
  return out.join("\n");
};

/* Twice, since the gate every write passes delivers a comment this session has not read and refuses once. */
const asBuilder = async (argv) => {
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, argv, { ...process.env, FORGE_SESSION_ID: BUILDER }, process.cwd());
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const landing = () => landingOf(context());
const remote = (at, ref = `refs/heads/${BASE}`) => sha(join(at, "origin.git"), ref);
const short = (one) => one.slice(0, 7);
const said = (run) => `${run.stdout}${run.stderr}`;

/** The builder's answer: a commit on top of the head the gate refused, pushed, the checkout left on it. */
const fixed = (work) => {
  git(work, "checkout", "-q", BRANCH);
  writeFileSync(join(work, OWNED), "the fix\n", { flag: "a" });
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "the fix for the gate");
  git(work, "push", "-q", "origin", BRANCH);
  return sha(work, BRANCH);
};

test("a red gate hands the branch back at head-owed, and its fixed head lands once the records judge it", async () => {
  const { at, work, head, base } = world({ base: "other", gate: GATE });
  seeded({ landing: ready(head, base), earned: { acceptanceCriteria: "1. it lands" } });
  const first = await ran([KEY], work);
  assert.match(first, /npm run check exited 1/u, first);
  assert.equal(landing().state, "head-owed", `the builder's turn, not the lander's:\n${first}`);
  assert.equal(landing().head, head, "the checkpoint still names the head the gate refused");
  assert.ok(first.includes(`forge claim ${KEY} --take`), `the take first:\n${first}`);
  assert.ok(first.indexOf(`forge claim ${KEY} --pushed --ready`) > first.indexOf(`forge claim ${KEY} --take`),
    `and the capture after it:\n${first}`);
  assert.doesNotMatch(first, /rebased/u, `no rebase that orphans the head the landing fetches:\n${first}`);
  assert.equal(remote(at), base, `nothing was pushed:\n${first}`);
  assert.equal(remote(at, `refs/heads/${BRANCH}`), head, `and no ref of the branch was written:\n${first}`);
  assert.equal(leaseOf(context()).holder, LANDER, "the lander's lease is still live on the issue");

  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, said(took));
  assert.equal(leaseOf(context()).holder, BUILDER, `the builder took the turn off the live lease:\n${said(took)}`);

  const tip = fixed(work);
  const early = await asBuilder(["record", "review", KEY, "--reviewer", "codex", "--commit", head, "--outcome", "approved"]);
  assert.equal(early.status, 0, said(early));
  const unreviewed = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unreviewed.status, 1, said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`judged ${short(head)}`), `the head the review names:\n${said(unreviewed)}`);
  assert.ok(unreviewed.stderr.includes(`captures ${short(tip)}`), `and the head the capture takes:\n${said(unreviewed)}`);
  assert.equal(landing().state, "head-owed", "and nothing was written");

  const review = await asBuilder(["record", "review", KEY, "--reviewer", "codex", "--commit", tip, "--outcome", "approved"]);
  assert.equal(review.status, 0, said(review));
  const unjudged = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unjudged.status, 1, said(unjudged));
  assert.match(unjudged.stderr, /verdicts on criterion 1 unjudged/u, said(unjudged));
  assert.ok(unjudged.stderr.includes(`--verdict <pass|fail|skipped|short> --criterion 1`), `with the write that answers it:\n${said(unjudged)}`);

  const verdict = await asBuilder(["record", "verdict", KEY, "--criterion", "1", "--verdict", "pass",
    "--commit", tip, "--evidence", tip]);
  assert.equal(verdict.status, 0, said(verdict));
  const captured = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(captured.status, 0, said(captured));
  assert.equal(landing().state, "ready", said(captured));
  assert.equal(landing().head, tip, "at the head the records judged");
  assert.equal(landing().builder, BUILDER, "written by the run that captured it");

  git(work, "checkout", "-q", BASE);
  const second = await ran([KEY], work);
  const landed = remote(at);
  assert.notEqual(landed, base, `the fixed head landed:\n${second}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", tip, landed).status, 0, `and it is the fix that landed:\n${second}`);
});

/* Read before the take, so the lease the builder holds is not replaced by a landing that owes nothing. */
test("a landing asked for a head-owed checkpoint refuses before the take, naming the builder's two writes", async () => {
  const { work, head, base } = world({ base: "other" });
  const lease = { holder: BUILDER, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] };
  seeded({ landing: ready(head, base, { state: "head-owed" }), lease });
  const out = await ran([KEY], work);
  assert.equal(exited, 1, out);
  assert.match(out, /reads `head-owed`/u, out);
  assert.ok(out.includes(`forge claim ${KEY} --take`), out);
  assert.ok(out.includes(`forge claim ${KEY} --pushed --ready`), out);
  assert.equal(leaseOf(context()).holder, BUILDER, `the builder's lease is left where it was:\n${out}`);
  assert.equal(landing().state, "head-owed", out);
});
