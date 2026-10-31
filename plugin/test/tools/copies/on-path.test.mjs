/* Two sessions on two copies share one `~/.local/bin`: each one's typed `forge` reaches its own copy,
   whichever started last, and a copy loaded by path is never the one every other caller falls back
   to. Red on the hook that linked the file to its own root, where the later start took the other's
   calls (FB-430). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { copyToRun } from "../../../src/tools/plugin-copy.mjs";
import { ROOT_VAR, dispatcherAt, reachRow, typedReach } from "../../../src/tools/copies/on-path.mjs";
import { tempRoom } from "../../fixtures.mjs";

const PLUGIN = new URL("../../..", import.meta.url).pathname;
const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;
const HOOK = join(PLUGIN, "hooks", "link-cli.mjs");

const wrote = (path, body) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
};

/* A copy whose dispatch says which copy it is, with this release's own launchers beside it. */
const copy = (dir, label, version) => {
  wrote(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version }));
  wrote(join(dir, "src", "dispatch.mjs"),
    `process.stdout.write(${JSON.stringify(label)} + " " + process.argv.slice(2).join(" ") + "\\n");\n`);
  mkdirSync(join(dir, "bin"), { recursive: true });
  for (const one of ["forge", "vi-natural"]) {
    copyFileSync(join(PLUGIN, "bin", one), join(dir, "bin", one));
    chmodSync(join(dir, "bin", one), 0o755);
  }
  return dir;
};

const world = ({ installed = true } = {}) => {
  const room = tempRoom("on-path-");
  const home = join(room, "home");
  const bin = join(home, ".local", "bin");
  mkdirSync(bin, { recursive: true });
  const beta = copy(join(room, "beta", "plugin"), "beta", "3.36.542");
  const dev = copy(join(room, "dev", "plugin"), "dev", "3.36.651");
  const cached = copy(join(home, ".claude", "plugins", "cache", "forge-local", NAME, "3.36.600"), "installed", "3.36.600");
  if (installed) {
    wrote(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: {
      [`${NAME}@forge-local`]: [{ scope: "user", installPath: cached, version: "3.36.600", lastUpdated: "2026-10-01T00:00:00.000Z" }],
    } }));
  }
  const outside = join(room, "elsewhere");
  mkdirSync(outside);
  return { room, home, bin, beta, dev, cached, outside };
};

/* A session's start, as Claude Code runs it: the hook on that session's root, with its own env file. */
const started = (made, root, label) => {
  const file = join(made.room, `${label}.env`);
  writeFileSync(file, "");
  const run = spawnSync(process.execPath, [HOOK, root], {
    cwd: made.outside,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: made.home, XDG_CONFIG_HOME: join(made.home, ".config"), CLAUDE_ENV_FILE: file },
  });
  assert.equal(run.status, 0, run.stderr);
  return file;
};

/* A command typed in a session: its env file sourced first, as Claude Code does before each one. */
const typed = (made, file, name = "forge") => spawnSync("sh", ["-c", `[ -n "$1" ] && . "$1"; exec ${name} --version`, "typed", file ?? ""], {
  cwd: made.outside,
  encoding: "utf8",
  env: { PATH: `${made.bin}:${process.env.PATH}`, HOME: made.home },
});

test("two sessions on two copies each reach their own, whichever started last", () => {
  const made = world();
  const beta = started(made, made.beta, "beta");
  const dev = started(made, made.dev, "dev");
  assert.equal(typed(made, dev).stdout, "dev src/cli.mjs --version\n", "the later start reaches its own copy");
  assert.equal(typed(made, beta).stdout, "beta src/cli.mjs --version\n",
    "and the earlier one still reaches its own, not the copy the later start wrote");
  started(made, made.beta, "beta-again");
  assert.equal(typed(made, dev).stdout, "dev src/cli.mjs --version\n", "a restart of the other changes nothing here");
  assert.equal(typed(made, beta, "vi-natural").stdout, "beta vi-natural/cli.mjs --version\n", "vi-natural the same way");
});

/* What a release before this one does to a file it finds there: it replaces a link and leaves a file. */
test("the file on PATH is a dispatcher, which no earlier release's start replaces", () => {
  const made = world();
  started(made, made.dev, "dev");
  for (const name of ["forge", "vi-natural"]) {
    const at = join(made.bin, name);
    assert.equal(lstatSync(at).isSymbolicLink(), false, `${name} is a file of its own, not a link`);
    assert.ok(dispatcherAt(at), `${name} is this plugin's dispatcher`);
  }
});

test("outside any session the dispatcher runs the installed copy, never one loaded by path", () => {
  const made = world();
  started(made, made.dev, "dev");
  assert.equal(typed(made, null).stdout, "installed src/cli.mjs --version\n");
  assert.equal(dispatcherAt(join(made.bin, "forge")).fallback, made.cached);
});

test("with no installed copy, a call from outside a session is refused by name", () => {
  const made = world({ installed: false });
  started(made, made.dev, "dev");
  assert.equal(dispatcherAt(join(made.bin, "forge")).fallback, null, "a copy loaded by path is never the fallback");
  const run = typed(made, null);
  assert.equal(run.status, 127);
  assert.match(run.stderr, new RegExp(`forge: ${ROOT_VAR} is unset here and no installed copy was recorded`, "u"));
});

test("a session root that holds no copy is refused by name, never run as another", () => {
  const made = world();
  const file = started(made, made.dev, "dev");
  writeFileSync(file, `export ${ROOT_VAR}='${join(made.room, "gone")}'\n`);
  const run = typed(made, file);
  assert.equal(run.status, 127);
  assert.match(run.stderr, /gone, read from this session's FORGE_PLUGIN_ROOT, holds no src\/dispatch\.mjs/u);
});

test("a call from a session's root is that session's copy, not the newest install", () => {
  const made = world();
  const record = join(made.home, ".claude", "plugins", "installed_plugins.json");
  const where = { cwd: made.outside, entry: join("src", "dispatch.mjs"), root: made.dev, record, pid: null };
  const chosen = copyToRun({ ...where, session: made.dev });
  assert.equal(chosen.kind, "inline");
  assert.equal(chosen.dir, made.dev);
  assert.equal(copyToRun({ ...where, session: undefined }).kind, "installed",
    "and without it, the newest install, as before");
});

/* The doctor reads the copy off the file a typed `forge` reaches, not off the copy answering it. */
test("the doctor's row names the copy a typed forge reaches", () => {
  const made = world();
  started(made, made.dev, "dev");
  const mine = typedReach({ path: made.bin, session: made.dev });
  assert.deepEqual([mine.how, mine.root, mine.version], ["session", made.dev, "3.36.651"]);
  assert.match(reachRow(mine, made.dev).detail, /^3\.36\.651 at \S+ — this session's own copy/u);
  const outside = typedReach({ path: made.bin, session: undefined });
  assert.match(reachRow(outside, null).detail, /^3\.36\.600 at \S+ — FORGE_PLUGIN_ROOT is unset here/u);

  const linked = join(made.room, "linked");
  mkdirSync(linked);
  symlinkSync(join(made.beta, "bin", "forge"), join(linked, "forge"));
  const other = reachRow(typedReach({ path: linked, session: undefined }), made.dev);
  assert.equal(other.level, "miss", "a link to another session's copy is the defect, said as one");
  assert.match(other.detail, /^3\.36\.542 at \S+ — \S+ is a link the last session to start wrote, not this session's/u);
});
