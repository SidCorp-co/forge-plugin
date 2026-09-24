/* One command reads the readings store once, and a reading after the store changed is of the store as
   it now is (ISS-1510). Which reading answers is `marks.test.mjs`; what a pass rewrites, `prune.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { releaseMark, runsMark } from "../../../src/stats/eval/eval.mjs";
import { RUNS, marksOf, marksPath, scopeOf, writeMark } from "../../../src/stats/marks/marks.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { PROJECT, corpusOf } from "../fixture-eval.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-once-home-");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

/* Loaded into the spawned verb ahead of the CLI, it counts every whole-file read of the store and
   writes the count where the case names. Written at run time, so no file in the tree is a module
   nothing imports. */
const counter = () => {
  const room = tempRoom("stats-once-counter-");
  const path = join(room, "count-reads.mjs");
  writeFileSync(path, [
    'import fs from "node:fs";',
    'import { syncBuiltinESMExports } from "node:module";',
    "const read = fs.readFileSync;",
    "let reads = 0;",
    'fs.readFileSync = (path, ...rest) => { if (String(path).endsWith("eval-marks.jsonl")) reads += 1; return read(path, ...rest); };',
    "syncBuiltinESMExports();",
    'process.on("exit", () => fs.writeFileSync(process.env.COUNT_READS_TO, String(reads)));',
  ].join("\n"));
  return { preload: path, count: join(room, "reads") };
};

const readsOf = (argv, env) => {
  const { preload, count } = counter();
  const ran = spawnSync(FORGE, argv, {
    encoding: "utf8",
    env: { ...process.env, ...env, NODE_OPTIONS: `--import=${preload}`, COUNT_READS_TO: count },
  });
  return { ran, reads: Number(readFileSync(count, "utf8")) };
};

const inHome = async (home, fn) => {
  const was = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, TMPDIR: process.env.TMPDIR };
  process.env.XDG_CONFIG_HOME = home;
  try {
    return await fn();
  } finally {
    Object.assign(process.env, was);
  }
};

/* Criterion 1. A count reading and a release reading held, and the passes already run by the writes
   that held them, so every read the verb makes is one of the readings it asks for. */
test("one stats eval against a held reading reads the store once", async () => {
  const home = tempRoom("stats-once-eval-");
  await inHome(home, async () => {
    process.env.TMPDIR = corpusOf(50);
    assert.match(await runsMark(PROJECT), /held as mark 50/u);
    assert.match(await releaseMark(PROJECT, { version: "9.9.9" }), /held as 9\.9\.9/u);
  });
  const room = corpusOf(100);
  const { ran, reads } = readsOf(["stats", "eval", "--checkout", PROJECT, "--against", "50"],
    { XDG_CONFIG_HOME: home, TMPDIR: room, HOME: tempRoom("stats-once-user-") });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /held at mark 50/u, "the reading asked for is the one it compared against");
  assert.equal(reads, 1, "criterion 1: the store's bytes are read once for every reading of it the verb makes");
});

/* Criterion 2. The consult side's reading, over a log of two and a half windows. */
test("one codex eval against a held reading reads the store once", async () => {
  const home = tempRoom("stats-once-codex-");
  const log = join(home, "forge", "codex-log.jsonl");
  const rows = Array.from({ length: 250 }, (one, n) => ({
    kind: "consult", ok: true, id: `w${n}`, at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(),
    slot: "codex", model: "a-model", effort: "medium", ms: 20_000, root: "/r",
    usage: { input_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 200 },
    prompt: { v: 2, sha: "aaa" }, reply: "- **F1 — major:** `a.mjs:1` — a thing\nCODEX: 1 findings",
  }));
  const verdicts = rows.map((one) => ({ kind: "verdict", of: one.id, accepted: 1, rejected: 0, kept: ["F1"], dropped: {} }));
  mkdirSync(dirname(log), { recursive: true });
  writeFileSync(log, `${[...rows, ...verdicts].map((one) => JSON.stringify(one)).join("\n")}\n`);
  await inHome(home, async () => {
    const { evalObject } = await import("../../../src/codex/codex-stats.mjs");
    const stored = { kind: "consults", mark: 200, at: "2026-09-05T00:00:00.000Z",
      ...evalObject([...rows.slice(0, 200), ...verdicts.slice(0, 200)]) };
    assert.equal(writeMark(stored), "written");
  });
  const { ran, reads } = readsOf(["codex", "eval", "--against", "200"], { XDG_CONFIG_HOME: home });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /held at mark 200/u, "the reading asked for is the one it compared against");
  assert.equal(reads, 1, "criterion 2: the store's bytes are read once for every reading of it the verb makes");
});

const reading = (mark, extra = {}) => ({ kind: RUNS, mark, at: "2026-09-05T00:00:00.000Z", scope: scopeOf(PROJECT), ...extra });
const marksHeld = () => marksOf(RUNS, scopeOf(PROJECT));

/* Criterion 3. */
test("a reading after this process wrote a record returns that record", async () => {
  await inHome(tempRoom("stats-once-write-"), () => {
    assert.equal(writeMark(reading(50)), "written");
    assert.deepEqual(marksHeld().map((one) => one.mark), [50], "the store is read, and whatever keeps its bytes holds them");
    assert.equal(writeMark(reading(100)), "written");
    assert.deepEqual(marksHeld().map((one) => one.mark), [50, 100], "criterion 3: the record this process appended");
  });
});

/* Criterion 4. The append is a process of its own, finished before the second reading. */
test("a reading after another process appended a record returns that record", async () => {
  await inHome(tempRoom("stats-once-append-"), () => {
    assert.equal(writeMark(reading(50)), "written");
    assert.deepEqual(marksHeld().map((one) => one.mark), [50]);
    const line = `${JSON.stringify(reading(100))}\n`;
    const appended = spawnSync(process.execPath, ["-e",
      `require("node:fs").appendFileSync(${JSON.stringify(marksPath())}, ${JSON.stringify(line)})`]);
    assert.equal(appended.status, 0, String(appended.stderr));
    assert.deepEqual(marksHeld().map((one) => one.mark), [50, 100], "criterion 4: the record the other process appended");
  });
});

/* Criterion 5. The passes run once on an empty store, a record carrying a field the prune pass drops
   is appended by hand, read, and then the prune pass is owed again and rewrites the store. */
test("a reading after a pass rewrote the store returns the rewritten records", async () => {
  await inHome(tempRoom("stats-once-pass-"), () => {
    mkdirSync(dirname(marksPath()), { recursive: true });
    assert.deepEqual(marksHeld(), [], "the passes run over an empty store and leave their markers");
    appendFileSync(marksPath(), `${JSON.stringify(reading(50, { before: { runs: 1 } }))}\n`);
    assert.deepEqual(marksHeld().map((one) => one.before), [{ runs: 1 }], "the record as appended");
    rmSync(`${marksPath()}.pruned`);
    assert.deepEqual(marksHeld().map((one) => [one.mark, one.before]), [[50, undefined]],
      "criterion 5: the record as the pass rewrote it");
  });
});
