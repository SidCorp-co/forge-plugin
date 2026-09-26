/* `--baseline` beside the slot wait, on real gates of one scratch: a baseline declined for the ceiling had no way
   to wait for a place and was retried by hand until one freed, the refusal reading every `--wait` as the verdict's
   (ISS-2568). The ceiling here is the case's own, one run at once, held by a gate that never leaves its step. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DECLINED } from "../../../gates/machine.mjs";
import { DEADLINE, DEFAULT_MINUTES } from "../../../gates/verdict.mjs";
import { escaped } from "../../../../plugin/test/fixtures.mjs";
import { configHome, git, HANGS_IN, heldGate, reachedTheStep, ROOT, run, runsFile, scratch, sibling, stopGate }
  from "../scratch.mjs";

const SLUG = "scratch-baseline-slot";
const WAITS_AGAIN = "node tools/gates.mjs --baseline ISS-7 --wait slot";

/* Two worktrees of a checkout that declares one run at once, the first holding the place. */
const held = async (name) => {
  const { at, work } = scratch(name, null, null, { hanging: HANGS_IN, runs: 1, slug: SLUG });
  const other = sibling(work);
  const first = heldGate(work, ["--full"]);
  await reachedTheStep(first, "the gate holding the place never reached its hanging step");
  return { at, work, other, first };
};

/* Everything the child has said so far, and a promise per line it is waited to say: it resolves on the chunk that
   completes the line and fails on the child's exit, so a case waits on the state and never on a clock. */
const heard = (child) => {
  const said = { text: "", waits: [] };
  const add = (chunk) => {
    said.text += chunk;
    said.waits = said.waits.filter((one) => !(said.text.includes(one.needle) && (one.done(), true)));
  };
  child.stdout.on("data", add);
  child.stderr.on("data", add);
  child.once("exit", (code) => {
    for (const one of said.waits) one.fail(new Error(`${one.why}: it exited ${code}\n${said.text}`));
  });
  return said;
};

const until = (said, needle, why) => new Promise((done, fail) => {
  if (said.text.includes(needle)) done();
  else said.waits.push({ needle, why, done, fail });
});

test("a baseline that waits for a place measures once one frees, as a gate every other gate counts", async () => {
  const { at, work, other, first } = await held("baseline-slot-measures");
  const waiter = heldGate(other, ["--baseline", "ISS-7", "--wait", "slot", String(DEFAULT_MINUTES)]);
  const said = heard(waiter);
  try {
    await until(said, "gate wait: watching", "the baseline never began waiting for a place");
    assert.ok(!said.text.includes("Nothing is published for"), `it measured with every place held:\n${said.text}`);
    await stopGate(first);
    await reachedTheStep(waiter, "the baseline never reached a step once the place freed");
    const head = git(other, "rev-parse", "HEAD").stdout.trim();
    assert.ok(said.text.includes(`forge record baseline ISS-7 --gate "npm run check" --result "<what already fails>" `
      + `--commit ${head} --scope whole`), `the write to record is not the bare baseline's:\n${said.text}`);
    const third = run(work, ["--full"]);
    assert.equal(third.status, DECLINED, `${third.stdout}${third.stderr}`);
    const counted = [...third.stderr.matchAll(new RegExp(`pid (\\d+) {2}gating ${escaped(other)}`, "gu"))];
    assert.equal(counted.length, 1, `the measuring baseline was not counted:\n${third.stderr}`);
    const pid = Number(counted[0][1]);
    assert.notEqual(pid, waiter.pid, "what was counted is the waiting process, not the gate measuring");
    const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    assert.ok(argv.includes("--baseline") && !argv.includes("--wait"), `the counted gate runs ${argv.join(" ")}`);
  } finally {
    await Promise.all([stopGate(first), stopGate(waiter)]);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a baseline whose wait runs out spends no step, exits as a deadline, and names the call that waits again", async () => {
  const { at, other, first } = await held("baseline-slot-deadline");
  try {
    const said = run(other, ["--baseline", "ISS-7", "--wait", "slot", "0.02"]);
    assert.equal(said.status, DEADLINE, `${said.stdout}${said.stderr}`);
    assert.ok(said.stderr.includes(`Wait again, in a call that returns:\n  ${WAITS_AGAIN}\n`)
      || said.stderr.endsWith(`Wait again, in a call that returns:\n  ${WAITS_AGAIN}`),
    `the deadline names no baseline wait:\n${said.stderr}`);
    assert.ok(!said.stdout.includes("Nothing is published for"), `it measured anyway:\n${said.stdout}`);
    assert.ok(!existsSync(runsFile(other)), "a baseline that never got a place spent a step");
  } finally {
    await stopGate(first);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a baseline declined for the place names the one call that waits for it, and a wait past a call's life is refused", async () => {
  const { at, other, first } = await held("baseline-slot-declined");
  try {
    const declined = run(other, ["--baseline", "ISS-7"]);
    assert.equal(declined.status, DECLINED, `${declined.stdout}${declined.stderr}`);
    assert.ok(declined.stderr.includes(`in the same call: ${WAITS_AGAIN}\n`), declined.stderr);
    const tooLong = run(other, ["--baseline", "ISS-7", "--wait", "slot", String(DEFAULT_MINUTES + 0.001)]);
    assert.equal(tooLong.status, 1, `${tooLong.stdout}${tooLong.stderr}`);
    assert.ok(tooLong.stderr.includes("the most a call can hold is"), tooLong.stderr);
    assert.ok(!`${tooLong.stdout}${tooLong.stderr}`.includes("gate wait: watching"), "it began the wait it refused");
  } finally {
    await stopGate(first);
    rmSync(at, { recursive: true, force: true });
  }
});

test("a head a ship published is cited beside the slot wait without waiting for the place", async () => {
  const { at, work, other, first } = await held("baseline-slot-cited");
  try {
    const head = git(other, "rev-parse", "HEAD").stdout.trim();
    const dir = join(configHome(work), "forge");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "gate-baselines.jsonl"), `${JSON.stringify({ project: SLUG, commit: head,
      gate: "npm run check", result: "nothing fails", scope: "whole", version: "9.9.9", at: new Date().toISOString() })}\n`);
    const said = run(other, ["--baseline", "ISS-7", "--wait", "slot", "0.02"]);
    assert.equal(said.status, 0, `${said.stdout}${said.stderr}`);
    assert.ok(said.stdout.includes(`--commit ${head} --scope whole --cited "the ship's gate at release 9.9.9"`), said.stdout);
    assert.ok(!said.stderr.includes("gate wait: watching"), `a cited head waited for a place:\n${said.stderr}`);
  } finally {
    await stopGate(first);
    rmSync(at, { recursive: true, force: true });
  }
});

test("the verdict wait beside --baseline is still refused and runs nothing, and -h names the slot wait", () => {
  const { at, work } = scratch("baseline-slot-verdict", null, null, { slug: SLUG });
  try {
    for (const wait of [["--wait"], ["--wait", "5"]]) {
      const said = run(work, ["--baseline", "ISS-7", ...wait]);
      assert.equal(said.status, 1, `${wait.join(" ")}: ${said.stdout}${said.stderr}`);
      assert.ok(said.stderr.includes("--baseline is the baseline and --wait is not part of one"), said.stderr);
      assert.ok(!existsSync(runsFile(work)), `--baseline ${wait.join(" ")} ran the gate`);
    }
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
  const help = run(ROOT.replace(/\/$/u, ""), ["-h"]).stdout;
  assert.ok(help.includes("The one wait\n             it takes is --wait slot [M]"), help);
});
