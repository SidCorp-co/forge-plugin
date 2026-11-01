/* A question record that only went into the thread asked nobody: the issue's own screen read empty
   and the run was told nothing (ISS-2317). The write now asks through the tracker's question route
   first, and these cases hold the order, the refusals that come before it and the retry after it. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("question").path;
const { render } = await import("../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-10-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body) => ({ documentId: `comment-${clock + 1}`, createdAt: at(), authorId: "agent", body });

const ASKING = {
  documentId: "asking-uuid",
  issueId: "ISS-99",
  status: "in_progress",
  workState: { step: "plan" },
  title: "the verb that has to ask somebody",
  description: "no mark here",
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ASKING],
  comments: {},
  questions: [],
  answer: {
    forge_config: (args) => (args.action === "gates" ? { profile: state.profile ?? null } : { config: state.config }),
    forge_issues: (args) => {
      if (args.action === "transition") {
        ASKING.status = args.data.status;
        return { ...ASKING };
      }
      return args.action === "update" ? Object.assign(ASKING, args.data) : undefined;
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        if (state.refuseComment) return { refused: state.refuseComment };
        const one = comment(args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, ""));
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId, authorDeviceId: "a-fake-device" };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
    forge_questions: (args) => (args.action === "ask" && state.refuseAsk ? { refused: state.refuseAsk } : undefined),
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], ENV);

const READINGS = ["keep the name -> nothing moves", "rename it -> every caller changes"];
/* The default question addresses the master, which is taken on any project (`blockerKind:
   master_or_peer`); a question to a person is `toPerson`, refused off a strict project. */
const record = (...extra) => ranAsync(FORGE, ["record", "question", "ISS-99",
  ...READINGS.flatMap((one) => ["--reading", one]), "--to", "master", ...extra], ENV);
const toPerson = (...extra) => ranAsync(FORGE, ["record", "question", "ISS-99",
  ...READINGS.flatMap((one) => ["--reading", one]), ...extra], ENV);

const fresh = () => {
  Object.assign(ASKING, { status: "in_progress", workState: { step: "plan" } });
  state.comments["asking-uuid"] = [];
  state.questions = [];
  state.profile = null;
  state.calls.length = 0;
};
const asks = () => state.calls.filter((one) => one.name === "forge_questions" && one.args.action === "ask");
const posted = () => state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create");

test("a question record asks on the issue first, its readings the options and the named one recommended", async () => {
  fresh();
  const run = await record("--recommend", "2");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(asks().length, 1, "one question is asked");
  const sent = asks()[0].args.data;
  assert.equal(sent.issueId, "asking-uuid");
  assert.equal(sent.blockerKind, "master_or_peer", "--to master rides the ask as blockerKind");
  assert.equal(sent.serious, undefined, "and nothing marks it serious");
  assert.deepEqual(sent.options.map((one) => one.label), READINGS, "each reading is an option, in order");
  assert.equal(sent.recommendedOptionId, sent.options[1].id, "the second reading is the recommended one");
  const asked = state.calls.findIndex((one) => one.name === "forge_questions" && one.args.action === "ask");
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.ok(asked >= 0 && wrote > asked, `the question goes before the record: asked ${asked}, wrote ${wrote}`);
  assert.match(run.stdout, /asked: question question-1\b/u, "and the id it was given is printed");
  assert.match(state.comments["asking-uuid"].at(-1).body, /^recommend: 2$/mu, "the record carries the recommendation");
});

test("a question the tracker refuses leaves no record on the issue", async () => {
  fresh();
  state.refuseAsk = "QUESTION_MESSAGE_REFUSED: the prompt reads as an instruction";
  const run = await record("--recommend", "1");
  delete state.refuseAsk;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /QUESTION_MESSAGE_REFUSED: the prompt reads as an instruction/u, "in the tracker's own words");
  assert.equal(posted().length, 0, "no comment claims a question nobody was asked");
});

test("a question record with no recommendation, or one naming no reading, writes nothing", async () => {
  for (const extra of [[], ["--recommend", "3"], ["--recommend", "two"]]) {
    fresh();
    const run = await record(...extra);
    assert.equal(run.status, 1, `${extra.join(" ")}: ${run.stdout}`);
    assert.match(run.stderr, /--recommend/u, run.stderr);
    assert.equal(asks().length + posted().length, 0, `${extra.join(" ")} sent a write`);
  }
});

/* The record's own field budget (400) is under the 500 an option label takes, so a reading that long
   is refused by the budget first, naming the field, its length and the cap. */
test("a reading longer than a record field takes is refused by the budget, before any write", async () => {
  fresh();
  const run = await ranAsync(FORGE, ["record", "question", "ISS-99", "--reading", `${"long ".repeat(110)}-> outcome`,
    "--reading", READINGS[1], "--recommend", "2"], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /record question: --reading is 560 code points and its cap is 400/u, run.stderr);
  assert.equal(asks().length + posted().length, 0);
});

test("more readings than a question takes options, or a prompt over the route's cap, is refused before any write", async () => {
  fresh();
  const many = await ranAsync(FORGE, ["record", "question", "ISS-99",
    ...Array.from({ length: 11 }, (_, at) => ["--reading", `reading ${at} -> outcome ${at}`]).flat(), "--recommend", "1"], ENV);
  assert.equal(many.status, 1, many.stdout);
  assert.match(many.stderr, /would offer 11 readings and the question route takes 10 options/u, many.stderr);
  const title = ASKING.title;
  ASKING.title = "a title ".repeat(1000);
  const long = await record("--recommend", "1");
  ASKING.title = title;
  assert.equal(long.status, 1, long.stdout);
  assert.match(long.stderr, /characters and the route takes 8000/u, long.stderr);
  assert.equal(asks().length + posted().length, 0);
});

test("a call repeated after its question was asked and its comment was not asks nothing twice", async () => {
  fresh();
  state.refuseComment = "INTERNAL_ERROR: the comment was not stored";
  const first = await record("--recommend", "2");
  delete state.refuseComment;
  assert.equal(first.status, 1, first.stdout);
  assert.equal(state.questions.length, 1, "the first call's question was asked");
  assert.equal(state.comments["asking-uuid"].length, 0, "and its record did not go up");
  const again = await record("--recommend", "2");
  assert.equal(again.status, 0, `${again.stdout}${again.stderr}`);
  assert.equal(asks().length, 1, "both calls together ask once");
  assert.match(again.stdout, /question question-1 already asks these readings/u, "and the retry names that question");
  assert.equal(state.comments["asking-uuid"].length, 1, "and the record it lacked goes up");
});

test("a retry recommending another reading than the open question does is refused, and writes nothing", async () => {
  fresh();
  state.refuseComment = "INTERNAL_ERROR: the comment was not stored";
  await record("--recommend", "1");
  delete state.refuseComment;
  state.calls.length = 0;
  const run = await record("--recommend", "2");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /recommending reading 1, and this call recommends reading 2/u, run.stderr);
  assert.match(run.stderr, /--recommend 1/u, "and the flag that matches it is named");
  assert.equal(asks().length + posted().length, 0);
});

test("a question park over a record written before the recommendation existed parks the issue", async () => {
  fresh();
  state.comments["asking-uuid"] = [comment(render("question", { reading: READINGS }))];
  assert.doesNotMatch(state.comments["asking-uuid"][0].body, /recommend/u, "the record is in the old shape");
  const run = await ranAsync(FORGE, ["advance", "ISS-99", "--park", "question", "--why",
    "which name the verb keeps"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(ASKING.status, "needs_info");
});

test("the kind's help names the recommendation and says where the person is asked", async () => {
  const run = await ranAsync(FORGE, ["record", "question", "-h"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--recommend N/u);
  assert.match(run.stdout, /asks a person on the issue's own screen/u);
});

/* The ask is a write of the call like the comment is, so the lease that refuses the comment refuses
   it first: asked after, a run with no right to the issue would leave a question there (ISS-3101). */
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const THEIRS = "iss-99-another-run";

test("a question record on an issue another run holds is refused before the ask, and sends nothing", async () => {
  fresh();
  const ours = ASKING.sessionContext;
  ASKING.sessionContext = { lease: { holder: THEIRS, agent: "a-test-agent", pid: "4242", renewedAt: ago(2), minutes: 60,
    next: "Phase 4: implementing", history: [{ holder: THEIRS, at: ago(2), how: "claim", status: "in_progress:plan", next: null }] } };
  const run = await record("--recommend", "1");
  ASKING.sessionContext = ours;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`held by another run: session ${THEIRS}`, "u"), run.stderr);
  assert.equal(asks().length, 0, "no question is asked by a run the record is refused for");
  assert.equal(posted().length, 0, "and no comment goes up");
});

test("a question record on an issue this run holds writes the lease before it asks", async () => {
  fresh();
  const run = await record("--recommend", "1");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const leased = state.calls.findIndex((one) => one.name === "forge_issues" && one.args.action === "update"
    && one.args.data?.sessionContext);
  const asked = state.calls.findIndex((one) => one.name === "forge_questions" && one.args.action === "ask");
  assert.ok(leased >= 0 && asked > leased, `the lease write goes before the ask: leased ${leased}, asked ${asked}`);
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  const leases = state.calls.slice(0, wrote).filter((one) => one.name === "forge_issues" && one.args.action === "update"
    && one.args.data?.sessionContext);
  assert.equal(leases.length, 1, "and that write stands for the comment's own renewal");
});

/* Core refuses a person a question the run may decide itself (QUESTION_AGENT_DECIDES); the verb reads
   the project's profile and refuses before the ask, naming the decision record and the master route. */
test("a question to a person the run may decide is refused before the ask, naming the way out", async () => {
  fresh();
  const run = await toPerson("--recommend", "1");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /QUESTION_AGENT_DECIDES/u, run.stderr);
  assert.match(run.stderr, /forge record decision ISS-99/u, "the decision record is named");
  assert.match(run.stderr, /--to master/u, "and so is the master route");
  assert.equal(asks().length + posted().length, 0, "nothing was sent");
});

test("--to master is taken on a non-strict project and rides the ask as blockerKind", async () => {
  fresh();
  const run = await record("--recommend", "1");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(asks()[0].args.data.blockerKind, "master_or_peer");
  assert.equal(state.calls.some((one) => one.name === "forge_config" && one.args.action === "gates"), false,
    "and the profile is not read where no block is a serious one to a person");
});

test("a serious question to a person is taken on a strict project and marked serious", async () => {
  fresh();
  state.profile = "strict";
  const run = await toPerson("--serious", "--recommend", "1");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(asks().length, 1, "the ask goes up");
  assert.equal(asks()[0].args.data.serious, true, "and carries serious");
  assert.equal(asks()[0].args.data.blockerKind, undefined, "to a person, not the master");
});

test("a serious question to a person off a strict project is refused", async () => {
  fresh();
  state.profile = "standard";
  const run = await toPerson("--serious", "--recommend", "1");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /QUESTION_AGENT_DECIDES/u, run.stderr);
  assert.match(run.stderr, /not strict/u, "the profile it read is why");
  assert.equal(asks().length + posted().length, 0, "nothing was sent");
});

/* Readings and the recommendation alone matched a person-directed open question to a `--to master`
   retry, recording a recipient no question held (codex F1). The retry now refuses the mismatch. */
test("a retry that changes an open question's recipient is refused, both directions, writing nothing", async () => {
  fresh();
  state.profile = "strict";
  state.refuseComment = "INTERNAL_ERROR: the comment was not stored";
  const toPersonFirst = await toPerson("--serious", "--recommend", "1");
  assert.equal(toPersonFirst.status, 1, toPersonFirst.stdout);
  assert.equal(state.questions.length, 1, "the person-directed question was asked");
  state.calls.length = 0;
  const toMasterNext = await record("--recommend", "1");
  assert.equal(toMasterNext.status, 1, toMasterNext.stdout);
  assert.match(toMasterNext.stderr, /addressed to a person.*asks the master/su, toMasterNext.stderr);
  assert.equal(asks().length + posted().length, 0, "nothing was sent on the forward mismatch");

  fresh();
  state.profile = "strict";
  state.refuseComment = "INTERNAL_ERROR: the comment was not stored";
  const toMasterFirst = await record("--recommend", "1");
  assert.equal(toMasterFirst.status, 1, toMasterFirst.stdout);
  assert.equal(state.questions.length, 1, "the master-directed question was asked");
  state.calls.length = 0;
  const toPersonNext = await toPerson("--serious", "--recommend", "1");
  delete state.refuseComment;
  assert.equal(toPersonNext.status, 1, toPersonNext.stdout);
  assert.match(toPersonNext.stderr, /addressed to the master.*asks a person, marked serious/su, toPersonNext.stderr);
  assert.equal(asks().length + posted().length, 0, "nothing was sent on the reverse mismatch");
});

test("the kind's help names the agent-decides refusal and the two routes out", async () => {
  const run = await ranAsync(FORGE, ["record", "question", "-h"], ENV);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /QUESTION_AGENT_DECIDES/u);
  assert.match(run.stdout, /--to master/u);
  assert.match(run.stdout, /--serious/u);
});
