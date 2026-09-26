/* The review-answers step over passes whose head the history lost. Each fault alone was refused, the
   short pass by the shortfall answer and the lost head by the ancestor test, but a pass both short of
   the set and off lineage was dropped before either was asked, and the run that did both was let
   through under the absence notice (ISS-2567). A whole-set diffs read at a lost head stays a notice,
   and the notice stops claiming the head is what the step asks for. */
import assert from "node:assert/strict";
import test from "node:test";

import { BARE, git, pushed, runIn } from "../run-fixtures.mjs";
import { ADDED, ELSEWHERE, UNDER_REVIEW, baseMoved, clippedRead, readTaken } from "./read-fixtures.mjs";

const REFUSED = /stopped at step 3 \(the review answers for the head this lands\)/u;
const REBASED = /step 4\/10 {2}rebase onto origin\/master/u;

/* The branch rebuilt as one commit over its base: the same tree, and a head no read was taken at. */
const rebuilt = (held) => {
  git(held.work, "reset", "--soft", held.base);
  git(held.work, "commit", "-m", "the change under review, rebuilt as one commit");
  return git(held.work, "rev-parse", "HEAD").stdout.trim();
};

const lostSaid = (at, head) => `at ${at.slice(0, 7)}, a head neither ${head.slice(0, 7)}'s history `
  + "nor this ship's recorded replay reaches";

test("passes short of the set at a head the history lost are refused, naming the head and what went unread", () => {
  const held = clippedRead("read-clipped-lost", "the file the pass clipped\n");
  const head = rebuilt(held);

  const run = runIn(held.work, ["ship"], held.env);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, REFUSED, run.stderr);
  assert.ok(run.stderr.includes(lostSaid(held.head, head)), `the lost head is not said to be lost:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`carry no whole body for ${ADDED}.`),
    `the file no pass carried whole is not named, or a file carried whole is named with it:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`--send bodies ${ADDED} ${UNDER_REVIEW}`),
    `the read it asks for is not the whole set at the head that would land:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`rewrite the review record at ${head.slice(0, 7)}`),
    `the head that would land is not named:\n${run.stderr}`);
  assert.doesNotMatch(run.stdout, /no consult in this log read the whole/u,
    `the passes were reported as an absence as well:\n${run.stdout}`);
  assert.doesNotMatch(run.stdout, /scratch gate ran/u, "a refused ship spent the gate");
  assert.equal(git(held.remote, "rev-parse", "master").stdout.trim(),
    git(held.work, "rev-parse", "master").stdout.trim(), "the refused change was pushed");
});

/* The whole-set read the refusal would ask for cannot be taken, so it stays the notice it is on lineage. */
test("a short pass at a lost head over a file no pass can carry is named and stops no ship", () => {
  const held = clippedRead("read-stuck-lost", "");
  rebuilt(held);

  const run = runIn(held.work, ["ship"], held.env);
  assert.match(run.stdout, REBASED, `a shortfall no consult clears stopped the ship:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(ADDED), `the file no pass carries is not named:\n${run.stdout}`);
  assert.match(run.stdout, /can be carried by no pass at all/u,
    `the step named the file without saying why no read will ever carry it:\n${run.stdout}`);
});

test("a whole-set read that sent diffs at a lost head is told both, and stops no ship", () => {
  const held = baseMoved("read-diffs-lost", ELSEWHERE);
  const env = readTaken(held.work, held.mine, [UNDER_REVIEW], { send: "diffs" });
  const head = rebuilt(held);

  const run = runIn(held.work, ["ship"], env);
  assert.match(run.stdout, /sent diffs rather than bodies/u, `the send mode is not named:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(lostSaid(held.mine, head)), `the lost head is not said to be lost:\n${run.stdout}`);
  assert.doesNotMatch(run.stdout, /The head, the root and the set are each what this step asks for/u,
    `a lost head was offered as one this step asks for:\n${run.stdout}`);
  assert.ok(run.stdout.includes(`--send bodies ${UNDER_REVIEW}`),
    `the read that would earn the review is not printed over the whole set:\n${run.stdout}`);
  assert.match(run.stdout, REBASED, `a notice this step cannot judge stopped the ship:\n${run.stdout}${run.stderr}`);
});

test("the ship's help states the refusal for passes both short of the set and off lineage", () => {
  const { work } = pushed("ship-help-lost-short");
  const help = runIn(work, ["-h"], BARE).stdout.replace(/\s+/gu, " ");
  assert.match(help, /Passes short of the set whose head is also on no lineage this step accepts are refused/u, help);
});
