/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The config directory is this suite's own and holds no
   credential, which is also what proves the gate asks the tracker nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { callHook, tempRoom } from "../fixtures.mjs";
import { namesPath } from "../../src/flow/record/merged.mjs";

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK = join(PLUGIN, "hooks", "entries", "plan-scope.mjs");

const room = tempRoom("plan-scope-gate-");
const ENV = { ...process.env, XDG_CONFIG_HOME: join(room, "config"), TMPDIR: join(room, "tmp") };
mkdirSync(ENV.TMPDIR, { recursive: true });
delete ENV.FORGE_URL;
delete ENV.FORGE_TOKEN;

/* A real repository, since the gate makes a path repository-relative before it compares it, and the
   directory case needs a directory that is really there. */
const tree = (() => {
  const at = tempRoom("plan-scope-tree-");
  execFileSync("git", ["init", "-q", at]);
  mkdirSync(join(at, "plugin", "src"), { recursive: true });
  mkdirSync(join(at, "elsewhere"), { recursive: true });
  mkdirSync(join(at, "plugin", "src", "held.dir"), { recursive: true });
  for (const one of ["planned.mjs", "unplanned.mjs"]) writeFileSync(join(at, "plugin", "src", one), "");
  return realpathSync(at);
})();

const PLAN = "## Files touched\n- `plugin/src/planned.mjs` — the one file this change opens.\n";

const scope = async (rows) => {
  const { dropScope, noteScope } = await import("../../src/flow/record/plan-scope.mjs");
  process.env.XDG_CONFIG_HOME = ENV.XDG_CONFIG_HOME;
  for (const one of await held()) dropScope(one.ref, { tree: one.tree });
  for (const [ref, named, at] of rows) noteScope(ref, named, { tree: at ?? tree });
};

const held = async () => {
  const { scopeHeld } = await import("../../src/flow/record/plan-scope.mjs");
  process.env.XDG_CONFIG_HOME = ENV.XDG_CONFIG_HOME;
  return [...scopeHeld(tree).map((one) => ({ ...one, tree })),
    ...scopeHeld(`${tree}/other`).map((one) => ({ ...one, tree: `${tree}/other` }))];
};

const answered = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true, reason: "" };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason ?? "" };
};

const ask = (event) => answered(callHook(HOOK, { session_id: randomUUID(), cwd: tree, ...event }, ENV));
const writes = (path) => ask({ tool_name: "Write", tool_input: { file_path: join(tree, path) } });
const runs = (command) => ask({ tool_name: "Bash", tool_input: { command } });

test("a write the plan does not name is refused, naming the path, the issue and the correction", async () => {
  await scope([["ISS-411", PLAN]]);
  const held = writes("plugin/src/unplanned.mjs");
  assert.equal(held.allowed, false);
  assert.match(held.reason, /`plugin\/src\/unplanned\.mjs`/u);
  assert.match(held.reason, /ISS-411's plan/u);
  assert.match(held.reason, /forge record correction ISS-411 --moved "the change also wrote plugin\/src\/unplanned\.mjs"/u);
  assert.match(held.reason, /forge hooks --how plan-scope/u);
});

test("a write the plan names, and one a correction names, both pass", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
  await scope([["ISS-411", `${PLAN}\nmoved: the change also wrote plugin/src/unplanned.mjs\n`]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
});

test("the gate and the check at developed hold one path outside the plan and never two", async () => {
  await scope([["ISS-411", PLAN]]);
  const paths = ["plugin/src/planned.mjs", "plugin/src/unplanned.mjs", "plugin/src/planned.mjs.bak",
    "plugin/src/sub/planned.mjs", "elsewhere/planned.mjs"];
  for (const one of paths) {
    assert.equal(writes(one).allowed, namesPath(PLAN, one), `the two readings disagree about ${one}`);
  }
});

test("a shell write outside the plan is refused and the file that command reads is not", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("sed -i s/a/b/ plugin/src/unplanned.mjs").allowed, false);
  assert.equal(runs("cp plugin/src/unplanned.mjs plugin/src/planned.mjs").allowed, true);
  assert.equal(runs("grep -n x plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -v plugin/src/unplanned.mjs plugin/src/planned.mjs").allowed, true);
  assert.equal(runs("cp -v plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, false);
});

test("a write the command placed in no tree is refused for no path", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("cd - && touch plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("touch plugin/src/unplanned.mjs").allowed, false);
});

test("a command this cannot aim, and one aimed at a directory, are refused for no path", async () => {
  await scope([["ISS-411", PLAN]]);
  assert.equal(runs("cat plugin/src/unplanned.mjs | xargs -I{} touch {}").allowed, true);
  assert.equal(runs("cp -t elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp --target-directory elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp --target-directory=elsewhere plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -telsewhere plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp -vtelsewhere plugin/src/planned.mjs plugin/src/unplanned.mjs").allowed, true);
  assert.equal(runs("cp plugin/src/planned.mjs plugin/src/held.dir").allowed, true);
});

test("a tree holding no issue, and one whose issue holds no plan, refuse nothing", async () => {
  await scope([]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  await scope([["ISS-411", ""]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  await scope([["ISS-411", PLAN], ["ISS-412", ""]]);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
});

test("where a tree holds two plans, a path either one names passes and a path neither names is refused", async () => {
  await scope([["ISS-411", PLAN], ["ISS-412", "- `plugin/src/unplanned.mjs`\n"]]);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, true);
  assert.equal(writes("plugin/src/third.mjs").allowed, false);
});

test("a write in another repository is judged against that tree's scope and not this one's", async () => {
  await scope([["ISS-411", PLAN]]);
  const away = tempRoom("plan-scope-away-");
  execFileSync("git", ["init", "-q", away]);
  assert.equal(ask({ tool_name: "Write", tool_input: { file_path: join(realpathSync(away), "anything.mjs") } }).allowed, true);
});

/* A credential pointed at a closed port: a gate that asked the tracker anything would stand down
   with its own reason, as the gate last on this line does. Both decisions still come, so it asks
   nothing. */
test("the gate decides with the tracker unreachable, so it asks the tracker nothing", async () => {
  await scope([["ISS-411", PLAN]]);
  mkdirSync(join(ENV.XDG_CONFIG_HOME, "forge"), { recursive: true });
  writeFileSync(join(ENV.XDG_CONFIG_HOME, "forge", "config.json"),
    JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", retrySeconds: 0 }));
  assert.equal(writes("plugin/src/unplanned.mjs").allowed, false);
  assert.equal(writes("plugin/src/planned.mjs").allowed, true);
});
