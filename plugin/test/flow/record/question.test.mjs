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
  status: "confirmed",
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
    forge_config: () => ({ config: state.config }),
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
const record = (...extra) => ranAsync(FORGE, ["record", "question", "ISS-99",
  ...READINGS.flatMap((one) => ["--reading", one]), ...extra], ENV);

const fresh = () => {
  Object.assign(ASKING, { status: "confirmed" });
  state.comments["asking-uuid"] = [];
  state.questions = [];
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

test("a reading longer than an option label takes is refused by the cap, before any write", async () => {
  fresh();
  const run = await ranAsync(FORGE, ["record", "question", "ISS-99", "--reading", `${"long ".repeat(110)}-> outcome`,
    "--reading", READINGS[1], "--recommend", "2"], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--reading 1 is \d+ characters and an option on the question route takes 500/u, run.stderr);
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
