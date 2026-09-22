/* How far a run standing in this checkout goes: `ship`, a key of the project's own record. What the
   two modes ask of a run is the served method's; what is judged here is which store answers, what
   the report says of it, and what a value at the machine's level decides, which is nothing. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { escaped, projectEntry, projectRoom, tempRoom } from "../../fixtures.mjs";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

/* The report is what a developer reads, so it is spawned rather than called. */
const ofProject = (config) => {
  const home = tempRoom("doctor-ship-read-");
  const cwd = projectRoom(tempRoom("doctor-ship-read-cwd-"), home, config);
  const run = spawnSync(process.execPath, [CLI, "doctor", "project"], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { out: run.stdout, entry: projectEntry(cwd, home) };
};

const machineShip = (saved) =>
  (existsSync(saved) ? JSON.parse(readFileSync(saved, "utf8")).ship : undefined);

/* Read back off the file rather than off the report, because what a later `ship` reads is the file:
   a report that agreed with itself and wrote nothing would leave the mode a fiction of one process.
   The write returns before the report, as every write of the project's record does, so the mode is
   read back by a second call standing in the same checkout. */
const shipped = (home, mode, argv = ["--ship", mode], config = { slug: "demo" }) => {
  const cwd = projectRoom(tempRoom("doctor-ship-cwd-"), home, config);
  const env = { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home };
  const run = spawnSync(process.execPath, [CLI, "doctor", ...argv], { encoding: "utf8", cwd, env });
  const back = spawnSync(process.execPath, [CLI, "doctor", "project"], { encoding: "utf8", cwd, env });
  return { wrote: run, out: back.stdout, said: run.stdout, cwd,
    entry: projectEntry(cwd, home), saved: join(home, "forge", "config.json") };
};

test("the landing mode is the project's: it is written to this machine's record of the project and the account's configuration is untouched", () => {
  const home = tempRoom("doctor-ship-home-");
  const { entry, saved, said } = shipped(home, "ready");
  assert.deepEqual(JSON.parse(readFileSync(entry, "utf8")), { slug: "demo", ship: "ready" },
    "the mode is in this machine's record of the project, beside the keys about the same landing");
  assert.equal(machineShip(saved), undefined,
    "and the account's configuration holds no such key: the project decided, not the box");
  assert.match(said, new RegExp(`${escaped(entry)}`, "u"), "the line it prints names the file it wrote");
  assert.match(said, /A run in a checkout of demo now ends at a pushed branch/u,
    "and the sentence names the project it wrote for rather than this machine");
  assert.doesNotMatch(said, /on this machine now/u, "it claims nothing about the box");
});

test("the mode the report prints is the mode last written, either way", () => {
  const home = tempRoom("doctor-mode-home-");
  assert.match(shipped(home, "ready").out, /\[ {2}ok {2}\] ship\s+ready {2}← \S+config\.json/u);
  assert.match(shipped(home, "self").out, /\[ {2}ok {2}\] ship\s+self {2}← \S+config\.json/u,
    "and self is written rather than cleared, so the report never has to guess which way a silence means");
});

/* The whole point of the move: one box, two projects, two answers. Two rooms under one home, so the
   machine's own file is the one thing they share. */
test("two projects on one machine answer the ship mode separately, each out of its own record", () => {
  const home = tempRoom("doctor-ship-two-");
  const lands = shipped(home, "ready", ["--ship", "ready"], { slug: "lands-its-own" });
  const waits = shipped(home, "self", ["--ship", "self"], { slug: "leaves-it-ready" });
  assert.equal(JSON.parse(readFileSync(lands.entry, "utf8")).ship, "ready");
  assert.equal(JSON.parse(readFileSync(waits.entry, "utf8")).ship, "self");
  assert.match(lands.out, /\[ {2}ok {2}\] ship\s+ready/u, "and each report reads its own checkout's");
  assert.match(waits.out, /\[ {2}ok {2}\] ship\s+self/u);
});

test("a project that declares no ship mode is read at self, against the plugin's own default", () => {
  const { out } = ofProject({ slug: "demo" });
  assert.match(out, /\[ {2}ok {2}\] ship\s+self {2}← the plugin's default/u,
    "a project that never sets it behaves exactly as every run did before the key existed");
});

test("the same key is written by --set, into the same file --ship writes", () => {
  const home = tempRoom("doctor-ship-set-");
  const { entry, saved } = shipped(home, "ready", ["--set", "ship=ready"]);
  assert.equal(JSON.parse(readFileSync(entry, "utf8")).ship, "ready",
    "two spellings of one write, so neither can disagree with the other about where the value lands");
  assert.equal(machineShip(saved), undefined);
});

test("a ship mode the key does not take is named by the report and read at the default", () => {
  const { out } = ofProject({ slug: "demo", ship: "solo" });
  assert.match(out, /\[ miss \] ship\s+solo is no value of this key — it takes self, ready; reading self {2}← the plugin's default/u,
    out);
});

test("a landing mode left in the account's configuration is reported ignored and decides nothing", () => {
  const home = tempRoom("doctor-ship-left-");
  const cwd = projectRoom(tempRoom("doctor-ship-left-cwd-"), home, { slug: "demo", ship: "ready" });
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify({ ship: "self" }));
  const entry = projectEntry(cwd, home);
  const run = spawnSync(process.execPath, [CLI, "doctor", "project"], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, new RegExp(`\\[ note \\] ship\\s+ready {2}← ${escaped(entry)}; \`ship: "self"\``, "u"),
    run.stdout);
  assert.match(run.stdout,
    /is ignored — the key that decides this is now `ship` in this machine's record of that project/u,
    "the value left behind is named, and so is the key that replaced it");
});

test("the ship mode cannot be written where there is no project to write it for", () => {
  const home = tempRoom("doctor-ship-nowhere-");
  const run = spawnSync(process.execPath, [CLI, "doctor", "--ship", "ready"], {
    encoding: "utf8", cwd: tempRoom("doctor-ship-loose-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^--ship: /u, "the refusal names the flag that was typed, not a flag that was not");
  assert.match(run.stderr, /belongs to no checkout, so there is no project to configure and nothing was written/u);
  assert.equal(existsSync(join(home, "forge", "config.json")), false, "and nothing of this machine's was written either");
});
