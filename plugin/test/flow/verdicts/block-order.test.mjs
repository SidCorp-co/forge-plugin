/* A flag between two `--criterion` flags reads two ways, and where the two readings record different
   verdicts the write is refused rather than resolved (ISS-435, ISS-2151). Every case goes through the binary,
   because the refusal is worth something only if it stands before the comment is posted. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("block-order").path;
const { parseAll } = await import("../../../src/flow/record/page.mjs");
const { blockOrderChecked } = await import("../../../src/flow/machine/block-order.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const OWN = "9a4d36d";
const CRITERIA = [1, 2, 3, 4, 5, 6, 7].map((one) => `${one}. Outcome ${one}.`).join("\n");

let clock = 0;
const at = () => `2026-09-25T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const judging = {
  documentId: "order-uuid",
  issueId: "ISS-9",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-09-25T09:00:00.000Z",
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "order-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return judging;
  if (args.action === "update") return Object.assign(judging, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const held = state.comments[args.filters?.issue] ?? [];
    return { comments: held, returned: held.length, hasMore: false };
  }
  const held = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${held.length}`;
  held.push({ documentId: id, createdAt: at(), body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state);
after(() => tracker.close());

const env = { ...ENV, FORGE_SESSION_ID: "block-order-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const posted = () => state.comments["order-uuid"].length;
const verdict = (...argv) => ask("record", "verdict", "ISS-9", "--commit", COMMIT, "--evidence", COMMIT, ...argv);
const verdicts = (run) => Object.fromEntries(parseAll(run.stdout)
  .map((one) => [String(one.fields.criterion).split(" ")[0], one.fields.verdict]));

state.comments["order-uuid"].push({
  documentId: "the-mark", createdAt: at(), body: `mark_merged target=base — merged to master at ${COMMIT}`,
});
before(async () => {
  await ask("claim", "ISS-9", "--unheld");
  const claimed = await ask("claim", "ISS-9", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("a shared flag restated after a block's own flag, with another block after it, is refused and nothing is posted", async () => {
  const held = posted();
  const run = await verdict("--verdict", "pass",
    "--criterion", "5", "--why", "ran it",
    "--verdict", "fail", "--criterion", "6", "--why", "the one that failed",
    "--verdict", "pass", "--criterion", "7", "--why", "ran it");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(posted(), held, "refused before the comment went up");
  assert.match(run.stderr, /--verdict fail stands in criterion 5's block after --why, with --criterion 6 next/u, run.stderr);
  assert.match(run.stderr, /It would be written onto criterion 5, and it reads as opening criterion 6\. Nothing was sent\./u);
  assert.match(run.stderr, /^ {2}… --criterion 6 … --criterion 5 --verdict fail … {3}for criterion 5, its block moved last$/mu,
    "the placement that means 5");
  assert.match(run.stderr, /^ {2}record verdict <issue> --verdict fail … --criterion 6 … {3}for criterion 6 and those after it, a write of its own$/mu,
    "and the one that means 6");
});

test("a repeatable flag the shared part names is refused in the same position", async () => {
  const held = posted();
  const run = await verdict("--verdict", "pass",
    "--criterion", "4", "--why", "probed it", "--evidence", OWN,
    "--criterion", "5");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(posted(), held, "nothing posted");
  assert.match(run.stderr, new RegExp(`--evidence ${OWN} stands in criterion 4's block after --why, with --criterion 5 next`, "u"),
    run.stderr);
});

/* The regrouping write: a heading writer puts the next group's value directly after the last
   criterion of the group before, and the parser hands it to that criterion (ISS-2151). */
test("a shared flag restated directly after its own --criterion, with another block after it, is refused too", async () => {
  const held = posted();
  const run = await verdict("--verdict", "pass",
    "--criterion", "1", "--criterion", "2", "--verdict", "skipped", "--criterion", "3", "--criterion", "4");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(posted(), held, "refused before the comment went up");
  assert.match(run.stderr, /^record verdict: --verdict skipped stands in criterion 2's block, with --criterion 3 next\. It would be written onto criterion 2, and it reads as opening criterion 3\. Nothing was sent\./mu,
    run.stderr);
  assert.doesNotMatch(run.stderr, /block after/u, "no flag stood ahead of it, and none is named");
  assert.match(run.stderr, /^ {2}… --criterion 3 … --criterion 2 --verdict skipped … {3}for criterion 2, its block moved last$/mu);
  assert.match(run.stderr, /^ {2}record verdict <issue> --verdict skipped … --criterion 3 … {3}for criterion 3 and those after it, a write of its own$/mu);
});

test("a regrouping that restates every shared flag at once is refused at the first of them", async () => {
  const held = posted();
  const run = await verdict("--verdict", "skipped", "--why", "not reachable from here",
    "--criterion", "1", "--criterion", "2", "--criterion", "4", "--verdict", "pass", "--why", "ran it",
    "--criterion", "3", "--criterion", "5");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(posted(), held, "no pass landed on criterion 4");
  assert.match(run.stderr, /--verdict pass stands in criterion 4's block, with --criterion 3 next/u, run.stderr);
});

test("a changed flag in the last block, after blocks carrying none, is taken", async () => {
  const run = await verdict("--verdict", "pass",
    "--criterion", "6", "--why", "ran it",
    "--criterion", "5", "--verdict", "fail", "--evidence", OWN, "--why", "the one that failed");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(verdicts(run), { 6: "pass", 5: "fail" });
  assert.deepEqual(parseAll(run.stdout).map((one) => one.fields.evidence), [[COMMIT], [COMMIT, OWN]]);
});

test("every block carrying its own --verdict, none shared, records each criterion's own", async () => {
  const run = await verdict("--criterion", "1", "--verdict", "pass", "--why", "ran it",
    "--criterion", "2", "--verdict", "skipped", "--why", "no route reaches it",
    "--criterion", "4", "--verdict", "fail", "--why", "it fell over");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(verdicts(run), { 1: "pass", 2: "skipped", 4: "fail" });
});

test("the last block takes a changed flag in any position, no block following it to be read as", async () => {
  const run = await verdict("--verdict", "pass",
    "--criterion", "1",
    "--criterion", "3", "--why", "no screen to look at", "--verdict", "skipped", "--evidence", OWN);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(verdicts(run), { 1: "pass", 3: "skipped" });
  assert.deepEqual(parseAll(run.stdout)[1].fields.evidence, [COMMIT, OWN]);
});

test("the documented write still fails its last criterion and passes the rest", async () => {
  const run = await verdict("--verdict", "pass",
    "--criterion", "1", "--criterion", "2", "--criterion", "3", "--verdict", "fail", "--why", "what failed");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(verdicts(run), { 1: "pass", 2: "pass", 3: "fail" });
});

test("the verdict help states the refused position and the placement taken instead", async () => {
  const help = await ask("record", "verdict", "-h");
  assert.equal(help.status, 0, help.stderr);
  const text = help.stdout.replace(/\s+/gu, " ");
  assert.match(text, /Where another --criterion follows, that value stands directly after the block's own --criterion; after the block's other flags it reads as the next block's, and is refused:/u,
    help.stdout);
});

test("a kind whose shape opens no blocks is never judged by position", () => {
  assert.doesNotThrow(() => blockOrderChecked("review", ["--reviewer", "a", "--criterion", "1", "--why", "x", "--reviewer", "b", "--criterion", "2"]));
  assert.doesNotThrow(() => blockOrderChecked("verdict", ["--criterion", "1", "--why", "x", "--verdict", "pass", "--criterion", "2"]),
    "and a write with no shared part has nothing a block could be changing");
});
