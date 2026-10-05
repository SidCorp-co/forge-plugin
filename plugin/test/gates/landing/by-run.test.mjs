/* The gate is matched by what a command runs, not by how it was typed: a project declaring `npm run gate`
   once has every spelling of that run refused, and a read of the script, or another script, let through
   (ISS-3194). */
import assert from "node:assert/strict";
import test from "node:test";

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, callHook, projectRecord, tempRoom } from "../../fixtures.mjs";

const HOOK = new URL("../../../hooks/entries/landing-gate.mjs", import.meta.url).pathname;
const room = tempRoom("landing-gate-by-run-");
const REPO = join(room, "repo");
const ELSEWHERE = join(room, "elsewhere");
mkdirSync(join(room, "forge"), { recursive: true });
for (const one of [REPO, ELSEWHERE]) spawnSync("git", ["init", "-q", one], { cwd: room });
mkdirSync(join(REPO, "scripts"));
mkdirSync(join(REPO, "frontend-v2"));
writeFileSync(join(REPO, "scripts", "gates.mjs"), "// the whole gate\n");
writeFileSync(join(REPO, "scripts", "other.mjs"), "// not the gate\n");
writeFileSync(join(REPO, "package.json"), JSON.stringify({
  scripts: { gate: "node scripts/gates.mjs", "gate:spec": "node scripts/other.mjs" },
}));
test.after(() => rmSync(room, { recursive: true, force: true }));

/* Declared once, as the npm script; the node script it runs is reached through the script's own body. */
const DECLARED = { slug: "fixture", ship: "ready", stats: { commands: { gate: "npm run gate" } } };

let count = 0;
const decision = (command, { project = DECLARED, cwd = REPO } = {}) => {
  count += 1;
  projectRecord(REPO, room, project);
  const run = callHook(HOOK,
    { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, session_id: `r${count}`, cwd },
    { ...process.env, HOME: room, XDG_CONFIG_HOME: room });
  return answered(run)?.hookSpecificOutput?.permissionDecision ?? "allow";
};

const SPELLINGS = [
  "node scripts/gates.mjs",
  "node ./scripts/gates.mjs",
  "cd frontend-v2 && node ../scripts/gates.mjs",
  "node --env-file=.env scripts/gates.mjs",
  "node --env-file .env scripts/gates.mjs",
  "npx node scripts/gates.mjs",
  "nohup node scripts/gates.mjs > log 2>&1 &",
  "nice -n 10 node scripts/gates.mjs",
  "setsid node scripts/gates.mjs",
  "ionice -c 3 node scripts/gates.mjs",
  "stdbuf -oL node scripts/gates.mjs",
  "timeout 600 node scripts/gates.mjs",
  "FORCE_COLOR=0 node scripts/gates.mjs",
  "npm run -s gate",
  "npm -s run gate",
  "npm run-script gate",
  `node ${join(REPO, "scripts", "gates.mjs")}`,
  "node 'scripts/gates.mjs'",
];

test("every spelling that runs the declared gate's script is refused", () => {
  for (const command of SPELLINGS) assert.equal(decision(command), "deny", command);
});

test("npm pointed at the tree from outside it is refused by the tree it names", () => {
  assert.equal(decision(`npm --prefix ${REPO} run gate`, { cwd: ELSEWHERE }), "deny");
  assert.equal(decision(`npm --prefix=${REPO} run gate`, { cwd: ELSEWHERE }), "deny");
  assert.equal(decision(`node ${join(REPO, "scripts", "gates.mjs")}`, { cwd: ELSEWHERE }), "deny");
});

test("reading the script, or running another, is let through", () => {
  for (const command of ["cat scripts/gates.mjs", "grep -n gate scripts/gates.mjs", "sed -n 1p scripts/gates.mjs",
    "node scripts/other.mjs", "npm run gate:spec", "node -e 'require(\"./scripts/gates.mjs\")'", "echo node scripts/gates.mjs"]) {
    assert.equal(decision(command), "allow", command);
  }
});

test("a tree not shipping ready, or declaring no gate, is refused none of them", () => {
  for (const command of ["node ./scripts/gates.mjs", "npm run -s gate"]) {
    assert.equal(decision(command, { project: { slug: "fixture", ship: "self", stats: { commands: { gate: "npm run gate" } } } }), "allow", command);
    assert.equal(decision(command, { project: { slug: "fixture", ship: "ready" } }), "allow", command);
  }
});
