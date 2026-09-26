/* `forge stats daily` under a borrowing run home: the device the daily fixture makes stands as the
   machine, and a fresh home borrowing its config is the run's. The registry the verb walks is the one
   directory a project-scoped call reads its record from, so a home holding no record lists the
   machine's projects and a home holding one lists its own alone (ISS-2631). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { NAME, daysAgo, device, envOf } from "./fixture-daily.mjs";
import { FORGE } from "../fixture-runs.mjs";
import { BORROW_VAR } from "../../../src/resolve/machine/borrowed.mjs";

/** The machine's device, its config.json for the borrow to name, and a run home holding nothing. */
const borrowingDevice = () => {
  const held = device({ days: [daysAgo(3)] });
  writeFileSync(join(held.home, "forge", "config.json"), "{}\n");
  const home = join(held.room, "run-home");
  mkdirSync(home);
  return { ...held, runHome: home };
};

const daily = (held, ...argv) => spawnSync(FORGE, ["stats", "daily", ...argv], {
  encoding: "utf8",
  cwd: held.room,
  env: envOf(held, { XDG_CONFIG_HOME: held.runHome, [BORROW_VAR]: join(held.home, "forge", "config.json") }),
});

test("a borrowing home with no record of its own reads a day the machine's registered project ran on", () => {
  const held = borrowingDevice();
  const run = daily(held, "--json", "--day", daysAgo(3));
  assert.equal(run.status, 0, run.stderr);
  const content = JSON.parse(run.stdout);
  assert.ok(content.projects.some((one) => one.name === NAME), `the machine's project is read:\n${run.stdout.slice(0, 2000)}`);
  assert.equal(existsSync(join(held.runHome, "forge", "projects")), false, "and the run home holds no project record after it");
});

test("that home's refusal names the machine's projects directory as where the registry was read", () => {
  const held = borrowingDevice();
  const run = daily(held, "--day", daysAgo(9));
  assert.equal(run.status, 1, run.stdout);
  assert.ok(run.stderr.includes(`${daysAgo(9)} is earlier than anything this device still holds`), run.stderr);
  assert.ok(run.stderr.includes(`registered projects were read from ${join(held.home, "forge", "projects")}.`), run.stderr);
});

test("a borrowing home holding a record of its own lists that record alone and names its own directory", () => {
  const held = borrowingDevice();
  const own = join(held.runHome, "forge", "projects", "own-project");
  mkdirSync(own, { recursive: true });
  writeFileSync(join(own, "config.json"), JSON.stringify({ slug: "own-slug" }));
  const run = daily(held, "--day", daysAgo(3));
  /* The machine's project is the only one that ran, so a registry holding it would read the day. */
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No day is held yet/u, run.stderr);
  assert.ok(run.stderr.includes(`registered projects were read from ${join(held.runHome, "forge", "projects")}.`), run.stderr);
});
