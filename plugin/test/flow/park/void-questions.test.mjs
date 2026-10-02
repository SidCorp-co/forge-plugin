/* The tracker holds a move to closed or dropped while a person's question on the issue is open and
   names `voidQuestions` as the way past it, a payload field no verb sent (ISS-3104). Spawned: the
   flag is read off argv and the payload off the wire, and the refusal is what a run acts on. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

const { render } = await import("../../../src/flow/record/page.mjs");

process.env.XDG_CONFIG_HOME = tempHome("advance-void-questions").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const HOLDER = "this-run";
const LEASE = { holder: HOLDER, agent: "claude-code_2-1-285_agent", pid: String(process.pid), renewedAt: new Date().toISOString(), minutes: 30 };
const OPEN = "this issue holds 1 open question (q-1), and `closed` would leave it asking a person for a "
  + "decision nothing can act on. Answer it first, or send this move again with `voidQuestions: "
  + "\"<why they died with the work>\"`, which voids each one with that reason in the same write.";
const ISSUE = {
  documentId: "asked-uuid",
  issueId: "ISS-99",
  status: "awaiting_release",
  title: "the issue a person was asked a question on",
  description: "no mark here",
  releaseNotes: { section: "Skip", userFacing: "-" },
  sessionContext: { lease: LEASE },
};
const VERIFIED = [{ createdAt: "2026-09-04T10:00:00.000Z", authorId: "agent",
  body: render("verification",
    { where: "the installed plugin", commit: "43b811e", evidence: ["https://app.example/build/9"] }) }];
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "none", pipelineConfig: { autoProdDeploy: true } },
  issues: [ISSUE],
  comments: { "asked-uuid": VERIFIED },
  answer: {},
  sent: [],
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
  if (args.action === "get") return ISSUE;
  if (args.action === "transition") {
    state.sent.push(args.data);
    if (state.asked && args.data.voidQuestions === undefined) return { refused: OPEN, code: "OPEN_QUESTIONS" };
    ISSUE.status = args.data.status;
    return { ...ISSUE };
  }
  return Object.assign(ISSUE, args.data ?? {});
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

const advance = async (status, ...argv) => {
  ISSUE.status = status;
  state.sent = [];
  return ranAsync(FORGE, ["advance", "ISS-99", ...argv], { ...ENV, FORGE_SESSION_ID: HOLDER });
};
const voided = () => state.sent.map((data) => data.voidQuestions);

test("a plain advance into closed carries the sentence, trimmed, and the issue closes", async () => {
  state.asked = true;
  const run = await advance("awaiting_release", "--void-questions", "  the work it asked about shipped  ");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(voided(), ["the work it asked about shipped"], JSON.stringify(state.sent));
  assert.equal(ISSUE.status, "closed");
});

test("a set into closed or dropped carries the sentence on its move", async () => {
  state.asked = true;
  for (const to of ["closed", "dropped"]) {
    const run = await advance("approved", "--set", to, "--why", "nobody owes it", "--void-questions", "it died with the work");
    assert.equal(run.status, 0, `${to}: ${run.stdout}${run.stderr}`);
    assert.deepEqual(voided(), ["it died with the work"], `${to}: ${JSON.stringify(state.sent)}`);
  }
});

test("a drop carries the sentence on its move", async () => {
  state.asked = true;
  const run = await advance("approved", "--drop", "--why", "obsolete", "--void-questions", "it died with the work");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(voided(), ["it died with the work"], JSON.stringify(state.sent));
  assert.equal(ISSUE.status, "dropped");
});

/* What the landing's status walk sends is `advance <key> --to closed`, so the route repeats the --to. */
test("a move held for open questions names the same command again with the flag, above the tracker's words", async () => {
  state.asked = true;
  const run = await advance("awaiting_release", "--to", "closed");
  assert.equal(run.status, 1, run.stdout);
  const [above, under = ""] = run.stderr.split("What refused it:\n");
  assert.match(above, /\n {2}forge advance ISS-99 --to closed --void-questions "<why they died with the work>"\n/u, run.stderr);
  assert.ok(under.trimEnd().endsWith(OPEN), `the tracker's words stay whole and last: ${run.stderr}`);
  assert.match(under, /^OPEN_QUESTIONS: /u, under);
  assert.equal(ISSUE.status, "awaiting_release");
});

test("that refusal names the person answering as the other route", async () => {
  state.asked = true;
  const run = await advance("awaiting_release");
  assert.equal(run.status, 1, run.stdout);
  const [above] = run.stderr.split("What refused it:\n");
  assert.match(above, /The person it asked answers it on the tracker, and this move then goes through as it stands; or,/u, above);
});

test("a refusal for anything else names no voiding route", async () => {
  state.asked = false;
  const held = state.answer.forge_issues;
  state.answer.forge_issues = (args) => (args.action === "transition" ? { refused: "NO_OP: issue already in toStatus" } : held(args));
  try {
    const run = await advance("awaiting_release");
    assert.equal(run.status, 1, run.stdout);
    assert.doesNotMatch(run.stderr, /--void-questions/u, run.stderr);
  } finally {
    state.answer.forge_issues = held;
  }
});

test("a blank sentence, or the flag beside a form that sends no terminal move, is refused before anything is sent", async () => {
  state.asked = true;
  const refused = [
    [["--void-questions", "   "], /--void-questions is blank/u],
    [["--owed", "--void-questions", "why"], /--owed sends none/u],
    [["--park", "blocked", "--why", "w", "--void-questions", "why"], /--park sends none/u],
    [["--reopen", "--why", "w", "--void-questions", "why"], /--reopen sends none/u],
    [["--set", "testing", "--why", "w", "--void-questions", "why"], /this set goes to testing/u],
  ];
  for (const [argv, said] of refused) {
    const run = await advance("awaiting_release", ...argv);
    assert.equal(run.status, 1, `${argv.join(" ")}: ${run.stdout}`);
    assert.match(run.stderr, said, `${argv.join(" ")}: ${run.stderr}`);
    assert.deepEqual(state.sent, [], `${argv.join(" ")} sent nothing`);
  }
});

test("a plain advance whose next status is not closed or dropped is refused, naming it", async () => {
  state.asked = false;
  const run = await advance("testing", "--void-questions", "why");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /this advance goes to awaiting_release\. Nothing was sent\./u, run.stderr);
  assert.deepEqual(state.sent, []);
});
