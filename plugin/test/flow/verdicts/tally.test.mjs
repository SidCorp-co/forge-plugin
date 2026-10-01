/* A verdict write reads back counted, and names a `pass` a `--why` rode onto (ISS-2198). Through the
   binary, because what is owed is what the writer sees on the two streams once the write has landed:
   both on stderr, stdout being the records a caller parses back. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-tally").path;
const { parseAll } = await import("../../../src/flow/record/page.mjs");
const { tallied } = await import("../../../src/flow/record/thread/tally.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const CRITERIA = [1, 2, 3, 4, 5, 6, 7].map((one) => `${one}. Outcome ${one}.`).join("\n");

let clock = 0;
const at = () => `2026-10-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const judging = {
  documentId: "tally-uuid",
  issueId: "ISS-9",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-10-02T09:00:00.000Z",
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "tally-uuid": [] }, answer: {} };
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

const env = { ...ENV, FORGE_SESSION_ID: "verdict-tally-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const posted = () => state.comments["tally-uuid"].length;
const verdict = (...argv) => ask("record", "verdict", "ISS-9", "--commit", COMMIT, "--evidence", COMMIT, ...argv);
const counted = (text) => text.split("\n").filter((line) => line.startsWith("wrote "));
/* The criterion and verdict of each record stdout parses back as, in the order it carries them. */
const records = (run) => parseAll(run.stdout).map((one) => [String(one.fields.criterion).split(" ")[0], one.fields.verdict]);
/* Each criterion's latest verdict and why, as the thread holds them now. */
const standing = () => Object.fromEntries(state.comments["tally-uuid"].flatMap((one) => parseAll(one.body ?? ""))
  .filter((one) => one.kind === "verdict")
  .map((one) => [String(one.fields.criterion).split(" ")[0], [one.fields.verdict, one.fields.why ?? null]]));

state.comments["tally-uuid"].push({
  documentId: "the-mark", createdAt: at(), body: `mark_merged target=base — merged to master at ${COMMIT}`,
});
before(async () => {
  await ask("claim", "ISS-9", "--unheld");
  const claimed = await ask("claim", "ISS-9", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("a verdict write counts each value it recorded on stderr, ahead of the guidance, in the help's order, criteria ascending", async () => {
  const run = await verdict(
    "--criterion", "5", "--verdict", "pass",
    "--criterion", "2", "--verdict", "skipped", "--why", "nobody looked",
    "--criterion", "3", "--verdict", "fail", "--why", "it fell over",
    "--criterion", "4", "--verdict", "short", "--why", "one of two", "--filed", "ISS-77",
    "--criterion", "1", "--verdict", "pass");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(counted(run.stderr), ["wrote 5 verdict(s) on ISS-9: 2 pass (1, 5), 1 fail (3), 1 short (4), 1 skipped (2)"],
    run.stderr);
  assert.ok(run.stderr.indexOf("wrote 5 verdict(s)") < run.stderr.indexOf("ISS-9 is developed; testing is next"),
    `ahead of what the write says is owed and of the guidance after it: ${run.stderr}`);
  assert.doesNotMatch(run.stderr, /--why rode onto/u, "no pass carried a why, so nothing is remarked");
  assert.deepEqual(records(run), [["5", "pass"], ["2", "skipped"], ["3", "fail"], ["4", "short"], ["1", "pass"]],
    "stdout parses back as the five records and nothing else");
  assert.doesNotMatch(run.stdout, /^wrote /mu);
});

test("the count names only the values the write recorded", async () => {
  const run = await verdict("--verdict", "skipped", "--why", "no route", "--criterion", "7", "--criterion", "6");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(counted(run.stderr), ["wrote 2 verdict(s) on ISS-9: 2 skipped (6, 7)"], run.stderr);
});

test("a --why riding onto a pass, shared or a block's own, is posted as written and named with the write that records it skipped", async () => {
  const held = posted();
  const run = await verdict("--verdict", "pass",
    "--criterion", "3", "--why", "ran it",
    "--criterion", "6", "--criterion", "2", "--why", "nobody's route reaches it");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(posted(), held + 1, "the write went up");
  assert.deepEqual([standing()[2], standing()[3], standing()[6]],
    [["pass", "nobody's route reaches it"], ["pass", "ran it"], ["pass", null]], "every block as written");
  assert.match(run.stderr, /^wrote 3 verdict\(s\) on ISS-9: 3 pass \(2, 3, 6\)\n--why rode onto criterion 2, 3, recorded `pass`\./mu, run.stderr);
  assert.deepEqual(records(run), [["3", "pass"], ["6", "pass"], ["2", "pass"]], "stdout carries no line of the remark");
  const command = run.stderr.split("\n").filter((line) => line.startsWith("  forge record verdict "));
  assert.deepEqual(command, [`  forge record verdict ISS-9 --commit ${COMMIT} --criterion 3 --verdict skipped --why 'ran it' `
    + `--criterion 2 --verdict skipped --why 'nobody'\\''s route reaches it'`], run.stderr);

  const again = await ranAsync("sh", ["-c", command[0].trim().replace(/^forge /u, `'${FORGE}' `)], env);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual([standing()[2], standing()[3]], [["skipped", "nobody's route reaches it"], ["skipped", "ran it"]],
    "the printed command, run as printed, records each skipped with the why it carried");
  assert.doesNotMatch(again.stderr, /--why rode onto/u);
});

test("a shared --why over passes is named the same way", async () => {
  const run = await verdict("--verdict", "pass", "--why", "not run", "--criterion", "7");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^--why rode onto criterion 7, recorded `pass`\./mu, run.stderr);
  assert.match(run.stderr, /^ {2}forge record verdict ISS-9 --commit 43b811e --criterion 7 --verdict skipped --why 'not run'$/mu);
});

test("a write refused before anything is posted prints no count", async () => {
  const held = posted();
  const run = await verdict("--criterion", "1", "--verdict", "pass", "--criterion", "99", "--verdict", "pass");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(posted(), held, "nothing posted");
  assert.deepEqual(counted(run.stdout + run.stderr), [], run.stderr);
});

test("an issue landing outside git is given the landing its blocks recorded, quoted for the shell", () => {
  const said = [];
  const error = console.error;
  const log = console.log;
  console.error = (line) => said.push(["err", line]);
  console.log = (line) => said.push(["out", line]);
  try {
    tallied("verdict", "ISS-9", [{ criterion: "4 — Outcome 4.", verdict: "pass", landing: "the shared drive", why: "seen" }])();
  } finally {
    console.error = error;
    console.log = log;
  }
  assert.equal(said.length, 1, "one write to one stream");
  assert.equal(said[0][0], "err");
  assert.match(said[0][1], /^wrote 1 verdict\(s\) on ISS-9: 1 pass \(4\)\n--why rode onto criterion 4/u);
  assert.match(said[0][1], /\n {2}forge record verdict ISS-9 --landing 'the shared drive' --criterion 4 --verdict skipped --why seen$/u);
  assert.equal(tallied("review", "ISS-9", [{ verdict: "pass" }]), null, "a kind other than verdict says nothing");
});
