/* A turn ends whether or not anything reads it, so the only proof this gate works is a transcript
   planted in each red state and fired at. The lease item is the one that would reach the tracker,
   so its reader is handed in: a planted transcript cannot plant a lease. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { callHook, cleanRepo, tempRoom } from "../../fixtures.mjs";

const HOOK = new URL("../../../hooks/entries/turn/stop-check.mjs", import.meta.url).pathname;
const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/u, "");

/* Set before the gate is loaded and not after: the consult log's path is read once, at the import,
   and this suite must not read the developer's own log or stamp against their own session. */
process.env.XDG_CONFIG_HOME = tempRoom("stop-check-own-");
process.env.TMPDIR = tempRoom("stop-check-own-tmp-");
const { run, silentSince } = await import("../../../hooks/gates/turn/stop-check.mjs");

/* Both roots are the child's too, for the same two reasons. */
const room = (log) => {
  const home = tempRoom("stop-check-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), log ?? "");
  return { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: tempRoom("stop-check-tmp-") };
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
  return held.stdout.trim() ? JSON.parse(held.stdout) : null;
};

const git = (dir, ...argv) =>
  spawnSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...argv], { encoding: "utf8" });

const consult = (root) => JSON.stringify({
  kind: "consult",
  id: "c9",
  at: AT,
  root,
  ok: true,
  files: ["a.mjs"],
  reply: "- **F1 — New — major:** `a.mjs:1` — x.",
});

test("a turn that left nothing red ends in silence", () => {
  assert.equal(stopped(room(), { transcript_path: transcript(), cwd: cleanRepo() }), null);
});

test("a file this turn wrote that the project's linter rejects refuses the stop, named", () => {
  const file = join(REPO, "plugin", "test", `stop-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, "// one\n// two\n// three\n// four\nexport const x = 1;\n");
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

/* The reader is handed the whole tail the transcript reader read, prompt and all, so a turn before
   this one wrote files this one is answerable for until the records are cut at the prompt. */
test("what an earlier turn wrote is not this turn's to answer for", () => {
  const file = join(REPO, "plugin", "test", `stop-probe-${randomUUID().slice(0, 8)}.mjs`);
  writeFileSync(file, "// one\n// two\n// three\n// four\nexport const x = 1;\n");
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
