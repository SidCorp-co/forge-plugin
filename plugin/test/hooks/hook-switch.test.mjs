/* A gate nobody can switch off gets escaped by forking the plugin, and a switch that fails open is
   the only kind worth having: the cost of a broken config must be a gate firing. */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import test from "node:test";

import { callHook, dirtyRepo, tempRoom } from "../fixtures.mjs";

import { hookEvents, hookNames } from "../../src/hooks/hook-switch.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "..", "..", "hooks", "entries", "bash-guard.mjs");
const CLI = join(HERE, "..", "..", "src", "cli.mjs");
/* Assembled, or this file is the fixture: the live gate reads the suite's own source. */
const STAGES_EVERYTHING = `git add -${"A"}`;

const room = (config) => {
  const home = tempRoom("hook-switch-");
  if (config !== undefined) {
    mkdirSync(join(home, "forge"));
    writeFileSync(join(home, "forge", "config.json"), config);
  }
  return home;
};

/* The fixture command trips a rule that only bites where there is uncommitted work. */
const DIRTY = dirtyRepo();

const refused = (home, extra = {}) => {
  const run = callHook(
    HOOK,
    { session_id: randomUUID(), tool_name: "Bash", cwd: DIRTY, tool_input: { command: STAGES_EVERYTHING } },
    { ...process.env, XDG_CONFIG_HOME: home, ...extra },
  );
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
/* A registered entry is thin — the hop and nothing else — so the switch it honours sits in the
   module it hands to, whose path is named right there in the `moduleToRun` call. Following it is
   what keeps this a check: reading the entry alone would report every thin entry as switchless. */
const HANDED = /moduleToRun\(\s*join\(([^)]*)\)/u;
const handedTo = (text) => {
  const said = HANDED.exec(text);
  return said ? join(HERE, "..", "..", ...[...said[1].matchAll(/"([^"]+)"/gu)].map(([, one]) => one)) : null;
};
const switchText = (path) => {
  const text = readFileSync(path, "utf8");
  const body = handedTo(text);
  return body ? `${text}\n${readFileSync(body, "utf8")}` : text;
};

test("every hook honours the switch, not only the ones that read an event", () => {
  const dirs = [join(HERE, "..", "..", "hooks"), join(HERE, "..", "..", "hooks", "entries")];
  const missing = dirs
    .flatMap((dir) => readdirSync(dir).map((name) => join(dir, name)))
    .filter((path) => path.endsWith(".mjs") && !basename(path).startsWith("_") && basename(path) !== "gate.mjs")
    .filter((path) => !/\balone\("[\w-]+"\)|\bhookOff\(/u.test(switchText(path)))
    .map((path) => basename(path));
  assert.deepEqual(
    missing,
    [],
    "each of these is listed by `forge hooks --off` and would keep running: run through alone(<name>), "
      + "which asks the switch, or name its own with hookOff(<name>) the way link-cli does",
  );
});

/* The config is the only source, so nothing in the environment may reach this decision: a second
   switch would need a precedence rule, and the report would have to name which one holds a gate.
   Asserted against the module rather than by trying names, because the name a later layer picks is
   exactly what a suite sampling names cannot know. */
test("the switch reads no environment variable", () => {
  const source = readFileSync(join(HERE, "..", "..", "src", "hooks", "hook-switch.mjs"), "utf8");
  assert.equal(
    /process\.env/u.test(source),
    false,
    "hooksOff in the account config decides whether a gate runs and nothing else does: a variable "
      + "here is a second source, and `forge doctor` would print an undo that leaves the gate down",
  );
  assert.equal(refused(room("{}"), { FORGE_HOOK_BASH_GUARD: "off" }), true);
});

/* A hook holding a switch of its own is not a second answer to hooksOff — it is its own decision —
   but a report printing one undo while another variable holds the gate down is worse than silence.
   The pairs are read from the hooks, so a gate that gains one is reported without an edit here. */
test("doctor reports a gate its own variable holds down", () => {
  const out = forgeIn(room("{}"), { FORGE_CODEX_DISABLE: "1" }, "doctor").stdout;
  const found = /hooks off\s+(.+?) — `unset FORGE_CODEX_DISABLE`/u.exec(out);
  assert.ok(found, `no line for a variable that stands gates down:\n${out}`);
  const named = found[1].split(", ").map((one) => one.replace(/ \(.+\)$/u, ""));
  assert.ok(named.length > 0);
  for (const name of named) {
    const source = readFileSync(join(HERE, "..", "..", "hooks", "gates", `${name}.mjs`), "utf8");
    assert.match(source, /FORGE_CODEX_DISABLE/u, `${name} does not read the variable it is listed under`);
  }
});

/* One name switches one hook type only while that stays true, and a file registered on no event is
   worse than a missing one: `forge hooks` lists it and switching it changes nothing. */
test("the gate line names every gate it runs, and a lone script names itself", () => {
  const registered = hookEvents();
  assert.deepEqual(registered["bash-guard"], ["PreToolUse"]);
  assert.deepEqual(registered["code-quality"], ["PostToolUse"]);
  assert.deepEqual(registered["link-cli"], ["SessionStart"]);
  assert.equal(registered.gate, undefined, "the dispatcher is not a gate");
  assert.equal(registered.pre, undefined, "nor is the kind word on its line");
});

test("each hook is registered on exactly one event", () => {
  const registered = hookEvents();
  const wrong = hookNames()
    .map((name) => [name, registered[name] ?? []])
    .filter(([, events]) => events.length !== 1);
  assert.deepEqual(
    wrong,
    [],
    "a script on two events is stood down on both by a name that mentions neither, and one on no "
      + "event never fires: register it in hooks.json once, or give the key a `name:Event` form",
  );
});

test("doctor names the event it stood down and the one undo for it", () => {
  const out = forge(room('{"hooksOff":["codex-turn"]}'), "doctor").stdout;
  assert.match(out, /hooks off\s+codex-turn \(PostToolUse\) — `forge hooks --on codex-turn`/);
});

