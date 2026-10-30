/* A session started with `--plugin-dir` registers that directory's hooks, so the hop in `gate.mjs`
   runs that copy: run through the newest install instead, every gate of a dev line is the released
   code, and a gate the release lacks stands down on every call ("no gates/landing-gate.mjs in this
   copy"). A copy loaded by path is the session's install, for its hooks and for its calls. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { copyToRun, installedCopy, sessionPluginDir } from "../../../src/tools/plugin-copy.mjs";
import { tempRoom } from "../../fixtures.mjs";

const PLUGIN = new URL("../../..", import.meta.url).pathname;
const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;
const HOOK = join("hooks", "_hook.mjs");

const wrote = (path, body) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
};

/* A plugin copy whose hook says which copy it is, carrying the real hop under test. */
const copy = (dir, label, version) => {
  wrote(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version }));
  wrote(join(dir, HOOK), `export const dispatch = (args) => process.stdout.write("${label} " + args.join(" ") + "\\n");\n`);
  for (const one of [join("hooks", "gate.mjs"), join("src", "tools", "plugin-copy.mjs")]) {
    mkdirSync(join(dir, one, ".."), { recursive: true });
    copyFileSync(join(PLUGIN, one), join(dir, one));
  }
  return dir;
};

const world = () => {
  const room = tempRoom("inline-copy-");
  const home = join(room, "home");
  const cache = join(home, ".claude", "plugins", "cache", "forge-local", NAME);
  const newest = copy(join(cache, "1.0.0"), "installed", "1.0.0");
  const older = copy(join(cache, "0.9.0"), "older", "0.9.0");
  const inline = copy(join(room, "dev", "plugin"), "inline", "9.0.0");
  const record = join(home, ".claude", "plugins", "installed_plugins.json");
  wrote(record, JSON.stringify({ version: 2, plugins: { [`${NAME}@forge-local`]: [
    { scope: "user", installPath: newest, version: "1.0.0", lastUpdated: "2026-10-01T00:00:00.000Z" },
  ] } }));
  const outside = join(room, "elsewhere");
  mkdirSync(outside);
  return { room, home, newest, older, inline, record, outside };
};

const hooked = (copyDir, { home, outside }) => spawnSync(process.execPath, [join(copyDir, "hooks", "gate.mjs"), "pre", "landing-gate"],
  { cwd: outside, encoding: "utf8", env: { PATH: process.env.PATH, HOME: home } });

test("a copy loaded by path runs its own hooks, never the installed copy's", () => {
  const made = world();
  try {
    const run = hooked(made.inline, made);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, "inline pre landing-gate\n", `the session's own copy answered:\n${run.stdout}${run.stderr}`);
    const chosen = copyToRun({ cwd: made.outside, entry: HOOK, root: made.inline, record: made.record, registered: true, pid: null });
    assert.equal(chosen.kind, "inline");
    assert.match(chosen.why, /loaded .* by path \(--plugin-dir\)/u, "and doctor can say why");
  } finally {
    rmSync(made.room, { recursive: true, force: true });
  }
});

test("an installed copy's hooks still follow the newest install, an older one included", () => {
  const made = world();
  try {
    assert.equal(hooked(made.newest, made).stdout, "installed pre landing-gate\n");
    assert.equal(hooked(made.older, made).stdout, "installed pre landing-gate\n",
      "a copy under the install cache is an install the newest replaced, not one loaded by path");
    assert.equal(installedCopy(made.older, made.record), true);
    assert.equal(installedCopy(made.inline, made.record), false);
  } finally {
    rmSync(made.room, { recursive: true, force: true });
  }
});

test("a call from a session started with --plugin-dir runs that copy, read off the session's command line", async () => {
  const made = world();
  const session = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", "--plugin-dir", made.inline],
    { stdio: "ignore" });
  try {
    await new Promise((up) => session.once("spawn", up));
    assert.equal(sessionPluginDir(session.pid, made.inline), made.inline);
    assert.equal(sessionPluginDir(process.pid, made.inline), null, "a process naming no --plugin-dir names none");
    const relative = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", "--plugin-dir", join("dev", "plugin")],
      { stdio: "ignore", cwd: made.room });
    await new Promise((up) => relative.once("spawn", up));
    assert.equal(sessionPluginDir(relative.pid, made.inline), made.inline, "a relative one read against the session's directory");
    relative.kill();
    const cli = join("hooks", "_hook.mjs");
    const chosen = copyToRun({ cwd: made.outside, entry: cli, root: made.newest, record: made.record, pid: session.pid });
    assert.equal(chosen.kind, "inline");
    assert.equal(chosen.dir, made.inline);
    const bare = copyToRun({ cwd: made.outside, entry: cli, root: made.newest, record: made.record, pid: null });
    assert.equal(bare.kind, "installed", "and with no such session the install answers as before");
  } finally {
    session.kill();
    rmSync(made.room, { recursive: true, force: true });
  }
});
