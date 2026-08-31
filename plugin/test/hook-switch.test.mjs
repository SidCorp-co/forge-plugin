/* A gate nobody can switch off gets escaped by forking the plugin, and a switch that fails open is
   the only kind worth having: the cost of a broken config must be a gate firing. */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { hookEvents } from "../src/hook-switch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "hooks", "bash-guard.mjs");
const CLI = join(HERE, "..", "src", "cli.mjs");
/* Assembled, or this file is the fixture: the live gate reads the suite's own source. */
const STAGES_EVERYTHING = `git add -${"A"}`;

const room = (config) => {
  const home = mkdtempSync(join(tmpdir(), "hook-switch-"));
  if (config !== undefined) {
    mkdirSync(join(home, "forge"));
    writeFileSync(join(home, "forge", "config.json"), config);
  }
  return home;
};

const refused = (home, extra = {}) => {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: randomUUID(), tool_name: "Bash", tool_input: { command: STAGES_EVERYTHING } }),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home, ...extra },
  });
  assert.equal(run.status, 0, run.stderr);
  return Boolean(run.stdout.trim());
};

const forgeIn = (home, extra, ...argv) =>
  spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home, ...extra },
  });

const forge = (home, ...argv) => forgeIn(home, {}, ...argv);

test("a hook named in hooksOff does not fire, and one not named does", () => {
  assert.equal(refused(room('{"hooksOff":["bash-guard"]}')), false);
  assert.equal(refused(room('{"hooksOff":["codex-second"]}')), true, "another hook's switch is not this one's");
  assert.equal(refused(room("{}")), true);
  assert.equal(refused(room()), true, "no config at all is every gate on");
});

test("a config that will not parse runs every gate", () => {
  assert.equal(refused(room("not json at all")), true);
  assert.equal(refused(room('{"hooksOff":"bash-guard"}')), true, "a string is not a list of names");
});

test("the CLI writes the switch and answers with the new state", () => {
  const home = room("{}");
  const off = forge(home, "hooks", "--off", "bash-guard");
  assert.match(off.stdout, /bash-guard \(PreToolUse\) is now off/, "the answer names the hook type");
  assert.match(off.stdout, /FORGE_HOOK_BASH_GUARD=off/, "and the variable that does it for one session");
  assert.equal(refused(home), false, "the hook process reads what the CLI wrote");
  const on = forge(home, "hooks", "--on", "bash-guard");
  assert.match(on.stdout, /Every hook is on/);
  assert.equal(refused(home), true);
});

test("a name that matches no hook is refused with the near miss", () => {
  const run = forge(room("{}"), "hooks", "--off", "bash-gard");
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}${run.stderr}`, /Did you mean: bash-guard/);
});

test("doctor reports a switch wired to nothing", () => {
  const out = forge(room('{"hooksOff":["gone-hook"]}'), "doctor").stdout;
  assert.match(out, /\[ miss \] hooks off\s+gone-hook is switched off and is no hook here/);
});

/* Deriving the names from the directory promises that a hook added later is switchable, and nothing
   made that true: link-cli proves an entry point can skip readEvent and stay active while
   `forge hooks --off` reports it off. So the promise is a case, not a convention. */
test("every hook honours the switch, not only the ones that read an event", () => {
  const dir = join(HERE, "..", "hooks");
  const missing = readdirSync(dir)
    .filter((name) => name.endsWith(".mjs") && !name.startsWith("_"))
    .filter((name) => !/\breadEvent\(|\bhookOff\(/u.test(readFileSync(join(dir, name), "utf8")));
  assert.deepEqual(
    missing,
    [],
    "each of these is listed by `forge hooks --off` and would keep running: call readEvent(), or "
      + "name its own switch with hookOff(<name>) the way link-cli does",
  );
});

/* The variable is the codex switches' shape, and it is the layer a session has: a config write
   outlives the reason for it, and `unset` is the only undo nobody has to remember a path for. */
test("a variable stands one hook down, and brings one back that the config holds off", () => {
  assert.equal(refused(room("{}"), { FORGE_HOOK_BASH_GUARD: "off" }), false);
  assert.equal(refused(room("{}"), { FORGE_HOOK_BASH_GUARD: "0" }), false, "0 and false spell it too");
  assert.equal(refused(room("{}"), { FORGE_HOOK_CODEX_SECOND: "off" }), true, "one name, one hook");
  const held = '{"hooksOff":["bash-guard"]}';
  assert.equal(refused(room(held)), false);
  assert.equal(refused(room(held), { FORGE_HOOK_BASH_GUARD: "on" }), true, "the variable wins");
});

test("a value neither set spells runs the gate", () => {
  assert.equal(refused(room("{}"), { FORGE_HOOK_BASH_GUARD: "maybe" }), true);
  assert.equal(refused(room("{}"), { FORGE_HOOK_BASH_GUARD: "" }), true, "empty is not off");
});

/* One name switches one hook type only while that stays true. A script on two events would be stood
   down on both by a name that mentions neither, so the day one appears the key needs the pair. */
test("each hook is registered on exactly one event", () => {
  const many = Object.entries(hookEvents()).filter(([, events]) => events.length !== 1);
  assert.deepEqual(
    many,
    [],
    "`forge hooks --off <name>` switches every event of a script: give the key a `name:Event` form, "
      + "or register this script once",
  );
});

test("doctor names the event it stood down and how to bring it back", () => {
  const out = forge(room('{"hooksOff":["codex-turn"]}'), "doctor").stdout;
  assert.match(out, /hooks off\s+codex-turn \(PostToolUse\) — `forge hooks --on codex-turn`/);
  const byEnv = forgeIn(room("{}"), { FORGE_HOOK_CODEX_TURN: "off" }, "doctor").stdout;
  assert.match(byEnv, /hooks off\s+codex-turn \(PostToolUse\) — `unset FORGE_HOOK_CODEX_TURN`/);
});
