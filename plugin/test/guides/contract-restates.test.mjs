/* CLAUDE.md, Rules only: a rule with a checker is stated once, in the checker. The contract carried four hundred lines of what `forge advance --owed`, its refusals and each record kind's usage print, and nothing failed while they drifted (ISS-802). This measures it: every part's prose and every cell of its tables against what those three emit, the corpus being the module beside this one. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("contract-restates").path;
const { partsOf, readContract } = await import("../../src/guides/contract.mjs");
const { claims, compare } = await import("../../src/checks/duplication.mjs");
const { FAMILIES, FLOOR, THRESHOLD, corpusUnits } = await import("../corpus.mjs");

const CORPUS = corpusUnits();
const worstIn = (text) => compare(claims(text).map((one) => ["a part", one]), CORPUS, THRESHOLD, FLOOR)[0];

test("no part of the contract restates what the checks, the rung report or a kind's usage print", () => {
  assert.ok(CORPUS.length > 120, `${CORPUS.length} unit(s) of what the CLI prints; the corpus is broken`);
  assert.ok(Object.keys(FAMILIES).length >= 10, "the corpus reads fewer message families than it names");
  for (const part of partsOf(readContract())) {
    const mine = claims(part.text).map((one) => [part.keys[0], one]);
    const [worst] = compare(mine, CORPUS, THRESHOLD, FLOOR);
    assert.equal(worst, undefined, worst && `\`forge guide contract ${worst[1][0]}\` restates what the `
      + `CLI already prints (${worst[0].toFixed(2)}), so the rule has two homes and the copy nobody `
      + `corrects is this one. Cut it to the command that prints it.\n`
      + `  the contract: ${worst[1][1].replace(/\s+/gu, " ").slice(0, 160)}\n`
      + `  ${worst[2][0]}: ${worst[2][1].replace(/\s+/gu, " ").slice(0, 160)}`);
  }
});

/* The measure is proven by watching it fire, four ways: a part that copies a shortfall sentence, one that copies a short table cell, one that points at the command instead, and one sharing only the flow's vocabulary. The last two must pass, or a contract could not cite the verb it defers to. */
test("the measure catches a copied sentence and a copied cell, and passes a pointer", () => {
  const copied = "the plan is untyped — it carries none of the sections a typed plan owes, and each "
    + "section is opened by a heading whose text is its name";
  assert.ok(worstIn(`## A part\n\n${copied}\n`), "a sentence copied from a shortfall message is not caught");
  const cell = "| Scenario | Writes |\n|---|---|\n| the baseline's gate ran over part of the tree | "
    + "the baseline says the gate measured part of the tree, so what it did not run has no answer "
    + "and a green after it stands on nothing |\n";
  assert.ok(worstIn(`## A part\n\n${cell}`), "a rule copied into a table cell is not caught");
  assert.equal(worstIn("## A part\n\nWhat each row is earned by is `forge advance <ref> --owed`, for "
    + "the issue in hand rather than in general.\n"), undefined, "a pointer at the command is refused");
  assert.equal(worstIn("## A part\n\nA status is a promise to whoever reads the tracker next, and the "
    + "payload that earned it is what they may rely on.\n"), undefined,
  "sharing the flow's vocabulary is read as a restatement");
});
