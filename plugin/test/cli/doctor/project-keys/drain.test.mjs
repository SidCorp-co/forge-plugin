/* Which master drains `developed`, which is the project file's key because the tracker's pipeline
   schema declares none: the row, the two readings the pair cannot mean, and the one write that
   clears the key with the judgement it was named for. docs/cli/doctor.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { escaped, fakeTracker, projectEntry, projectRoom, ranAsync, tempHome } from "../../../fixtures.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

const state = {
  answer: {
    forge_guide: () => ({ guides: [] }),
    forge_config: (args) => (args.action === "get"
      ? { config: { baseBranch: "master", releaseModel: "publish",
        pipelineConfig: state.settings?.pipelineConfig ?? {} } }
      : undefined),
  },
  config: { pipelineConfig: { autoProdDeploy: false, qa: "independent" } },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

/* The room is the checkout, and the file every case reads back is this machine's record of the
   project that checkout belongs to — kept under the configuration home, not in the tree (ISS-1403).
   `where` is the directory the replacement is written and renamed in, which is what the two
   unwritable cases take away. */
const room = tempHome("doctor-drain");
projectRoom(room.path, tracker.env.XDG_CONFIG_HOME, { slug: "forge-plugin", runs: 2 });
const file = projectEntry(room.path, tracker.env.XDG_CONFIG_HOME);
const where = dirname(file);
test.after(() => {
  chmodSync(where, 0o755);
  room.remove();
});

/** One file and one project record per case: every case here is about what one call left behind. */
const fresh = (drain, qa = "independent") => {
  chmodSync(where, 0o755);
  if (existsSync(file)) chmodSync(file, 0o644);
  writeFileSync(file, `{\n  "slug": "forge-plugin",\n${drain === null ? ""
    : `  "drainedBy": ${JSON.stringify(drain)},\n`}  "runs": 2\n}\n`);
  state.settings = { pipelineConfig: { autoProdDeploy: false, qa } };
  state.calls = [];
  state.issues = [];
};

const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], tracker.env, room.path);
const sent = () => (state.calls ?? []).filter((one) => one.method === "PATCH");
const held = () => JSON.parse(readFileSync(file, "utf8"));
/* Root passes a mode check every other user fails, so the two unwritable cases say so rather than
   reporting a refusal nobody produced. */
const asRoot = process.getuid?.() === 0;

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const DAYS = 3 * 24 * 60;
const atDeveloped = (issueId, held = {}) => ({ issueId, documentId: `u-${issueId}`, title: `${issueId} title`,
  status: "developed", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: ago(DAYS), ...held });
const leased = { sessionContext: { lease: { holder: "a-judging-run", agent: "an agent", pid: "9",
  renewedAt: new Date().toISOString(), minutes: 60,
  history: [{ holder: "a-judging-run", at: ago(20), how: "claim", status: "developed" }] } } };

test("a declared master the rows at developed show draining is ok, with the evidence and the oldest row", async () => {
  fresh("qa-master");
  state.issues = [atDeveloped("ISS-5"), atDeveloped("ISS-6", leased)];
  const run = await ask();
  assert.match(run.stdout,
    new RegExp(`\\[ {2}ok {2}\\] drained by\\s+qa-master, draining: 1 of the 2 row\\(s\\) read at developed carry another session's live lease, another session last claimed one at developed 20 minute\\(s\\) ago, and the oldest offered, ISS-5, was last written 3 day\\(s\\) ago {2}← ${escaped(file)}`, "u"),
    run.stdout);
  assert.doesNotMatch(run.stdout, /^\[ miss \] drained by/mu,
    "a declared master under an independent judgement is the pair meaning what it says");
});

test("a declared master the rows show nobody draining is a miss naming the row that sat and the way out", async () => {
  fresh("qa-master");
  state.issues = [atDeveloped("ISS-5")];
  const run = await ask();
  assert.match(run.stdout,
    /^\[ miss \] drained by\s+qa-master is declared and not draining: 0 of the 1 row\(s\) read at developed carry another session's live lease, no claim at developed by another session is recorded on them, and the oldest offered, ISS-5, was last written 3 day\(s\) ago, judged against `rank\.drainIdle` 60 minute\(s\)\./mu,
    run.stdout);
  assert.match(run.stdout, /So any master that reads the queue takes the rows at developed: start qa-master, or take `drainedBy` out of the file/u);
});

test("a declared master over no row at all is a note, nothing here saying whether it is alive", async () => {
  fresh("qa-master");
  state.issues = [];
  const run = await ask();
  assert.match(run.stdout,
    /^\[ note \] drained by\s+qa-master, declared; no row stands at developed, so nothing here says whether it is draining/mu,
    run.stdout);
});

test("a project that declared nothing is told no master is declared, and of no default", async () => {
  fresh(null);
  state.issues = [atDeveloped("ISS-5")];
  const run = await ask();
  assert.match(run.stdout,
    /^\[ note \] drained by\s+no master — `drainedBy` is unset, so any master that reads the queue takes the rows at developed: 0 of the 1 row\(s\)/mu,
    run.stdout);
  assert.doesNotMatch(run.stdout, /drained by\s+dispatcher/u, "nobody declared the dispatcher");
  assert.doesNotMatch(run.stdout, /drained by[^\n]*the plugin's default/u, "and no default stands in for a decision");
});

test("a window the read did not finish leaves the declaration unchecked and says how much went unread", async () => {
  fresh("qa-master");
  writeFileSync(file, `{\n  "slug": "forge-plugin",\n  "drainedBy": "qa-master",\n  "rank": { "windowCap": 1 },\n  "runs": 2\n}\n`);
  state.issues = [atDeveloped("ISS-5"),
    atDeveloped("ISS-6", { createdAt: "2026-09-02T00:00:00.000Z", updatedAt: ago(5) })];
  const run = await ask();
  assert.match(run.stdout,
    /^\[ miss \] drained by\s+qa-master is declared and not draining: 0 of the 1 row\(s\) read at developed .*and 1 further row\(s\) at developed went unread/mu,
    run.stdout);
});

test("a rank the project file holds and the fold refuses leaves the drain unread, not judged on the defaults", async () => {
  fresh("qa-master");
  writeFileSync(file, `{\n  "slug": "forge-plugin",\n  "drainedBy": "qa-master",\n  "rank": { "drainIdle": 0 },\n  "runs": 2\n}\n`);
  state.issues = [atDeveloped("ISS-5", { updatedAt: ago(5) })];
  const run = await ask();
  assert.match(run.stdout,
    /^\[ note \] drained by\s+qa-master, declared; whether it is draining went unread: `rank\.drainIdle` is a whole number of minutes above zero/mu,
    run.stdout);
  assert.doesNotMatch(run.stdout, /drained by\s+qa-master, draining/u, "a row inside the default window proves nothing here");
});

test("the drain window is set in the project's own file, and a value that counts no minutes is refused", async () => {
  fresh("qa-master");
  const refused = await ask("--set", "rank.drainIdle=0");
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr, /`rank\.drainIdle` is a whole number of minutes above zero/u, refused.stderr);
  assert.equal(held().rank, undefined, "and nothing was written");
  const set = await ask("--set", "rank.drainIdle=90");
  assert.equal(set.status, 0, set.stderr);
  assert.equal(held().rank.drainIdle, 90);
});

test("a value the key does not take names no master and is a miss", async () => {
  fresh("qa-mastre");
  const run = await ask();
  assert.match(run.stdout, /^\[ miss \] drained by\s+`drainedBy` is `qa-mastre`, which is no master that drains developed/mu,
    run.stdout);
  assert.match(run.stdout, /it takes dispatcher or qa-master/u, "the refusal names the values it takes");
  assert.doesNotMatch(run.stdout, /^\[ {2}ok {2}\] drained by/mu,
    "a typo that fell back to the dispatcher is the invisible failure the key exists to prevent");
});

test("a master named while the judgement is not independent is the clash, reported and not reconciled", async () => {
  fresh("qa-master", "builder");
  const run = await ask();
  assert.match(run.stdout,
    /^\[ miss \] drained by\s+`drainedBy` names qa-master and the judgement between developed and testing is builder/mu,
    run.stdout);
  assert.match(run.stdout, /nothing is offered at that status for it to drain/u,
    "the sentence says why the combination cannot mean anything");
  assert.match(run.stdout, /set the judgement to independent, or take the key out/u,
    "and what to do about it");
});

test("the write that moves the judgement off independent clears the drain key with it", async () => {
  fresh("qa-master");
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^drainedBy: cleared, the judgement it named a master for having moved {2}← /mu,
    run.stdout);
  assert.equal(held().drainedBy, undefined, "the key is gone from the file, not set to something inert");
  assert.deepEqual(Object.keys(held()), ["slug", "runs"], "and every other key of it is as it was");
});

test("a write that moves no judgement leaves the key standing", async () => {
  fresh("qa-master");
  const run = await ask("--set", "pipeline.autoProdDeploy=true");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held().drainedBy, "qa-master",
    "the judgement the key answers to did not move, so undoing a declaration nobody touched would be a loss");
  assert.doesNotMatch(run.stdout, /drainedBy: cleared/u);
});

test("selecting a flow that asks for no judgement leaves the key standing", async () => {
  fresh("qa-master");
  const run = await ask("--flow", "default");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held().drainedBy, "qa-master",
    "that flow asks this project for nothing, so it undid a declaration it never touched");
  assert.equal(held().flow, "default", "and the half it does write landed");
});

test("a project file that cannot be rewritten refuses the write before the tracker is sent anything", { skip: asRoot }, async () => {
  fresh("qa-master");
  chmodSync(file, 0o444);
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not be read and rewritten, so that half is out of reach and nothing was sent/u,
    run.stderr);
  assert.equal(sent().length, 0, "a judgement that landed over a file this could not clear is the orphan itself");
  assert.equal(state.settings.pipelineConfig.qa, "independent");
});

test("a directory the replacement cannot write in refuses the write too, the file itself being writable", { skip: asRoot }, async () => {
  fresh("qa-master");
  chmodSync(where, 0o555);
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not be read and rewritten, so that half is out of reach and nothing was sent/u,
    "the replacement writes a sibling and renames it, so the file's own mode answers half the question");
  assert.equal(sent().length, 0);
});

test("a key declared twice is cleared out of the file entirely, not down to the one the resolver reads", async () => {
  fresh("qa-master");
  writeFileSync(file,
    `{\n  "slug": "forge-plugin",\n  "drainedBy": "dispatcher",\n  "drainedBy": "qa-master",\n  "runs": 2\n}\n`);
  const run = await ask("--set", "pipeline.qa=builder");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(Object.hasOwn(held(), "drainedBy"), false,
    "a document declaring one key twice parses to the last of them, so clearing the first clears nothing");
  assert.deepEqual(Object.keys(held()), ["slug", "runs"]);
});

test("a file made unreadable under the call gets the same account as one that could not be written", { skip: asRoot }, async () => {
  fresh("qa-master");
  const held0 = state.answer.forge_config;
  state.answer.forge_config = (args) => {
    if (args.action === "set_pipeline") chmodSync(file, 0o000);
    return held0(args);
  };
  const run = await ask("--set", "pipeline.qa=builder").finally(() => {
    state.answer.forge_config = held0;
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /pipeline\.qa is "builder" on the tracker now and .* could not be read back and written/u,
    "a read that throws leaves the caller as uninformed as a write that does");
  assert.match(run.stderr, /Send the same command again once that file can be written/u);
  chmodSync(file, 0o644);
  assert.equal(held().drainedBy, "qa-master", "and the key stands, which is what the account is about");
});

test("a send that never answered names the key it left standing rather than the transport alone", async () => {
  fresh("qa-master");
  const held0 = state.answer.forge_config;
  state.answer.forge_config = (args) => {
    if (args.action === "set_pipeline") return { refused: "the tracker would not answer" };
    return held0(args);
  };
  const run = await ask("--set", "pipeline.qa=builder").finally(() => {
    state.answer.forge_config = held0;
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the send did not answer, so nothing here can say whether the tracker took it/u,
    run.stderr);
  assert.match(run.stderr, /is untouched and still sets `drainedBy`/u,
    "the transport error alone leaves the caller to find the surviving key on some later report");
  assert.equal(held().drainedBy, "qa-master");
});

test("a read back that kept nothing names the key still on the file beside what it says of the tracker", async () => {
  fresh("qa-master");
  const held0 = state.answer.forge_config;
  state.answer.forge_config = (args) => (args.action === "pipeline"
    ? { pipelineConfig: { autoProdDeploy: false } }
    : held0(args));
  const run = await ask("--set", "pipeline.qa=builder").finally(() => {
    state.answer.forge_config = held0;
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /The tracker did not keep it/u, run.stderr);
  assert.match(run.stderr, /is untouched and still sets `drainedBy`/u,
    "the branch that reads the write as refused says nothing of the half it left standing");
  assert.equal(held().drainedBy, "qa-master");
});

test("a project file another session moved under the call is refused rather than written back", async () => {
  fresh("qa-master");
  const held0 = state.answer.forge_config;
  state.answer.forge_config = (args) => {
    if (args.action === "set_pipeline") {
      writeFileSync(file, `{\n  "slug": "forge-plugin",\n  "drainedBy": "qa-master",\n  "runs": 4\n}\n`);
    }
    return held0(args);
  };
  try {
    const run = await ask("--set", "pipeline.qa=builder");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /changed while that write was in flight/u, run.stderr);
    assert.equal(held().runs, 4, "the other session's edit stands, which writing the snapshot back would have lost");
  } finally {
    state.answer.forge_config = held0;
  }
});

test("a file that fails after the tracker kept the judgement names what stands and the call that settles it", { skip: asRoot }, async () => {
  fresh("qa-master");
  const held0 = state.answer.forge_config;
  /* Broken during the tracker call and not before, which is the only window the preflight leaves. */
  state.answer.forge_config = (args) => {
    if (args.action === "set_pipeline") chmodSync(where, 0o555);
    return held0(args);
  };
  const run = await ask("--set", "pipeline.qa=builder").finally(() => {
    state.answer.forge_config = held0;
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /pipeline\.qa is "builder" on the tracker now and .* could not be read back and written/u,
    run.stderr);
  assert.match(run.stderr, /a master named for a judgement nobody asked for/u);
  assert.match(run.stderr, /Send the same command again once that file can be written/u,
    "the refusal carries the one call that clears it rather than a description of the state");
  assert.equal(held().drainedBy, "qa-master", "and the file is as it was, so the same call is the undo");
});
