/* One symlink on PATH served the whole machine from whichever copy a session wrote it from, so a
   half-finished refactor here killed `forge issues` in two other projects. The dispatcher is only
   provable against copies that print which one they are. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { copyToRun } from "../../src/tools/plugin-copy.mjs";

const BIN = new URL("../../bin/", import.meta.url).pathname;
const PLUGIN = new URL("../..", import.meta.url).pathname;

const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;

const wrote = (path, body) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
};

/* A copy is a plugin directory holding a manifest and the two entries, each printing which copy it
   is: the choice is invisible in an exit code. */
const copy = (dir, label, cli = `process.stdout.write("${label} cli " + process.argv.slice(2).join(" ") + "\\n");\n`) => {
  wrote(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version: "1.2.3" }));
  wrote(join(dir, "src", "cli.mjs"), cli);
  wrote(join(dir, "vi-natural", "cli.mjs"), `process.stdout.write("${label} vi\\n");\n`);
  return dir;
};

const record = (home, plugins) =>
  wrote(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins }));

/* The fake world: a checkout whose marketplace ships this plugin's name, one installed copy the
   record resolves to, one it names at a path that no longer exists, and one older. */
const world = (cli) => {
  const room = mkdtempSync(join(tmpdir(), "dispatch-"));
  const checkout = copy(join(room, "checkout", "plugin"), "checkout", cli);
  wrote(
    join(room, "checkout", ".claude-plugin", "marketplace.json"),
    JSON.stringify({ plugins: [{ name: NAME, source: "./plugin" }] }),
  );
  const newest = copy(join(room, "cache", "1.2.3"), "installed");
  copy(join(room, "cache", "1.0.0"), "older");
  const home = join(room, "home");
  record(home, {
    [`${NAME}@fake`]: [
      { scope: "user", installPath: join(room, "cache", "1.0.0"), version: "1.0.0", lastUpdated: "2026-01-01T00:00:00.000Z" },
      { scope: "user", installPath: newest, version: "1.2.3", lastUpdated: "2026-01-02T00:00:00.000Z" },
      { scope: "user", installPath: join(room, "cache", "pruned"), version: "9.9.9", lastUpdated: "2026-02-01T00:00:00.000Z" },
    ],
  });
  mkdirSync(join(room, "bin"));
  for (const name of ["forge", "vi-natural"]) symlinkSync(join(BIN, name), join(room, "bin", name));
  mkdirSync(join(room, "elsewhere"));
  return { room, home, checkout, newest, outside: join(room, "elsewhere") };
};

const ran = (wrapper, { cwd, home }, ...args) =>
  spawnSync(wrapper, args, {
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });

const inRoom = (cli, check) => {
  const made = world(cli);
  try {
    check(made);
  } finally {
    rmSync(made.room, { recursive: true, force: true });
  }
};

test("through the link, the working directory picks the copy", () => {
  inRoom(undefined, ({ room, home, checkout, outside }) => {
    const link = join(room, "bin", "forge");
    const inside = ran(link, { cwd: join(checkout, ".."), home }, "issues");
    assert.match(inside.stdout, /^checkout cli issues$/mu, "a directory inside the checkout runs the checkout");
    const under = ran(link, { cwd: join(checkout, "src"), home }, "issues");
    assert.match(under.stdout, /^checkout cli issues$/mu, "and so does one under it");
    const out = ran(link, { cwd: outside, home }, "issues");
    assert.match(out.stdout, /^installed cli issues$/mu, "outside it, the newest install record that resolves");
    assert.doesNotMatch(out.stdout, /older|9\.9\.9/u, "not the older copy, and not the pruned path");
  });
});

test("vi-natural follows the same rule", () => {
  inRoom(undefined, ({ room, home, checkout, outside }) => {
    const link = join(room, "bin", "vi-natural");
    assert.match(ran(link, { cwd: checkout, home }).stdout, /^checkout vi$/mu);
    assert.match(ran(link, { cwd: outside, home }).stdout, /^installed vi$/mu);
  });
});

/* The failure that reads as success: a main-module guard compares argv[1] against
   `import.meta.url`, which escapes what a path may hold, so a copy under a directory with a space
   in its name loads, runs no command and exits 0. The chooser can select such a copy wherever the
   wrapper itself sits, which is why the real CLI is what answers here. */
test("a chosen copy at an escaped path is still the main module, so vi-natural answers --help", () => {
  const room = mkdtempSync(join(tmpdir(), "dispatch-escaped-"));
  try {
    const checkout = join(room, "a checkout");
    cpSync(join(PLUGIN, "vi-natural"), join(checkout, "plugin", "vi-natural"), { recursive: true });
    wrote(join(checkout, "plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version: "1.2.3" }));
    wrote(
      join(checkout, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: NAME, source: "./plugin" }] }),
    );
    mkdirSync(join(room, "bin"));
    symlinkSync(join(BIN, "vi-natural"), join(room, "bin", "vi-natural"));
    const run = ran(join(room, "bin", "vi-natural"), { cwd: checkout, home: room }, "--help");
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /vi-natural/u, "the CLI printed its help, rather than loading and exiting");
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

test("a wrapper invoked by its own path runs its own copy, wherever it is called from", () => {
  inRoom(undefined, ({ home, outside }) => {
    const run = ran(join(BIN, "forge"), { cwd: outside, home }, "-h");
    assert.match(run.stdout, /Usage: forge/u, "this checkout's own CLI answered");
    assert.doesNotMatch(run.stdout, /installed cli/u, "the install record was not consulted");
  });
});

test("no install record and no checkout above leaves the copy on PATH", () => {
  inRoom(undefined, ({ room, outside }) => {
    const bare = join(room, "bare-home");
    mkdirSync(bare);
    const run = ran(join(room, "bin", "forge"), { cwd: outside, home: bare }, "-h");
    assert.match(run.stdout, /Usage: forge/u, "the copy the link points at is the fallback");
  });
});

const BOOM = 'import { nothing } from "./gone.mjs";\nprocess.stdout.write(nothing);\n';

test("a crash on load in the checkout names the copy that ran and the installed one", () => {
  inRoom(BOOM, ({ room, home, checkout, newest }) => {
    const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "issues");
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Cannot find module|ERR_MODULE_NOT_FOUND/u, "the failure itself is still reported");
    assert.ok(run.stderr.includes(`${join(checkout, "src", "cli.mjs")} is this checkout's own copy`),
      `the copy that ran is named:\n${run.stderr}`);
    assert.ok(run.stderr.includes(join(newest, "src", "cli.mjs")), "and the installed copy's path is the way out");
  });
});

test("a checkout whose entry has gone is still the copy, and says which one", () => {
  inRoom(undefined, ({ room, home, checkout }) => {
    rmSync(join(checkout, "src", "cli.mjs"));
    const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "issues");
    assert.equal(run.status, 1);
    assert.doesNotMatch(run.stdout, /installed cli/u, "the installed copy did not quietly answer for it");
    assert.ok(run.stderr.includes(`${join(checkout, "src", "cli.mjs")} is this checkout's own copy`),
      `the tree the caller is in is named:\n${run.stderr}`);
  });
});

const REFUSED = 'process.stderr.write("no such thing\\n");\nprocess.exit(3);\n';

test("a refusal the CLI wrote itself is not a crash", () => {
  inRoom(REFUSED, ({ room, home, checkout }) => {
    const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "issues");
    assert.equal(run.status, 3, "the exit code is the CLI's own");
    assert.equal(run.stderr, "no such thing\n", "and nothing was appended to it");
  });
});

/* The chooser on its own, since the reason is what `doctor` prints and a spawn cannot read it. */
test("the chosen copy carries why it was chosen", () => {
  inRoom(undefined, ({ room, home, checkout, newest, outside }) => {
    const entry = join("src", "cli.mjs");
    const at = (cwd) => copyToRun({ cwd, entry, root: PLUGIN, record: join(home, ".claude", "plugins", "installed_plugins.json") });
    const inside = at(checkout);
    assert.equal(inside.dir, checkout);
    assert.equal(inside.kind, "checkout");
    assert.match(inside.why, /working directory is inside the checkout/u);
    assert.equal(inside.installed.dir, newest, "the installed copy is carried whichever was chosen");
    const out = at(outside);
    assert.equal(out.dir, newest);
    assert.equal(out.kind, "installed");
    assert.equal(out.version, "1.2.3");
    const none = copyToRun({ cwd: outside, entry, root: PLUGIN, record: join(room, "no-record.json") });
    assert.equal(none.kind, "this");
    assert.equal(none.dir, PLUGIN.replace(/\/$/u, ""));
  });
});

/* A dispatcher whose module graph reaches the code it exists to survive survives nothing. */
test("the dispatcher imports nothing but node builtins and the chooser", () => {
  const imports = (path) =>
    [...readFileSync(path, "utf8").matchAll(/from\s+"([^"]+)"/gu)].map(([, one]) => one);
  const chooser = "./tools/plugin-copy.mjs";
  for (const one of imports(join(PLUGIN, "src", "dispatch.mjs"))) {
    assert.ok(one.startsWith("node:") || one === chooser, `dispatch.mjs imports ${one}`);
  }
  for (const one of imports(join(PLUGIN, "src", "tools", "plugin-copy.mjs"))) {
    assert.ok(one.startsWith("node:"), `plugin-copy.mjs imports ${one}`);
  }
});
