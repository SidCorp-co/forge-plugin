/* The verdict write asks the judging rung's question about its own writer before it sends anything,
   because the page keeps the latest verdict per criterion and one the rung never counts would take a
   judge's place (ISS-2206). Each case reads what the tracker fixture received, not only the exit. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-writer").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const MASTER = "the-dispatching-master";
const BUILDER = "the-builder-run";
const JUDGE = "the-judging-run";
const OUTSIDE_BUILDER = "the-outside-builder";
const MERGED = "c8c35500000000000000000000000000000000ab";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";
const PLACE = "https://shop.example.test/products/jersey";
const AT = "2026-10-02T08:00:00.000Z";
const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const INDEPENDENT = { autoProdDeploy: true, qa: "independent" };

let clock = 0;
const at = () => `2026-10-02T09:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const liveLease = (holder, history = []) => ({
  holder, renewedAt: new Date().toISOString(), minutes: 60, history,
});

const inGit = {
  documentId: "in-git-uuid", issueId: "ISS-9", status: "developed", title: "a change judged in git",
  description: "here", plan: PLAN, acceptanceCriteria: CRITERIA, mergedAt: AT, attachments: [],
  sessionContext: {
    landing: { state: "judged", builder: BUILDER, branch: "iss-9-1", head: MERGED, base: MERGED,
      candidate: DEPLOYED, deployment: DEPLOYED, files: ["a.mjs"], at: AT },
  },
};
const outsideGit = {
  documentId: "outside-uuid", issueId: "ISS-10", status: "developed", title: "a change judged outside git",
  description: "here", plan: PLAN, acceptanceCriteria: CRITERIA, mergedAt: AT, mergedLanding: PLACE,
  landingShape: "outside_git", attachments: [], sessionContext: {},
};
const ISSUES = { "ISS-9": inGit, "ISS-10": outsideGit };

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: INDEPENDENT },
  issues: [inGit, outsideGit],
  comments: { "in-git-uuid": [], "outside-uuid": [] },
  answer: {},
};
const byId = (args) => Object.values(ISSUES).find((one) => [one.documentId, one.issueId].includes(args.documentId))
  ?? Object.values(ISSUES).find((one) => one.issueId === args.filters?.issueId) ?? inGit;
state.answer.forge_config = () => ({ config: state.config });
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return byId(args);
  if (args.action === "update" || args.action === "transition") return Object.assign(byId(args), args.data);
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

/* An inherited caller holds no FORGE_SESSION_ID at all and the harness's id instead; every other
   caller names its own. */
const as = (id, inherited = false) => {
  const env = { ...ENV, ...(inherited ? { CLAUDE_CODE_SESSION_ID: id } : { FORGE_SESSION_ID: id }) };
  if (inherited) delete env.FORGE_SESSION_ID;
  /* A write's first send is held to deliver the comments this caller has not read: the second is
     the write the case is about. */
  return async (...argv) => {
    const first = await ranAsync(FORGE, argv, env);
    return /has not been shown/u.test(`${first.stdout}${first.stderr}`) ? ranAsync(FORGE, argv, env) : first;
  };
};
const said = (run) => `${run.stdout}\n${run.stderr}`;
const posted = (issue) => state.comments[issue.documentId].length;
/* The verdict record among what one write posted, which can carry more than that record. */
const verdictSince = (issue, from) =>
  state.comments[issue.documentId].slice(from).map((one) => one.body).find((body) => /^## Verdict$/mu.test(body)) ?? "";

const VERDICT_GIT = ["record", "verdict", "ISS-9", "--commit", MERGED, "--evidence", DEPLOYED,
  "--verdict", "pass", "--criterion", "1", "--criterion", "2"];

before(() => {
  for (const issue of [inGit, outsideGit]) {
    state.comments[issue.documentId].push({ documentId: `mark-${issue.issueId}`, createdAt: at(),
      body: issue === inGit ? `mark_merged target=base — merged to master at ${MERGED}`
        : `mark_merged target=base — landed outside git, at the place this mark's landing names\n`
          + `this mark names where the work landed outside git: \`merged_landing\` holds ${PLACE}.` });
  }
});

test("an inherited verdict is refused before anything is sent, and the route is the same call under an id of its own", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  inGit.sessionContext.lease = liveLease(MASTER);
  const before = posted(inGit);
  const run = await as(MASTER, true)(...VERDICT_GIT);
  assert.equal(run.status, 1, said(run));
  assert.equal(posted(inGit), before, "nothing reached the tracker");
  assert.match(said(run), /carries the judge id `the-dispatching-master`, which the record says the run inherited/u, said(run));
  assert.match(said(run), /Nothing was sent\./u, said(run));
  assert.ok(said(run).includes(`  FORGE_SESSION_ID=<an id of its own> forge ${VERDICT_GIT.join(" ")}`),
    `every flag the caller typed comes back after the prefix:\n${said(run)}`);
});

test("the builder's own verdict is refused before anything is sent, and the route is the judging rung's read", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  inGit.sessionContext.lease = liveLease(MASTER);
  const before = posted(inGit);
  const run = await as(BUILDER)(...VERDICT_GIT);
  assert.equal(run.status, 1, said(run));
  assert.equal(posted(inGit), before, "nothing reached the tracker");
  assert.match(said(run), /carries the builder's own id `the-builder-run`/u, said(run));
  assert.match(said(run), /^ {2}forge advance ISS-9 --owed$/mu, said(run));
});

test("outside git, a run that held the issue while it was built is refused as the builder", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  outsideGit.sessionContext.lease = liveLease(MASTER, [{ at: AT, how: "write", holder: OUTSIDE_BUILDER, status: "in_progress" }]);
  const before = posted(outsideGit);
  const run = await as(OUTSIDE_BUILDER)("record", "verdict", "ISS-10", "--landing", PLACE, "--evidence", DEPLOYED,
    "--verdict", "pass", "--criterion", "1");
  assert.equal(run.status, 1, said(run));
  assert.equal(posted(outsideGit), before, "nothing reached the tracker");
  assert.match(said(run), /carries the builder's own id `the-outside-builder`/u, said(run));
});

test("a judge under an id of its own is written past the master's lease", async () => {
  state.config.pipelineConfig = INDEPENDENT;
  inGit.sessionContext.lease = liveLease(MASTER);
  const before = posted(inGit);
  const run = await as(JUDGE)(...VERDICT_GIT);
  assert.equal(run.status, 0, said(run));
  assert.match(verdictSince(inGit, before), /^judge: the-judging-run$/mu, "the verdicts went up under the judge's id");
  assert.equal(inGit.sessionContext.lease.holder, MASTER, "and the master's lease stands as it was");
});

test("where the project asks for no second judge, an inherited verdict is written as before", async () => {
  state.config.pipelineConfig = { autoProdDeploy: true };
  inGit.sessionContext.lease = liveLease(MASTER);
  const before = posted(inGit);
  const run = await as(MASTER, true)(...VERDICT_GIT);
  assert.equal(run.status, 0, said(run));
  assert.match(verdictSince(inGit, before), /^judge-from: inherited$/mu, "the verdicts went up as inherited");
});
