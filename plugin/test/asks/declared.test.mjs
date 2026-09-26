/* What a question says about itself: the declaration it ends with, and the subjects that are the
   owner's whatever it declares. */
import assert from "node:assert/strict";
import test from "node:test";

import { OWNER_CATEGORIES, namedCategories, ownerCategories, ownersBefore, reversalOf } from "../../src/asks/declared.mjs";

const asked = (question, labels = ["Parser first (Recommended)", "Renderer first"], extra = {}) =>
  ({ question, header: "Order", options: labels.map((label) => ({ label })), ...extra });

test("a question declares its reversal only in the trailing form, and one without it is the owner's", () => {
  assert.equal(reversalOf(asked("Which slice first? [reversible: git revert the slice commit]")), "git revert the slice commit");
  assert.equal(reversalOf(asked("Which slice first? [reversible: ] ")), null, "an empty declaration declares nothing");
  assert.equal(reversalOf(asked("[reversible: x] Which slice first?")), null, "and it is the question's last words or nothing");
  assert.equal(ownersBefore(asked("Which slice first?")), "it declares no reversal");
  assert.equal(ownersBefore(asked("Which slice first? [reversible: reorder the steps]")), null);
});

test("a declared question naming any built-in owner category is the owner's, wherever in it the words sit", () => {
  const cases = [
    ["a secret or credential", asked("How should I supply the gateway token? [reversible: unset it]")],
    ["spend", asked("Should the plan buy the larger tier? [reversible: downgrade]")],
    ["a production or outward-facing write", asked("Which order? [reversible: redo]", ["Deploy now", "Wait"])],
    ["discarding work the owner holds", asked("Which order? [reversible: redo]", ["Keep it", "Discard it"])],
    ["filing or dropping product work", asked("Which order? [reversible: redo]", ["As one", "Split in three"])],
    ["a contract others build against", asked("How should progress reach the browser? [reversible: swap]", ["SSE", "WebSocket"])],
  ];
  for (const [name, question] of cases) {
    assert.deepEqual(namedCategories(question), [name], question.question);
    assert.match(ownersBefore(question), new RegExp(`it names ${name}`, "u"));
  }
  const described = asked("Which order? [reversible: redo]", ["Keep it"]);
  described.options.push({ label: "Tidy it", description: "removes the old helper" });
  assert.ok(ownersBefore(described), "an option's description is read too");
  assert.equal(namedCategories(asked("Which slice first? [reversible: git reset --hard the slice]")).length, 0,
    "while the declaration itself is how it is undone, not a subject");
});

test("a term the project lists sends a question naming it to the owner", () => {
  const question = asked("Which currency rounding do you want? [reversible: change the rounding flag]");
  assert.equal(ownersBefore(question, ownerCategories([])), null);
  assert.match(ownersBefore(question, ownerCategories(["currency rounding"])), /`currency rounding` \(asks\.owner\)/u);
  assert.equal(ownersBefore(asked("Which currency? [reversible: x]"), ownerCategories(["currency rounding"])), null,
    "a whole phrase, not a word of it");
});

test("no project list removes a built-in owner category", () => {
  const names = OWNER_CATEGORIES.map((one) => one.name);
  for (const terms of [[], ["spend"], ["a secret or credential"], [".*"], [""]]) {
    const held = ownerCategories(terms).map((one) => one.name);
    for (const name of names) assert.ok(held.includes(name), `${JSON.stringify(terms)} kept ${name}`);
  }
  assert.equal(ownersBefore(asked("Which slice first? [reversible: reorder]"), ownerCategories([".*"])), null,
    "and a pattern in the list is a phrase to find, never a pattern that matches everything");
});
