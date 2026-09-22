/* What a level resolves to and which channel carries it. The gateway states a model's effort in the
   model id, so two channels for one value is a contradiction it resolves silently — these cases are
   what stops one being sent. A subject of its own because `codex-plan.test.mjs` is at the code lines
   one file may hold and `plugin/test/codex/` at the files one directory may. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds a working token and the rung
   table is read off that same file. */
const HOME = tempRoom("forge-codex-effort-");
mkdirSync(join(HOME, "forge"));
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", retrySeconds: 0 }));
process.env.XDG_CONFIG_HOME = HOME;

const {
  defaultEffort,
  disagreement,
  effortFor,
  effortVia,
  kindOf,
  plannedFor,
  rungFor,
  rungIn,
  rungLadder,
} = await import("../../../src/codex/codex-plan.mjs");
const { userConfig } = await import("../../../src/resolve/config.mjs");

/* The write `saveConfig` makes without the file: the config object is memoised, so a reader called
   after this sees what a hand-edited `codex.rungs` would have left. */
const configured = (codex) => {
  delete userConfig().codex;
  if (codex) userConfig().codex = codex;
};

const SIZES = { small: 40, large: 400 };

test("the size moves the effort one level in either direction, and no further", () => {
  assert.equal(effortFor({ base: "medium", lines: 100, ...SIZES }), "medium");
  assert.equal(effortFor({ base: "medium", lines: 12, ...SIZES }), "low");
  assert.equal(effortFor({ base: "medium", lines: 900, ...SIZES }), "high");
  assert.equal(effortFor({ base: "high", lines: 900, ...SIZES }), "high", "clamped at the top");
  assert.equal(effortFor({ base: "minimal", kind: "recheck" }), "minimal", "and at the bottom");
});

/* The kind is a statement about the job and the size is a guess from its width, so the kind wins:
   a recheck of a thousand-line diff is still the narrower question. */
test("the kind outranks the size, and moves it one level whatever the width", () => {
  assert.equal(effortFor({ base: "medium", kind: "recheck", lines: 900, ...SIZES }), "low",
    "a recheck is a narrower question whatever the diff's size");
  assert.equal(effortFor({ base: "medium", kind: "bodies", lines: 12, ...SIZES }), "high",
    "a whole-set pass reads every file it holds, however little of it moved");
  assert.equal(effortFor({ base: "medium", kind: "verify", lines: 12, ...SIZES }), "high",
    "a ruling on named risks is asked for whatever the diff's size");
  assert.equal(effortFor({ base: "medium", kind: "diff", lines: 900, ...SIZES }), "high",
    "the ordinary diff is the one kind that says nothing, so the size decides it");
});

test("one consult is one kind, the recheck first and the ordinary diff last", () => {
  assert.equal(kindOf({ recheck: true, bodies: true, risks: 2 }), "recheck");
  assert.equal(kindOf({ bodies: true, risks: 2 }), "verify");
  assert.equal(kindOf({ bodies: true }), "bodies");
  assert.equal(kindOf({}), "diff");
});

test("a consult naming a risk is planned as a ruling rather than as a diff of its size", () => {
  const parts = [{ rel: "a.mjs", text: "x\n".repeat(12) }];
  assert.equal(plannedFor({ parts, bodies: false, recheck: false }).kind, "diff");
  const ruling = plannedFor({ parts, bodies: false, recheck: false, risks: 2 });
  assert.equal(ruling.kind, "verify");
  assert.equal(ruling.effort, "high", "one step above the medium base, not two");
});

test("a rung the model's own id states is read off it, and anything else states none", () => {
  assert.equal(rungIn("cx/gpt-6-astra-high"), "high");
  assert.equal(rungIn("cx/gpt-6-astra-minimal"), "minimal");
  assert.equal(rungIn("cx/gpt-6-astra"), null, "the bare id is the base and names no rung");
  assert.equal(rungIn("cx/gpt-6-astra-zzz"), null, "a suffix that is no level of ours is not a rung");
  assert.equal(rungIn(null), null);
  assert.equal(effortVia("cx/gpt-6-astra-low"), "model");
  assert.equal(effortVia("cx/gpt-5.6-sol"), "parameter");
});

test("the level names the model, a level the table misses falls to the base rung, and an empty table to the slot", () => {
  configured({ rungs: { low: "cx/gpt-6-astra-low", medium: "cx/gpt-6-astra-medium" } });
  assert.equal(rungFor("low", "slotted"), "cx/gpt-6-astra-low", "the level the table names");
  assert.equal(rungFor("high", "slotted"), "cx/gpt-6-astra-medium",
    "no high rung, so the base rung the table does name");
  configured({ rungs: { low: "cx/gpt-6-astra-low" } });
  assert.equal(rungFor("high", "slotted"), "slotted",
    "no high rung and no base rung either, so the one slot the profile maps");
  configured({});
  assert.equal(rungFor("medium", "slotted"), "slotted", "a machine declaring no table reaches what it always did");
  assert.equal(rungFor("medium", null), null, "and one declaring neither resolves nothing to refuse on");
  assert.deepEqual(rungLadder(), [], "an absent table is no ladder");
});

test("a rung whose value is not a level of ours is not offered as one", () => {
  configured({ rungs: { medium: "cx/gpt-6-astra-medium", turbo: "cx/gpt-6-astra-high" } });
  assert.deepEqual(rungLadder(), [["medium", "cx/gpt-6-astra-medium"]]);
  configured({ rungs: ["cx/gpt-6-astra"] });
  assert.deepEqual(rungLadder(), [], "an array is no table");
  assert.equal(rungFor("medium", "slotted"), "slotted");
});

/* The whole point of the report: a reader given the model alone cannot tell a ladder from one slot
   frozen at a rung, and the second is what every consult on this device ran under. */
test("a model stating a rung other than the level the rule decided is the disagreement", () => {
  assert.equal(disagreement("medium", "cx/gpt-6-astra-high"), "high");
  assert.equal(disagreement("high", "cx/gpt-6-astra-high"), null, "the id and the level agree");
  assert.equal(disagreement("medium", "cx/gpt-5.6-sol"), null, "an id stating no rung disagrees with nothing");
});

test("the base is medium where nothing declares one, and the declaration is read where there is one", () => {
  configured({});
  assert.equal(defaultEffort(), "medium");
  configured({ effort: "low" });
  assert.equal(defaultEffort(), "low");
  configured({});
});

/* A table naming only the rung a consult lands on is complete: the level is settled from the plan
   this consult already has, so no level it could never ask for has to resolve for it to run. */
test("a table naming one rung answers every consult that lands on it, with no slot behind it", () => {
  configured({ rungs: { high: "cx/gpt-6-astra-high" } });
  const parts = [{ rel: "a.mjs", text: "x\n".repeat(12) }];
  for (const [named, over] of [["bodies pass", { bodies: true }], ["risk ruling", { risks: 2 }]]) {
    const { effort } = plannedFor({ parts, bodies: false, recheck: false, ...over });
    assert.equal(effort, "high", `a ${named} over a small diff still lands on high from the medium base`);
    assert.equal(rungFor(effort, null), "cx/gpt-6-astra-high", "and that rung resolves with no profile slot behind it");
  }
  configured({});
});
