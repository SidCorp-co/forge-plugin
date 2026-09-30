/* The merged mark's commit, as the tracker holds it: the verb sends `--at` as the typed field, and
   because the tracker keeps the first stamp a row carries, a mark over a stamp naming no commit or
   another one is refused before it is written, and what the row holds after a write is read back
   rather than assumed (ISS-1808). The fake below keeps the first stamp as the tracker does. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("record-merged-commit").path;

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const ROOM = tempRoom("record-merged-commit-repo-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM, encoding: "utf8" });
const commit = (text) => {
  writeFileSync(join(ROOM, "a.txt"), text);
  git(ROOM, "add", "a.txt");
  git(ROOM, "commit", "-qm", text);
  return git(ROOM, "rev-parse", "HEAD").stdout.trim();
};
const FIRST = commit("the first landing\n");
const SECOND = commit("the second landing\n");

const ISSUE = {
  documentId: "merged-commit-uuid",
  issueId: "ISS-99",
  status: "in_progress",
  title: "a mark whose commit the tracker holds",
  description: "no plan needed for this suite",
  complexity: "s",
};

/* What the tracker answers a mark with, off the row it keeps: `observed` stands in for a merge the
   tracker saw for itself, which is the one commit it stamps into the column of its own accord. */
const DETAIL = "a claim Forge did not observe: the column stays empty and the note carries the commit";
const tracker$ = { observed: null, answered: null };

const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      state.calls.push(args);
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      if (args.action === "mark_merged") {
        (state.comments[args.data.issueId] ??= []).push({ documentId: `mark-${state.calls.length}`,
          createdAt: "2026-10-01T10:00:00.000Z", authorId: "agent", body: `mark_merged — ${args.data.note}` });
        const wrote = !ISSUE.mergedAt;
        if (wrote) Object.assign(ISSUE, { mergedAt: "2026-10-01T10:00:00.000Z", mergedCommitSha: tracker$.observed });
        return { id: ISSUE.documentId, action: tracker$.answered ?? (wrote ? "merged" : "already_merged"),
          mark: "asserted", detail: DETAIL };
      }
      if (args.action === "unmark") {
        state.comments[args.data.issueId] = [];
        Object.assign(ISSUE, { mergedAt: null, mergedCommitSha: null });
        return { id: ISSUE.documentId, action: "unmarked" };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        (state.comments[args.data.issue] ??= []).push({ documentId: `c-${state.calls.length}`,
          createdAt: "2026-10-01T10:00:00.000Z", authorId: "agent", body: args.data.body });
        return { documentId: `c-${state.calls.length}` };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-99", "--unheld"], ENV, ROOM);

const mark = (at) => ranAsync(FORGE, ["record", "merged", "ISS-99", "--at", at, "--reviewed", at,
  "--judged", at, "--wrote", "a.txt"], ENV, ROOM);
const undo = () => ranAsync(FORGE, ["record", "merged", "ISS-99", "--undo"], ENV, ROOM);
const sent = () => state.calls.filter((one) => one.action === "mark_merged").map((one) => one.data);

test.beforeEach(() => {
  state.comments[ISSUE.documentId] = [];
  state.calls = [];
  Object.assign(ISSUE, { mergedAt: null, mergedCommitSha: null });
  Object.assign(tracker$, { observed: null, answered: null });
});

test("the mark sends --at to the tracker as its commit field", async () => {
  const run = await mark(FIRST);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent().map((one) => one.commit), [FIRST], "the typed field, beside the note that names it");
});

test("a mark over a stamp that names no commit is refused before anything is written", async () => {
  Object.assign(ISSUE, { mergedAt: "2026-09-24T08:00:00.000Z", mergedCommitSha: null });
  const run = await mark(SECOND);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-99 already carries a merged stamp from 2026-09-24T08:00:00\.000Z, naming no commit/u, run.stderr);
  assert.match(run.stderr, /the tracker keeps the first stamp/u, "and why a second mark would not move it");
  assert.match(run.stderr, /^ {2}forge record merged ISS-99 --undo$/mu, "the one command that clears it");
  assert.deepEqual(sent(), [], "no mark went up");
  assert.deepEqual(state.comments[ISSUE.documentId], [], "nor a note the row would contradict");
});

test("a mark over a stamp naming another commit is refused, naming the commit it holds", async () => {
  Object.assign(ISSUE, { mergedAt: "2026-09-24T08:00:00.000Z", mergedCommitSha: FIRST });
  const run = await mark(SECOND);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`from 2026-09-24T08:00:00.000Z, at ${FIRST}`), run.stderr);
  assert.ok(run.stderr.includes(`a mark at ${SECOND} would post a note the row contradicts`), run.stderr);
  assert.deepEqual(sent(), []);
});

test("a mark over a stamp already naming the same commit is written", async () => {
  Object.assign(ISSUE, { mergedAt: "2026-09-24T08:00:00.000Z", mergedCommitSha: SECOND });
  const run = await mark(SECOND.slice(0, 9));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent().map((one) => one.commit), [SECOND.slice(0, 9)], "a prefix of the stamp is that commit");
});

test("undo, then mark, sends the new --at as the commit", async () => {
  Object.assign(ISSUE, { mergedAt: "2026-09-24T08:00:00.000Z", mergedCommitSha: null });
  assert.equal((await undo()).status, 0);
  const run = await mark(SECOND);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(sent().map((one) => one.commit), [SECOND], "the mark after the removal carries its commit");
});

test("a tracker answering already_merged is refused after the write, naming the route", async () => {
  tracker$.answered = "already_merged";
  const run = await mark(FIRST);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the tracker answered `already_merged` for ISS-99: it kept the stamp it held/u, run.stderr);
  assert.ok(run.stderr.includes(`the mark just posted names ${FIRST}`), run.stderr);
  assert.match(run.stderr, /^ {2}forge record merged ISS-99 --undo$/mu);
});

test("a row whose commit field names another commit after the write is refused, naming both", async () => {
  tracker$.observed = SECOND;
  const run = await mark(FIRST);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`ISS-99's mark names ${FIRST} and the row's commit field holds ${SECOND}`), run.stderr);
  assert.match(run.stderr, /^ {2}forge record merged ISS-99 --undo$/mu);
});

test("a row whose commit field holds --at says so", async () => {
  tracker$.observed = FIRST;
  const run = await mark(FIRST);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.split("\n").includes(`The row's commit field holds ${FIRST}.`), run.stdout);
});

test("a row whose commit field is empty says so, in the tracker's own words", async () => {
  const run = await mark(FIRST);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes(`The row's commit field is empty. The tracker's word on this mark: ${DETAIL}`), run.stdout);
});
