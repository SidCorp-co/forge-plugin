/* The verb's output is readings and nothing else, and a record the gate can check it against. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { escaped, tempRoom } from "../fixtures.mjs";
import { RUN, brief, homeFor, repository } from "./fixture.mjs";
import { besideGit, runIdAt, runsFor } from "../../src/resolve/session/run-id.mjs";

const repo = repository();

const READINGS = [/^ISS-\d+$/u, /^Tree: /u, /^FORGE_SESSION_ID=/u, /^TMPDIR=/u, /^XDG_CONFIG_HOME=/u, /^Held by the other trees/u,
  /^ {2}\S/u, /^Plugin copy: /u, /^Restart owed: /u, /^Trees: /u];

test("with --tree, the brief names that tree's branch, head, run id, scratch directory and borrowing route", () => {
  const home = homeFor();
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, home.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ISS-7\nTree: .*mine · branch mine · head [0-9a-f]{7}$/mu);
  assert.match(run.stdout, new RegExp(`^FORGE_SESSION_ID=${RUN}$`, "mu"));
  assert.match(run.stdout, new RegExp(`^TMPDIR=/tmp/forge-run-${RUN}$`, "mu"));
  /* The line `run.mjs start` prints, so a dispatched run borrows rather than copying the credential. */
  assert.match(run.stdout, new RegExp(`^XDG_CONFIG_HOME=/tmp/forge-run-${RUN}/home FORGE_BORROW_FROM=${
    escaped(join(home.config, "forge", "config.json"))}$`, "mu"));
});

test("a brief naming no issue leaves a tree that records no run without an id or a scratch line", () => {
  const fresh = repository();
  const run = brief(["--tree", fresh.idle], fresh.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /FORGE_SESSION_ID=|TMPDIR=|XDG_CONFIG_HOME=/u);
  assert.equal(runIdAt(fresh.idle), null, "no key names what an id would be minted for, so none is");
});

/* The dispatch is where a run is bound to its issues, and the brief is the plugin verb every dispatch
   runs: a tree no repository tool minted for gets its id here, or its run can never be placed (ISS-1682). */
test("a brief naming an issue gives a tree that records no run an id naming that issue", () => {
  const fresh = repository();
  const run = brief(["ISS-7", "--tree", fresh.idle], fresh.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  const minted = runIdAt(fresh.idle);
  assert.deepEqual(runsFor(minted), ["iss-7"], `the brief wrote ${minted}`);
  assert.match(run.stdout, new RegExp(`^FORGE_SESSION_ID=${minted}$`, "mu"), "and printed the id it wrote");
});

test("a batch is minted into one id at the first brief, the key first and each batchmate after it", () => {
  const fresh = repository();
  const run = brief(["ISS-7", "--batch", "ISS-8,ISS-9", "--tree", fresh.idle], fresh.main, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  const minted = runIdAt(fresh.idle);
  assert.deepEqual(runsFor(minted), ["iss-7", "iss-8", "iss-9"], `the brief wrote ${minted}`);
  assert.ok(run.stdout.split("\n").includes(`FORGE_SESSION_ID=${minted}`), `the brief printed:\n${run.stdout}`);
});

test("an id already naming the issue, as its head or as a batchmate, is printed as it stands", () => {
  const fresh = repository();
  writeFileSync(besideGit(fresh.idle, "forge-run-id"), "iss-7+8-0123abcd\n");
  for (const key of ["ISS-7", "ISS-8"]) {
    const run = brief([key, "--tree", fresh.idle], fresh.main, homeFor().env);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^FORGE_SESSION_ID=iss-7\+8-0123abcd$/mu, key);
    assert.equal(runIdAt(fresh.idle), "iss-7+8-0123abcd", `${key} left the id as it was`);
  }
});

/* Never extended: the run that id names may still be standing in the tree, and a new id takes its
   holder away from every lease it has. */
test("a tree whose id does not name the issue, or a batchmate, refuses the brief and keeps its id", () => {
  const fresh = repository();
  for (const args of [["ISS-8"], ["ISS-7", "--batch", "ISS-8"]]) {
    const run = brief([...args, "--tree", fresh.mine], fresh.main, homeFor().env);
    assert.notEqual(run.status, 0, `${args.join(" ")} was briefed into a tree minted for ISS-7`);
    assert.equal(run.stdout, "", "and no brief is printed");
    assert.match(run.stderr, new RegExp(`already holds the run id ${RUN}, which names ISS-7 and not ISS-8`, "u"));
    assert.match(run.stderr, /git worktree add <new tree> && forge brief/u, "naming the way to a tree of its own");
    assert.equal(runIdAt(fresh.mine), RUN, "the id stands as it was");
  }
});

test("a key the id grammar cannot carry is refused where the brief would mint, and nothing is written", () => {
  const fresh = repository();
  const run = brief(["ABC-3", "--tree", fresh.idle], fresh.main, homeFor().env);
  assert.notEqual(run.status, 0, "an id minted for ABC-3 would name no issue the claim can place");
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /ABC-3 cannot go into a run id, which names only ISS- keys/u);
  assert.equal(runIdAt(fresh.idle), null);
});

test("a batch is refused without a tree to mint it into, and without a key to lead it", () => {
  const fresh = repository();
  for (const args of [["ISS-7", "--batch", "ISS-8"], ["--batch", "ISS-8", "--tree", fresh.idle]]) {
    const run = brief(args, fresh.main, homeFor().env);
    assert.notEqual(run.status, 0, args.join(" "));
    assert.equal(run.stdout, "");
    assert.match(run.stderr, /--batch .* is read only with a key and --tree/su);
  }
  assert.equal(runIdAt(fresh.idle), null, "and nothing was minted");
});

test("a batch naming the key twice, or naming something that is no key, is refused", () => {
  const fresh = repository();
  const twice = brief(["ISS-7", "--batch", "ISS-7", "--tree", fresh.idle], fresh.main, homeFor().env);
  assert.notEqual(twice.status, 0);
  assert.match(twice.stderr, /names ISS-7 or one of its keys twice/u);
  const junk = brief(["ISS-7", "--batch", "eight", "--tree", fresh.idle], fresh.main, homeFor().env);
  assert.notEqual(junk.status, 0);
  assert.match(junk.stderr, /`eight` is none/u);
  assert.equal(runIdAt(fresh.idle), null);
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
