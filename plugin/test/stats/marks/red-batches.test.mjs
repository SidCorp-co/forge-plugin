/* The red-batch records a landing writes, read back as the figure `stats runs` and the daily page
   print: each set counted by how it was resolved, its gates beside what landing every member alone
   would have spent, and a set whose resolution is missing or unusable counted as unknown (ISS-2490). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync } from "node:fs";

import { BATCHES, marksOf, marksPath } from "../../../src/stats/marks/marks.mjs";
import {
  ALONE, ATTRIBUTED, SPLIT, UNREAD, batchOpened, batchResolved, redBatchLine, redBatchesOver,
} from "../../../src/stats/marks/red-batches.mjs";
import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("stats-red-batches-home-");

const SCOPE = "checkout:/work/app";
const set = (batch, at, members, resolution) => [
  { kind: BATCHES, scope: SCOPE, batch, phase: "opened", at, members },
  ...(resolution ? [{ kind: BATCHES, scope: SCOPE, batch, phase: "resolved", at, members, alone: [], back: [],
    rounds: 0, ...resolution }] : []),
];
const AT = "2026-09-25T10:00:00.000Z";

test("each resolved red set is counted by its outcome, and its gates sit beside one per member plus the combined one", () => {
  const records = [
    ...set("a", AT, ["ISS-1", "ISS-2", "ISS-3"], { outcome: ATTRIBUTED, gates: 2, back: ["ISS-1"] }),
    ...set("b", AT, ["ISS-4", "ISS-5", "ISS-6", "ISS-7"], { outcome: SPLIT, gates: 5, rounds: 2, back: ["ISS-7"] }),
    ...set("c", AT, ["ISS-8", "ISS-9"], { outcome: ALONE, gates: 1, alone: ["ISS-8", "ISS-9"] }),
  ];
  const held = redBatchesOver(SCOPE, null, null, records);
  assert.deepEqual(held, { sets: 3, attributed: 1, split: 1, rounds: 2, oneByOne: 1, unknown: 0, spent: 10, alone: 12 });
  assert.equal(redBatchLine(held), "red batches     3 red set(s) recorded: 1 attributed by paths, 1 split over 2 round(s), "
    + "1 landed one by one, 0 unknown · the 3 resolved spent 10 gate(s) where landing each member alone would have spent 12");
});

test("a red set whose opening has no resolution is unknown and adds to neither gate sum", () => {
  const records = [
    ...set("a", AT, ["ISS-1", "ISS-2"], { outcome: ATTRIBUTED, gates: 2 }),
    ...set("dead", AT, ["ISS-3", "ISS-4", "ISS-5"], null),
  ];
  const held = redBatchesOver(SCOPE, null, null, records);
  assert.equal(held.sets, 2);
  assert.equal(held.unknown, 1);
  assert.equal(held.spent, 2, "the unresolved set's members add no gate");
  assert.equal(held.alone, 3, "and no alone baseline either");
});

test("a resolution with no whole-number gate figure, or one that reads unread, is unknown and adds to neither gate sum", () => {
  const records = [
    ...set("a", AT, ["ISS-1", "ISS-2"], { outcome: SPLIT, gates: 1.5 }),
    ...set("b", AT, ["ISS-3", "ISS-4"], { outcome: ATTRIBUTED, gates: null }),
    ...set("c", AT, ["ISS-5", "ISS-6"], { outcome: UNREAD, gates: 3 }),
  ];
  const held = redBatchesOver(SCOPE, null, null, records);
  assert.equal(held.unknown, 3);
  assert.equal(held.spent, 0);
  assert.equal(held.alone, 0);
  assert.equal(held.split + held.attributed + held.oneByOne, 0);
});

test("a window counts only the sets opened inside it", () => {
  const records = [
    ...set("old", "2026-09-20T10:00:00.000Z", ["ISS-1", "ISS-2"], { outcome: ATTRIBUTED, gates: 2 }),
    ...set("new", AT, ["ISS-3", "ISS-4"], { outcome: ATTRIBUTED, gates: 2 }),
  ];
  assert.equal(redBatchesOver(SCOPE, Date.parse("2026-09-24T00:00:00.000Z"), null, records).sets, 1);
  assert.equal(redBatchesOver(SCOPE, null, Date.parse("2026-09-24T00:00:00.000Z"), records).sets, 1);
  assert.equal(redBatchLine(redBatchesOver(SCOPE, Date.now() + 1, null, records)),
    "red batches     none recorded, so no red set's gates are read");
});

test("the opening and the resolution a landing writes are read back from the store as one set", () => {
  const opened = batchOpened({ root: "/work/app", members: ["ISS-1", "ISS-2"], candidate: "c0ffee", pin: "beef",
    strategy: "attribute-then-split" });
  batchResolved(opened, { outcome: ATTRIBUTED, gates: 2, back: ["ISS-1"] });
  const records = marksOf(BATCHES, opened.scope);
  assert.deepEqual(records.map((one) => one.phase), ["opened", "resolved"]);
  assert.equal(records[0].candidate, "c0ffee");
  assert.deepEqual(records[1].back, ["ISS-1"]);
  assert.deepEqual(redBatchesOver(opened.scope), { sets: 1, attributed: 1, split: 0, rounds: 0, oneByOne: 0,
    unknown: 0, spent: 2, alone: 3 });
});

test("a record the store refuses is said, and the write returns rather than throwing", (t) => {
  const was = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = tempRoom("stats-red-batches-shut-");
  /* A directory where the store's file goes: every append to it fails, and at once. */
  mkdirSync(marksPath(), { recursive: true });
  const said = [];
  t.mock.method(console, "error", (line) => said.push(line));
  try {
    const opened = batchOpened({ root: "/work/app", members: ["ISS-1", "ISS-2"], candidate: "c0ffee", pin: "beef",
      strategy: "attribute-then-split" });
    batchResolved(opened, { outcome: ATTRIBUTED, gates: 2 });
    const all = said.join("\n");
    assert.match(all, /red batch: the red set's opening is not on record, so `forge stats runs` counts this set as unknown; the landing goes on as it would have\./u);
    assert.match(all, /red batch: how the red set of ISS-1 ISS-2 was resolved is not on record/u);
  } finally {
    process.env.XDG_CONFIG_HOME = was;
  }
});
