/* Two agents dispatched into one worktree resolve one id, so the lease read the second as the first
   renewing and `forge claim` answered `renewed` while the first was mid-ship: ISS-1872's own account,
   measured on ISS-1699. Nothing ambient separates them, so each case below either finds work standing
   in the tree and refuses, or finds none and takes the lease exactly as it did before. Which process
   counts is the project's own `lease.workingRe`, so each tree below declares its own and one of them
   declares nothing at all. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { escaped, fakeTracker, ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { idsHere } from "../../../src/flow/lease.mjs";
import { workingHere } from "../../../src/flow/lease/working.mjs";

process.env.XDG_CONFIG_HOME = tempHome("live-sibling").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const UUID = "live-sibling-uuid";
const OURS = "iss-1872-a4e81e39";
const ELSEWHERE = "iss-1699-3727cd01";
/* One token on a worker's argument vector, so a declaration reaches this suite's own work alone. */
const MARK = "iss-1872-work-witness";

/* A tree is its git directory and the id beside it, which is the whole of what the reading resolves
   a tree from; the project file travels with it so that leaving the checkout moves nothing else. */
const treeMinting = (id, declares = MARK) => {
  const at = tempRoom(`live-sibling-${id}-`);
  mkdirSync(join(at, ".git"));
  writeFileSync(join(at, ".git", "forge-run-id"), `${id}\n`);
  const project = JSON.parse(readFileSync(new URL("../../../../.forge.json", import.meta.url), "utf8"));
  if (declares) project.lease = { workingRe: declares };
  else delete project.lease;
  writeFileSync(join(at, ".forge.json"), JSON.stringify(project));
  return at;
};

const TREE = treeMinting(OURS);
const OTHER = treeMinting(ELSEWHERE);
/* A tree of this project's own that declares nothing, which is every project that has not chosen. */
const SILENT = treeMinting(OURS, null);
/* The caller stands in the tree, as the run it is claiming for does: its own process and its parent
   are therefore standing there too, and a reading that did not exclude them would refuse every call
   ever made from a worktree — which is what the cases that are granted below prove it does not. */
process.chdir(TREE);

/* The shape the defect had, made of this test's own processes: the host is this process, the work
   below is one call of it, and the `forge` below is another — which is what two agents of one wave
   standing in one tree are, and all that separates them. Naming a host further up puts both under
   one call of it instead, which is what a run's own suite looks like from inside. */
const standingIn = async (at, mark = MARK) => {
  const one = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(0), 120_000)", ...mark ? [mark] : []],
    { cwd: at, stdio: "ignore" });
  for (let waited = 0; waited < 200; waited += 1) {
    try {
      if (readlinkSync(`/proc/${one.pid}/cwd`) === at) return one;
    } catch { /* not in the table yet */ }
    await new Promise((wake) => { setTimeout(wake, 10); });
  }
  throw new Error("a spawned process never reached the process table, which is not a state this suite can run in");
};

/* The shape a sibling's work takes once its own intermediate has gone: the seed starts the worker
   detached and exits, so the worker keeps the directory and is reparented off every chain the host
   stands in. Measured on this box before it was written: a live gate in another run's tree answered
   to `systemd --user` and to no host at all, which is why the host bounds this call's own work rather
   than qualifying what is found (ISS-1872 F1). */
const reparentedIn = async (at) => {
  const seed = spawn(process.execPath, ["-e",
    'const { spawn } = require("node:child_process");'
    + 'const one = spawn(process.argv[1], ["-e", "setTimeout(() => process.exit(0), 120_000)", process.argv[3]],'
    + ' { cwd: process.argv[2], stdio: "ignore", detached: true });'
    + 'one.unref(); process.stdout.write(String(one.pid) + "\\n"); process.exit(0);',
    process.execPath, at, MARK], { stdio: ["ignore", "pipe", "ignore"] });
  let said = "";
  seed.stdout.on("data", (chunk) => { said += chunk; });
  await new Promise((done) => { seed.on("exit", done); });
  const pid = Number(said.trim());
  assert.ok(Number.isInteger(pid) && pid > 1, `the seed named no worker: ${said}`);
  for (let waited = 0; waited < 300; waited += 1) {
    if (answeredCwd(pid) === at && !chainHolds(pid, process.pid)) return { pid, kill: () => { try { process.kill(pid); } catch { /* already gone */ } } };
    await new Promise((wake) => { setTimeout(wake, 10); });
  }
  throw new Error(`a worker never left this process's ancestry, which is not a state this suite can run in: pid ${pid}`);
};

const answeredCwd = (pid) => { try { return readlinkSync(`/proc/${pid}/cwd`); } catch { return null; } };

const chainHolds = (pid, want) => {
  for (let at = pid; at > 1;) {
    if (at === want) return true;
    const said = (() => { try { return readFileSync(`/proc/${at}/status`, "utf8"); } catch { return ""; } })();
    const up = Number(/^PPid:\s*(\d+)$/mu.exec(said)?.[1]) || 0;
    if (up === at || up === 0) return false;
    at = up;
  }
  return false;
};

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1872",
  status: "approved",
  title: "a lease two agents in one tree both read as their own",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. BR-05~1: the one outcome.",
  complexity: "m",
};

const heldBy = ({ holder = OURS, history = [] } = {}) => {
  ISSUE.status = "approved";
  state.wrote = 0;
  ISSUE.sessionContext = {
    lease: {
      holder, agent: "a-test-agent", pid: String(process.pid), renewedAt: ago(5), minutes: 60,
      next: "Phase 4: the branch is cut", history,
    },
  };
};

const state = {
  calls: [],
  wrote: 0,
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [ISSUE],
  comments: { [UUID]: [] },
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: 1, hasMore: false };
      if (args.action === "update") {
        state.wrote += 1;
        Object.assign(ISSUE, args.data);
      }
      if (args.action === "transition") ISSUE.status = args.data.status;
      return ISSUE;
    },
    forge_comments: (args) => {
      if (args.action !== "list") return { documentId: "a-comment" };
      return { comments: state.comments[UUID] ?? [], returned: 0, hasMore: false };
    },
  },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const HOST = process.pid;
const UNDER_ONE_CALL = process.ppid;

const ran = (argv, at = TREE, host = HOST) =>
  ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: OURS, CLAUDE_PID: String(host) }, at);
const onTheRecord = () => ISSUE.sessionContext.lease;

test("the reading is of work outside this call's own, and of nothing else", async () => {
  const own = await standingIn(TREE);
  try {
    assert.ok(workingHere(OURS, TREE, HOST).some((one) => one.pid === own.pid),
      "work standing in the tree that is not this call, not above it and not anything it started");
    assert.deepEqual(workingHere(OURS, TREE, UNDER_ONE_CALL), [],
      "and the same work under one call of a host further up, which is this reading's blind spot and the suite's own shape");
    assert.deepEqual(workingHere(ELSEWHERE, TREE, HOST), [], "a holder this tree does not mint is read from no tree at all");
    assert.deepEqual(workingHere(OURS, TREE, "unknown"), [], "and a call that knows no host process reads nothing");
  } finally {
    own.kill();
  }
});

test("a second claim from one worktree is refused while work this call did not start stands in that tree", async () => {
  heldBy();
  /* Off the record before the call, because the reader below hands back the very object a write
     would have changed: comparing it with itself passes however much the claim wrote. */
  const was = onTheRecord().renewedAt;
  const sibling = await standingIn(TREE);
  try {
    const refused = await ran(["claim", "ISS-1872"]);
    assert.equal(refused.status, 1, `a renewal is what asking nothing of the tree answered:\n${refused.stdout}`);
    assert.match(refused.stderr, new RegExp(`pid ${sibling.pid}`, "u"), "the process is named by its id");
    assert.match(refused.stderr, /setTimeout/u, "and by what it is running, which is what says whose it is");
    assert.match(refused.stderr, new RegExp(escaped(TREE), "u"), "beside the tree it is standing in");
    assert.match(refused.stderr, new RegExp(escaped(join(TREE, ".git", "forge-run-id")), "u"),
      "and the file that mints the id, which is why the holder matched");
    assert.match(refused.stderr, /ps -o pid,lstart,args/u, "with the command that establishes who is under it");
    assert.match(refused.stderr, /forge claim ISS-1872 --stopped/u, "and the one flag that takes it anyway");
    assert.equal(onTheRecord().renewedAt, was,
      "and the lease still reads as it did before the call, the refusal coming before the write");
    assert.equal(state.wrote, 0, "which the tracker confirms: no write of the field was even attempted");
  } finally {
    sibling.kill();
  }
});

/* The case ISS-919 landed, which this may not cost anything: the run before it died in this tree and
   left the lease behind, and the tree is idle, so there is nothing to establish and nothing to type. */
test("the same claim is granted at once where nothing is standing in that tree", async () => {
  heldBy();
  const took = await ran(["claim", "ISS-1872"]);
  assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
  assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u, "the holder's own lease renewed, as before");
  assert.doesNotMatch(took.stdout, /standing in/u, "and nothing said about a tree with nothing in it");
});

test("the flag takes the lease while that work is still standing, and the history keeps no row for it", async () => {
  heldBy();
  const sibling = await standingIn(TREE);
  try {
    const took = await ran(["claim", "ISS-1872", "--stopped"]);
    assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u, "the take the caller asserted");
    assert.equal(onTheRecord().history.length, 0,
      "and a holder retaking its own lease is no handoff, so the park counting crashes counts nothing here");
    assert.equal(state.wrote, 1,
      "one write reached the tracker, which is what makes the refusal's count of none an assertion that can fail");
  } finally {
    sibling.kill();
  }
});

test("work under the same call as this one is this call's own, and the claim is granted", async () => {
  heldBy();
  const own = await standingIn(TREE);
  try {
    const took = await ran(["claim", "ISS-1872"], TREE, UNDER_ONE_CALL);
    assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u,
      "a run's own gate standing in its own tree is not a second run, and neither is a suite");
  } finally {
    own.kill();
  }
});

test("a tree minting another id says nothing about this lease, whatever is running in it", async () => {
  heldBy();
  const sibling = await standingIn(OTHER);
  try {
    const took = await ran(["claim", "ISS-1872"], OTHER);
    assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u,
      "the reading is the tree's own id and not any process it happens to hold");
  } finally {
    sibling.kill();
  }
});

/* The reading refuses a claim and stands out of every payload write, because a run writing what it
   has just done while a gate of its own runs in the tree would be refused by a probe that cannot say
   whose the gate is — and the write is the half of the lease that carries the work. */
test("a payload write under that same lease lands while the work stands", async () => {
  heldBy();
  const sibling = await standingIn(TREE);
  try {
    const wrote = await ran(["record", "decision", "ISS-1872", "--none", "nothing was ambiguous"]);
    assert.equal(wrote.status, 0, `${wrote.stdout}${wrote.stderr}`);
  } finally {
    sibling.kill();
  }
});

test("the brief says the work is standing there rather than leaving the lease's own state as the whole reading", async () => {
  heldBy();
  const sibling = await standingIn(TREE);
  try {
    const read = await ran(["resume", "ISS-1872"]);
    assert.equal(read.status, 0, read.stderr);
    assert.match(read.stdout, new RegExp(`pid ${sibling.pid}`, "u"), "the process, under the lease it qualifies");
    assert.match(read.stdout, /names this tree and not one run in it/u, "and what the matching holder is worth");
  } finally {
    sibling.kill();
  }
});

/* An id read off a tree is the one thing that cannot be called this caller's own, so the sentence a
   worktree-sourced caller is given may not say so — the refusal's own reassurance, in prose. */
test("the sentence a worktree-sourced caller is given names the tree rather than that caller's run", () => {
  const said = idsHere({ holder: ELSEWHERE, agent: "a-test-agent", pid: "1", renewedAt: ago(5), minutes: 60 },
    { id: OURS, source: "worktree" }, TREE);
  assert.match(said, new RegExp(escaped(join(TREE, ".git", "forge-run-id")), "u"), "the file the id was read off");
  assert.match(said, /names that tree rather than this run/u, "and what an id read off a tree identifies");
  assert.doesNotMatch(said, /this run's alone/u, "never that the id is this caller's own, which no tree can say");
});

/* F1 of this change's own review: the reading asked the host to appear in what it found, so a
   sibling's worker whose intermediate had exited read as nothing at all — which is the shape a
   backgrounded gate actually has on this box. */
test("work whose own intermediate has exited still refuses the claim, the host having left its ancestry", async () => {
  heldBy();
  const orphan = await reparentedIn(TREE);
  try {
    assert.ok(workingHere(OURS, TREE, HOST).some((one) => one.pid === orphan.pid),
      "the reading finds work the host no longer stands above");
    const refused = await ran(["claim", "ISS-1872"]);
    assert.equal(refused.status, 1, `a renewal is what asking the host to be found answered:\n${refused.stdout}`);
    assert.match(refused.stderr, new RegExp(`pid ${orphan.pid}`, "u"), "and names it as it names any other");
    assert.match(refused.stderr, /neither this call, nor above it, nor anything it started/u,
      "saying only what the reading establishes, the host being a boundary and not the origin it can claim for what it found");
    assert.doesNotMatch(refused.stderr, /another call of this host/u,
      "and not an origin this work does not have, its own chain reaching no host at all");
    const read = await ran(["resume", "ISS-1872"]);
    assert.match(read.stdout, new RegExp(`pid ${orphan.pid}`, "u"), "and the brief reports it on the same terms");
  } finally {
    orphan.kill();
  }
});

/* Criterion 2: the tree is busy and the claim is still granted, because what is standing in it is
   not what this project calls a run's work. A gate is the case that matters — the method starts one
   before the claim — and this is the shape of it. */
test("work this project does not declare leaves the claim exactly as it was", async () => {
  heldBy();
  const idle = await standingIn(TREE, null);
  try {
    assert.deepEqual(workingHere(OURS, TREE, HOST), [], "the reading passes over it");
    const took = await ran(["claim", "ISS-1872"]);
    assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u, "and the lease renews as it always did");
    assert.doesNotMatch(took.stdout, /standing in/u, "with nothing said about a process no declaration reaches");
  } finally {
    idle.kill();
  }
});

/* Criterion 3: a project that has not chosen gets the behaviour it had before the key existed.
   Silence is the answer docs/two-levels.md asks for, a plugin installed into a tree that never
   opted in imposing nothing. */
test("a project that declares nothing reads no process at all, whatever is standing in its tree", async () => {
  heldBy();
  const sibling = await standingIn(SILENT);
  try {
    assert.deepEqual(workingHere(OURS, SILENT, HOST), [], "no declaration, so nothing to find");
    const took = await ran(["claim", "ISS-1872"], SILENT);
    assert.equal(took.status, 0, `${took.stdout}${took.stderr}`);
    assert.match(took.stdout, /renewed: session iss-1872-a4e81e39/u,
      "the claim a declared tree would refuse, taken where the key is absent");
  } finally {
    sibling.kill();
  }
});

/* Criterion 7: the ship runs the gate itself, and the gate makes claims. So declared work this call
   descends from is this call's own however well it matches, and the control below is the same
   command standing beside the call rather than above it. */
test("declared work this call descends from is its own, and the same command beside it is not", async () => {
  heldBy();
  const asked = ["claim", "ISS-1872"];
  const under = await new Promise((done, broke) => {
    const one = spawn(process.execPath, ["-e",
      'const { spawnSync } = require("node:child_process");'
      + 'const ran = spawnSync(process.argv[1], JSON.parse(process.argv[2]), { encoding: "utf8" });'
      + "process.stdout.write(JSON.stringify({ status: ran.status, stdout: ran.stdout, stderr: ran.stderr }));",
      FORGE, JSON.stringify(asked), MARK],
    { cwd: TREE, stdio: ["ignore", "pipe", "ignore"],
      env: { ...tracker.env, FORGE_SESSION_ID: OURS, CLAUDE_PID: String(HOST) } });
    let said = "";
    one.stdout.on("data", (chunk) => { said += chunk; });
    one.on("error", broke);
    one.on("exit", () => done(JSON.parse(said || "{}")));
  });
  assert.equal(under.status, 0, `a run's own ship is not a sibling of it:\n${under.stdout}${under.stderr}`);
  assert.match(under.stdout, /renewed: session iss-1872-a4e81e39/u, "so the claim under it is taken");

  heldBy();
  const beside = await standingIn(TREE);
  try {
    const refused = await ran(asked);
    assert.equal(refused.status, 1, `the same command, standing beside the call:\n${refused.stdout}`);
    assert.match(refused.stderr, new RegExp(`pid ${beside.pid}`, "u"),
      "which is what says the exclusion above is about ancestry and not about the declaration missing");
  } finally {
    beside.kill();
  }
});
