/* What a session picks up only at its start: the registered entries, and the link they reach the CLI
   through. Both are frozen, and what an entry does with the rest is only provable against copies that
   say which one answered. Never against the installed cache: the whole claim is that the entry may be
   old, and the live copy cannot be made old to prove it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { FROZEN } from "../../src/tools/plugin-copy.mjs";
import { dirtyRepo, tempRoom } from "../fixtures.mjs";

const PLUGIN = new URL("../..", import.meta.url).pathname.replace(/\/$/u, "");
const ROOT = dirname(PLUGIN);
const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;
const EVENT = { tool_name: "Bash", tool_input: { command: "true" }, session_id: "s", transcript_path: "" };

const wrote = (path, body) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
};

/* A harness that says which copy it is and echoes the registration it was handed, since the argv is
   the frozen half of the interface: an old registration has to stay readable by a new harness. */
const HARNESS = (label) =>
  `export const dispatch = async (given) => process.stdout.write("${label} ran " + given.join(" ") + "\\n");\n`;

/* Everything `hooks/gate.mjs` reaches, taken from this tree rather than written again: a copy whose
   entry or chooser is a stand-in would prove something about the stand-in. */
const copy = (dir, label, harness = HARNESS(label)) => {
  wrote(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version: "1.2.3" }));
  for (const one of [join("hooks", "gate.mjs"), join("src", "tools", "plugin-copy.mjs")]) {
    mkdirSync(dirname(join(dir, one)), { recursive: true });
    cpSync(join(PLUGIN, one), join(dir, one));
  }
  wrote(join(dir, "hooks", "_hook.mjs"), harness);
  return dir;
};

const record = (home, plugins) =>
  wrote(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins }));

/* An old copy holding the entry a session registered, a newer install the record resolves to, and a
   checkout above one directory. Each copy's harness prints its own name. */
const world = (name, { newest = HARNESS("installed") } = {}) => {
  const room = tempRoom(`${name}-`);
  const old = copy(join(room, "cache", "1.0.0"), "old");
  const fresh = copy(join(room, "cache", "1.2.3"), "installed", newest);
  copy(join(room, "checkout", "plugin"), "checkout");
  wrote(
    join(room, "checkout", ".claude-plugin", "marketplace.json"),
    JSON.stringify({ plugins: [{ name: NAME, source: "./plugin" }] }),
  );
  const home = join(room, "home");
  record(home, {
    [`${NAME}@fake`]: [
      { scope: "user", installPath: old, version: "1.0.0", lastUpdated: "2026-01-01T00:00:00.000Z" },
      { scope: "user", installPath: fresh, version: "1.2.3", lastUpdated: "2026-01-02T00:00:00.000Z" },
    ],
  });
  mkdirSync(join(room, "elsewhere"));
  return { room, home, old, fresh, checkout: join(room, "checkout"), outside: join(room, "elsewhere") };
};

/* Called the way Claude Code calls it: the entry by its own path, the event on stdin, and the cwd
   the session was started in — which is the only thing the entry has to choose a copy with. */
const fired = (entry, { cwd, home }, ...argv) =>
  spawnSync(process.execPath, [join(entry, "hooks", "gate.mjs"), ...argv], {
    input: JSON.stringify(EVENT),
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });

test("the entry a session froze runs the copy installed since, not the one beside it", () => {
  const { home, old, fresh, outside } = world("gate-newer");
  const run = fired(old, { cwd: outside, home }, "pre", "bash-guard");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^installed ran pre bash-guard$/mu,
    `the old entry did not reach the newer harness:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stdout, /^old ran/mu, "the entry ran the harness lying beside it");
  assert.ok(fresh.endsWith("1.2.3") && old.endsWith("1.0.0"));
});

test("inside a checkout the entry runs the checkout's gate code, as the CLI does", () => {
  const { home, old, checkout } = world("gate-checkout");
  const inside = fired(old, { cwd: join(checkout, "plugin", "hooks"), home }, "post", "code-quality");
  assert.match(inside.stdout, /^checkout ran post code-quality$/mu, inside.stdout);
});

const BOOM = 'import { nothing } from "./gone.mjs";\nexport const dispatch = () => nothing;\n';

test("a chosen copy that will not load leaves the gates running, and says which copy answered", () => {
  const { home, old, fresh, outside } = world("gate-broken", { newest: BOOM });
  const run = fired(old, { cwd: outside, home }, "pre", "bash-guard");
  assert.equal(run.status, 0, `a failed hop took the call down:\n${run.stderr}`);
  assert.match(run.stdout, /^old ran pre bash-guard$/mu,
    `the entry's own gates did not answer for the broken copy:\n${run.stdout}${run.stderr}`);
  assert.ok(run.stderr.includes(join(fresh, "hooks", "_hook.mjs")), `the copy that failed is named:\n${run.stderr}`);
  assert.ok(run.stderr.includes(join(old, "hooks", "_hook.mjs")), `the copy that answered is named:\n${run.stderr}`);
  assert.match(run.stderr, /Cannot find module|ERR_MODULE_NOT_FOUND/u, "and the failure itself is still reported");
});

test("a chosen copy exporting no dispatch is a copy this entry cannot run, and falls back too", () => {
  const { home, old, outside } = world("gate-shapeless", { newest: "export const nothing = 1;\n" });
  const run = fired(old, { cwd: outside, home }, "pre", "bash-guard");
  assert.match(run.stdout, /^old ran pre bash-guard$/mu, run.stdout);
  assert.match(run.stderr, /exports no dispatch\(\) to run/u, run.stderr);
});

/* The frozen half of the interface: `hooks.json` pins the gate names and a newer copy may not have
   one. Losing that gate is the cost; losing the line it sits on would be the defect. */
test("a registration naming a gate the chosen copy has not got loses that gate alone", () => {
  const room = tempRoom("gate-unknown-");
  /* A repository with work to lose, since `bash-guard` stands down over one with none — and this
     checkout is clean the moment the change is committed, which is when the suite runs. */
  const run = spawnSync(process.execPath, [join(PLUGIN, "hooks", "gate.mjs"), "pre", "no-such-gate", "bash-guard"], {
    input: JSON.stringify({ ...EVENT, tool_input: { command: "git stash" }, cwd: dirtyRepo() }),
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, XDG_CONFIG_HOME: room },
  });
  assert.match(run.stdout, /"permissionDecision":"deny"/u,
    `the gate after the missing one did not decide:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /no-such-gate failed and was skipped/u, `the miss is not reported:\n${run.stderr}`);
});

test("the deadline runs from the process, so a hop and a fallback buy no time back", () => {
  const held = pathToFileURL(join(PLUGIN, "hooks", "_hook.mjs")).href;
  const probe = `await new Promise((go) => setTimeout(go, 400));\n`
    + `const { DEADLINES, remaining } = await import(${JSON.stringify(held)});\n`
    + `process.stdout.write(String(DEADLINES.post - remaining()));\n`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", probe], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(Number(run.stdout) >= 350,
    `the clock started when the harness was imported, not when the process did: ${run.stdout}ms spent`);
});

/* The declaration is only worth reading if nothing can drift out from under it, so the closure is
   walked rather than compared to a list somebody kept up to date. */
/* Every static form, since one that escaped the walk is a file drifting out of the set unseen: a
   side-effect import, a re-export, either quote. No `(`, so a path inside a call is not one. */
const RELATIVE = /(?:^|\n)(?:import|export)\b[^();]*?from\s*["'](\.[^"']+)["']|(?:^|\n)import\s*["'](\.[^"']+)["']/gu;

const reaches = (from, found = new Set()) => {
  if (found.has(from)) return found;
  found.add(from);
  for (const said of readFileSync(from, "utf8").matchAll(RELATIVE)) {
    reaches(join(dirname(from), said[1] ?? said[2]), found);
  }
  return found;
};

test("what the registered entries import is exactly what the frozen set declares", () => {
  const walked = new Set();
  for (const one of ["gate.mjs", "link-cli.mjs"]) reaches(join(PLUGIN, "hooks", one), walked);
  const reachable = [...walked].map((one) => relative(ROOT, one)).sort();
  const declared = FROZEN.filter((one) => one.endsWith(".mjs")).sort();
  assert.deepEqual(reachable, declared,
    "the registered entries reach files the frozen set does not name, or name files they no longer "
      + "reach: a session cannot pick either up, so FROZEN in plugin/src/tools/plugin-copy.mjs and "
      + "the ship's restart line are wrong until this matches");
});

test("the solo entries still run this checkout's own gate text, so the suite is unaffected", () => {
  for (const name of ["bash-guard", "codex-turn"]) {
    const text = readFileSync(join(PLUGIN, "hooks", "entries", `${name}.mjs`), "utf8");
    assert.match(text, /from "\.\.\/_hook\.mjs"/u, `${name} no longer loads the harness beside it`);
    assert.doesNotMatch(text, /plugin-copy/u, `${name} hops, and the suite would then test the installed copy`);
  }
});

/* The link runs at every session start, in whatever `~/.local/bin` the machine already has. What sits
   there may be somebody else's install of the same name, and deleting it is not recoverable. */
const LINK = join(PLUGIN, "hooks", "link-cli.mjs");

const binRoom = () => {
  const home = tempRoom("link-home-");
  mkdirSync(join(home, ".local", "bin"), { recursive: true });
  return home;
};

const linking = (home) =>
  spawnSync(process.execPath, [LINK, PLUGIN], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });

const THEIRS = "#!/bin/sh\necho somebody else's forge\n";

test("a forge that is not a symlink is named and left where it is", () => {
  const home = binRoom();
  const theirs = join(home, ".local", "bin", "forge");
  writeFileSync(theirs, THEIRS);
  const run = linking(home);
  assert.equal(readFileSync(theirs, "utf8"), THEIRS, "the file is still theirs");
  assert.match(run.stdout, /`forge` on PATH is not this plugin's/u);
});

test("a link an earlier session left is repointed", () => {
  const home = binRoom();
  const link = join(home, ".local", "bin", "vi-natural");
  symlinkSync(join(home, "moved-away"), link);
  linking(home);
  assert.equal(readlinkSync(link), join(PLUGIN, "bin", "vi-natural"));
});

test("an empty bin gets both", () => {
  const home = binRoom();
  linking(home);
  for (const name of ["forge", "vi-natural"]) {
    assert.equal(readlinkSync(join(home, ".local", "bin", name)), join(PLUGIN, "bin", name));
  }
});
