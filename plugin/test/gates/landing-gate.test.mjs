import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, projectEntry, projectRecord, tempRoom } from "../fixtures.mjs";
import { assertRouteFirst } from "../fixtures/route-first.mjs";

const HOOK = new URL("../../hooks/entries/landing-gate.mjs", import.meta.url).pathname;
const room = tempRoom("landing-gate-");
const REPO = join(room, "repo");
const OTHER = join(room, "other");
mkdirSync(join(room, "forge"), { recursive: true });
for (const one of [REPO, OTHER]) spawnSync("git", ["init", "-q", one], { cwd: room });
mkdirSync(join(REPO, "sub"));
/* The tree a dispatch bound to an issue carries the run id beside its git directory; the other is
   named for its issue by its branch alone, which is the reading a hand-made worktree leaves. */
writeFileSync(join(REPO, ".git", "forge-run-id"), "iss-77-0a1b2c3d\n");
spawnSync("git", ["-C", OTHER, "symbolic-ref", "HEAD", "refs/heads/iss-55-by-hand"], { cwd: room });
test.after(() => rmSync(room, { recursive: true, force: true }));

/* A refusal is armed by the project's own two declarations and by no table of this repository's. */
const GATED = { stats: { commands: { gate: "npm run check" } } };
const READY = { slug: "fixture", ship: "ready", ...GATED };

let count = 0;
const gate = (command, { project = READY, other = null, cwd = REPO } = {}) => {
  count += 1;
  if (project === null) rmSync(projectEntry(REPO, room), { force: true });
  else projectRecord(REPO, room, project);
  if (other) projectRecord(OTHER, room, other);
  const run = callHook(
    HOOK,
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: `s${count}`, cwd },
    { ...process.env, HOME: room, XDG_CONFIG_HOME: room },
  );
  return answered(run);
};
const because = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

test("the declared gate is refused where the project ships ready", () => {
  const out = gate("npm run check");
  assert.equal(out?.hookSpecificOutput?.permissionDecision, "deny", "under ready the gate is the landing's");
  assert.equal(gate("cd sub && npm run check -- --full")?.hookSpecificOutput?.permissionDecision, "deny",
    "and in the same tree after a cd, with arguments after it");
  assert.equal(gate("ls && npm run check")?.hookSpecificOutput?.permissionDecision, "deny",
    "and as the second command of a line");
});

test("the refusal names the changed files' suites and the hand-over for the tree's own issue", () => {
  const said = because(gate("npm run check"));
  assertRouteFirst(said, "landing-gate");
  const [first] = said.split("\n");
  assert.match(first, /^Run the suites that exercise the files this change touched/u,
    "the proof a builder owes instead, in the first line, naming no runner a project may not have");
  assert.match(first, /forge claim ISS-77 --pushed --ready/u, "and the hand-over, keyed off the run id beside the tree");
  assert.match(said, /landing gates every change on the base as it is/u, "with the reason in one clause");
  assert.match(said, /forge hooks --off landing-gate/u);
  assert.match(said, /How: `forge hooks --how landing-gate`/u);
  const branched = because(gate("npm run check", { other: READY, cwd: OTHER }));
  assert.match(branched.split("\n")[0], /forge claim ISS-55 --pushed --ready/u,
    "a tree with no run id is keyed off the branch named for its issue");
});

test("under ship self, or with ship unset, the declared gate runs", () => {
  assert.equal(gate("npm run check", { project: { ...READY, ship: "self" } }), null, "a run that lands its own change gates it");
  assert.equal(gate("npm run check", { project: { slug: "fixture", ...GATED } }), null, "unset is self, which never chose this");
  assert.equal(gate("npm run check", { project: { ...READY, ship: "sometimes" } }), null,
    "and a word the key does not take is its fallback, not a guess at ready");
});

test("a project that declares no gate command is refused nothing", () => {
  assert.equal(gate("npm run check", { project: { slug: "fixture", ship: "ready" } }), null, "this repository's own gate is no declaration of theirs");
  assert.equal(gate("npm run check", { project: { ...READY, stats: { commands: { gate: "" } } } }), null,
    "a blank declares nothing");
  assert.equal(gate("npm run check", { project: null }), null, "and a tree with no project record at all");
  assert.equal(gate("npm run check", { project: { ...READY, stats: { commands: { gate: "make verify" } } } }), null,
    "a project held at the command it declared is not held at another");
});

test("the landing's own verbs are not the gate, and pass under ship ready", () => {
  assert.equal(gate("node tools/run.mjs land-ready ISS-1"), null, "the landing starts the gate as its own child");
  assert.equal(gate("node tools/run.mjs ship"), null, "and so does the ship");
  assert.equal(gate("node --test plugin/test/gates/landing-gate.test.mjs"), null, "a changed file's own suite is the route");
  assert.equal(gate("grep -n 'npm run check' README.md"), null, "and a command naming the gate in an argument runs none");
});

test("a line that moves into another tree is judged by that tree's own declaration", () => {
  assert.equal(gate(`cd ${OTHER} && npm run check`, { other: { ...READY, ship: "self" } }), null,
    "the tree the gate runs in ships self");
  assert.equal(gate(`cd ${OTHER} && npm run check`, { project: { ...READY, ship: "self" }, other: READY })
    ?.hookSpecificOutput?.permissionDecision, "deny", "and the one it was sent from does not decide for it");
});
