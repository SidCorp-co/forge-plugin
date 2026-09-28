/* The proposer over an injected gateway, asker and writer: which fields are asked, which are written, what
   the correction's why carries, and what each line says. Nothing here reaches the tracker or a model;
   the end-to-end cases are plugin/test/tracker/filing/proposed-fields.test.mjs. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("fields").path;
const { absentIn, proposeFields, provenanceOf, switchesOf } = await import("../../../src/codex/proposed/fields.mjs");

const SCALE = { high: "a lost turn", low: "wording", none: "never asked for", urgent: "not a level" };
const ON = switchesOf({ complexityModel: "cx/luna", priorityModel: "cx/astra" }, SCALE);

/* Every dependency the proposer reaches, recorded, so a case reads what was asked and what was written. */
const faked = ({ answers = {}, problem = null, switches = ON } = {}) => {
  const asked = [];
  const wrote = [];
  const ask = (field) => async (_values, model, row, on) => {
    asked.push({ field, model, row, on });
    return answers[field] ?? { refused: `no answer for ${field}` };
  };
  return {
    asked,
    wrote,
    deps: {
      gateway: () => ({ problem, values: problem ? {} : { ANTHROPIC_BASE_URL: "http://g", ANTHROPIC_AUTH_TOKEN: "k" } }),
      ask: { priority: ask("priority"), complexity: ask("complexity") },
      effort: () => "medium",
      write: async (documentId, ref, written, occasion) => { wrote.push({ documentId, ref, written, occasion }); },
      switches: () => switches,
    },
  };
};

const ROW = { issueId: "ISS-7", title: "t", description: "b", category: "feature" };
const call = (absent, deps) => proposeFields({ documentId: "u-7", ref: "ISS-7", row: ROW, absent, occasion: "at filing" }, deps);

test("a field is absent where the priority is nobody's judgement or the complexity is missing, and present otherwise", () => {
  assert.deepEqual(absentIn({ priority: "none", complexity: null }), ["priority", "complexity"]);
  assert.deepEqual(absentIn({ priority: "high", complexity: "m" }), []);
  assert.deepEqual(absentIn({ priority: "low" }), ["complexity"]);
});

test("the record switches each field on by naming a model, and the priority only beside a scale it can judge on", () => {
  assert.deepEqual(ON.priority.levels, [["high", "a lost turn"], ["low", "wording"]], "levels in the tracker's order, the unjudged and the unknown left out");
  assert.equal(ON.complexity.model, "cx/luna");
  const bare = switchesOf({}, null);
  assert.match(bare.complexity.off, /names no `codex\.complexityModel`/u);
  assert.equal(bare.priority.route, "forge doctor --set codex.priorityModel=<model>");
  const noScale = switchesOf({ priorityModel: "cx/astra" }, {});
  assert.match(noScale.priority.off, /states no `priorities` scale/u);
  assert.equal(noScale.priority.route, "forge doctor --set priorities.high=<what earns it>");
  assert.match(switchesOf({ complexityModel: "  " }, null).complexity.off, /names no/u, "a blank model is no model");
});

test("only the absent fields are asked, each of its own model, and what came back is written once", async () => {
  const { asked, wrote, deps } = faked({ answers: {
    complexity: { proposed: "m", confidence: 0.8, why: "two modules" },
  } });
  const outcome = await call(["complexity"], deps);
  assert.deepEqual(asked.map((one) => [one.field, one.model]), [["complexity", "cx/luna"]]);
  assert.equal(asked[0].row, ROW, "the question reads the filing's own title, category and body");
  assert.deepEqual(wrote, [{ documentId: "u-7", ref: "ISS-7", occasion: "at filing",
    written: [{ field: "complexity", model: "cx/luna", value: "m", confidence: 0.8, why: "two modules" }] }]);
  assert.deepEqual(outcome.lines, ["complexity m proposed by cx/luna (confidence 0.80) and written."]);
});

test("the priority question is handed the levels the scale states", async () => {
  const { asked, deps } = faked({ answers: { priority: { proposed: "high", confidence: null, why: "a lost turn" } } });
  await call(["priority"], deps);
  assert.deepEqual(asked[0].on.levels, [["high", "a lost turn"], ["low", "wording"]]);
});

test("a proposal that fails writes nothing for its field and names the command that asks again", async () => {
  const { wrote, deps } = faked({ answers: { priority: { proposed: "low", confidence: 0.4, why: "wording" } } });
  const outcome = await call(["priority", "complexity"], deps);
  assert.deepEqual(wrote[0].written.map((one) => one.field), ["priority"], "the answered field is still written");
  assert.deepEqual(outcome.failed.map((one) => one.field), ["complexity"]);
  assert.equal(outcome.lines[1], "complexity left unset: the proposal by cx/luna failed — no answer for complexity. "
    + "Propose it again: forge issue ISS-7 --propose");
});

test("an answer carrying no reason is no proposal: its field is left unset and nothing is written for it", async () => {
  const { wrote, deps } = faked({ answers: { priority: { proposed: "high", confidence: 0.9, why: "  " } } });
  const outcome = await call(["priority"], deps);
  assert.deepEqual(wrote, []);
  assert.match(outcome.lines[0], /^priority left unset: the proposal by cx\/astra failed — the model gave no reason.*Propose it again: forge issue ISS-7 --propose$/u);
});

test("with no gateway nothing is asked and nothing is written, and each field says why", async () => {
  const { asked, wrote, deps } = faked({ problem: "no gateway endpoint" });
  const outcome = await call(["priority", "complexity"], deps);
  assert.deepEqual(asked, []);
  assert.deepEqual(wrote, []);
  assert.match(outcome.lines[0], /^priority left unset: the proposal by cx\/astra failed — there is no gateway to send it to — no gateway endpoint\. Propose it again/u);
});

test("a model the profile cannot resolve is a failure of its field, not of the call", async () => {
  const { asked, deps } = faked({ switches: switchesOf({ complexityModel: "nosuchslot" }, null) });
  const outcome = await call(["complexity"], deps);
  assert.deepEqual(asked, []);
  assert.match(outcome.lines[0], /^complexity left unset: the proposal by nosuchslot failed — `nosuchslot` is neither a gateway id nor a slot/u);
});

test("a field the record does not turn on is asked of nobody, and its line names the setting", async () => {
  const { asked, wrote, deps } = faked({ switches: switchesOf({}, null) });
  const outcome = await call(["priority"], deps);
  assert.deepEqual([asked, wrote], [[], []]);
  assert.deepEqual(outcome.lines, ["priority left unset: this project's record names no `codex.priorityModel`. "
    + "`forge doctor --set codex.priorityModel=<model>` turns its proposal on."]);
});

test("the correction's why names each field's model, its confidence and its sentence, and the call that replaces it", () => {
  const why = provenanceOf([
    { field: "priority", value: "high", model: "cx/astra", confidence: 0.6, why: "a lost turn" },
    { field: "complexity", value: "m", model: "cx/luna", confidence: null, why: "two modules" },
  ], "ISS-7", "at filing");
  assert.equal(why, "Proposed at filing and not judged by a reader: priority high by cx/astra (confidence 0.60) — a lost turn; "
    + "complexity m by cx/luna (no confidence given) — two modules. "
    + "A reader's `forge issue ISS-7 --set <field>=<value> --why <w>` replaces it.");
});
