/* A dangling install is the break that reads as a clean tree: nothing in the manifest moved, so every
   check keyed on the manifest still passes and the report says nothing. What each state of an install
   earns here, and what the report may never do about it (ISS-885). */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { installRows } from "../../../src/tools/services/doctor-install.mjs";
import { tempRoom } from "../../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "cli.mjs");

const installed = (at, name, manifest = { name, version: "1.0.0" }) => {
  mkdirSync(join(at, "node_modules", name), { recursive: true });
  writeFileSync(join(at, "node_modules", name, "package.json"), JSON.stringify(manifest));
};

/* The project's own root and never this checkout's: a case reading the repository it runs in would
   pass on a developer's box and say nothing about either answer. */
const project = (name, manifest, holds = []) => {
  const at = tempRoom(`install-${name}-`);
  if (manifest) writeFileSync(join(at, "package.json"), JSON.stringify(manifest));
  for (const one of holds) installed(at, one);
  return at;
};

const rowIn = (at) => installRows(at)[0] ?? null;

const DEV = { devDependencies: { widget: "^1.0.0" } };

test("a package declared under either section and not installed is named by the row", () => {
  assert.match(rowIn(project("dev", DEV)).detail, /widget/u);
  assert.match(rowIn(project("prod", { dependencies: { gadget: "^2.0.0" } })).detail, /gadget/u);
});

test("the row naming them is a miss carrying the command that installs them", () => {
  const row = rowIn(project("miss", DEV));
  assert.equal(row.level, "miss");
  assert.equal(row.label, "dependencies");
  assert.match(row.detail, /npm install/u);
});

test("a package resolves by its own manifest being readable, wherever above the project it sits", () => {
  const at = project("here", DEV, ["widget"]);
  assert.equal(rowIn(at).level, undefined);
  const above = tempRoom("install-above-");
  installed(above, "widget");
  const under = join(above, "packages", "one");
  mkdirSync(under, { recursive: true });
  writeFileSync(join(under, "package.json"), JSON.stringify(DEV));
  assert.equal(rowIn(under).level, undefined);
});

test("a package whose manifest exposes no root entry point resolves like any other", () => {
  const at = project("exports", DEV);
  installed(at, "widget", { name: "widget", exports: { "./only": "./only.js" } });
  assert.equal(rowIn(at).level, undefined);
});

test("an optional or a peer entry is not a dependency this reads", () => {
  const at = project("other-sections", {
    optionalDependencies: { widget: "^1.0.0" },
    peerDependencies: { gadget: "^2.0.0" },
  });
  assert.equal(rowIn(at), null);
});

test("a project with nothing installed at all has every declared package named", () => {
  const row = rowIn(project("bare", { dependencies: { one: "1", two: "2" }, devDependencies: { three: "3" } }));
  assert.equal(row.level, "miss");
  for (const name of ["one", "two", "three"]) assert.match(row.detail, new RegExp(name, "u"));
});

test("every declared package resolving is one ok row counting them", () => {
  const row = rowIn(project("whole", { dependencies: { one: "1" }, devDependencies: { two: "2" } }, ["one", "two"]));
  assert.equal(row.level, undefined);
  assert.match(row.detail, /2 declared, every one resolves/u);
});

test("no manifest, no project root and a Plug'n'Play loader are each silence rather than a finding", () => {
  assert.deepEqual(installRows(project("no-manifest", null)), []);
  assert.deepEqual(installRows(null), []);
  const pnp = project("pnp", DEV);
  writeFileSync(join(pnp, ".pnp.cjs"), "module.exports = {};\n");
  assert.deepEqual(installRows(pnp), []);
});

/* The one case that runs the verb rather than the reading: a row this composes and the report never
   prints is a green report in front of a tree that cannot lint. */
test("the report prints the row and leaves the install exactly as it found it", () => {
  const at = project("reported", DEV, ["widget"]);
  rmSync(join(at, "node_modules", "widget", "package.json"));
  writeFileSync(join(at, ".forge.json"), JSON.stringify({ slug: "scratch" }));
  const before = readdirSync(at, { recursive: true }).sort();
  const home = tempRoom("install-home-");
  const run = spawnSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8", cwd: at, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  assert.match(run.stdout, /\[ miss \] dependencies\s+1 of 1 declared do not resolve under node_modules: widget — npm install/u);
  assert.deepEqual(readdirSync(at, { recursive: true }).sort(), before);
  assert.equal(readFileSync(join(at, "package.json"), "utf8"), JSON.stringify(DEV));
});
