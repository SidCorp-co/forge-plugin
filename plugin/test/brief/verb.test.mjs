/* The verb's output is readings and nothing else, and a record the gate can check it against. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";
import { RUN, brief, homeFor, repository } from "./fixture.mjs";

const repo = repository();

const READINGS = [/^ISS-\d+$/u, /^Tree: /u, /^FORGE_SESSION_ID=/u, /^TMPDIR=/u, /^Held by the other trees/u,
  /^ {2}\S/u, /^Plugin copy: /u, /^Restart owed: /u, /^Trees: /u];

test("with --tree, the brief names that tree's branch, head, run id and scratch directory", () => {
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-7\nTree: .*mine · branch mine · head [0-9a-f]{7}$/mu);
  assert.match(run.stdout, new RegExp(`^FORGE_SESSION_ID=${RUN}$`, "mu"));
  assert.match(run.stdout, new RegExp(`^TMPDIR=/tmp/forge-run-${RUN}$`, "mu"));
});

test("a tree whose git directory records no run gets no id or scratch line", () => {
  const run = brief(["ISS-7", "--tree", repo.idle], repo.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /FORGE_SESSION_ID=|TMPDIR=/u);
});

test("every other tree is listed with both readings, and an empty one says so", () => {
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, homeFor().env);
  assert.match(run.stdout, /committed against origin\/main:/u);
  assert.match(run.stdout, /busy \(busy\): committed: landed\.txt; uncommitted: open\.txt$/mu);
  assert.match(run.stdout, /idle \(idle\): reads empty$/mu);
  assert.doesNotMatch(run.stdout, /mine \(/u);
});

test("every line of the brief is a reading", () => {
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, homeFor().env);
  const lines = run.stdout.trim().split("\n");
  for (const line of lines) assert.ok(READINGS.some((one) => one.test(line)), `not a reading: ${line}`);
});

test("a flag the verb does not take is refused, and nothing is printed", () => {
  const run = brief(["ISS-7", "--note", "rebase first"], repo.main, homeFor().env);
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /--tree/u);
});

test("outside any checkout the brief still prints, and says no trees were read", () => {
  const run = brief(["ISS-7"], tempRoom("brief-nowhere-"), homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Trees: none read/mu);
});

test("a record that cannot be written prints no brief and names what failed", () => {
  const { env, home } = homeFor();
  const blocked = join(home, "not-a-directory");
  writeFileSync(blocked, "");
  const run = brief(["ISS-7"], repo.main, { ...env, XDG_CONFIG_HOME: blocked });
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /could not be written \(.*not-a-directory/u);
});
