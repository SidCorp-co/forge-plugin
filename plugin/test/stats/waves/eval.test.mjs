/* The wave eval is the run eval's envelope over waves: the last `size` folded waves against the
   `size` before, with the copy each dispatcher ran as what separates them (ISS-460). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("waves-eval-");
const { dispatch, fold, row, standing, took } = await import("../fixture-waves.mjs");
const { evalWaves } = await import("../../../src/stats/waves/eval.mjs");

/* Five waves on one headline, each an hour apart: the last two cost more and went wrong more. */
const WAVES = [
  { start: 0, long: 10, extra: 0 },
  { start: 60, long: 10, extra: 0 },
  { start: 120, long: 20, extra: 1, disposed: true },
  { start: 180, long: 30, extra: 2, handedBack: true },
  { start: 240, long: 50, extra: 4, replaced: true },
];
const callsOf = (one, index) => [
  [one.start, "forge next"],
  [one.start + 1, `forge record wave ISS-1 --member ISS-${index + 2} --role forge:runner --session w${index}`],
  ...(one.replaced ? [[one.start + 2, `forge record wave ISS-1 --member ISS-${index + 2} --role forge:runner --session again`]] : []),
  ...(one.disposed ? [[one.start + 3, "forge record confirmation ISS-9 --finding already-fixed --evidence x"]] : []),
  ...Array.from({ length: one.extra }, (_, n) => [one.start + 4 + n, "git status --short"]),
  [one.start + one.long, `forge record fold ISS-1 --summary wave-${index}`],
];
const PAGE = WAVES.flatMap((one, index) => [
  dispatch(one.start + 1, [`ISS-${index + 2}`], `w${index}`),
  ...(one.replaced ? [dispatch(one.start + 2, [`ISS-${index + 2}`], "again")] : []),
  fold(one.start + one.long, `wave-${index}`),
]);
const ISSUES = [row(1, "open"), ...WAVES.map((one, index) => row(index + 2, "closed", one.handedBack
  ? { sessionContext: { lease: { holder: "run", history: [took(one.start + 5, "head-owed")] } } } : {}))];

test("the last two folded waves against the two before, with each window's figures", async () => {
  const { tracker, forge } = await standing(ISSUES, { "uuid-1": PAGE }, { dispatcher: WAVES.flatMap(callsOf) });
  try {
    const json = await forge("stats", "eval", "--waves", "--size", "2", "--checkout", "/fixture/waves", "--json");
    assert.equal(json.status, 0, json.stderr);
    const held = JSON.parse(json.stdout);
    assert.equal(held.total, 5);
    assert.deepEqual(held.before.summaries, ["wave-1", "wave-2"]);
    assert.deepEqual(held.now.summaries, ["wave-3", "wave-4"]);
    const figures = (one) => [one.medianMinutes, one.medianCalls, one.handBacks, one.replaced, one.dispositions];
    /* Minutes run from each wave's `forge next` to its fold's stamp, two seconds past the call. */
    assert.deepEqual(figures(held.before), [15, 4, 0, 0, 1]);
    assert.deepEqual(figures(held.now), [40, 6.5, 1, 1, 0]);

    const shown = await forge("stats", "eval", "--waves", "--size", "2", "--checkout", "/fixture/waves");
    assert.equal(shown.status, 0, shown.stderr);
    assert.match(shown.stdout, /median minutes +15 → 40/u);
    assert.match(shown.stdout, /Both windows ran the same plugin copies\./u);

    const short = await forge("stats", "eval", "--waves", "--size", "3", "--checkout", "/fixture/waves");
    assert.equal(short.status, 0, short.stderr);
    assert.match(short.stdout, /5 folded wave\(s\) held for this project; a comparison of 3 against 3 needs 6\./u);
  } finally {
    tracker.close();
  }
});

/* Rows as the profile hands them over, so the copy and the cut are the only thing that differs. */
const waveRow = (copy, to, cut = []) => ({
  headline: "ISS-1", state: "folded", summary: to, to, minutes: 10, calls: 5, copy,
  handBacks: 1, handBacksCut: cut, replaced: [], dispositions: {},
});

test("the copy each wave ran separates the windows, and a cut history keeps its window a lower bound", () => {
  const held = evalWaves([
    waveRow("3.36.1", "2026-09-20T01:00:00.000Z"),
    waveRow("3.36.1", "2026-09-20T02:00:00.000Z", ["ISS-7"]),
    waveRow("3.36.2", "2026-09-20T03:00:00.000Z"),
    waveRow("3.36.2", "2026-09-20T04:00:00.000Z"),
  ], 2);
  assert.deepEqual(held.before.tallies, { copy: { "3.36.1": 2 } });
  assert.deepEqual(held.now.tallies, { copy: { "3.36.2": 2 } });
  assert.deepEqual(held.shifts.map((one) => one.name), ["copy"]);
  assert.equal(held.before.handBacksCut, 1);
  assert.equal(held.now.handBacksCut, 0);
});

test("--waves is refused beside a run anchor before anything is read", async () => {
  const { project, tracker, forge } = await standing([row(1, "open")], {}, {}, null, ["forge_issues", "forge_comments"]);
  try {
    for (const flag of ["--against", "--since-release"]) {
      const refused = await forge("stats", "eval", "--waves", flag);
      assert.equal(refused.status, 1);
      assert.match(refused.stderr, new RegExp(`--waves compares waves read now, and ${flag} anchors`, "u"), refused.stderr);
      assert.match(refused.stderr, /forge stats eval --waves$/mu);
    }
    assert.deepEqual(project.calls, []);
  } finally {
    tracker.close();
  }
});
