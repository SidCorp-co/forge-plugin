/* A release takes its two readings off one read of the transcript corpus, and prints what each
   reading prints when it reads the corpus for itself (ISS-495). */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import { tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { PROJECT, corpusOf, rootOf } from "../../../../plugin/test/stats/fixture-eval.mjs";

process.env.HOME = tempRoom("readings-once-user-");

const { releaseReadings } = await import("../../../run/release/readings.mjs");
const { releaseMark, runsMark } = await import("../../../../plugin/src/stats/eval/eval.mjs");

const RELEASE = { version: "9.9.1", head: "abc1234", issues: ["ISS-495"] };

/* A fresh readings store over the corpus the room holds, so no reading one case holds is another's. */
const inRoom = async (room, fn) => {
  const was = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, TMPDIR: process.env.TMPDIR };
  process.env.XDG_CONFIG_HOME = tempRoom("readings-once-home-");
  process.env.TMPDIR = room;
  try {
    return await fn();
  } finally {
    Object.assign(process.env, was);
  }
};

/* Every whole-file read of a transcript under the room's corpus, by path, while `fn` runs. */
const readsDuring = async (room, fn) => {
  const under = rootOf(room);
  const read = fs.readFileSync;
  const reads = new Map();
  fs.readFileSync = (path, ...rest) => {
    if (String(path).startsWith(under)) reads.set(String(path), (reads.get(String(path)) ?? 0) + 1);
    return read(path, ...rest);
  };
  syncBuiltinESMExports();
  try {
    return { value: await fn(), reads };
  } finally {
    fs.readFileSync = read;
    syncBuiltinESMExports();
  }
};

const alone = (room) => inRoom(room, async () => [await runsMark(PROJECT), await releaseMark(PROJECT, RELEASE)]);

const released = (room) => inRoom(room, () => readsDuring(room, async () => {
  const said = [];
  await releaseReadings(PROJECT, RELEASE, (line) => said.push(line));
  return said;
}));

test("a release at a crossing reads each transcript once and prints both lines as each reading prints them", async () => {
  const room = corpusOf(50);
  const [count, release] = await alone(room);
  assert.match(count, /^stats: 50 issue-flow runs/u, "the corpus is at a crossing");
  const { value: said, reads } = await released(room);
  assert.equal(reads.size, 50, "criterion 1: every transcript in the corpus is read");
  assert.deepEqual([...new Set(reads.values())], [1], "criterion 1: and each of them once");
  assert.deepEqual(said, [`  ${count}`, `  ${release}`], "criterion 2: the count line and the release line, word for word");
});

test("a release short of a crossing reads each transcript once and prints the release line alone", async () => {
  const room = corpusOf(49);
  const [count, release] = await alone(room);
  assert.equal(count, null, "the corpus is short of a crossing");
  const { value: said, reads } = await released(room);
  assert.equal(reads.size, 49, "criterion 1: every transcript in the corpus is read");
  assert.deepEqual([...new Set(reads.values())], [1], "criterion 1: and each of them once");
  assert.deepEqual(said, [`  ${release}`], "criterion 3: the release line alone, word for word");
});
