/* Who judged a criterion, on the record rather than in the run's memory. A field the caller cannot
   type is only worth writing if it reads back: `readRecords` keeps a shape's declared fields and
   drops the rest, so a `judge:` line rendered onto a page and lost on the way back would leave the
   `tested` rule with nothing to weigh and nothing here failing (ISS-673). */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-judge").path;
const { assemble, parseAll, render } = await import("../../../src/flow/record/page.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const JUDGE = "the-qa-session";

let clock = 0;
const at = () => `2026-09-07T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ createdAt: at(), authorId: "agent", body });
const verdictOf = (number, extra = {}) =>
  ({ criterion: `${number} — text`, verdict: "pass", commit: COMMIT, evidence: [COMMIT], ...extra });

test("the judge is a declared field, so a rendered verdict reads back carrying it", () => {
  const held = SHAPES.verdict.fields.find((one) => one.flag === "judge");
  assert.ok(held, "SHAPES.verdict declares judge");
  assert.notEqual(held.derived, true, "declared and not derived: a derived field is dropped on the way back");
  assert.equal(held.written, true, "and written by the CLI, so no caller flag reaches it");
  assert.equal(held.newer, true, "and excused at the read-back, or every verdict older than the field reads as a gap");
  const body = render("verdict", [verdictOf(1, { judge: JUDGE }), verdictOf(2, { judge: JUDGE })]);
  assert.equal(body.match(/^judge: /gmu).length, 2, `a line per block:\n${body}`);
  assert.deepEqual(parseAll(body).map((one) => one.fields.judge), [JUDGE, JUDGE],
    "and each block reads back naming its judge");
});

test("the assembled view of an issue's verdicts keeps the judge on each", () => {
  const criteria = [{ number: 1, text: "The first outcome." }, { number: 2, text: "The second outcome." }];
  const one = comment(render("verdict", [verdictOf(1, { judge: JUDGE })]));
  const two = comment(render("verdict", [verdictOf(2, { judge: "another-session" })]));
  const { verdicts } = assemble([one, two], criteria);
  assert.deepEqual([...verdicts].map(([number, held]) => [number, held.record.fields.judge]),
    [[1, JUDGE], [2, "another-session"]], "the field survives the read the entry checks weigh");
  const older = "## Verdict\n\n- **Criterion:** 1 — text\n- **Verdict:** pass\n- **Commit:** 43b811e\n"
    + "- **Evidence:** 43b811e\n- **Judge:** the-qa-session\n\n`forge-record: verdict · contract 1`";
  assert.equal(parseAll(older)[0].fields.judge, JUDGE, "and the bullet form reads it off its label");
});

/* Spawned, because what is being proved is the value the CLI resolved and not the value a test
   passed in: `sessionOf` reads the environment, and a caller that could hand it over could lie. */
const judging = {
  documentId: "judging-uuid",
  issueId: "ISS-7",
  status: "developed",
  title: "the change being judged",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  mergedAt: "2026-09-07T09:00:00.000Z",
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "judging-uuid": [] }, answer: {} };
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
const tracker = await fakeTracker(state);
after(() => tracker.close());

const env = { ...tracker.env, FORGE_SESSION_ID: JUDGE };
const ask = (...argv) => ranAsync(FORGE, argv, env);

state.comments["judging-uuid"].push({
  documentId: "the-mark",
  createdAt: at(),
  body: `mark_merged target=base — merged to master at ${COMMIT}`,
});
before(async () => {
  await ask("claim", "ISS-7");
  const claimed = await ask("claim", "ISS-7");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("every verdict a write makes carries the writer's session id as the CLI resolved it", async () => {
  const run = await ask("record", "verdict", "ISS-7", "--evidence", COMMIT, "--verdict", "pass",
    "--criterion", "1", "--criterion", "2");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.match(new RegExp(`^judge: ${JUDGE}$`, "gmu")).length, 2,
    `one judge line per block, naming this run:\n${run.stdout}`);
  const stored = state.comments["judging-uuid"].at(-1).body;
  assert.deepEqual(parseAll(stored).map((one) => one.fields.judge), [JUDGE, JUDGE],
    "and what the tracker holds reads back the same");
});

test("--judge is refused rather than dropped, so no writer names another run as the judge", async () => {
  const run = await ask("record", "verdict", "ISS-7", "--evidence", COMMIT, "--verdict", "pass",
    "--criterion", "1", "--judge", "somebody-else");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No record verdict flag named --judge\./u, run.stderr);
  /* The kind's own row is what the refusal offers back, and the written field is not on it, so
     nothing invites a second try. The row is under the usage line rather than on it, which is why
     the refusal carries the rows that name a flag and not the first line alone. */
  const offered = /^ {2}verdict\s+(.*)$/mu.exec(run.stderr)[1].match(/--[a-z]+/gu);
  assert.deepEqual(offered, ["--criterion", "--verdict", "--commit", "--evidence", "--why"]);
  assert.doesNotMatch(run.stderr, /--judge\b(?!\.)/u, "and the flag it refused is not offered back");
});
