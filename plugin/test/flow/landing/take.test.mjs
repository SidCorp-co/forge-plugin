/* The handoff itself, through the verb: the checkpoint a build writes where it ends, and the take
   that moves the lease only where the state names the taker's turn. Every refusal here is read for
   the state it names, because a state machine refusing for the wrong reason looks identical to one
   refusing for the right one (ISS-673). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

import { fakeTracker, ranAsync, standsInNoTree, tempHome, tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-take").path;
standsInNoTree("landing-take");
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
   the same command sent again lands. That hold is not this file's subject, and neither is the
   other: every case here starts from a field holding no lease at `developed`, which is the record
   a claim refuses without `--unheld` (ISS-1184), and the flag says nothing about any state a
   checkpoint names. */
const ran = async (argv, id, cwd = process.cwd(), env = asRun) => {
  const sent = argv[0] === "claim" ? [...argv, "--unheld"] : argv;
  let run = null;
  for (const again of [1, 2]) {
    run = await ranAsync(FORGE, sent, env(id), cwd);
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

/* Through the verb and not through the printer, because the printer's own cases stay green when the
   wiring under them goes: the bug this catches was `advise` composing the opening from the issue it
   fetched before its own write, so a capture went unprinted by the call that made it (consult
   34d2ee F3). The branch here is bare — one commit, its own base — which is what a branch looks like
   at the moment the status it is built under is entered. */
test("a bare branch is captured, and the claim's own opening names it above the lane", async () => {
  field(null, null);
  const run = await ran(["claim", "ISS-673", "--pushed"], BUILDER, NOTHING);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const at = git(NOTHING, "rev-parse", "HEAD").stdout.trim();
  const wrote = state.issues[0].sessionContext.worklog;
  assert.equal(wrote.branch, "iss-673-6", "the branch, which the old capture wrote nowhere");
  assert.equal(wrote.head, at, "the head it stands at");
  assert.equal(wrote.base, at, "and the base, which on a branch with no commit of its own is that head");
  assert.equal(wrote.touched, undefined, "no diff, so no touched set beside a head that has none");
  const said = run.stdout.split("\n");
  const work = said.findIndex((one) => /^ {2}work: iss-673-6, at /u.test(one));
  assert.notEqual(work, -1, run.stdout);
  assert.match(said[work], /its own base at that reading, so nothing of its own on it/u,
    "which is what a branch with no commit of its own is, said as the reading it comes from");
  assert.ok(work < said.findIndex((one) => one.startsWith("Lane at ")), "above the lane, not under it");
});

/* The resume's own wiring, which no printer case reaches, and the pointer at a status with no
   opening to carry it: the split between the two blocks says which renders a fact, never whether
   one is rendered, and a closed issue is where somebody asks which branch this was (c88e14 F1, ecf127 F3). */
test("the resume names the work through the verb, and a status owing no phase says it below", async () => {
  field(null, null);
  const wrote = await ran(["claim", "ISS-673", "--pushed"], BUILDER, CHANGED);
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  const owed = await ran(["resume", "ISS-673"], BUILDER, CHANGED);
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  assert.match(owed.stdout.split("Lane at ")[0], /^ {2}work: iss-673-6, at /mu,
    "the worklog this verb fetched, above the lane rather than in a footer");
  state.issues[0] = { ...state.issues[0], status: "closed" };
  const closed = await ran(["resume", "ISS-673"], BUILDER, CHANGED);
  assert.equal(closed.status, 0, `${closed.stdout}${closed.stderr}`);
  assert.equal(/^ {2}work: /mu.test(closed.stdout.split("\nWorklog")[0]), false,
    "a status owing no phase opens on nothing, so nothing above the block says it");
  assert.equal((closed.stdout.match(/^ {2}work: iss-673-6, at /gmu) ?? []).length, 1,
    `and the block below carries it instead, exactly once: ${closed.stdout}`);
});

/* The other half of the same wiring: a claim writing no capture is advised on the block that was
   already there, and one writing a capture is advised on the block it just wrote. */
test("the opening names the branch this claim wrote, and the one it found where it wrote none", async () => {
  field(null, null);
  state.issues[0].sessionContext = { worklog: { branch: "iss-673-before", head: "9e24c2af0000000000000000000000000000abcd" } };
  const found = await ran(["claim", "ISS-673"], BUILDER, NOTHING);
  assert.equal(found.status, 0, `${found.stdout}${found.stderr}`);
  assert.match(found.stdout, /^ {2}work: iss-673-before, at 9e24c2a/mu, found.stdout);
  const wrote = await ran(["claim", "ISS-673", "--pushed"], BUILDER, CHANGED);
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  assert.match(wrote.stdout, /^ {2}work: iss-673-6, at /mu, "the branch this call captured, not the one it read");
  assert.equal(/iss-673-before/u.test(wrote.stdout.split("Lane at ")[0]), false,
    "and the block it replaced is gone from the opening rather than printed beside its successor");
  assert.match(wrote.stderr, /this capture names `iss-673-6`/u, "with the replacement said aloud");
});

test("--ready without the capture it writes from is refused, and so is a capture holding nothing", async () => {
  field(null, null);
  const alone = await ran(["claim", "ISS-673", "--ready"], BUILDER, CHANGED);
  assert.equal(alone.status, 1, alone.stdout);
  assert.match(alone.stderr, /forge claim ISS-673 --pushed --ready/u, alone.stderr);
  assert.equal(checkpoint(), null, "and nothing was written");
  const empty = await ran(["claim", "ISS-673", "--pushed", "--ready"], BUILDER, NOTHING);
  assert.equal(empty.status, 1, empty.stdout);
  assert.match(empty.stderr, /captured no change/u, empty.stderr);
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

test("with the builder holding the lease at builder-owed, a payload write of its own is accepted", async () => {
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

/* The route out of `builder-owed`, which the state had none of until this: the builder says which
   candidate it read, and the sha it names is what the landing compares before it promotes anything
   (ISS-726). Refusals read for the state and the shas they name, as every refusal here is. */
const CANDIDATE = "7c1d0e5b0000000000000000000000000000face";
const OWED = { ...BUILT, state: "builder-owed", candidate: CANDIDATE, moved: "one.mjs" };

test("the builder's reconciliation moves the checkpoint to reconciled at the candidate it names", async () => {
  field(OWED, lease(BUILDER));
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], BUILDER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const after = checkpoint();
  assert.equal(after.state, "reconciled", "the state the lander's turn is read from again");
  assert.equal(after.reconciled, CANDIDATE, "against the candidate this landing built, which the promotion compares");
  assert.equal(after.candidate, CANDIDATE, "and the candidate itself is left where it was");
  assert.match(run.stdout, /landing `reconciled`/u, run.stdout);
  assert.match(run.stdout, /promotes that commit and no other/u, "and what the run is told is left of it");
});

test("the seven digits the landing prints are the value, and the whole sha is what is stored", async () => {
  field(OWED, lease(BUILDER));
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE.slice(0, 7)], BUILDER);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(checkpoint().reconciled, CANDIDATE,
    "the stop prints seven and the promotion compares forty, so the checkpoint's own string is stored");
});

test("a reconciliation naming another candidate is refused with both shas, and writes nothing", async () => {
  field(OWED, lease(BUILDER));
  const before = JSON.stringify(state.issues[0].sessionContext);
  const run = await ran(["claim", "ISS-673", "--reconciled", BUILT.head], BUILDER);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`names the candidate ${CANDIDATE.slice(0, 7)}`, "u"), run.stderr);
  assert.match(run.stderr, new RegExp(`reconciliation names ${BUILT.head.slice(0, 7)}`, "u"),
    "the sha given, so the two are read side by side");
  assert.match(run.stderr, new RegExp(`--reconciled ${CANDIDATE}`, "u"), "with the command that answers it");
  assert.equal(JSON.stringify(state.issues[0].sessionContext), before, "and the field is untouched");
  const shapeless = await ran(["claim", "ISS-673", "--reconciled", "the-candidate"], BUILDER);
  assert.equal(shapeless.status, 1, shapeless.stdout);
  assert.match(shapeless.stderr, /7 to 40 hex digits/u, shapeless.stderr);
  assert.equal(JSON.stringify(state.issues[0].sessionContext), before);
});

test("a reconciliation at any state but builder-owed is refused naming the state it read", async () => {
  for (const state of ["ready", "candidate", "reconciled", "qa-owed", "judged", "marked", "done"]) {
    field({ ...OWED, state }, lease(BUILDER));
    const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], BUILDER);
    assert.equal(run.status, 1, `${state}: ${run.stdout}`);
    assert.match(run.stderr, new RegExp(`reads \`${state}\``, "u"), run.stderr);
    assert.match(run.stderr, /handed back from `builder-owed`/u, "and the one state it is handed back from");
    assert.equal(checkpoint().state, state, "nothing was written");
  }
  field(null, lease(BUILDER));
  const none = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], BUILDER);
  assert.equal(none.status, 1, none.stdout);
  assert.match(none.stderr, /reads `nothing at all`/u, "an issue with no checkpoint reads as no state");
});

/* The successor route the reclaim rules already allow, all the way through: the builder is gone, so
   its dead lease is any run's, and the run that takes the turn holds a live lease of its own from
   that moment — read as the lease alone, that live lease would refuse the write the take was made
   for. What separates it from the lander is its take's own history row (ISS-726). */
test("a successor that took the builder's dead turn writes the reconciliation under the lease it took", async () => {
  field(OWED, { ...lease(BUILDER), renewedAt: "2026-09-07T10:00:00.000Z" });
  const took = await ran(["claim", "ISS-673", "--take"], "a-successor-run");
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`, "the builder is gone and its lease is dead");
  assert.equal(held().holder, "a-successor-run");
  assert.equal(held().history.at(-1).landing, "builder-owed", "the take names the state it was taken at");
  const wrote = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], "a-successor-run");
  assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`, "and the write it took the turn to make is its own");
  assert.equal(checkpoint().state, "reconciled");
  assert.equal(checkpoint().reconciled, CANDIDATE);
});

/* The lease a successor's reconciliation leaves behind is the judge's hole one state over: it is
   live, its turn is over, and the state's turn is the lander's. Spent by the take, and by the same
   take a third run's would not be. */
test("the lease a successor reconciled under is taken back from at once, and its lander's is not", async () => {
  const took = [{ holder: "a-successor-run", at: "2026-09-07T11:00:00.000Z", how: "take", status: "developed", next: null, landing: "builder-owed" }];
  field({ ...OWED, state: "reconciled", reconciled: CANDIDATE }, { ...lease("a-successor-run"), history: took });
  const lander = await ran(["claim", "ISS-673", "--take"], LANDER);
  assert.equal(lander.status, 0, `${lander.stdout}${lander.stderr}`, "the landing carries on the moment the write lands");
  assert.equal(held().holder, LANDER);
  const third = await ran(["claim", "ISS-673", "--take"], "a-third-run");
  assert.equal(third.status, 1, `${third.stdout}${third.stderr}`);
  assert.match(third.stderr, /is already on it/u, "the lander's own lease is an ordinary one");
  assert.equal(held().holder, LANDER, "and it is where it was");
  /* The same run twice over: the successor that reconciled goes on to land, and the row that made
     its builder's lease spent is not the one its lander's lease is read by. */
  field({ ...OWED, state: "reconciled", reconciled: CANDIDATE }, { ...lease("a-successor-run"), history: took });
  const landing = await ran(["claim", "ISS-673", "--take"], "a-successor-run");
  assert.equal(landing.status, 0, `${landing.stdout}${landing.stderr}`, "its own lease, taken again, which a re-run is");
  const after = await ran(["claim", "ISS-673", "--take"], "a-third-run");
  assert.equal(after.status, 1, `${after.stdout}${after.stderr}`);
  assert.match(after.stderr, /is already on it/u, "and what it holds now is a lander's, spent by nothing");
  assert.equal(held().holder, "a-successor-run");
});

/* The history outlives the holder, and a row that licensed a run once would license it forever: the
   run that took this turn and lost the lease is any other run again, and the live lease it would be
   taking is a second successor's own turn. */
test("a successor whose lease went to the run after it is refused the turn it once held", async () => {
  const gone = { ...lease("the-first-successor"), renewedAt: "2026-09-07T10:00:00.000Z" };
  field(OWED, { ...gone, history: [{ holder: "the-first-successor", at: gone.renewedAt, how: "take", status: "developed", next: null, landing: "builder-owed" }] });
  const second = await ran(["claim", "ISS-673", "--take"], "the-second-successor");
  assert.equal(second.status, 0, `${second.stdout}${second.stderr}`, "the first successor's lease is dead");
  assert.equal(held().holder, "the-second-successor");
  const again = await ran(["claim", "ISS-673", "--take"], "the-first-successor");
  assert.equal(again.status, 1, `${again.stdout}${again.stderr}`);
  assert.match(again.stderr, /neither it nor a successor/u, again.stderr);
  assert.equal(held().holder, "the-second-successor", "and the live lease it would have taken is where it was");
});

test("the lander that wrote the hand-back cannot sign the reconciliation, holding an older lease", async () => {
  field(OWED, lease(LANDER));
  const run = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], LANDER);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, new RegExp(`the builder ${BUILDER}'s`, "u"), run.stderr);
  assert.equal(checkpoint().state, "builder-owed", "the reading is the builder's to make and the turn is still owed");
});

test("a reconciliation by a run the state does not license is refused, naming whose turn it is", async () => {
  field(OWED, lease(LANDER));
  const third = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE], "a-third-run");
  assert.equal(third.status, 1, third.stdout);
  assert.match(third.stderr, new RegExp(`the builder ${BUILDER}'s`, "u"), third.stderr);
  assert.equal(checkpoint().state, "builder-owed", "and the turn is still owed");
  /* And the hole the case below this file's next comment is about, asked at this write too. */
  field({ ...OWED, builder: "the-dispatching-session" }, lease(LANDER));
  const wave = await ran(["claim", "ISS-673", "--reconciled", CANDIDATE],
    "the-dispatching-session", process.cwd(), asWave);
  assert.equal(wave.status, 1, `${wave.stdout}${wave.stderr}`);
  assert.match(wave.stderr, /names a wave and not a run/u, wave.stderr);
  assert.equal(checkpoint().state, "builder-owed");
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
  assert.match(run.stderr, /No claim flag named --judge\./u, run.stderr);
  assert.match(run.stderr, /--ready/u, "and the flags it does take are on the line");
  const both = await ran(["claim", "ISS-673", "--ready", "--take"], LANDER);
  assert.equal(both.status, 1, both.stdout);
  assert.match(both.stderr, /--ready and --take/u, both.stderr);
  assert.match(both.stderr, /each is a different turn's own move/u, "and why two of them name no turn");
  /* Every pair, not the one the first version knew: three turns now write through this verb, and a
     refusal listing only two of them would let the third pair through unread. */
  const three = await ran(["claim", "ISS-673", "--ready", "--take", "--judged"], LANDER);
  assert.match(three.stderr, /--ready and --take and --judged/u, three.stderr);
  const judging = await ran(["claim", "ISS-673", "--take", "--judged"], LANDER);
  assert.equal(judging.status, 1, judging.stdout);
  assert.match(judging.stderr, /--take and --judged/u, judging.stderr);
});
