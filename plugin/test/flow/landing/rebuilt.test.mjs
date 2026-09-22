/* The way back out of the window's closing. A capture reads the diff behind the branch and a merge
   makes that diff empty, so a run that died between the two leaves an issue whose code is live and
   whose verdicts earn nothing for good. What is judged here is which readings license a checkpoint
   written after the landing and which do not: git licenses it and the caller's word does not, the
   run making the write is its writer and never the builder, and a builder the record answers for on
   its own is derived rather than declared (ISS-1784). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { projectRecord, projectRoom, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { OWN, trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("rebuilt").path;
/* Away from this checkout, whose git directory names the run this suite is written under: what
   these cases read is a room's own ancestry and never the tree the suite stands in. */
const AWAY = projectRoom(tempRoom("rebuilt-away-"), process.env.XDG_CONFIG_HOME, OWN);
process.chdir(AWAY);
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");
const { judgeProblem } = await import("../../../src/flow/qa/verdicts.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;
const RUN = "the-judging-run";
/* Apart from every holder the claim history names, which is what the rung reads where the
   checkpoint's builder is one nobody can recover. */
const JUDGING = "a-judge-of-its-own";
const BRANCH = "iss-1784-1";
const AT = "2026-09-07T12:00:00.000Z";
const DEPLOYED = "9e24c2af00000000000000000000000000000cde";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: room, encoding: "utf8" });

const ISSUE = {
  documentId: "rebuilt-uuid",
  issueId: "ISS-1784",
  status: "developed",
  title: "one flow: the checkpoint nobody captured",
  description: "no mark here",
};
const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "rebuilt-uuid": [] },
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
      const held = state.comments["rebuilt-uuid"];
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

/* The lease is this run's own and the history is what the rule is read against: one holder across
   the whole of it names the builder, and several is a question no record here can answer. */
const held = (holders, landing = undefined, over = {}) => {
  state.issues[0] = {
    ...ISSUE,
    ...over,
    sessionContext: {
      lease: { holder: RUN, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(),
        minutes: 30, next: null,
        history: [...holders.map((holder) => ({ holder, status: "in_progress" })),
          { holder: RUN, status: "developed" }] },
      ...(landing ? { landing } : {}),
    },
  };
  state.comments["rebuilt-uuid"] = [];
};

const ran = async (argv, cwd) => {
  const env = { ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: RUN };
  const before = state.issues[0];
  let run = null;
  for (const again of [1, 2]) {
    state.issues[0] = before;
    run = await ranAsync(process.execPath, [CLI, ...argv], env, cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

/* A default branch this checkout records as the remote's own, and a head that only the merge put on
   it — which is exactly the shape the capture can no longer read and this write can. */
const landedRoom = (name, { merge = true } = {}) => {
  const room = tempRoom(`rebuilt-${name}-`);
  spawnSync("git", ["init", "-q", "-b", "master", room], { cwd: dirname(room), encoding: "utf8" });
  projectRecord(room, CHILD_HOME, { slug: "forge-plugin" });
  writeFileSync(join(room, "one.mjs"), "the base\n");
  git(room, "add", "one.mjs");
  git(room, "commit", "-qm", "the base");
  const base = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "checkout", "-q", "-b", BRANCH);
  writeFileSync(join(room, "one.mjs"), "the judged head\n");
  git(room, "add", "one.mjs");
  git(room, "commit", "-qm", "the judged head");
  const judged = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "checkout", "-q", "master");
  if (merge) git(room, "merge", "-q", "--no-ff", "-m", "the release that landed it", BRANCH);
  const tip = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "update-ref", "refs/remotes/origin/master", tip);
  git(room, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");
  return { room, base, judged, tip };
};

/* The two clauses the reading carries out, asserted as strings rather than as fragments: which of
   the two sources named the branch is the whole of what this issue added, so a case reading half of
   one of them would pass on a reconstruction that had said nothing (ISS-1802). */
const DECLARED = "the branch this project declares a change lands on, read off the tracker's project config";
const RECORDED = "the branch this checkout recorded as the remote's own default, this project having declared none";

/* Which branch the project declares a change lands on, for one call, restored afterwards. */
const declaring = async (branch, take) => {
  const was = state.config;
  state.config = { ...was, baseBranch: branch };
  try {
    return await take();
  } finally {
    state.config = was;
  }
};

/* And which judgement the project asks for between `developed` and `testing`, the same way. */
const declaringQa = async (qa, take) => {
  const was = state.config;
  state.config = { ...was, pipelineConfig: { ...was.pipelineConfig, qa } };
  try {
    return await take();
  } finally {
    state.config = was;
  }
};

const PLAN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";

test("a landed head with no checkpoint behind it takes one written after the fact", async () => {
  const { room, judged, tip } = landedRoom("carried");
  held(["one", "two", "three"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const read = checkpoint();
  assert.equal(read.state, "done", "the state naming no turn, there being nothing left of this landing");
  assert.equal(read.head, judged);
  assert.ok(read.handWritten.why.includes(`off origin/master — ${DECLARED} — at ${tip.slice(0, 7)}`),
    "the block records the branch that licensed it, where that branch's name came from, and not the caller's word for either");
  assert.equal(read.deployment, DEPLOYED, "and the identity a verdict is judged against, which the judge holds");
  assert.match(read.handWritten.why, /the deployment identity is the caller's/u,
    "said to be the caller's, this checkout having read no deployment");
  assert.match(run.stdout, /rebuilt by hand by the-judging-run/u,
    "and the line it prints back says the checkpoint is a reconstruction");
  /* What this write leaves is judged here rather than described: a route whose end is refused again
     is the route it replaced (consult F1). */
  const verdict = { criterion: "1 — text", verdict: "pass", commit: judged, evidence: [DEPLOYED],
    judge: RUN };
  assert.equal(judgeProblem(verdict, read, ["one", "two", "three"]), null,
    "and the checkpoint it wrote is one a verdict earns testing against");
});

test("the run writing a checkpoint after the landing is recorded as its writer and never as the builder", async () => {
  const { room, judged } = landedRoom("writer");
  held(["one", "two"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const read = checkpoint();
  assert.equal(read.handWritten.by, RUN, "the run that made the write is on the block as its writer");
  assert.equal(read.builder, undefined, "and no builder is named, this run being the one judging the change");
  assert.match(read.handWritten.builder, /names 2 runs that held it while the change was being built — one, two —/u,
    "with the reason the record cannot name one, composed off that record and not off the caller");
  assert.ok(read.handWritten.lost.includes("builder"), `and the keys it recovered nothing for: ${read.handWritten.lost}`);
});

test("a head the branch it lands on is not proved to carry refuses the write, saying what fell short", async () => {
  const { room, judged } = landedRoom("unlanded", { merge: false });
  held(["one", "two"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /does not reach it/u, `the reading that fell short:\n${run.stderr}`);
  assert.match(run.stderr, /what is owed is the capture and not this write/u);
  assert.equal(checkpoint(), null, "and nothing was written");
});

test("a builder the claim history answers for on its own refuses the declaration, naming that holder", async () => {
  const { room, judged } = landedRoom("derivable");
  held(["the-only-run"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /exactly one run that held it while the change was being built, `the-only-run`/u);
  assert.match(run.stderr, /derived and not declared/u);
  assert.equal(checkpoint(), null, "and nothing was written");
});

/* One statement about the deployment is owed, and a silence is neither of them. Read as `there is
   none` it would withdraw the citation the judging rung spends on a checkpoint that names an
   identity, with nothing on the record saying it had been (ISS-1993). */
test("a reconstruction saying nothing about the deployment is refused, and the refusal prints both routes", async () => {
  const { room, judged } = landedRoom("no-deployment");
  held(["one", "two"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /--deployment <the sha the deployment reports serving>/u);
  assert.ok(run.stderr.includes(`forge claim ISS-1784 --rebuilt ${judged.slice(0, 7)} --undeployed`),
    `the route a change that reached no deployment can run unchanged:\n${run.stderr}`);
  assert.equal(checkpoint(), null, "and nothing was written");
});

test("a reconstruction naming a deployment and saying there is none is refused as two statements about one fact", async () => {
  const { room, judged } = landedRoom("both-said");
  held(["one", "two"]);
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED, "--undeployed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /names an identity and says the change reached none/u);
  assert.equal(checkpoint(), null, "and nothing was written");
});

/* Either flag says what the checkpoint `--rebuilt` writes holds, so a call writing no checkpoint has
   nowhere to put one: read where it is written, refused where it is not, and never dropped. */
test("a statement about the deployment with no reconstruction to carry it is refused rather than dropped", async () => {
  const { room, judged } = landedRoom("no-rebuilt");
  held(["one", "two"]);
  const alone = await ran(["claim", "ISS-1784", "--undeployed"], room);
  assert.equal(alone.status, 1, `${alone.stdout}${alone.stderr}`);
  assert.match(alone.stderr, /this call writes no checkpoint/u);
  const named = await ran(["claim", "ISS-1784", "--deployment", DEPLOYED], room);
  assert.equal(named.status, 1, `${named.stdout}${named.stderr}`);
  assert.match(named.stderr, /this call writes no checkpoint/u);
  assert.equal(checkpoint(), null, `and neither wrote a checkpoint, for ${judged.slice(0, 7)}`);
});

/* The whole of what this issue is: a test-only fix reaches no deployment it ever will, so a write
   demanding an identity left its judge no route at all. What the route has to end at is the rung,
   not the write — `judgeProblem` answering `null` says nothing about the transition that spends it
   (consult F1, ISS-1993). */
test("a change that reached no deployment takes a checkpoint declaring that, and an independent judge's verdict earns testing against it", async () => {
  const { room, judged } = landedRoom("undeployed");
  held(["one", "two"], undefined, { acceptanceCriteria: "1. The one outcome.", plan: PLAN, mergedAt: AT });
  const wrote = await declaringQa("independent", () =>
    ran(["claim", "ISS-1784", "--rebuilt", judged, "--undeployed"], room));
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  const read = checkpoint();
  assert.equal(read.state, "done", "the state naming no turn, as the route that names an identity leaves");
  assert.equal(read.deployment, undefined, "and no deployment identity on it, there being none to name");
  assert.match(read.handWritten.why, /reached no deployment, so the head is the identity its verdicts answer to/u,
    `the block says the caller stated it rather than leaving the key silently empty: ${read.handWritten.why}`);
  state.comments["rebuilt-uuid"].push(
    { documentId: "c-mark", createdAt: AT, authorId: "agent",
      body: `mark_merged target=base — merged to master at ${judged}` },
    { documentId: "c-verdict", createdAt: AT, authorId: "agent",
      body: render("verdict", [{ criterion: "1 — The one outcome.", verdict: "pass", commit: judged,
        evidence: [judged], judge: JUDGING }]) },
  );
  const owed = await declaringQa("independent", () => ran(["advance", "ISS-1784", "--owed"], room));
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  assert.doesNotMatch(owed.stdout, /landing checkpoint/u,
    `nothing about the checkpoint stands between this judge and the rung:\n${owed.stdout}`);
  assert.match(owed.stdout, /testing is next and the record earns it/u,
    `and the rung the judging run is dispatched to earn:\n${owed.stdout}${owed.stderr}`);
  /* What the rung would be owed and what the move does are two readings, and only the second is the
     one this issue exists for: a promotion path that refused after the checkpoint stood would leave
     the first green and the judge exactly where it was (review F1). */
  const moved = await declaringQa("independent", () => ran(["advance", "ISS-1784"], room));
  assert.equal(moved.status, 0, `${moved.stdout}${moved.stderr}`);
  assert.match(moved.stdout, /developed -> testing/u, `${moved.stdout}${moved.stderr}`);
  assert.equal(state.issues[0].status, "testing",
    "and the status the tracker holds is the one the judging run was dispatched to earn");
});

/* `landingOf` answers null for a block whose state it cannot place as well as for no block, and a
   reconstruction over the first writes over evidence it never read (consult F2). */
test("a landing block whose state this version cannot place is not an absent one, and is not written over", async () => {
  const { room, judged } = landedRoom("unreadable");
  held(["one", "two"], { state: "", builder: "the-builder-run", head: judged, deployment: DEPLOYED });
  const run = await ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /state reads `nothing at all`/u, `the state it read:\n${run.stderr}`);
  assert.match(run.stderr, /builder, deployment, head, state/u, "and every key it would have replaced");
  assert.equal(state.issues[0].sessionContext.landing.builder, "the-builder-run",
    "and the block stands exactly as it was");
});

/* The reconstruction landed with the same reading the landing route had, so it inherited the same
   defect: on a project whose release promotes, the recorded default is the branch a release promotes
   to, and a reconstruction read against it refuses a head the branch a change lands on carries.
   Both routes are one cause, so both are read against the declaration (ISS-1802). */
test("the reconstruction reads the branch the project declares a change lands on", async () => {
  const { room, judged } = landedRoom("promote", { merge: false });
  git(room, "checkout", "-q", "-b", "staging");
  git(room, "merge", "-q", "--no-ff", "-m", "the release that landed it", BRANCH);
  const tip = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "update-ref", "refs/remotes/origin/staging", tip);
  assert.notEqual(git(room, "merge-base", "--is-ancestor", judged, "refs/remotes/origin/master").status, 0,
    "the recorded default does not carry the head, which is what refused this write before");
  held(["one", "two"]);
  const run = await declaring("staging", () =>
    ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const read = checkpoint();
  assert.equal(read.state, "done", `${run.stdout}${run.stderr}`);
  assert.ok(read.handWritten.why.includes(`off origin/staging — ${DECLARED} — at ${tip.slice(0, 7)}`),
    `the block names the declared branch and the declaration that named it: ${read.handWritten.why}`);
  assert.ok(run.stdout.includes(`What licensed it: ${read.handWritten.why}`),
    `and the run that made the write reads the same account it stored:\n${run.stdout}`);
});

test("a declared branch that does not carry the head refuses the reconstruction, whatever the recorded default carries", async () => {
  const { room, judged, tip } = landedRoom("declared-behind");
  git(room, "update-ref", "refs/remotes/origin/staging", git(room, "rev-parse", `${tip}^1`).stdout.trim());
  assert.equal(git(room, "merge-base", "--is-ancestor", judged, "refs/remotes/origin/master").status, 0,
    "the recorded default carries the head, and would have licensed this write");
  held(["one", "two"]);
  const run = await declaring("staging", () =>
    ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room));
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /origin\/staging stands at/u, `the declared branch:\n${run.stderr}`);
  assert.ok(run.stderr.includes(DECLARED), `and that the declaration named it:\n${run.stderr}`);
  assert.equal(checkpoint(), null, "and nothing was written");
});

test("a project declaring no branch sends the reconstruction to the recorded default, and says so on the block", async () => {
  const { room, judged, tip } = landedRoom("undeclared");
  held(["one", "two"]);
  const run = await declaring(null, () =>
    ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room));
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(checkpoint().handWritten.why.includes(`off origin/master — ${RECORDED} — at ${tip.slice(0, 7)}`),
    `the block names the recorded ref and the absence that sent it there: ${checkpoint().handWritten.why}`);
});

/* The reconstruction reads through the same lookup, so the local lookalike is refused there too:
   one cause, both routes (consult F1). */
test("a local branch named after the declared remote-tracking ref does not license a reconstruction", async () => {
  const { room, judged } = landedRoom("lookalike");
  git(room, "update-ref", "refs/heads/refs/remotes/origin/staging", judged);
  held(["one", "two"]);
  const run = await declaring("staging", () =>
    ran(["claim", "ISS-1784", "--rebuilt", judged, "--deployment", DEPLOYED], room));
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /origin\/staging resolves to no commit here/u, run.stderr);
  assert.equal(checkpoint(), null, "and nothing was written");
});
