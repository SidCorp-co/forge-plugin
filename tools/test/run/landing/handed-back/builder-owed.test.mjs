/* A branch the landing hands back for a reading of its candidate, where the reading finds that
   candidate wrong: the case ISS-2502 met, whose builder rebased onto the base that moved and had no
   write left that took the head it pushed. The answer is a new head the landing builds its
   candidate from again, captured on the records that judge it, and the reconciliation stays named
   beside every refusal of it (ISS-2514). */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { BASE, BRANCH, BUILDER, KEY, context, ctx, git, ready, seeded, sha, tracker, world } from "../fixture.mjs";
import { ranAsync } from "../../../../../plugin/test/fixtures.mjs";

const FORGE = new URL("../../../../../plugin/bin/forge", import.meta.url).pathname;

const { landReady } = await import("../../../../run/land-ready.mjs");
const { Stop } = await import("../../../../checkout.mjs");
const { landingOf } = await import("../../../../../plugin/src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

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
const short = (one) => one.slice(0, 7);
const said = (run) => `${run.stdout}${run.stderr}`;
const approve = (commit) => asBuilder(["record", "review", KEY, "--reviewer", "codex", "--commit", commit, "--outcome", "approved"]);
const pass = (commit) => asBuilder(["record", "verdict", KEY, "--criterion", "1", "--verdict", "pass", "--commit", commit, "--evidence", commit]);

test("a builder who reads the candidate wrong answers with a new head, and that head lands", async () => {
  const { at, work, head, base } = world({ base: "moved" });
  seeded({ landing: ready(head, base), earned: { acceptanceCriteria: "1. it lands" } });
  const first = await ran([KEY], work);
  const owed = landing();
  assert.equal(owed.state, "builder-owed", first);
  assert.ok(first.includes(`forge claim ${KEY} --reconciled ${owed.candidate}`), `the reconciliation:\n${first}`);
  assert.ok(first.includes(`then: forge claim ${KEY} --pushed --ready`), `and the capture beside it:\n${first}`);
  const took = await asBuilder(["claim", KEY, "--take"]);
  assert.equal(took.status, 0, said(took));

  git(work, "checkout", "-q", BRANCH);
  assert.equal((await approve(head)).status, 0);
  assert.equal((await pass(head)).status, 0);
  const again = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(again.status, 1, said(again));
  assert.ok(again.stderr.includes("which is the head that candidate was built from"), said(again));
  assert.ok(again.stderr.includes(`forge claim ${KEY} --reconciled ${short(owed.candidate)}\n  forge claim ${KEY} --pushed --ready`),
    `both answers, the reading and a committed head:\n${said(again)}`);
  assert.equal(landing().state, "builder-owed", "and nothing was written");

  /* The answer ISS-2502 gave: the branch rebased onto the base that moved, and pushed over itself. */
  git(work, "fetch", "-q", "origin");
  assert.equal(git(work, "rebase", "-q", `origin/${BASE}`).status, 0);
  assert.equal(git(work, "push", "-q", "--force", "origin", BRANCH).status, 0);
  const tip = sha(work, BRANCH);
  const unreviewed = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unreviewed.status, 1, said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`captures ${short(tip)} as the answer to the candidate ${short(owed.candidate)}`), said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`judged ${short(head)}`), said(unreviewed));
  assert.ok(unreviewed.stderr.includes(`forge claim ${KEY} --reconciled ${short(owed.candidate)}`), `the other route:\n${said(unreviewed)}`);
  assert.equal(landing().state, "builder-owed", "and nothing was written");

  assert.equal((await approve(tip)).status, 0);
  const unjudged = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(unjudged.status, 1, said(unjudged));
  assert.match(unjudged.stderr, /criterion 1 at [0-9a-f]{7} \(pass\)/u, `the verdict left at the refused head:\n${said(unjudged)}`);
  assert.equal(landing().state, "builder-owed", "and nothing was written");

  assert.equal((await pass(tip)).status, 0);
  const captured = await asBuilder(["claim", KEY, "--pushed", "--ready"]);
  assert.equal(captured.status, 0, said(captured));
  assert.equal(landing().state, "ready", said(captured));
  assert.equal(landing().head, tip, "at the head the records judged");
  assert.equal(landing().candidate, undefined, "and nothing of the refused candidate is carried");

  git(work, "checkout", "-q", BASE);
  const second = await ran([KEY], work);
  const landed = sha(join(at, "origin.git"), `refs/heads/${BASE}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", tip, landed).status, 0, `the answer landed:\n${second}`);
  assert.notEqual(landing().state, "builder-owed", second);
});
