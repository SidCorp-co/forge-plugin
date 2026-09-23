/* `--baseline` on a scratch checkout: a head a ship published is cited and spends no step, a head
   nothing published is measured the way a bare gate measures it, and `--full` beside it is refused.
   The run it replaces spent a fourteen-step `--full` on a head the ship had already measured
   (ISS-2291). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { configHome, git, ROOT, run, runsFile, scratch } from "../scratch.mjs";

const SLUG = "scratch-baseline";
const RESULT = "nothing fails: all 14 gate step(s) green at this commit";

const baselineScratch = (name) => scratch(name, null, null, { slug: SLUG });

const headOf = (work) => git(work, "rev-parse", "HEAD").stdout.trim();

const publish = (work, commit) => {
  const dir = join(configHome(work), "forge");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "gate-baselines.jsonl"), `${JSON.stringify({ project: SLUG, commit,
    gate: "npm run check", result: RESULT, scope: "whole", version: "9.9.9", at: new Date().toISOString() })}\n`);
};

test("a head a ship published is cited and no step is spent", () => {
  const { at, work } = baselineScratch("baseline-cited");
  try {
    const head = headOf(work);
    publish(work, head);
    const said = run(work, ["--baseline", "ISS-7"]);
    assert.equal(said.status, 0, said.stderr);
    assert.ok(said.stdout.includes(`forge record baseline ISS-7 --gate "npm run check" --result "${RESULT}" `
      + `--commit ${head} --scope whole --cited "the ship's gate at release 9.9.9"`), said.stdout);
    assert.ok(!existsSync(runsFile(work)), `a cited baseline ran the gate:\n${said.stdout}`);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a head nothing published is measured reading the record, and the write to record is printed", () => {
  const { at, work } = baselineScratch("baseline-fresh");
  try {
    const head = headOf(work);
    const said = run(work, ["--baseline", "ISS-7"]);
    assert.equal(said.status, 0, said.stderr);
    assert.ok(said.stdout.includes(`Nothing is published for ${head}`), said.stdout);
    assert.ok(said.stdout.includes(`forge record baseline ISS-7 --gate "npm run check" --result "<what already fails>" `
      + `--commit ${head} --scope whole`), said.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

/* What the gate decided, and nothing a run's timing or temp path varies: the scope, the record read and
   each step's spend line. A baseline that ran `--full` underneath prints no ledger and spends on other
   grounds, so any drift from the bare call shows here. */
const decided = (stdout) => stdout.split("\n").filter((line) => /^(=== scope:|=== ledger:|spend )/u.test(line));

test("the measured baseline decides every step exactly as a bare call on the same tree does", () => {
  const bare = baselineScratch("baseline-bare");
  const measuredTree = baselineScratch("baseline-measured");
  try {
    const plain = run(bare.work, []);
    const measured = run(measuredTree.work, ["--baseline", "ISS-7"]);
    assert.equal(measured.status, plain.status, measured.stderr);
    assert.ok(decided(plain.stdout).some((line) => line.startsWith("=== ledger:")), plain.stdout);
    assert.deepEqual(decided(measured.stdout), decided(plain.stdout));
  } finally {
    rmSync(bare.at, { recursive: true, force: true });
    rmSync(measuredTree.at, { recursive: true, force: true });
  }
});

test("a baseline asked of one tree's gate from inside another is refused as the wrong tree, not cited", () => {
  const gate = baselineScratch("baseline-gate");
  const other = baselineScratch("baseline-other");
  try {
    publish(gate.work, headOf(other.work));
    const said = run(gate.work, ["--baseline", "ISS-7"], other.work);
    assert.equal(said.status, 1, said.stdout);
    assert.ok(said.stderr.includes("A gate aimed at the wrong tree does not fail, it certifies"), said.stderr);
    assert.ok(!said.stdout.includes("--cited"), said.stdout);
  } finally {
    rmSync(gate.at, { recursive: true, force: true });
    rmSync(other.at, { recursive: true, force: true });
  }
});

test("--baseline beside --full is refused, naming the baseline command, and runs nothing", () => {
  const { at, work } = baselineScratch("baseline-full");
  try {
    const said = run(work, ["--baseline", "ISS-7", "--full"]);
    assert.equal(said.status, 1);
    assert.ok(said.stderr.includes("Take the baseline: node tools/gates.mjs --baseline ISS-7"), said.stderr);
    assert.ok(!existsSync(runsFile(work)), "a refused baseline ran the gate");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("-h lists --baseline ahead of --full, and says --full is not the baseline route", () => {
  const said = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  assert.ok(said.indexOf("  --baseline [ISS-nn]") > 0 && said.indexOf("  --baseline [ISS-nn]") < said.indexOf("  --full "), said);
  assert.ok(said.includes("is never the baseline route"), said);
});
