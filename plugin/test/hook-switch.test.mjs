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

const refused = (home) => {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: randomUUID(), tool_name: "Bash", tool_input: { command: STAGES_EVERYTHING } }),
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home },
  });
  assert.equal(run.status, 0, run.stderr);
  return Boolean(run.stdout.trim());
};

const forge = (home, ...argv) =>
  spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home },
  });

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
  assert.match(off.stdout, /bash-guard is now off/);
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
