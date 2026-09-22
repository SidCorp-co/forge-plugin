/* What kind of project a checkout belongs to: `shape`, a key of the project's own record. What a run
   does with each of the three is the served method's; what is judged here is that the word is
   declared rather than inferred, that the report carries what it means, and that a fourth word is
   named rather than taken (ISS-2190). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { escaped, projectEntry, projectRoom, tempRoom } from "../../fixtures.mjs";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

const envOf = (home) => ({ PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home });

/* The report is what a developer reads, so it is spawned rather than called. */
const ofProject = (config, argv = ["doctor", "project"]) => {
  const home = tempRoom("doctor-shape-");
  const cwd = projectRoom(tempRoom("doctor-shape-cwd-"), home, config);
  const run = spawnSync(process.execPath, [CLI, ...argv], { encoding: "utf8", cwd, env: envOf(home) });
  return { out: run.stdout, said: run.stderr, status: run.status, cwd, home, entry: projectEntry(cwd, home) };
};

/* The write returns before the report, as every write of the project's record does, so what the key
   now holds is read off the file and off a second call standing in the same checkout. */
const set = (value, config = { slug: "demo" }) => {
  const home = tempRoom("doctor-shape-set-");
  const cwd = projectRoom(tempRoom("doctor-shape-set-cwd-"), home, config);
  const env = envOf(home);
  const wrote = spawnSync(process.execPath, [CLI, "doctor", "--set", `shape=${value}`], { encoding: "utf8", cwd, env });
  const back = spawnSync(process.execPath, [CLI, "doctor", "project"], { encoding: "utf8", cwd, env });
  const entry = projectEntry(cwd, home);
  return { wrote, out: back.stdout, entry, held: JSON.parse(readFileSync(entry, "utf8")) };
};

test("the shape the report prints is the shape that file holds, with the consequence each of the three carries", () => {
  const direct = ofProject({ slug: "demo", shape: "direct" });
  assert.match(direct.out, /\[ {2}ok {2}\] shape\s+direct — live only, so work is exercised on this box and preview is localhost {2}← \S+config\.json/u,
    "the word alone would leave every reader to infer the consequence, which is what the key exists to stop");
  assert.match(direct.out, new RegExp(escaped(direct.entry), "u"), "and the source is the file it was read from");
  assert.match(ofProject({ slug: "demo", shape: "staged" }).out,
    /\[ {2}ok {2}\] shape\s+staged — a preview deployment somebody opens, then live/u);
  assert.match(ofProject({ slug: "demo", shape: "storefront" }).out,
    /\[ {2}ok {2}\] shape\s+storefront — no repository here; the store is its own source of truth/u);
});

test("a project that declares no shape is told the key is unset rather than read at one of the three", () => {
  const { out } = ofProject({ slug: "demo" });
  assert.match(out, /\[ {2}ok {2}\] shape\s+unset, so nothing here says whether work is exercised on a deployment or on this box/u);
  for (const word of ["direct", "staged", "storefront"]) {
    assert.doesNotMatch(out, new RegExp(`shape\\s+${word}`, "u"),
      `a default nobody chose reads exactly like a declaration, and ${word} is not this project's`);
  }
});

/* The convention every key of this file keeps: a word the key does not take falls back rather than
   refusing a call that has nothing to do with it, and this report is the one surface that names it.
   Silent here would be worse than for the keys beside it, the fallback being the tracker's flag. */
test("a word the shape key does not take is named in the report rather than read as no declaration", () => {
  const { out } = ofProject({ slug: "demo", shape: "warehouse" });
  assert.match(out, /\[ miss \] shape\s+warehouse is no value of this key — it takes storefront, staged, direct/u);
  assert.match(out, /reading no shape at all/u, "and what it fell back to, so the reader knows what is in force");
});

test("the key is written by --set into this machine's record of the project, beside its slug", () => {
  const { held, entry, wrote } = set("direct");
  assert.deepEqual(held, { slug: "demo", shape: "direct" });
  assert.match(wrote.stdout, new RegExp(escaped(entry), "u"), "and the line it prints names the file it wrote");
});

test("a shape outside the set is refused by name, and the file is left as it was", () => {
  const { wrote, held } = set("warehouse");
  assert.notEqual(wrote.status, 0);
  assert.match(wrote.stderr, /is one of storefront, staged, direct, not `"warehouse"`/u,
    "the set is named in the refusal, and so is the value that is outside it");
  assert.deepEqual(held, { slug: "demo" }, "nothing was written");
});

test("both keys this project has not declared are listed by the undecided reading", () => {
  const { out } = ofProject({ slug: "demo" }, ["doctor", "undecided"]);
  assert.match(out, /^\[ {2}ok {2}\] shape\s+not set — forge doctor --set shape=<text>$/mu);
  assert.match(out, /^\[ {2}ok {2}\] release\s+not set — forge doctor --set release=<text>$/mu);
});
