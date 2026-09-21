/* A turn ends whether or not anything reads it, so the only proof this gate works is a transcript
   planted in each red state and fired at. The lease item is the one that would reach the tracker,
   so its reader is handed in: a planted transcript cannot plant a lease. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, cleanRepo, escaped, pathed, projectRecord, projectRoom, tempRoom, typed }
  from "../../fixtures.mjs";
import { FIELD, KEY } from "../../../src/flow/lease.mjs";
import { sessionKey } from "../../../src/shown/ledger.mjs";
import { OWN } from "../../fixtures/own-project.mjs";

const HOOK = new URL("../../../hooks/entries/turn/stop-check.mjs", import.meta.url).pathname;
const GATE = new URL("../../../hooks/gate.mjs", import.meta.url).pathname;
const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/u, "");

/* A probe that means to be refused says 1300 characters of comment, because that is what a
   comment costs now. On one line, which is how the same file passed the ceiling before it. */
const DENSE = `// ${"the unit is what the comment says and never the column its author wrapped it at. ".repeat(20)}\nexport const x = 1;\n`;

/* Set before the gate is loaded and not after: the consult log's path is read once, at the import,
   and this suite must not read the developer's own log. Where its stamps land is the fixture's,
   which pointed `TMPDIR` at this process's own root before this line ran. */
process.env.XDG_CONFIG_HOME = tempRoom("stop-check-own-");
/* The project a case standing the gate here resolves, under a home of the suite's own: the roles
   whose stops are judged are one of its keys, and the record is this machine's rather than the
   tree's, so nothing is resolved until this home carries one. */
projectRecord(REPO, process.env.XDG_CONFIG_HOME, OWN);
const { run, silentSince, judgedStop, heldAndSilent } = await import("../../../hooks/gates/turn/stop-check.mjs");

/* Both roots are the child's too, for the same two reasons. A case that does not stand the child
   somewhere else stands it in this checkout, so the home carries this checkout's record as well. */
const room = (log) => {
  const home = tempRoom("stop-check-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), log ?? "");
  projectRecord(REPO, home, OWN);
  return { ...process.env, HOME: home, XDG_CONFIG_HOME: home, TMPDIR: tempRoom("stop-check-tmp-") };
};

const AT = "2026-09-01T10:00:00.000Z";
const prompt = { type: "user", promptSource: "typed", timestamp: AT, message: { content: "go" } };
const used = (name, input) => ({
  type: "assistant",
  timestamp: "2026-09-01T10:01:00.000Z",
  message: { content: [{ type: "tool_use", name, input }] },
});

const transcript = (...records) => written([prompt, ...records]);

const written = (records) => {
  const path = join(tempRoom("stop-check-turn-"), "t.jsonl");
  writeFileSync(path, `${records.map((one) => JSON.stringify(one)).join("\n")}\n`);
  return path;
};

const stopped = (env, event) => {
  const held = callHook(HOOK, { hook_event_name: "Stop", session_id: randomUUID(), ...event }, env);
  assert.equal(held.status, 0, held.stderr);
  return answered(held);
};

const git = (dir, ...argv) =>
  spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { cwd: dir, encoding: "utf8" });

const consult = (root) => JSON.stringify({
  kind: "consult",
  id: "c9",
  at: AT,
  root,
  ok: true,
  files: ["a.mjs"],
  reply: "- **F1 — New — major:** `a.mjs:1` — x.",
});

/* The registered line, not the entry: it sets the stop clock, under which a lint's budget is what is
   left rather than the ceiling, and a budget that is not a whole number is one no child accepts. */
test("the registered stop line refuses a dense write too, on the stop clock", () => {
  const file = join(REPO, "plugin", "test", `stop-clock-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const ev = { hook_event_name: "Stop", session_id: randomUUID(), transcript_path: transcript(used("Write", { file_path: file })), cwd: cleanRepo() };
    const said = spawnSync(process.execPath, [GATE, "stop", "stop-check"], { input: JSON.stringify(ev), encoding: "utf8", env: room() });
    assert.equal(said.status, 0, said.stderr);
    assert.match(said.stdout, /stop-clock-.*comment-density/su, `the stop clock's budget reached the linter: ${said.stdout || "(silent)"}`);
  } finally {
    rmSync(file, { force: true });
  }
});

test("a turn that left nothing red ends in silence", () => {
  assert.equal(stopped(room(), { transcript_path: transcript(), cwd: cleanRepo() }), null);
});

test("a file this turn wrote that the project's linter rejects refuses the stop, named", () => {
  const file = join(REPO, "plugin", "test", `stop-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const said = stopped(room(), {
      transcript_path: transcript(used("Write", { file_path: file })),
      cwd: cleanRepo(),
    });
    assert.match(said?.reason ?? "", /stop-probe-/u, `the file is not named: ${said?.reason}`);
    assert.match(said.reason, /code-quality\/comment-density/u, "nor is what the linter said");
  } finally {
    rmSync(file, { force: true });
  }
});

test("findings nobody ruled on refuse the stop, with the verdict to write", () => {
  const cwd = cleanRepo();
  const said = stopped(room(`${consult(realpathSync(cwd))}\n`), { transcript_path: transcript(), cwd });
  assert.match(said?.reason ?? "", /Consult c9 made F1/u, said?.reason);
  assert.match(said.reason, /forge codex verdict --of c9/u, "the command that clears it is missing");
});

/* Git answers the two directories relatively in a checkout and absolutely in a worktree, so a
   comparison of the raw answers refuses every checkout there is — which is the dangerous direction,
   and why the checkout the worktree was made from is asserted silent in the same case. */
test("tracked changes in a worktree the run made refuse the stop; the checkout they came from does not", () => {
  const checkout = cleanRepo();
  writeFileSync(join(checkout, "one.txt"), "committed\n");
  git(checkout, "add", "one.txt");
  git(checkout, "commit", "-qm", "base");
  const wt = join(tempRoom("stop-check-wt-"), "wt");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", "side", wt).status, 0);
  writeFileSync(join(wt, "one.txt"), "changed, and never committed\n");

  const said = stopped(room(), { transcript_path: transcript(), cwd: wt });
  assert.match(said?.reason ?? "", /is a worktree this turn left with tracked changes/u, said?.reason);
  assert.match(said.reason, /git -C .*add -u/u, "the command that clears it is missing");
  assert.equal(stopped(room(), { transcript_path: transcript(), cwd: checkout }), null,
    "the checkout the worktree was made from is clean and must hear nothing");

  const old = Date.parse(AT) / 1000 - 86_400;
  utimesSync(join(wt, "one.txt"), old, old);
  assert.equal(stopped(room(), { transcript_path: transcript(), cwd: wt }), null,
    "dirt older than the turn is somebody else's, and this run is not told to put it away");
});

/* A worktree cut fresh for each case, so one case's leftover process is never read by another's. */
const freshWorktree = () => {
  const checkout = cleanRepo();
  const wt = join(tempRoom("stop-check-live-wt-"), "wt");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", `side-${randomUUID().slice(0, 8)}`, wt).status, 0);
  return { checkout, wt };
};

/* Detached the way a backgrounded ship or gate is: a shell that exits leaves this reparented, cwd
   the only thing left naming the tree it belongs to. */
const spawnIn = (tree) => {
  const child = spawn("sleep", ["5"], { cwd: tree, detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

const stopStanding = (pid) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone, which is what the case wanted anyway
  }
};

const settled = (ms = 150) => new Promise((r) => setTimeout(r, ms));

test("a process still standing in a worktree the turn left refuses the stop, named", async () => {
  const { wt } = freshWorktree();
  const pid = spawnIn(wt);
  try {
    await settled();
    const said = stopped(room(), { transcript_path: transcript(), cwd: wt });
    assert.match(said?.reason ?? "", /still standing, pid/u, said?.reason);
    assert.match(said.reason, new RegExp(`pid ${pid}`, "u"), "the pid standing there is not named");
    assert.match(said.reason, /forge hooks --how polling/u, "the wait it should take instead is missing");
  } finally {
    stopStanding(pid);
  }
});

test("a process standing outside the worktree the turn left does not refuse the stop", async () => {
  const { wt } = freshWorktree();
  const elsewhere = tempRoom("stop-check-live-elsewhere-");
  const pid = spawnIn(elsewhere);
  try {
    await settled();
    assert.equal(stopped(room(), { transcript_path: transcript(), cwd: wt }), null,
      "a process standing in an unrelated tree was read as standing in this one");
  } finally {
    stopStanding(pid);
  }
});

test("a process that has already ended does not refuse the stop", async () => {
  const { wt } = freshWorktree();
  const pid = spawnIn(wt);
  await settled();
  stopStanding(pid);
  await settled();
  assert.equal(stopped(room(), { transcript_path: transcript(), cwd: wt }), null,
    "a pid no longer in the process table was still read as standing there");
});

/* A wait as the corpus writes it: no `cd`, so the process keeps the session's own working
   directory — the checkout a worktree was cut from — and the worktree reading never sees it. */
const ranIn = (command, tree) => {
  const child = spawn("/bin/sh", ["-c", command], { cwd: tree, detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
};

const waiting = () => `sleep 30 # stop-check-live ${randomUUID()}`;

const ago = (seconds) => new Date(Date.now() - seconds * 1_000).toISOString();

/* A turn stamped against this machine's clock rather than the fixed one every other case uses: a
   process's own moment is the kernel's, and only a turn standing beside it can be judged with it.
   `at` is how long ago the call was made and `answered` how long ago the record that closed it
   came back; the turn itself goes on until now either way. */
const liveTurn = (command, { at = 60, back = null } = {}) => {
  const id = `toolu_${randomUUID().slice(0, 8)}`;
  return written([
    { ...prompt, timestamp: ago(at + 1) },
    {
      type: "assistant",
      timestamp: ago(at),
      message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
    },
    ...(back === null ? [] : [{
      type: "user",
      timestamp: ago(back),
      message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
    }]),
    { type: "assistant", timestamp: ago(0), message: { content: [{ type: "text", text: "and on" }] } },
  ]);
};

test("a wait this turn started with no cd refuses the stop, outside any worktree", async () => {
  const checkout = cleanRepo();
  const command = waiting();
  const pid = ranIn(command, checkout);
  try {
    await settled();
    const said = stopped(room(), { transcript_path: liveTurn(command), cwd: checkout });
    assert.match(said?.reason ?? "", /still standing, pid/u, said?.reason);
    assert.match(said.reason, new RegExp(`pid ${pid}`, "u"), "the pid this turn started is not named");
    assert.match(said.reason, /forge hooks --how polling/u, "the wait it should take instead is missing");
  } finally {
    stopStanding(pid);
  }
});

/* Two runs share one host, one working directory and one environment, so the only thing that tells
   this turn's process from the other's is which transcript names it. The same process, the same
   directory, two turns: a reading that widened the tree or walked ancestry would refuse both. */
test("a process another run left standing where this turn stood does not refuse the stop", async () => {
  const checkout = cleanRepo();
  const theirs = waiting();
  const pid = ranIn(theirs, checkout);
  try {
    await settled();
    assert.equal(stopped(room(), { transcript_path: liveTurn(waiting()), cwd: checkout }), null,
      "a process this turn never started was named in its refusal");
    assert.match(stopped(room(), { transcript_path: liveTurn(theirs), cwd: checkout })?.reason ?? "",
      new RegExp(`pid ${pid}`, "u"),
      "the case proves nothing unless the turn that did start it is refused");
  } finally {
    stopStanding(pid);
  }
});

/* Two runs of one project run the same commands, so the command alone cannot tell their processes
   apart and when each began has to. Here the sibling's began before this turn made its own call. */
test("the same command another run began before this turn's own call does not refuse the stop", async () => {
  const checkout = cleanRepo();
  const command = waiting();
  const pid = ranIn(command, checkout);
  try {
    await settled(1_000);
    assert.equal(stopped(room(), { transcript_path: liveTurn(command, { at: 0 }), cwd: checkout }), null,
      "a process older than this turn's own call was read as started by it");
    assert.match(stopped(room(), { transcript_path: liveTurn(command), cwd: checkout })?.reason ?? "",
      new RegExp(`pid ${pid}`, "u"),
      "the case proves nothing unless the turn whose call did precede it is refused");
  } finally {
    stopStanding(pid);
  }
});

/* The other half of the same hazard: this turn's own call ran and came back, the turn carried on
   working, and the sibling started the identical command after that. A window that ended at the
   turn rather than at the call would still be open, and would refuse this turn on its account. */
test("the same command another run began after this turn's call came back does not refuse the stop", async () => {
  const checkout = cleanRepo();
  const command = waiting();
  const pid = ranIn(command, checkout);
  try {
    await settled();
    assert.equal(stopped(room(), { transcript_path: liveTurn(command, { at: 600, back: 300 }), cwd: checkout }),
      null, "a process begun long after this turn's own call came back was read as started by it");
    assert.match(stopped(room(), { transcript_path: liveTurn(command, { at: 600 }), cwd: checkout })?.reason ?? "",
      new RegExp(`pid ${pid}`, "u"),
      "the case proves nothing unless the same turn with its call still open is refused");
  } finally {
    stopStanding(pid);
  }
});

test("the same live process does not refuse the stop a second time this turn", async () => {
  const { wt } = freshWorktree();
  const pid = spawnIn(wt);
  try {
    await settled();
    const env = room();
    const path = transcript();
    const session = randomUUID();
    assert.match(stopped(env, { session_id: session, transcript_path: path, cwd: wt }).reason,
      /still standing, pid/u);
    assert.equal(stopped(env, { session_id: session, transcript_path: path, cwd: wt }), null,
      "asked once, this run said so and is let go, not looped on a job it cannot end itself");
  } finally {
    stopStanding(pid);
  }
});

/* The reader is handed the whole tail the transcript reader read, prompt and all, so a turn before
   this one wrote files this one is answerable for until the records are cut at the prompt. */
test("what an earlier turn wrote is not this turn's to answer for", () => {
  const file = join(REPO, "plugin", "test", `stop-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const earlier = { ...prompt, timestamp: "2026-08-31T10:00:00.000Z" };
    const path = written([earlier, used("Write", { file_path: file }), prompt]);
    assert.equal(stopped(room(), { transcript_path: path, cwd: cleanRepo() }), null);
  } finally {
    rmSync(file, { force: true });
  }
});

/* Every answer is thrown — silence included — so what a decision was is read off what it carried. */
const decided = (ev, held) => {
  try {
    run(ev, held);
  } catch (answer) {
    return { kind: answer.kind, said: answer.message };
  }
  return { kind: "returned", said: "" };
};

test("a lease this session holds with nothing written against it since the claim refuses the stop", () => {
  const ev = { session_id: "s-lease", transcript_path: transcript(), cwd: cleanRepo() };
  const refused = decided(ev, () => ["ISS-999"]);
  assert.equal(refused.kind, "block");
  assert.match(refused.said, /ISS-999 is in_progress under this session's lease/u);
  assert.match(refused.said, /forge record park ISS-999/u, "the command that clears it is missing");
  const quiet = decided({ ...ev, session_id: "s-quiet" }, () => []);
  assert.equal(quiet.kind, "none", `a session holding nothing silent said: ${quiet.said}`);
});

/* The cap is on what qualifies, not on what a turn named: applied to the names, two keys this session
   does not hold hide the one it does behind them, and the stop passes on a lease nobody answered for.
   The reader is handed in because the real one spawns the CLI, which no case here has a tracker for. */
test("keys this session does not hold do not use up the cap the held ones are counted against", () => {
  const holder = "s-capped";
  const lease = { holder, renewedAt: AT, history: [{ at: AT, how: "claim", holder }] };
  const rows = {
    "ISS-701": { status: "closed" },
    "ISS-702": { status: "closed" },
    "ISS-703": { status: "in_progress", [FIELD]: { [KEY]: lease } },
  };
  const asked = [];
  const read = (tree, argv) => {
    asked.push(argv[1]);
    return rows[argv[1]] ?? null;
  };
  const said = ["ISS-701 and ISS-702 are done; ISS-703 is the one in hand"];
  assert.deepEqual(heldAndSilent({}, ".", said, holder, read), ["ISS-703"],
    `the two closed keys were read and passed over: ${asked.join(", ")}`);
  assert.deepEqual(asked, ["ISS-701", "ISS-702", "ISS-703"], "each named key is read once, in order");
});

/* And the cap still holds: two that qualify is where it stops, whatever follows them. */
test("the cap stops at two that qualify, and reads no key past them", () => {
  const holder = "s-two";
  const lease = { holder, renewedAt: AT, history: [{ at: AT, how: "claim", holder }] };
  const asked = [];
  const read = (tree, argv) => {
    asked.push(argv[1]);
    return { status: "in_progress", [FIELD]: { [KEY]: lease } };
  };
  const said = ["ISS-801 ISS-802 ISS-803"];
  assert.deepEqual(heldAndSilent({}, ".", said, holder, read), ["ISS-801", "ISS-802"]);
  assert.deepEqual(asked, ["ISS-801", "ISS-802"], "the third is never asked for");
});

/* The rule that reader spends, which no planted transcript could reach: every payload write renews
   the lease, and only a claim appends to its history. */
test("a lease is silent only while its renewal still stands on the newest claim", () => {
  const holder = "s1";
  const claimed = { holder, renewedAt: AT, history: [{ at: AT, how: "claim", holder }] };
  assert.equal(silentSince(claimed, holder), true);
  assert.equal(silentSince({ ...claimed, renewedAt: "2026-09-01T10:05:00.000Z" }, holder), false);
  assert.equal(silentSince(claimed, "someone-else"), false, "another run's lease is not this one's to judge");
  assert.equal(silentSince(null, holder), false);
});

test("FORGE_STOP_DISABLE stands the whole gate down", () => {
  const cwd = cleanRepo();
  const env = { ...room(`${consult(realpathSync(cwd))}\n`), FORGE_STOP_DISABLE: "1" };
  assert.equal(stopped(env, { transcript_path: transcript(), cwd }), null);
});

/* A subagent's stop names the parent's transcript and cwd in the common fields and its own transcript
   beside them; the first record of its own is the prompt it was handed, which nobody typed. For weeks
   the gate read the parent's and passed every delegated run (ISS-530). */
const handed = (...records) => written([
  { type: "user", timestamp: AT, message: { content: "Work ISS-1." } }, ...records,
]);
const subagentStop = (event) => ({
  hook_event_name: "SubagentStop", agent_type: "forge:runner", transcript_path: transcript(), ...event,
});

test("a subagent's stop is judged on the subagent's own transcript, not the parent's", () => {
  const file = join(REPO, "plugin", "test", `stop-agent-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  try {
    const own = handed(used("Write", { file_path: file }));
    const said = stopped(room(), subagentStop({ agent_transcript_path: own, cwd: cleanRepo() }));
    assert.match(said?.reason ?? "", /stop-agent-/u, `the subagent's write is not named: ${said?.reason}`);
    assert.match(said.reason, /code-quality\/comment-density/u);
    assert.equal(stopped(room(), subagentStop({ agent_transcript_path: own, cwd: cleanRepo(), agent_type: "Explore" })), null,
      "a subagent this plugin did not dispatch is not this gate's to judge");
    assert.equal(stopped(room(), subagentStop({ agent_transcript_path: own, cwd: cleanRepo(), agent_type: "runner" }))?.reason.includes("stop-agent-"), true,
      "the bare role name is the same role");
  } finally {
    rmSync(file, { force: true });
  }
});

test("the tree a subagent stood in is the one its commands moved to, whatever the event's cwd says", () => {
  const checkout = cleanRepo();
  writeFileSync(join(checkout, "one.txt"), "committed\n");
  git(checkout, "add", "one.txt");
  git(checkout, "commit", "-qm", "base");
  const wt = join(tempRoom("stop-check-agent-wt-"), "wt");
  assert.equal(git(checkout, "worktree", "add", "-q", "-b", "side", wt).status, 0);
  writeFileSync(join(wt, "one.txt"), "changed, and never committed\n");
  /* One command per line, as a run types them; the `cd` not first, and a second `cd` relative to it. */
  mkdirSync(join(wt, "sub"));
  const own = handed(used("Bash", { command: `export FORGE_SESSION_ID=iss-1-abc\ncd ${pathed(wt)}\ncd sub && git status --short` }));
  const said = stopped(room(), subagentStop({ agent_transcript_path: own, cwd: checkout }));
  assert.match(said?.reason ?? "", /is a worktree this turn left with tracked changes/u, said?.reason);
  assert.match(said.reason, new RegExp(`git -C ${escaped(typed(wt))} add -u`, "u"),
    "the worktree, not the checkout the event names");
});

test("the lease a subagent is judged on is the id its own commands exported", () => {
  /* The operator sits flush against the value; the value is not the operator. */
  const own = handed(used("Bash", { command: "export FORGE_SESSION_ID=iss-1-abc; forge claim ISS-1&&true" }));
  const ev = subagentStop({ session_id: "s-parent", agent_transcript_path: own, cwd: cleanRepo() });
  const asked = [];
  const held = (...given) => {
    const holder = given[3];
    asked.push(holder);
    return holder === "iss-1-abc" ? ["ISS-1"] : [];
  };
  const refused = decided(ev, held);
  assert.equal(refused.kind, "block", refused.said);
  assert.match(refused.said, /ISS-1 is in_progress under this session's lease/u);
  assert.deepEqual(asked, ["iss-1-abc"], "the exported id, not the parent's session key");
  const plain = decided(subagentStop({ session_id: "s-parent", agent_transcript_path: handed(), cwd: cleanRepo() }), held);
  assert.equal(plain.kind, "none", `with nothing exported the parent's key stands and holds nothing: ${plain.said}`);
});

/* ISS-583. This gate spelt the variable and its value itself, and its spelling had drifted from the
   one the write gate credits under, so a run could be held under one holder here and checked under
   another there. The holder is read through `granted-id.mjs` now, and the three rows are the ones
   that answered differently before: a call that ends having given the name up grants nothing, and
   the last call that granted one is what the turn is credited to whatever a later call does. */
test("a subagent turn that gave its name up is credited to the session's own key", () => {
  const asked = [];
  const held = (...given) => {
    asked.push(given[3]);
    return [];
  };
  /* A session of its own per row: this gate says a thing once, and two rows under one id are one. */
  const turn = (...commands) => {
    asked.length = 0;
    const own = handed(...commands.map((command) => used("Bash", { command })));
    const ev = subagentStop({ session_id: `s-${randomUUID()}`, agent_transcript_path: own, cwd: cleanRepo() });
    decided(ev, held);
    return { holder: asked[0], fallback: sessionKey(ev) };
  };
  const kept = turn("export FORGE_SESSION_ID=iss-1-abc && forge claim ISS-1");
  assert.equal(kept.holder, "iss-1-abc", "the call granted a name and kept it");
  const cleared = turn("export FORGE_SESSION_ID=iss-1-abc && forge claim ISS-1 && FORGE_SESSION_ID= true");
  assert.equal(cleared.holder, cleared.fallback, "the call ends having assigned the name nothing");
  const back = turn("export FORGE_SESSION_ID=iss-1-abc && forge claim ISS-1 && unset FORGE_SESSION_ID");
  assert.equal(back.holder, back.fallback, "the call ends having taken the name back");
  const later = turn("export FORGE_SESSION_ID=iss-1-abc && forge claim ISS-1", "unset FORGE_SESSION_ID");
  assert.equal(later.holder, "iss-1-abc", "a later call cannot revoke what the call before it wrote under");
  const said = turn("echo FORGE_SESSION_ID=iss-1-abc",
    "export FORGE_SESSION_ID=iss-2-def; forge claim ISS-2; unset FORGE_SESSION_ID");
  assert.equal(said.holder, said.fallback, "a name a command was handed as a word is no call's grant");
  const wrapped = turn("export FORGE_SESSION_ID=iss-1-abc",
    "OTHER=1 env FORGE_SESSION_ID=iss-2-def forge claim ISS-2");
  assert.equal(wrapped.holder, "iss-2-def", "the wrappers a prefix carries do not cost the call its grant");
  assert.notEqual(cleared.fallback, "iss-1-abc", "the fallback would have hidden the two rows above");
});

/* And the shape of the fix, not only its answers: a second spelling of this variable anywhere in
   this file is the defect coming back, and nothing else would fail while it did. */
test("this gate spells the granted id nowhere", () => {
  const said = readFileSync(new URL("../../../hooks/gates/turn/stop-check.mjs", import.meta.url), "utf8");
  const code = said.replace(/\/\*[\s\S]*?\*\/|\/\/.*/gu, "");
  assert.equal(code.includes("FORGE_SESSION_ID"), false, "the variable is named in this gate's code");
  assert.equal(/\bconst value\b/u.test(code), false, "the gate carries a value extractor of its own");
});

/* The two readings of a turn are collected in one walk, and a Bash-only one would lose this: the
   keys a turn named come off every tool's command, and where it stood off Bash alone (ISS-509). */
test("a key named only by a tool that is not Bash is still a key this turn named", () => {
  const named = written([prompt, used("mcp__forge__forge_issues", { command: "forge issue ISS-777" })]);
  const asked = [];
  const held = (...given) => {
    asked.push(given[2]);
    return [];
  };
  decided({ session_id: "s-keys", transcript_path: named, cwd: cleanRepo() }, held);
  assert.equal(asked.length, 1, "the lease reading did not run");
  assert.ok(asked[0].some((one) => one.includes("ISS-777")),
    `a non-Bash tool's command reached no key search: ${JSON.stringify(asked[0])}`);
});

test("stop.agents in a project's own configuration decides which subagents' stops are judged", () => {
  const runner = { hook_event_name: "SubagentStop", agent_type: "forge:runner" };
  assert.equal(judgedStop(runner, []), false, "an empty list silences every subagent stop");
  assert.equal(judgedStop({ ...runner, agent_type: "Explore" }, ["Explore"]), true, "a name set there is honoured");
  assert.equal(judgedStop({ hook_event_name: "Stop" }, []), true, "the main agent's stop is always judged");
  const file = join(REPO, "plugin", "test", `stop-config-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, DENSE);
  /* The judged cases above run from this repository, against the record written for it above,
     whose `stop.agents` lists four roles. The checkout and the home holding its record travel
     together, one pair per reading. */
  const at = (config) => {
    const env = room();
    return { env, cwd: projectRoom(tempRoom("stop-check-config-"), env.XDG_CONFIG_HOME, config) };
  };
  try {
    const own = handed(used("Write", { file_path: file }));
    const from = ({ env, cwd }) => {
      const ev = { hook_event_name: "SubagentStop", agent_type: "forge:runner", session_id: randomUUID(), transcript_path: transcript(), agent_transcript_path: own, cwd };
      const said = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(ev), encoding: "utf8", env, cwd });
      assert.equal(said.status, 0, said.stderr);
      return said.stdout.trim();
    };
    assert.equal(from(at({ slug: "x" })), "", "a project that named no agents hears nothing of any subagent's stop");
    assert.equal(from(at({ slug: "x", stop: { agents: [] } })), "", "an emptied list is the same silence, said on purpose");
    assert.match(from(at({ slug: "x", stop: { agents: ["runner"] } })), /stop-config-/u, "and the named role's dense write is refused");
  } finally {
    rmSync(file, { force: true });
  }
});

test("a refusal is a block on the stop, never a permission decision", () => {
  const cwd = cleanRepo();
  const said = stopped(room(`${consult(realpathSync(cwd))}\n`), { transcript_path: transcript(), cwd });
  assert.equal(said.decision, "block");
  assert.equal(said.hookSpecificOutput, undefined, "a Stop event has no permission to decide");
});

test("the same red item does not refuse the stop after this one", () => {
  const cwd = cleanRepo();
  const env = room(`${consult(realpathSync(cwd))}\n`);
  const path = transcript();
  const session = randomUUID();
  assert.match(stopped(env, { session_id: session, transcript_path: path, cwd }).reason, /Consult c9/u);
  assert.equal(stopped(env, { session_id: session, transcript_path: path, cwd }), null, "it refused twice");
});
