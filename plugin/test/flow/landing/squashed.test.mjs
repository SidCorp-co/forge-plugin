/* The landing a squash merge made: the branch's work reaches the default branch as one new commit
   whose single parent is the base, so the head the checkpoint was written at is never on it and the
   ancestry read alone refuses for good. The merged mark is the second proof, and it is named on the
   checkpoint rather than read as the first; every case stands a real object store up, a fixture
   built only on merge commits exercising the path that already worked (ISS-3146). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { projectRecord, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("squashed").path;
/* Away from this checkout, whose git directory names the run this suite is written under. */
const AWAY = projectRoom(tempRoom("squashed-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;
const RUN = "the-lander-run";
const BUILDER = "the-builder-run";
const BRANCH = "iss-3146-1";
const AT = "2026-10-03T12:00:00.000Z";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: room, encoding: "utf8" });
const sha = (room, rev = "HEAD") => git(room, "rev-parse", rev).stdout.trim();

const ISSUE = {
  documentId: "squashed-uuid",
  issueId: "ISS-3146",
  status: "developed",
  title: "one flow: a landing a squash merge made",
  description: "no mark here",
};
const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "squashed-uuid": [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "update" || args.action === "transition") {
        state.issues[0] = { ...state.issues[0], ...args.data };
      }
      return state.issues[0];
    },
    forge_comments: (args) => {
      const held = state.comments["squashed-uuid"];
      if (args.action !== "list") {
        held.push({ documentId: `c-${held.length + 1}`, createdAt: AT, authorId: "agent", body: args.data.body });
        return { documentId: `c-${held.length}` };
      }
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state, [AWAY]);
const CHILD_HOME = ENV.HOME;
test.after(() => tracker.close());

const checkpoint = () => landingOf(state.issues[0].sessionContext);

/* The audit comment the mark leaves, in the clauses its readers parse. */
const markSaid = ({ at, reviewed, judged = reviewed }) => ({
  documentId: "c-mark", createdAt: AT, authorId: "agent",
  body: `mark_merged target=base — merged to master at ${at}; reviewed head ${reviewed}; `
    + `judged head ${judged}; landing moved nothing; landing wrote one.mjs`,
});

/* A `ready` checkpoint at `head`, the row's merged commit where `merged` names one, and the mark's
   note where `note` gives its clauses. */
const ready = (head, { merged = null, note = null, landing = {} } = {}) => {
  state.issues[0] = {
    ...ISSUE,
    ...(merged ? { mergedAt: AT, mergedCommitSha: merged } : {}),
    sessionContext: {
      lease: { holder: RUN, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(),
        minutes: 30, next: null, history: [{ holder: BUILDER, status: "in_progress" }, { holder: RUN, status: "developed" }] },
      landing: { state: "ready", builder: BUILDER, branch: BRANCH, head,
        base: "c4890050000000000000000000000000000dcba", files: ["one.mjs"], at: AT, ...landing },
    },
  };
  state.comments["squashed-uuid"] = note ? [markSaid(note)] : [];
};

/* Twice, since the gate every write passes delivers a comment this session has not read and refuses once. */
const ran = async (argv, cwd) => {
  const env = { ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: RUN };
  const held = { issue: state.issues[0], comments: [...state.comments["squashed-uuid"]] };
  let run = null;
  for (const again of [1, 2]) {
    state.issues[0] = held.issue;
    state.comments["squashed-uuid"] = [...held.comments];
    run = await ranAsync(process.execPath, [CLI, ...argv], env, cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const onTop = (room, said) => {
  writeFileSync(join(room, "one.mjs"), `${said}\n`);
  git(room, "add", "one.mjs");
  git(room, "commit", "-qm", said);
  return sha(room);
};

/* A base on master, the judged head on the branch alone, and master moved on by a squash of that
   branch: one new commit whose only parent is the base, which is what a squash merge leaves. */
const squashedRoom = (name, { land = true } = {}) => {
  const room = tempRoom(`squashed-${name}-`);
  spawnSync("git", ["init", "-q", "-b", "master", room], { cwd: dirname(room), encoding: "utf8" });
  projectRecord(room, CHILD_HOME, { slug: "forge-plugin" });
  const base = onTop(room, "the base");
  git(room, "checkout", "-q", "-b", BRANCH);
  onTop(room, "the first step");
  const judged = onTop(room, "the judged head");
  git(room, "checkout", "-q", "master");
  git(room, "merge", "-q", "--squash", BRANCH);
  git(room, "commit", "-qm", "the squash that landed it");
  const squash = sha(room);
  git(room, "update-ref", "refs/remotes/origin/master", land ? squash : base);
  git(room, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");
  assert.equal(sha(room, `${squash}^@`), base, "the squash has the base for its one parent");
  assert.notEqual(git(room, "merge-base", "--is-ancestor", judged, squash).status, 0,
    "and does not carry the judged head");
  return { room, base, judged, squash };
};

test("a squash-merged head ends the landing on the merged mark, and the checkpoint names that proof", async () => {
  const { room, judged, squash } = squashedRoom("proved");
  ready(judged, { merged: squash, note: { at: squash, reviewed: judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done", `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().head, judged, "the head stays the one the review and the verdicts answer for");
  assert.equal(checkpoint().mergeRecord, squash, "and the merge record's commit is held as the proof taken");
  assert.ok(run.stdout.includes(`landed by the merge record at ${squash.slice(0, 7)}, the branch not reaching the head`),
    `the checkpoint line names the proof:\n${run.stdout}`);
  assert.ok(run.stdout.includes(`does not reach ${judged.slice(0, 7)}`), run.stdout);
  assert.ok(run.stdout.includes("the merge record proved this landing and the branch reaching the head did not"),
    `and the closing line says which proof it was:\n${run.stdout}`);
});

/* The note names two heads, and either one ties the mark to this checkpoint: a fix confined to the
   files the review read leaves the reviewed head behind the one the verdicts judged. */
test("a mark naming the checkpoint's head as the judged one alone still proves the landing", async () => {
  const { room, base, judged, squash } = squashedRoom("judged-only");
  ready(judged, { merged: squash, note: { at: squash, reviewed: base, judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done");
  assert.equal(checkpoint().mergeRecord, squash);
});

test("a landing the branch reaches takes no merge record, whatever the mark says", async () => {
  const { room, judged } = squashedRoom("merged");
  git(room, "checkout", "-q", "master");
  git(room, "reset", "-q", "--hard", "HEAD^");
  git(room, "merge", "-q", "--no-ff", "-m", "a merge commit", BRANCH);
  const merge = sha(room);
  git(room, "update-ref", "refs/remotes/origin/master", merge);
  ready(judged, { merged: merge, note: { at: merge, reviewed: judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done");
  assert.equal(checkpoint().mergeRecord, undefined, "the ancestry proved it, so no merge record is named");
  assert.ok(!run.stdout.includes("merge record"), run.stdout);
});

test("no merged mark keeps the refusal, and the checkpoint stays ready", async () => {
  const { room, judged } = squashedRoom("unmarked");
  ready(judged);
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes("origin/master stands at"), run.stderr);
  assert.ok(run.stderr.includes("does not reach it"), run.stderr);
  assert.equal(checkpoint().state, "ready", "absence of a mark is not evidence of landing");
});

test("a merged mark the landing branch does not reach is refused by its commit, and the checkpoint stays ready", async () => {
  const { room, judged, squash } = squashedRoom("unreached", { land: false });
  ready(judged, { merged: squash, note: { at: squash, reviewed: judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(`merged mark names ${squash.slice(0, 7)}`), run.stderr);
  assert.ok(run.stderr.includes("does not reach it"), `the reading the mark's commit fell short on:\n${run.stderr}`);
  assert.ok(run.stderr.includes("forge claim ISS-3146 --landed"), run.stderr);
  assert.ok(run.stderr.includes("forge record merged ISS-3146 --undo"), `and the route for a mark naming the wrong commit:\n${run.stderr}`);
  assert.equal(checkpoint().state, "ready", "and no landing is ended on a mark nothing carries");
});

/* The stale mark: the tracker keeps the first stamp until it is undone, so a second capture of the
   same issue stands beside the first landing's mark, which is reachable and names its own head. */
test("a mark of an earlier landing of the issue is refused naming its head, and the second capture stays ready", async () => {
  const { room, judged, squash } = squashedRoom("earlier");
  git(room, "checkout", "-q", BRANCH);
  const second = onTop(room, "the second capture");
  ready(second, { merged: squash, note: { at: squash, reviewed: judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(`its note names ${judged.slice(0, 7)} as what was reviewed and judged, not ${second.slice(0, 7)}`),
    run.stderr);
  assert.ok(run.stderr.includes("forge record merged ISS-3146 --undo"), `the route that takes the mark down:\n${run.stderr}`);
  assert.equal(checkpoint().state, "ready", "and the second landing is not ended on the first one's mark");
});

test("a mark whose note names another commit than the row is refused naming both, and the checkpoint stays ready", async () => {
  const { room, base, judged, squash } = squashedRoom("disagreeing");
  ready(judged, { merged: squash, note: { at: base, reviewed: judged } });
  const run = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(`merged mark names ${squash.slice(0, 7)}`), run.stderr);
  assert.ok(run.stderr.includes(`note names ${base.slice(0, 7)} at its \`at\` clause`), run.stderr);
  assert.equal(checkpoint().state, "ready", "and two answers for one landing end nothing");
});

/* After a squash landing every later repair carries the squash and never the head, so the forward
   check reads from the commit the merge record proved. */
test("a later landing over a checkpoint the merge record proved is taken where it carries that commit", async () => {
  const { room, judged, squash } = squashedRoom("later");
  ready(judged, { merged: squash, note: { at: squash, reviewed: judged } });
  const landed = await ran(["claim", "ISS-3146", "--landed"], room);
  assert.equal(landed.status, 0, `${landed.stdout}${landed.stderr}`);
  git(room, "checkout", "-q", "master");
  const repair = onTop(room, "the repair");
  git(room, "update-ref", "refs/remotes/origin/master", repair);
  const run = await ran(["claim", "ISS-3146", "--rebuilt", repair, "--undeployed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().head, repair, "the later landing stands");
  assert.equal(checkpoint().superseded.at(-1).mergeRecord, squash, "and the one it replaced is kept with its proof");
});
