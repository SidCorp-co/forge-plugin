/* The branch under a hand-back, read as git has it. The landing merges the judged head and fetches
   the branch to find it, so a reconciliation written over a branch that has let that head go is a
   landing that dies in some other checkout days later (ISS-1638). Its neighbour `take.test.mjs` is
   about the state machine and reaches no repository; every case here stands one up, because what is
   being judged is which readings of a real object store may refuse a builder and which may not. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { rmSync, writeFileSync } from "node:fs";

import { fakeTracker, ranAsync, standsInNoTree, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("reconciled-branch").path;
standsInNoTree("reconciled-branch");
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-run";
const BRANCH = "iss-673-6";
const CANDIDATE = "7c1d0e5b0000000000000000000000000000face";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

const ISSUE = {
  documentId: "landing-uuid",
  issueId: "ISS-673",
  status: "developed",
  title: "one flow: the branch a hand-back leaves behind",
  description: "no mark here",
};
const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "landing-uuid": [] },
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
      const held = state.comments["landing-uuid"];
      if (args.action !== "list") {
        held.push({ documentId: `c-${held.length + 1}`, createdAt: "2026-09-07T12:00:00.000Z", authorId: "agent", body: args.data.body });
        return { documentId: `c-${held.length}` };
      }
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const checkpoint = () => landingOf(state.issues[0].sessionContext);

/* Each case starts from the field it is about, at the state the hand-back leaves and under a lease
   the builder holds, which is the one state and the one run this write is ever made at. */
const owed = (head) => {
  state.issues[0] = {
    ...ISSUE,
    sessionContext: {
      lease: { holder: BUILDER, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
      landing: {
        state: "builder-owed", builder: BUILDER, branch: BRANCH, head, candidate: CANDIDATE, moved: "one.mjs",
        base: "c4890050000000000000000000000000000dcba", files: ["one.mjs"], at: "2026-09-07T12:00:00.000Z",
      },
    },
  };
  state.comments["landing-uuid"] = [];
};

/* Twice, since the gate every write passes delivers a comment this session has not read and refuses
   once; and with `--unheld`, every case starting from a field whose lease is the builder's own. */
const ran = async (argv, cwd) => {
  const env = { ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: BUILDER };
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, [...argv, "--unheld"], env, cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const handedRoom = (name) => {
  const room = tempRoom(`reconciled-${name}-`);
  spawnSync("git", ["init", "-q", "-b", BRANCH, room], { encoding: "utf8" });
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  writeFileSync(join(room, "one.mjs"), "the judged head\n");
  git(room, "add", "one.mjs", ".forge.json");
  git(room, "commit", "-qm", "the judged head");
  const judged = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "update-ref", `refs/remotes/origin/${BRANCH}`, judged);
  return { room, judged };
};

const onTop = (room, file, said) => {
  writeFileSync(join(room, file), `${said}\n`);
  git(room, "add", file);
  git(room, "commit", "-qm", said);
  return git(room, "rev-parse", "HEAD").stdout.trim();
};

test("a reconciliation over a branch that let the judged head go is refused, naming the push back", async () => {
  const { room, judged } = handedRoom("forced");
  writeFileSync(join(room, "one.mjs"), "what a rebase leaves\n");
  git(room, "add", "one.mjs");
  git(room, "commit", "-q", "--amend", "-m", "the rebase a hand-back must not ask for");
  const tip = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "update-ref", `refs/remotes/origin/${BRANCH}`, tip);
  owed(judged);
  const before = JSON.stringify(state.issues[0].sessionContext);
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], room);
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${BRANCH} no longer carries ${judged.slice(0, 7)}`), run.stderr);
  assert.ok(run.stderr.includes(`stands at ${tip.slice(0, 7)}`),
    `the tip it stands at instead tells a forgotten push from a rewritten branch:\n${run.stderr}`);
  assert.ok(run.stderr.includes(
    `git push --force-with-lease=${BRANCH}:${tip} origin ${judged}:refs/heads/${BRANCH}`),
  `the push that puts the judged head back:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`git fetch origin ${BRANCH}`),
    `the fetch that moves the evidence it is read off, a push made elsewhere leaving it:\n${run.stderr}`);
  assert.equal(JSON.stringify(state.issues[0].sessionContext), before, "and the checkpoint is as it was");
});

test("a reconciliation over a branch whose tip has moved past the judged head is written", async () => {
  const { room, judged } = handedRoom("ahead");
  git(room, "update-ref", `refs/remotes/origin/${BRANCH}`, onTop(room, "two.mjs", "a commit made after the capture"));
  owed(judged);
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  /* The branch still carries what lands, so this write is none of the refusal's business. That the
     landing says nothing of the commit on top of it is the other half of the reading, and ISS-1644. */
  assert.equal(checkpoint().state, "reconciled", `${run.stdout}${run.stderr}`);
});

test("a reading that proves neither answer lets the reconciliation through", async () => {
  const { room, judged } = handedRoom("unknown");
  git(room, "update-ref", `refs/heads/${BRANCH}`, onTop(room, "two.mjs", "the tip a shallow clone fetches"));
  const shallow = tempRoom("reconciled-shallow-");
  spawnSync("git", ["clone", "-q", "--depth", "1", "--branch", BRANCH, `file://${room}`, shallow],
    { encoding: "utf8" });
  assert.notEqual(git(shallow, "cat-file", "-e", `${judged}^{commit}`).status, 0,
    "the judged head is behind the shallow boundary, which is a history that cannot settle it");
  owed(judged);
  const boundary = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], shallow);
  assert.equal(boundary.status, 0, `${boundary.stdout}${boundary.stderr}`,
    "an unreadable head under a shallow history proves nothing, and a refusal there is a branch that was right");
  assert.equal(checkpoint().state, "reconciled");
  git(room, "update-ref", "-d", `refs/remotes/origin/${BRANCH}`);
  owed(judged);
  const nothing = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], room);
  assert.equal(nothing.status, 0, `${nothing.stdout}${nothing.stderr}`,
    "and a checkout holding no remote-tracking ref for that branch has read nothing about it");
  assert.equal(checkpoint().state, "reconciled");
});

/* A complete history is not a promise that every object in it can be read, and the two look the same
   to a probe that asks only whether the store answers: the branch here carries the judged head and
   the reading still cannot say so, which is the reading that may not refuse (consult 7d5528 F1). */
test("a judged head this store cannot read is no proof the branch let it go", async () => {
  const { room, judged } = handedRoom("unreadable");
  git(room, "update-ref", `refs/remotes/origin/${BRANCH}`, onTop(room, "two.mjs", "on top of the judged head"));
  rmSync(join(room, ".git", "objects", judged.slice(0, 2), judged.slice(2)));
  assert.notEqual(git(room, "cat-file", "-e", `${judged}^{commit}`).status, 0, "the object is gone");
  owed(judged);
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "reconciled", "the turn ends, no push being owed by a branch that is right");
});
