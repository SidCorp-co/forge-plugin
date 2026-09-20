/* The write that puts a judged rejection back in front of whoever ranks work to be built. It had
   none: a blocking judgement reached `reopen` only through `--set`, which leaves a correction
   saying no entry check read the status, or through a park into `on_hold`, which nothing ranks
   (ISS-1815). */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("advance-reopen").path;
const { SHAPES } = await import("../../../src/flow/machine.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-09-18T09:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) =>
  ({ documentId: `comment-${clock + 1}`, createdAt: at(), authorId: "agent", body, ...extra });

const MARKED = "2026-09-18T08:00:00.000Z";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CRITERIA = "1. The list comes back in the order the criterion names.";
/* The change a judge blocked: it landed, so the mark is what says where a reopen goes back to. */
const JUDGED = {
  documentId: "judged-uuid",
  issueId: "ISS-90",
  status: "developed",
  title: "the change a judge found broken",
  description: "no body worth reading",
  mergedAt: MARKED,
  reopenCount: 0,
  plan: PLAN,
  acceptanceCriteria: CRITERIA,
  attachments: [{ name: "shot.png" }],
  complexity: "m",
};
/* Nothing landed and nothing was dropped, so no record on it says what the work got to. */
const UNLANDED = {
  documentId: "unlanded-uuid",
  issueId: "ISS-91",
  status: "in_progress",
  title: "the change still being written",
  description: "no body worth reading",
  plan: PLAN,
  acceptanceCriteria: CRITERIA,
  complexity: "m",
};

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [JUDGED, UNLANDED],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") {
        const wanted = String(args.filters?.search ?? "").toLowerCase();
        const rows = state.issues.filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
        return { issues: rows, returned: rows.length, hasMore: false };
      }
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) {
        /* The tracker's own count, which is what stamps the pair a reopen is routed by. */
        if (args.data.status === "reopen") found.reopenCount = (found.reopenCount ?? 0) + 1;
        found.status = args.data.status;
        const answer = { ...found };
        /* A tracker that answers the move without its own count of the reopens, which is the one
           thing the pair under a reopen is keyed by. */
        if (state.countless) delete answer.reopenCount;
        return answer;
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = comment(args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, ""));
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-90", "--unheld"], tracker.env);
await ranAsync(FORGE, ["claim", "ISS-91", "--unheld"], tracker.env);

const ran = (argv) => ranAsync(FORGE, argv, tracker.env);
const bodies = (id) => (state.comments[id] ?? []).map((one) => one.body);
const holds = (id, kind) => bodies(id).filter((one) => one.includes(`forge-record: ${kind}`)).length;

test("a reopen moves the status and writes no correction for it", async () => {
  const before = holds("judged-uuid", "correction");
  const run = await ran(["advance", "ISS-90", "--reopen", "--why", "the list comes back in the order it was filed"]);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ISS-90 {2}developed -> reopen$/mu);
  assert.equal(JUDGED.status, "reopen");
  assert.equal(holds("judged-uuid", "correction"), before, "an ordinary outcome leaves no override on the record");
  assert.match(run.stdout, /no finding: what was expected, what was seen/u,
    "and the move says what the reopen now owes, so nothing is learned from a refusal later");
});

test("a reopen is refused where nothing on the record says what the work got to", async () => {
  const run = await ran(["advance", "ISS-91", "--reopen", "--why", "somebody thinks it is wrong"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /nothing landed, and no park record of kind dropped/u, run.stderr);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.equal(UNLANDED.status, "in_progress", "and the status the refusal describes is the one it still holds");
});

/* The reopen is the judge's own act. A run that meant only to say a criterion failed is not carried
   out of its own queue by saying it, and a run that means to reopen types the reopen. */
test("a failing verdict moves no status, the reopen being an act of its own", async () => {
  Object.assign(JUDGED, { status: "developed", reopenCount: 0 });
  const run = await ran(["record", "verdict", "ISS-90", "--criterion", "1", "--verdict", "fail",
    "--commit", "43b811e", "--evidence", "shot.png", "--why", "the order is the one it was filed in"]);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(JUDGED.status, "developed", "the verdict is a refusal of the advance and not a move");
});

/* The whole walk a judging run makes, which is what the issue was filed for: a blocked change at the
   judging rung, and a building rung at the end of it with no person anywhere in between. */
test("a judge's reopen, finding and triage carry the issue down to a building rung", async () => {
  Object.assign(JUDGED, { status: "developed", reopenCount: 0 });
  const reopened = await ran(["advance", "ISS-90", "--reopen", "--why", "criterion 1 is not met on what is running"]);
  assert.equal(reopened.status, 0, `${reopened.stdout}${reopened.stderr}`);
  /* No quote: this run saw it, and what it has instead is what it captured. */
  const found = await ran(["record", "finding", "ISS-90", "--criterion", "1",
    "--expected", "the list in the order criterion 1 names", "--seen", "the order it was filed in",
    "--evidence", "shot.png"]);
  assert.equal(found.status, 0, `${found.stdout}${found.stderr}`);
  const ruled = await ran(["record", "triage", "ISS-90", "--outcome", "not-met",
    "--would-have-caught", "a verdict taken against the running deployment"]);
  assert.equal(ruled.status, 0, `${ruled.stdout}${ruled.stderr}`);
  /* A reopen judges again, so the verdict that supersedes is the one written after the ruling. */
  const judged = await ran(["record", "verdict", "ISS-90", "--criterion", "1", "--verdict", "fail",
    "--commit", "43b811e", "--evidence", "shot.png", "--why", "the order is the one it was filed in"]);
  assert.equal(judged.status, 0, `${judged.stdout}${judged.stderr}`);
  const moved = await ran(["advance", "ISS-90"]);
  assert.equal(moved.status, 0, `${moved.stdout}${moved.stderr}`);
  assert.equal(JUDGED.status, "in_progress", "which is the rung a builder's queue reads");
  assert.equal(holds("judged-uuid", "correction"), 0, "and nothing on the record calls this an override");
});

/* Each look is stamped with the reopen it belongs to, so the shortfall printed under a second reopen
   is read against the count that reopen made — not the one this call arrived holding, which would
   hand a judge the last look's pair and say the record already earns the fall. */
test("a second reopen asks for its own finding and triage, not the pair the first one left", async () => {
  const again = await ran(["advance", "ISS-90", "--reopen", "--why", "the order came back wrong again"]);
  assert.equal(again.status, 0, `${again.stdout}${again.stderr}`);
  assert.equal(JUDGED.reopenCount, 2, "the tracker counted the second look");
  assert.match(again.stdout, /1 finding record\(s\), and none of them this reopen's/u, again.stdout);
  assert.match(again.stdout, /1 triage record\(s\), and none of them this reopen's/u);
});

test("a move whose answer carries no count asks what the reopen owes rather than guessing", async () => {
  Object.assign(JUDGED, { status: "developed" });
  state.countless = true;
  const run = await ran(["advance", "ISS-90", "--reopen", "--why", "a third look, on a tracker that counts none"]);
  delete state.countless;
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /its answer to this move carried none:\n {2}forge advance ISS-90 --owed/u, run.stdout);
});

test("a finding through the verb is refused where it quotes nobody and captured nothing", async () => {
  const run = await ran(["record", "finding", "ISS-90", "--expected", "the order criterion 1 names",
    "--seen", "the order it was filed in"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /quotes nobody and captured nothing/u, run.stderr);
  assert.match(run.stderr, /--quoted .+ or --evidence /u, "and the refusal names both grounds");
});

/* The two grounds a finding stands on, beside the write they were widened for: `--quoted` was
   mandatory, so the one actor the flow dispatches to look — having nobody to quote — had no whole
   finding to write, and its judgement could reach no status a queue offers. */
const WHOLE = { expected: "the list sorted by name", seen: "sorted by id", evidence: ["shot.png"], quoted: "I cannot find anything in it" };
const field = (flag) => SHAPES.finding.fields.find((one) => one.flag === flag);

test("a person's word and a run's own capture are each a whole finding", () => {
  const { check } = SHAPES.finding;
  assert.equal(check({ ...WHOLE, quoted: undefined }), null, "what the run captured stands on its own");
  assert.equal(check({ ...WHOLE, evidence: [] }), null, "and so does a person's word with no artifact");
  assert.ok(field("quoted").optional, "a quote is a person's word and never a run's own");
  assert.equal(field("evidence").least, 0, "and each is a ground, so the shape's check is what refuses");
});

test("a finding that quotes nobody and captured nothing is refused, naming both grounds", () => {
  const said = SHAPES.finding.check({ ...WHOLE, quoted: undefined, evidence: [] });
  assert.match(said, /quotes nobody and captured nothing/u);
  assert.match(said, /--quoted .+ or --evidence /u);
});
