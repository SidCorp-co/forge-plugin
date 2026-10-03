/* The verdict write names the runtime a judge exercised beside the source it read, whole, and where a
   second judge is asked for at a checkpoint naming a deployment, a verdict saying somebody looked owes
   one: a commit says which code was read and never that it ran (ISS-2279). Each case reads what the
   tracker fixture received, not only the exit. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-runtime-write").path;
const { parseAll } = await import("../../../../src/flow/record/page.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-run";
const JUDGE = "the-judging-run";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const AT = "2026-10-03T08:00:00.000Z";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const INDEPENDENT = { autoProdDeploy: true, qa: "independent" };
const BUILDER_JUDGES = { autoProdDeploy: true, qa: "builder" };

let clock = 0;
const at = () => `2026-10-03T09:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const judged = {
  documentId: "runtime-uuid", issueId: "ISS-9", status: "developed", title: "a change judged at a deployment",
  description: "here", plan: PLAN, acceptanceCriteria: CRITERIA, mergedAt: AT, attachments: [],
  sessionContext: {
    landing: { state: "judged", builder: BUILDER, branch: "iss-9-1", head: MERGED, base: MERGED,
      candidate: DEPLOYED, deployment: DEPLOYED, files: ["a.mjs"], at: AT },
    /* Another run's, live: a verdict goes up past it, which is the judge's ordinary position. */
    lease: { holder: "the-landing-run", renewedAt: new Date().toISOString(), minutes: 60, history: [] },
  },
};

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: INDEPENDENT },
  issues: [judged],
  comments: { "runtime-uuid": [] },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return judged;
  if (args.action === "update" || args.action === "transition") return Object.assign(judged, args.data);
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

/* A write's first send is held to deliver the comments this caller has not read: the second is the
   write the case is about. */
const asJudge = async (...argv) => {
  const env = { ...ENV, FORGE_SESSION_ID: JUDGE };
  const first = await ranAsync(FORGE, argv, env);
  /* Only a refused first send: one that went up and then met an unread comment is not sent twice. */
  return first.status !== 0 && /has not been shown/u.test(`${first.stdout}${first.stderr}`) ? ranAsync(FORGE, argv, env) : first;
};
const said = (run) => `${run.stdout}\n${run.stderr}`;
const writesSince = (from) => (state.calls ?? []).slice(from).filter((one) => one.method !== "GET");
const verdictsSince = (from) => state.comments["runtime-uuid"].slice(from).map((one) => one.body)
  .filter((body) => /^## Verdict$/mu.test(body)).flatMap((body) => parseAll(body));
const verdict = (...tail) => ["record", "verdict", "ISS-9", "--commit", MERGED, ...tail];

before(() => {
  state.comments["runtime-uuid"].push({ documentId: "mark", createdAt: at(),
    body: `mark_merged target=base — merged to master at ${MERGED}` });
});

test("a runtime is written beside the commit, and each criterion's block reads back carrying it", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  const from = state.comments["runtime-uuid"].length;
  const run = await asJudge(...verdict("--runtime", DEPLOYED, "--evidence", "https://ci.example.test/9",
    "--verdict", "pass", "--criterion", "1", "--criterion", "2"));
  assert.equal(run.status, 0, said(run));
  const stored = state.comments["runtime-uuid"].slice(from).map((one) => one.body).find((body) => /^## Verdict$/mu.test(body));
  assert.equal(stored.match(new RegExp(`^runtime: ${DEPLOYED}$`, "gmu")).length, 2,
    `one runtime line per criterion, in the key forge-core reads:\n${stored}`);
  assert.deepEqual(verdictsSince(from).map((one) => [one.fields.criterion.split(" ")[0], one.fields.runtime, one.fields.commit]),
    [["1", DEPLOYED, MERGED], ["2", DEPLOYED, MERGED]], "and each block reads back with the runtime and the commit both");
});

test("an abbreviated runtime is refused before anything is sent, naming the abbreviation", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  const from = state.calls?.length ?? 0;
  const run = await asJudge(...verdict("--runtime", DEPLOYED.slice(0, 12), "--evidence", "https://ci.example.test/9",
    "--verdict", "pass", "--criterion", "1"));
  assert.equal(run.status, 1, said(run));
  assert.deepEqual(writesSince(from), [], "nothing reached the tracker");
  assert.match(said(run), new RegExp(`--runtime in full, not the abbreviation \`${DEPLOYED.slice(0, 12)}\``, "u"), said(run));
  assert.match(said(run), /named by its whole object id/u, said(run));
});

test("a runtime that is no object id is refused before anything is sent, naming the value", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  const from = state.calls?.length ?? 0;
  const run = await asJudge(...verdict("--runtime", "staging-v2", "--evidence", "https://ci.example.test/9",
    "--verdict", "pass", "--criterion", "1"));
  assert.equal(run.status, 1, said(run));
  assert.deepEqual(writesSince(from), [], "nothing reached the tracker");
  assert.match(said(run), /not `staging-v2`, which is no object id/u, said(run));
});

test("the verdict help lists --runtime and says it is read off the deployment, never a branch head", async () => {
  const run = await ranAsync(FORGE, ["record", "verdict", "-h"], ENV);
  assert.equal(run.status, 0, said(run));
  assert.match(run.stdout, /^ {2}verdict .*\[--runtime R\]/mu, run.stdout);
  assert.match(run.stdout, /^--runtime takes the whole id the deployment reports, never a branch head\.$/mu, run.stdout);
});

test("under a second judge at a deployment, a looked verdict naming no runtime is refused with both routes", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  const from = state.calls?.length ?? 0;
  const run = await asJudge(...verdict("--evidence", DEPLOYED, "--verdict", "pass", "--criterion", "1",
    "--criterion", "2", "--verdict", "fail", "--why", "printed nothing"));
  assert.equal(run.status, 1, said(run));
  assert.deepEqual(writesSince(from), [], "nothing reached the tracker");
  assert.match(said(run), /the verdict on criterion 1, 2 names no --runtime/u, said(run));
  assert.match(said(run), /^ {2}--runtime <the whole object id the deployment reports serving>$/mu, said(run));
  assert.match(said(run), /^ {2}or: --verdict skipped --why "<what kept you from exercising it>"$/mu, said(run));
});

test("under a second judge, a skip naming no runtime is written, nobody having exercised anything", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  const from = state.comments["runtime-uuid"].length;
  const run = await asJudge(...verdict("--verdict", "skipped", "--why", "no route reached the deployment", "--criterion", "2"));
  assert.equal(run.status, 0, said(run));
  assert.deepEqual(verdictsSince(from).map((one) => [one.fields.verdict, one.fields.runtime]), [["skipped", undefined]]);
});

test("where the builder judges, a verdict naming only its commit is written as before", async () => {
  state.config.pipelineConfig = BUILDER_JUDGES;
  const from = state.comments["runtime-uuid"].length;
  const run = await asJudge(...verdict("--evidence", DEPLOYED, "--verdict", "pass", "--criterion", "1"));
  assert.equal(run.status, 0, said(run));
  const [held] = verdictsSince(from);
  assert.equal(held.fields.commit, MERGED, said(run));
  assert.equal(held.fields.runtime, undefined, "and it carries no runtime nobody gave");
});
