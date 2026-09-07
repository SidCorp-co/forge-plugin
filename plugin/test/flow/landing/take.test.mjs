/* The handoff itself, through the verb: the checkpoint a build writes where it ends, and the take
   that moves the lease only where the state names the taker's turn. Every refusal here is read for
   the state it names, because a state machine refusing for the wrong reason looks identical to one
   refusing for the right one (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

import { fakeTracker, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-take").path;
const { landingOf, leaseOf } = await import("../../../src/flow/lease.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const BUILDER = "the-builder-run";
const LANDER = "the-lander-run";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

/* What `--pushed` reads: a base a remote head names, and a diff above it. The remote ref is written
   by hand because a fixture with a real remote is a second repository for one merge-base. */
const pushedRepo = (files) => {
  const room = tempRoom("landing-repo-");
  spawnSync("git", ["init", "-q", "-b", "iss-673-6", room], { encoding: "utf8" });
  writeFileSync(join(room, "base.txt"), "the base\n");
  /* The verb is project-scoped wherever it runs, and the capture's checkout is where it runs. */
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "forge-plugin" }));
  git(room, "add", "base.txt", ".forge.json");
  git(room, "commit", "-qm", "base");
  git(room, "update-ref", "refs/remotes/origin/master", git(room, "rev-parse", "HEAD").stdout.trim());
  for (const one of files) writeFileSync(join(room, one), `${one}, changed\n`);
  if (files.length) {
    git(room, "add", ...files);
    git(room, "commit", "-qm", "the change");
  }
  return room;
};

const CHANGED = pushedRepo(["one.mjs", "two.mjs"]);
const NOTHING = pushedRepo([]);

const ISSUE = {
  documentId: "landing-uuid",
  issueId: "ISS-673",
  status: "developed",
  title: "one flow: the ready checkpoint and the handoff",
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
      if (args.action !== "list") {
        state.comments["landing-uuid"].push({ documentId: `c-${state.comments["landing-uuid"].length + 1}`, createdAt: "2026-09-07T12:00:00.000Z", authorId: "agent", body: args.data.body });
        return { documentId: `c-${state.comments["landing-uuid"].length}` };
      }
      const held = state.comments["landing-uuid"];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const asRun = (id) => ({ ...tracker.env, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: id });
/* The id a whole wave carries: no `FORGE_SESSION_ID`, so every run of it reads the dispatcher's. */
const asWave = (id) => {
  const env = { ...asRun(id), CLAUDE_CODE_SESSION_ID: id };
  delete env.FORGE_SESSION_ID;
  return env;
};
const held = () => leaseOf(state.issues[0].sessionContext);
const checkpoint = () => landingOf(state.issues[0].sessionContext);

const lease = (holder, minutes = 30) => ({
  holder, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes, next: null, history: [],
});

/* Each case starts from the field it is about, so no case reads through the one before it. */
const field = (landing, leased) => {
  state.issues[0] = { ...ISSUE };
  if (landing || leased) state.issues[0].sessionContext = { ...(leased ? { lease: leased } : {}), ...(landing ? { landing } : {}) };
  state.comments["landing-uuid"] = [];
};

const BUILT = {
  state: "ready",
  builder: BUILDER,
  branch: "iss-673-6",
  head: "9e24c2af0000000000000000000000000000abcd",
  base: "c4890050000000000000000000000000000dcba",
  files: ["one.mjs", "two.mjs"],
  at: "2026-09-07T12:00:00.000Z",
};

/* The read-before-write gate delivers a comment this session has not been shown and refuses once;
   the same command sent again lands. That hold is not this file's subject. */
const ran = async (argv, id, cwd = process.cwd(), env = asRun) => {
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, argv, env(id), cwd);
    if (run.status === 0 || again === 2) return run;
  }
  return run;
};

test("a build that ends ready writes the checkpoint the landing reads, off the capture", async () => {
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, CHANGED);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const written = checkpoint();
  assert.equal(written.state, "ready", "the state the lander's turn is read from");
  assert.equal(written.builder, BUILDER, "the session that built it, so the reconciliation has somebody to owe");
  assert.equal(written.branch, "iss-673-6");
  assert.equal(written.head, git(CHANGED, "rev-parse", "HEAD").stdout.trim(), "the head the review was taken at");
  assert.equal(written.base, git(CHANGED, "rev-parse", "refs/remotes/origin/master").stdout.trim());
  assert.deepEqual(written.files, ["one.mjs", "two.mjs"], "the paths, so a moved one can be compared");
  assert.match(run.stdout, /landing `ready`: iss-673-6 at/u, run.stdout);
  assert.match(run.stdout, /forge claim ISS-673 --take/u, "and the command that takes it from here");
  assert.equal(held().holder, BUILDER, "the lease is still the builder's, which is what --take is for");
});

test("--ready without the capture it writes from is refused, and so is a capture holding nothing", async () => {
  field(null, null);
  const alone = await ran(["claim", "ISS-673", "--ready"], BUILDER, CHANGED);
  assert.equal(alone.status, 1, alone.stdout);
  assert.match(alone.stderr, /forge claim ISS-673 --pushed --ready/u, alone.stderr);
  assert.equal(checkpoint(), null, "and nothing was written");
  const empty = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, NOTHING);
  assert.equal(empty.status, 1, empty.stdout);
  assert.match(empty.stderr, /captured nothing/u, empty.stderr);
  assert.match(empty.stderr, /Capture at the push, before the merge/u);
  assert.equal(checkpoint(), null, "a checkpoint with no head is one nobody can land");
});

test("a second session takes the turn at ready, and the history row names the state", async () => {
  field(BUILT, lease(BUILDER));
  const run = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(held().holder, LANDER, "the lease moved, over a lease that was still live");
  assert.deepEqual(held().history.at(-1), {
    holder: LANDER, at: held().renewedAt, how: "take", status: "developed", next: null, landing: "ready",
  });
  assert.match(run.stdout, /landing `ready`/u, run.stdout);
  assert.equal(checkpoint().state, "ready", "and the take moves the lease, not the state");
});

test("a take with no checkpoint, and a take at done, are each refused naming what was read", async () => {
  field(null, lease(BUILDER));
  const none = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(none.status, 1, none.stdout);
  assert.match(none.stderr, /carries no landing checkpoint/u, none.stderr);
  assert.match(none.stderr, /forge claim ISS-673 --pushed --ready/u);
  assert.equal(held().holder, BUILDER, "and the lease is where it was");
  field({ ...BUILT, state: "done" }, lease(BUILDER));
  const over = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(over.status, 1, over.stdout);
  assert.match(over.stderr, /reads `done`/u, over.stderr);
  assert.equal(held().holder, BUILDER);
});

test("at builder-owed the named builder takes the lease off the lander that holds it", async () => {
  field({ ...BUILT, state: "builder-owed" }, lease(LANDER));
  const run = await ran(["claim", "ISS-673", "--take"], BUILDER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(held().holder, BUILDER, "the reconciliation is the builder's, and so is the lease while it runs");
  assert.equal(held().history.at(-1).landing, "builder-owed");
  assert.match(run.stdout, /landing `builder-owed`/u, run.stdout);
});

test("with the builder holding the lease at builder-owed, its reconciliation write is accepted", async () => {
  field({ ...BUILT, state: "builder-owed" }, lease(BUILDER));
  const run = await ran(["record", "review", "ISS-673", "--reviewer", "codex", "--commit",
    "9e24c2af0000000000000000000000000000abcd", "--outcome", "approved"], BUILDER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const after = checkpoint();
  assert.equal(after.state, "builder-owed", "the write renewed the lease and left the checkpoint alone");
  assert.equal(after.builder, BUILDER, "which still names who owes the reconciliation");
  assert.deepEqual(after.files, BUILT.files);
  assert.equal(held().holder, BUILDER);
});

test("at builder-owed a run that is neither the builder nor a successor is refused naming the state", async () => {
  field({ ...BUILT, state: "builder-owed" }, lease(LANDER));
  const run = await ran(["claim", "ISS-673", "--take"], "a-third-run");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /reads `builder-owed`/u, run.stderr);
  assert.match(run.stderr, new RegExp(`the builder ${BUILDER}'s`, "u"), "and names whose turn it is");
  assert.match(run.stderr, /forge resume ISS-673/u, "with the read that says where the landing is");
  assert.equal(held().holder, LANDER, "and nothing of the third run's was written");
});

test("at builder-owed the lander's take is refused until the state reads reconciled", async () => {
  field({ ...BUILT, state: "builder-owed" }, lease(BUILDER));
  const early = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(early.status, 1, early.stdout);
  assert.match(early.stderr, /reads `builder-owed`/u, early.stderr);
  assert.equal(held().holder, BUILDER, "the builder keeps the lease while the reconciliation is owed");
  field({ ...BUILT, state: "reconciled" }, lease(BUILDER));
  const then = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(then.status, 0, `${then.stdout}${then.stderr}`);
  assert.equal(held().holder, LANDER, "and the same take lands once the state says the turn is back");
  assert.equal(held().history.at(-1).landing, "reconciled");
});

/* The hole a green suite would not show: with one id across a wave, builder equality proves
   nothing, and this is the one write that would replace a live lease on it (ISS-445). */
test("a run carrying the wave's id is refused the builder's turn, and the field is left alone", async () => {
  const wave = "the-dispatching-session";
  field({ ...BUILT, state: "builder-owed", builder: wave }, lease(LANDER));
  const before = JSON.stringify(state.issues[0].sessionContext);
  const run = await ran(["claim", "ISS-673", "--take"], wave, process.cwd(), asWave);
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /reads `builder-owed`/u, run.stderr);
  assert.match(run.stderr, /names a wave and not a run/u, "and says what the id it matched means");
  assert.equal(JSON.stringify(state.issues[0].sessionContext), before, "nothing was written before the refusal");
  const own = await ran(["claim", "ISS-673", "--take"], wave);
  assert.equal(own.status, 0, `${own.stdout}${own.stderr}`, "the same id, given as this run's own, is that run's");
  assert.equal(held().holder, wave);
});

/* The shape the arrangement really takes: the session that lands is the one that dispatched the
   builder, so its id is the wave's and only the builder was given one of its own. The refusal
   above is the builder's turn alone, and this is the same id at the lander's. */
test("the lander carrying the wave's id takes the turn at ready off the builder's live lease", async () => {
  const wave = "the-dispatching-session";
  field(BUILT, lease(BUILDER));
  const run = await ran(["claim", "ISS-673", "--take"], wave, process.cwd(), asWave);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(held().holder, wave, "the lease moved to the run that will land it");
  assert.equal(held().history.at(-1).landing, "ready", "and the history says where it was taken");
  assert.match(run.stdout, /names a wave and not a run/u, "told, as every write under a shared id is");
});

test("the lander that already holds the lease takes its own turn again, which a re-run is", async () => {
  field(BUILT, lease(BUILDER));
  const first = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
  const again = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(again.status, 0, `${again.stdout}${again.stderr}`, "the landing command re-run is not a second lander");
  assert.equal(held().holder, LANDER);
  assert.equal(held().history.filter((one) => one.how === "take").length, 2, "and each take is in the history");
});

/* Regression: the flag the provenance field would need is not this change's, and an undeclared
   flag is refused by the list rather than read as something near it. */
test("claim refuses a flag it does not take, and names the ones it does", async () => {
  field(BUILT, lease(BUILDER));
  const run = await ran(["claim", "ISS-673", "--judge", "codex"], LANDER);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /claim takes no --judge/u, run.stderr);
  assert.match(run.stderr, /--ready/u, "and the flags it does take are on the line");
  const both = await ran(["claim", "ISS-673", "--ready", "--take"], LANDER);
  assert.equal(both.status, 1, both.stdout);
  assert.match(both.stderr, /--ready or --take and not both/u, both.stderr);
});
