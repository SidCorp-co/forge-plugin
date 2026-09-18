/* A declaration is a ceiling somebody wrote against a test file, so the table is only as good as
   its keys: one naming a file git no longer reports, or a claim over a path git tracks nothing at,
   saves nothing and reads exactly like a table that works. Neither is a gate condition — both are
   inert, and refusing the gate for them would refuse every tree the table was not written for, the
   scratch checkouts this suite builds among them (ISS-1761). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { DECLARED_READS, TEST_FILE } from "../../../../tools/gates/steps.mjs";
import { under } from "../../../../tools/gates/scope.mjs";

const ROOT = new URL("../../../..", import.meta.url).pathname;

const tracked = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).stdout.trim().split("\n");
const tests = tracked.filter((one) => TEST_FILE.test(one));

test("the table this checks is the real one, and it reaches every entry of it", () => {
  assert.ok(tests.length > 200, `git reports ${tests.length} test files, so the list is not this suite's`);
  assert.ok(DECLARED_READS.length > 0, "an empty table passes every case below without asserting anything");
  for (const one of DECLARED_READS) {
    assert.ok(Array.isArray(one.reads) && one.reads.length > 0, `${one.where} declares no path`);
    assert.equal(typeof one.blind, "string", `${one.where} names no blindness it was declared against`);
    assert.ok(one.blind.length > 0, `${one.where} names no blindness it was declared against`);
  }
});

test("every declaration names a test file git reports, so none of them saves nothing", () => {
  const gone = DECLARED_READS.filter((one) => !tests.includes(one.where)).map((one) => one.where);
  assert.deepEqual(gone, [], "delete these from DECLARED_READS in tools/gates/steps.mjs, or name the "
    + "file each was written for: a key matching no test file narrows nothing and nothing says so");
});

test("every claim names a path git tracks, so no ceiling is written over nothing", () => {
  const absent = DECLARED_READS.flatMap((one) => one.reads
    .filter((claim) => claim !== "." && !tracked.some((each) => under(each, claim)))
    .map((claim) => `${claim} for ${one.where}`));
  assert.deepEqual(absent, [], "correct these in tools/gates/steps.mjs: a claim over a path git "
    + "tracks nothing at contributes an absent listing and no content, so it widens no ceiling");
});

test("no test file is declared twice, since which paths it may read would have no answer", () => {
  const seen = new Set();
  const twice = DECLARED_READS.map((one) => one.where).filter((one) => seen.size === seen.add(one).size);
  assert.deepEqual(twice, [], "leave one entry per file in tools/gates/steps.mjs");
});
