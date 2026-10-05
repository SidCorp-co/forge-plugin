/* The landing gates the whole tree on every change, so a criterion whose outcome is that gate passing
   is met by every change and shows nothing this issue moved. Refused at the write, narrowly: a
   criterion about the gate's own behaviour names another outcome. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { projectRoom, tempRoom } from "../../../fixtures.mjs";
import { gateCriteria, gateCriteriaRefused } from "../../../../src/flow/record/fields.mjs";

const DECLARED = { gate: ["npm run check", "node tools/gates.mjs"] };
const numbered = (...texts) => texts.map((text, at) => ({ number: at + 1, text }));
const caught = (criteria, declared) => {
  try {
    gateCriteriaRefused(criteria, declared);
  } catch (error) {
    return String(error.message);
  }
  return null;
};

test("a criterion that the declared gate passes is refused by number, with what to write instead", () => {
  const said = caught(numbered("The list is sorted by name.", "`npm run check` passes."), DECLARED);
  assert.match(said, /^Criterion 2 names the whole-tree gate passing as the outcome, so nothing was written:/u);
  assert.match(said, /^ {2}2\. `npm run check` passes\.$/mu, "the line itself, as it was sent");
  assert.match(said, /the landing gates the whole tree on every change; a criterion names the outcome this issue changes and the case that shows it/iu);
  assert.match(said, /Rewrite 2 as that, or drop it/u);
  for (const text of [
    "WHEN the change lands THEN `node tools/gates.mjs --full` SHALL pass.",
    "npm run check exits 0 on the branch.",
    "`npm run check` stays green.",
    "`node tools/gates.mjs` succeeds.",
  ]) assert.equal(gateCriteria(numbered(text), DECLARED).length, 1, `a pass of the declared gate: ${text}`);
});

test("the generic forms of the whole suite passing are refused whatever the project declared", () => {
  for (const text of [
    "The whole gate passes.",
    "The full suite is green.",
    "the whole suite stays green",
    "The entire test suite passes.",
    "THEN the whole gate (`make verify`) SHALL pass.",
  ]) {
    assert.equal(gateCriteria(numbered(text), DECLARED).length, 1, `with a gate declared: ${text}`);
    assert.equal(gateCriteria(numbered(text), null).length, 1, `and with none: ${text}`);
  }
  assert.match(caught(numbered("The whole gate passes.", "The full suite is green."), null),
    /^Criteria 1, 2 name the whole-tree gate passing/u);
});

test("a criterion about the gate's own behaviour, or one file's suite, is written", () => {
  for (const text of [
    "`node tools/gates.mjs -h` names every flag.",
    "node tools/gates.mjs --help exits 0 and lists the steps.",
    "`npm run check` refuses a file holding a stray comment.",
    "The changed file's full suite passes.",
    "`node --test plugin/test/gates/landing-gate.test.mjs` passes.",
  ]) assert.equal(caught(numbered(text), DECLARED), null, text);
});

test("where the project declares no gate, its command passing is not read as the gate", () => {
  assert.equal(caught(numbered("`npm run check` passes."), null), null, "a command nobody declared is any command");
  assert.equal(caught(numbered("`npm run check` passes."), { gate: "make verify" }), null,
    "and another project's gate is not this one's");
});

test("the write refuses it before any tracker is asked", (t) => {
  const room = tempRoom("gate-passing-");
  t.after(() => rmSync(room, { recursive: true, force: true }));
  const at = join(room, "repo");
  mkdirSync(at);
  projectRoom(at, room, { slug: "fixture", stats: { commands: { gate: "npm run check" } } });
  writeFileSync(join(at, "criteria.md"), "1. The list is sorted by name.\n2. `npm run check` passes.\n");
  const run = spawnSync(new URL("../../../../bin/forge", import.meta.url).pathname, ["record", "criteria", "ISS-1", "criteria.md"],
    { cwd: at, encoding: "utf8", env: { ...process.env, HOME: room, XDG_CONFIG_HOME: room } });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^Criterion 2 names the whole-tree gate passing/mu, run.stderr);
});
