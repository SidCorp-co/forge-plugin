import assert from "node:assert/strict";
import test from "node:test";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds the device's own log. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-effort-rung-");

const { compared, evalLines, windowObject } = await import("../../../src/codex/codex-stats.mjs");

const ROW = (n, held) => ({
  kind: "consult", ok: true, id: `r${n}`, at: new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString(),
  slot: "codex", root: "/r", reply: "CODEX: 0 findings", prompt: { v: 5, sha: "aaa" }, ...held,
});

/* The machine the issue was read on: no ladder, so every level resolved went out as the slot's one
   rung on the model id, and the level column described a treatment that never ran. */
const LADDERLESS = (n) => ROW(n, { model: "cx/gpt-6-astra-high", effortVia: "model", effort: ["low", "medium", "high"][n % 3] });

const effortOf = (window) => window.mix.effort;
const lineOf = (said, name) => said.split("\n").find((line) => line.startsWith(`  ${name} `));

test("the effort a window is counted by is the rung the request carried, never the level it resolved", () => {
  const window = windowObject([
    ...Array.from({ length: 6 }, (one, n) => LADDERLESS(n)),
    ROW(10, { model: "plain-model", effortVia: "parameter", effort: "low" }),
    ROW(11, { model: "plain-model", effort: "medium" }),
  ], []);
  assert.deepEqual(effortOf(window), { high: 6, low: 1, unrecorded: 1 },
    "the model channel counts its id's rung, the parameter its level, and a row naming no channel is unrecorded");
  assert.deepEqual(window.mix["effort resolved"], { low: 3, medium: 3, high: 2 }, "the level each row resolved, kept apart");
  for (const group of window.groups) {
    const expected = { "cx/gpt-6-astra-high": "high", "plain-model": group.effortVia === "parameter" ? "low" : "unrecorded" };
    assert.equal(group.effort, expected[group.model], `the group ${group.key} names the rung its requests carried`);
  }
});

test("the screen prints the rung, and the resolved level on its own line only where it says something else", () => {
  const now = Array.from({ length: 6 }, (one, n) => LADDERLESS(n + 100));
  const before = Array.from({ length: 6 }, (one, n) => LADDERLESS(n));
  const said = evalLines(compared(now, before, [], 12)).join("\n");
  assert.equal(lineOf(said, "effort"), "  effort  high 6 → 6", "one rung on both sides, as the model line says");
  assert.match(lineOf(said, "effort resolved"), /low 2 → 2/u);

  const plain = (n) => ROW(n, { model: "plain-model", effortVia: "parameter", effort: "medium" });
  const same = evalLines(compared([plain(100)], [plain(1)], [], 2)).join("\n");
  assert.equal(lineOf(same, "effort"), "  effort  medium 1 → 1");
  assert.equal(lineOf(same, "effort resolved"), undefined, "the parameter channel's two lines count the same thing");
});

test("a reading stored before the rung was tallied is re-tallied off its groups", () => {
  const live = windowObject(Array.from({ length: 6 }, (one, n) => LADDERLESS(n)), []);
  /* The shape a mark written before this change holds: the levels under `effort`, a group's effort its first row's level. */
  const { "effort resolved": resolved, ...older } = live.mix;
  const stored = {
    ...live,
    mix: { ...older, effort: resolved },
    groups: live.groups.map((group) => ({ ...group, effort: "low" })),
  };
  const held = compared(Array.from({ length: 6 }, (one, n) => LADDERLESS(n + 100)), [], [], 12, { mark: 6, now: stored });
  assert.deepEqual(effortOf(held.before), { high: 6 }, "the rung the stored groups' model ids carried");
  assert.deepEqual(held.before.mix["effort resolved"], resolved, "what it stored under effort, under the name it always meant");
  assert.deepEqual(held.before.groups.map((group) => group.effort), ["high"]);
  assert.deepEqual(Object.keys(held.before.mix), Object.keys(held.now.mix), "the dimensions line up with a live window's");
  assert.deepEqual(held.shifts.find((one) => one.name === "effort").values, [{ value: "high", now: 6, before: 6 }]);

  const current = compared([LADDERLESS(100)], [], [], 12, { mark: 6, now: live });
  assert.equal(current.before, live, "a reading that already holds the rung is read as it was written");
});
