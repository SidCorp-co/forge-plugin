#!/usr/bin/env node
/* The plugin cache is keyed by the manifest's number and `npm version` moves the other file, so a
   release that moves one installs nowhere. Run from the package being bumped. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative } from "node:path";

const HERE = process.cwd();
const found = spawnSync("git", ["ls-files", "*.claude-plugin/plugin.json"], { cwd: HERE, encoding: "utf8" });
if (found.status !== 0) {
  process.stderr.write(`sync-manifest-version: git could not list ${HERE}\n`);
  process.exit(1);
}

/* A manifest belongs to the nearest package.json above it: a nested package syncs its own. */
const ownedHere = (rel) => {
  let dir = dirname(join(HERE, rel));
  while (relative(HERE, dir) !== "" && !relative(HERE, dir).startsWith("..")) {
    if (existsSync(join(dir, "package.json"))) return false;
    dir = dirname(dir);
  }
  return true;
};

const manifests = found.stdout.split("\n").filter(Boolean).filter(ownedHere);
if (manifests.length !== 1) {
  process.stderr.write(`sync-manifest-version: ${manifests.length} manifests belong to ${HERE}, expected one\n`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const [manifest] = manifests;
const held = JSON.parse(readFileSync(manifest, "utf8"));
if (held.version !== version) {
  writeFileSync(manifest, `${JSON.stringify({ ...held, version }, null, 2)}\n`);
}
spawnSync("git", ["add", manifest], { cwd: HERE });
process.stdout.write(`${manifest} ships ${version}\n`);
