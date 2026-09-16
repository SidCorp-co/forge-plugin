/* The landing a release left declaring itself ready, ended on the one thing that settles it: whether
   the default branch already carries the head the checkpoint was written at. The write is terminal,
   so every case here stands a real object store up rather than a table — what is being judged is
   which readings of one may end a landing and which may not, and the refusals are read for the
   reading that fell short (ISS-1655). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, standsInNoTree, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landed").path;
standsInNoTree("landed");
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;
const RUN = "the-lander-run";
const BUILDER = "the-builder-run";
const BRANCH = "iss-1655-6";
const AT = "2026-09-07T12:00:00.000Z";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

const ISSUE = {
  documentId: "landed-uuid",
  issueId: "ISS-1655",
  status: "awaiting_release",
  title: "one flow: the checkpoint a release left behind",
  description: "no mark here",
};
const state = {
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { "landed-uuid": [] },
  /* Counted so a case can move the checkpoint under the write itself: `landingSaved` reads the field
     again at the write, and the second read is that one. */
  reads: 0,
  moveOnRead: null,
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "get") {
        state.reads += 1;
        if (state.moveOnRead && state.reads === state.moveOnRead.at) {
          const held = state.issues[0].sessionContext;
          state.issues[0] = { ...state.issues[0],
            sessionContext: { ...held, landing: { ...held.landing, ...state.moveOnRead.to } } };
        }
        return state.issues[0];
      }
      if (args.action === "update" || args.action === "transition") {
        state.issues[0] = { ...state.issues[0], ...args.data };
      }
      return state.issues[0];
    },
    forge_comments: (args) => {
      const held = state.comments["landed-uuid"];
      if (args.action !== "list") {
        held.push({ documentId: `c-${held.length + 1}`, createdAt: AT, authorId: "agent", body: args.data.body });
        return { documentId: `c-${held.length}` };
      }
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const checkpoint = () => landingOf(state.issues[0].sessionContext);

/* The lease is this run's own, which is the whole of what the write asks of the caller: nothing here
   is judged, so no turn is taken and no independence is read. */
const ready = (head, over = {}) => {
  state.reads = 0;
  state.moveOnRead = null;
  state.issues[0] = {
    ...ISSUE,
    sessionContext: {
      lease: { holder: RUN, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] },
      landing: {
        state: "ready", builder: BUILDER, branch: BRANCH, head,
        base: "c4890050000000000000000000000000000dcba", files: ["one.mjs"], at: AT, ...over,
      },
    },
  };
  state.comments["landed-uuid"] = [];
};

/* Twice, since the gate every write passes delivers a comment this session has not read and refuses
   once. The counter is reset per attempt, a case about the second read meaning the second of one run. */
const ran = async (argv, cwd, over = {}) => {
  const env = { ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: RUN, ...over };
  const held = { issue: state.issues[0], moveOnRead: state.moveOnRead };
  let run = null;
  for (const again of [1, 2]) {
    state.issues[0] = held.issue;
    state.moveOnRead = held.moveOnRead;
    state.reads = 0;
    run = await ranAsync(process.execPath, [CLI, ...argv], env, cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

const onTop = (room, file, said) => {
  writeFileSync(join(room, file), `${said}\n`);
  git(room, "add", file);
  git(room, "commit", "-qm", said);
  return git(room, "rev-parse", "HEAD").stdout.trim();
};

/* A default branch this checkout has recorded as the remote's own, a branch beside it, and a head on
   the branch alone: the shape the ancestry is read against, before anything lands it. */
const landedRoom = (name) => {
  const room = tempRoom(`landed-${name}-`);
  spawnSync("git", ["init", "-q", "-b", "master", room], { encoding: "utf8" });
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  writeFileSync(join(room, "one.mjs"), "the base\n");
  git(room, "add", "one.mjs", ".forge.json");
  git(room, "commit", "-qm", "the base");
  const base = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "checkout", "-q", "-b", BRANCH);
  const judged = onTop(room, "one.mjs", "the judged head");
  git(room, "update-ref", `refs/remotes/origin/${BRANCH}`, judged);
  git(room, "update-ref", "refs/remotes/origin/master", base);
  git(room, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");
  return { room, base, judged };
};

const releasedOnto = (room, branch) => {
  git(room, "checkout", "-q", branch);
  git(room, "merge", "-q", "--no-ff", "-m", "the release that landed it", BRANCH);
  const tip = git(room, "rev-parse", "HEAD").stdout.trim();
  git(room, "update-ref", `refs/remotes/origin/${branch}`, tip);
  return tip;
};

test("a default branch already carrying the judged head ends the landing, on the evidence it prints", async () => {
  const { room, judged } = landedRoom("carried");
  const tip = releasedOnto(room, "master");
  ready(judged);
  const run = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done", `${run.stdout}${run.stderr}`);
  assert.ok(run.stdout.includes("origin/master"), `the ref it read:\n${run.stdout}`);
  assert.ok(run.stdout.includes(`stands at ${tip.slice(0, 7)}`), `the commit that ref stands at:\n${run.stdout}`);
  assert.ok(run.stdout.includes(`carries ${judged.slice(0, 7)}`), `and the head proved to be on it:\n${run.stdout}`);
});

/* A branch of that name is legal and git disambiguates the shortened form against it, so a checkout
   holding one would have the landing refused on a ref that names nothing (consult ee55fe F1). */
test("a local branch named after the remote's own does not refuse a landing that stands", async () => {
  const { room, judged } = landedRoom("collision");
  const tip = releasedOnto(room, "master");
  git(room, "update-ref", "refs/heads/origin/master", tip);
  assert.equal(git(room, "symbolic-ref", "--short", "refs/remotes/origin/HEAD").stdout.trim(),
    "remotes/origin/master", "the shortened target git gives where the name is ambiguous");
  ready(judged);
  const run = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done", `${run.stdout}${run.stderr}`);
});

test("a checkpoint at any state but the one a build leaves is refused, naming the state it read", async () => {
  const { room, judged } = landedRoom("mid-landing");
  releasedOnto(room, "master");
  for (const state_ of ["candidate", "judged", "marked", "done"]) {
    ready(judged, { state: state_ });
    const run = await ran(["claim", "ISS-1655", "--landed"], room);
    assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
    assert.ok(run.stderr.includes(`reads \`${state_}\``), `the state it read:\n${run.stderr}`);
    assert.ok(run.stderr.includes("forge resume ISS-1655"), `and where to read the landing:\n${run.stderr}`);
    assert.equal(checkpoint().state, state_, "and the checkpoint is as it was");
  }
});

/* The reading that decides is the branch this checkout has recorded as the remote's own, and never a
   conventional name that happens to resolve: here the head is on `origin/main` and the default is
   `origin/master`, and a guess would end a landing nothing landed (consult 1adbff F1). */
test("a default branch that does not reach the head refuses, whatever other branch carries it", async () => {
  const { room, judged } = landedRoom("elsewhere");
  const elsewhere = releasedOnto(room, "main");
  git(room, "update-ref", "refs/remotes/origin/main", elsewhere);
  assert.equal(git(room, "merge-base", "--is-ancestor", judged, "refs/remotes/origin/main").status, 0,
    "origin/main carries the judged head");
  ready(judged);
  const run = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes("origin/master stands at"), `the default branch and where it stands:\n${run.stderr}`);
  assert.ok(run.stderr.includes("does not reach it"), run.stderr);
  assert.ok(run.stderr.includes("git fetch origin"), `the fetch that reads the ref again:\n${run.stderr}`);
  assert.equal(checkpoint().state, "ready", "and the checkpoint is as it was");
});

test("every ancestry reading this checkout cannot make refuses, saying which one fell short", async () => {
  const { room, judged } = landedRoom("cannot-say");
  releasedOnto(room, "master");
  git(room, "symbolic-ref", "-d", "refs/remotes/origin/HEAD");
  ready(judged);
  const unrecorded = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(unrecorded.status, 1, unrecorded.stdout);
  assert.ok(unrecorded.stderr.includes("recorded no default branch"), unrecorded.stderr);
  assert.ok(unrecorded.stderr.includes("git remote set-head origin -a"),
    `and the command that records one, an ordinary fetch leaving this refusal where it is:\n${unrecorded.stderr}`);
  git(room, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");

  const gone = landedRoom("unreadable");
  releasedOnto(gone.room, "master");
  rmSync(join(gone.room, ".git", "objects", gone.judged.slice(0, 2), gone.judged.slice(2)));
  ready(gone.judged);
  const unreadable = await ran(["claim", "ISS-1655", "--landed"], gone.room);
  assert.equal(unreadable.status, 1, unreadable.stdout);
  assert.ok(unreadable.stderr.includes("holds no commit of that name"), unreadable.stderr);
  assert.ok(unreadable.stderr.includes("git fetch origin"), unreadable.stderr);

  const shallow = tempRoom("landed-shallow-");
  spawnSync("git", ["clone", "-q", "--depth", "1", "--branch", "master", `file://${room}`, shallow],
    { encoding: "utf8" });
  git(shallow, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");
  writeFileSync(join(shallow, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  ready(judged);
  const boundary = await ran(["claim", "ISS-1655", "--landed"], shallow);
  assert.equal(boundary.status, 1, boundary.stdout);
  assert.ok(boundary.stderr.includes("shallow"), boundary.stderr);
  assert.ok(boundary.stderr.includes("git fetch --unshallow origin"),
    `and the fetch that removes the boundary rather than one that leaves it:\n${boundary.stderr}`);

  const bare = tempRoom("landed-no-tree-");
  writeFileSync(join(bare, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  ready(judged);
  const notree = await ran(["claim", "ISS-1655", "--landed"], bare);
  assert.equal(notree.status, 1, notree.stdout);
  assert.ok(notree.stderr.includes("no git checkout"), notree.stderr);
  assert.ok(notree.stderr.includes("Ask from a checkout that can read that history"),
    `and a reading nothing here settles asks for another checkout rather than a command:\n${notree.stderr}`);
  assert.equal(checkpoint().state, "ready", "and no reading that fell short ended a landing");
});

/* What says no gate was spent is the environment the call is made in and not the tree it left: the
   whole search path is one directory whose only entry is a git that records what it was asked, so a
   gate, a version bump or a publish reaches for a command that is not there and the call fails. */
test("the call runs git and nothing else, over refs this checkout already holds", async () => {
  const { room, judged } = landedRoom("offline");
  releasedOnto(room, "master");
  const only = tempRoom("landed-path-");
  const log = join(only, "asked.log");
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(join(only, "git"), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${log}\nexec ${real} "$@"\n`);
  chmodSync(join(only, "git"), 0o755);
  writeFileSync(log, "");
  ready(judged);
  const run = await ran(["claim", "ISS-1655", "--landed"], room, { PATH: only });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().state, "done", "the write is made with no command but git reachable at all");
  const asked = readFileSync(log, "utf8").split("\n").filter(Boolean);
  assert.ok(asked.length, "and git is what it ran");
  for (const one of asked) {
    assert.ok(!["fetch", "push", "ls-remote", "tag", "commit"].includes(one.split(" ")[0]),
      `nothing this call asked git for reaches a remote or writes one: ${one}`);
  }
});

/* An overlay rewrites what every reading of the store answers, so an ancestry proved under one is a
   fact about the overlay and not about what the remote carries. Both mechanisms, since the graft file
   is deprecated and still honoured, and the replacement it is converted to is a different switch
   (consult 8faf61 F1, consult 6f5c5b F1). */
test("an ancestry standing only under a local overlay does not end the landing", async () => {
  const { room, judged } = landedRoom("replaced");
  const tip = releasedOnto(room, "main");
  git(room, "update-ref", "refs/remotes/origin/master", tip);
  assert.equal(git(room, "merge-base", "--is-ancestor", judged, tip).status, 0, "before the branch is cut back");
  git(room, "update-ref", "refs/remotes/origin/master", git(room, "rev-parse", `${tip}^1`).stdout.trim());
  const base = git(room, "rev-parse", "refs/remotes/origin/master").stdout.trim();
  assert.notEqual(git(room, "merge-base", "--is-ancestor", judged, base).status, 0,
    "the recorded default does not carry the judged head");
  assert.equal(git(room, "replace", "--graft", base, judged).status, 0, "and a graft says it does");
  assert.equal(git(room, "merge-base", "--is-ancestor", judged, base).status, 0,
    "which every reading of this store that honours replacements now answers");
  ready(judged);
  const run = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes("does not reach it"), run.stderr);
  assert.equal(checkpoint().state, "ready", "and no landing is ended over a history somebody overlaid");

  git(room, "replace", "-d", base);
  writeFileSync(join(room, ".git", "info", "grafts"), `${base} ${judged}\n`);
  assert.equal(git(room, "merge-base", "--is-ancestor", judged, base).status, 0,
    "the graft file is deprecated and still answers, which is why it is its own switch");
  ready(judged);
  const grafted = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(grafted.status, 1, `${grafted.stdout}${grafted.stderr}`);
  assert.ok(grafted.stderr.includes("does not reach it"), grafted.stderr);
  assert.equal(checkpoint().state, "ready", "and a graft ends no landing either");
});

test("--landed beside another turn of the same verb is refused, each being a different move", async () => {
  const { room, judged } = landedRoom("two-turns");
  releasedOnto(room, "master");
  for (const other of [["--take"], ["--judged"], ["--recorded"], ["--pushed", "--ready"],
    ["--reconciled", "7c1d0e5b0000000000000000000000000000face"]]) {
    ready(judged);
    const run = await ran(["claim", "ISS-1655", "--landed", ...other], room);
    assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
    assert.ok(run.stderr.includes("--landed"), `naming the flags it was given:\n${run.stderr}`);
    assert.equal(checkpoint().state, "ready", "and nothing is written");
  }
});

/* The same guard the other landing writes are held to, asked here because this one is terminal: a
   checkpoint another run replaced between the reading and the write would be closed over its state. */
test("a checkpoint that moved between the reading and the write is refused, naming what moved", async () => {
  const { room, judged } = landedRoom("moved");
  releasedOnto(room, "master");
  ready(judged);
  state.moveOnRead = { at: 2, to: { state: "candidate", head: "9e24c2af0000000000000000000000000000abcd" } };
  const run = await ran(["claim", "ISS-1655", "--landed"], room);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes("moved between the read"), run.stderr);
  assert.ok(/state reads `candidate`/u.test(run.stderr), `the state it moved to:\n${run.stderr}`);
  assert.ok(/head reads `9e24c2a/u.test(run.stderr), `and the head:\n${run.stderr}`);
  assert.notEqual(checkpoint().state, "done", "and the landing is not ended over somebody else's reading");
});
