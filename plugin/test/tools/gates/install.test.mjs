/* A dangling install moves no tracked file and no manifest, so every entry of the record still matches
   and the one step that cannot run is the one skipped. What the runner reads before a digest (ISS-885). */
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { entryNames, landed, run, scratch, touchedEverywhere } from "./scratch.mjs";

const DECLARED = { widget: "^1.0.0" };
const GREEN = /=== ledger: (\d+) of \d+ step\(s\) green already ===/u;

/* An installed package read as an untracked path would refuse this tree as dirty and read as a tracked
   one would widen every run for a path no step claims, so it is ignored before the first install. */
const install = (work) => {
  landed(work, ".gitignore", "node_modules/\n");
  mkdirSync(join(work, "node_modules", "widget"), { recursive: true });
  writeFileSync(join(work, "node_modules", "widget", "package.json"), JSON.stringify({ name: "widget" }));
};

// A step that really loads the package, so the tree has one that cannot run rather than one told to exit non-zero for a reason of this case's own.
const NEEDS = { step: "check:spec", command: `node -e "require('widget/package.json')"` };

// Sorted, because the order is the record's own: cheapest first by the seconds each step last took, which a loaded machine moves between two runs of one tree.
const spentIn = (said) => [...said.matchAll(/^=== (\S+) ===$/gmu)].map((one) => one[1]).sort();

// How many steps the record answered for, `null` where it was never opened: a run finding nothing green prints the block a run skipping half the table prints.
const heldBy = (said) => {
  const found = GREEN.exec(said);
  return found === null ? null : Number(found[1]);
};

/* One tree taken through the whole sequence, because each state is only meaningful against the one
   before it: a run that skips nothing proves nothing unless the run before it skipped something. */
const { work } = scratch("gate-install", null, null, { declares: DECLARED });
install(work);
touchedEverywhere(work, "one");
const cold = run(work).stdout;
const warm = run(work).stdout;
touchedEverywhere(work, "two");
rmSync(join(work, "node_modules", "widget"), { recursive: true });
const held = entryNames(work);
const broken = run(work).stdout;
const after = entryNames(work);
install(work);
run(work);
const healed = run(work).stdout;

test("the record this tree keeps is the one a skip is taken on", () => {
  assert.equal(heldBy(cold), 0);
  assert.ok(heldBy(warm) > 0);
});

test("a declared package that does not resolve leaves every planned step spent", () => {
  assert.equal(heldBy(broken), null);
  assert.deepEqual(spentIn(broken), spentIn(cold));
});

test("the line saying why the record went unread names the package", () => {
  assert.match(broken, /=== ledger: digests not read — widget does not resolve under node_modules/u);
});

test("that same line carries the command that puts it back", () => {
  assert.match(broken.split("digests not read").at(1), /Run `npm install`\./u);
});

test("no pass is recorded for a step spent while a declared package does not resolve", () => {
  assert.deepEqual(after, held);
});

test("the record is taken on again once the package resolves", () => {
  assert.ok(heldBy(healed) > 0);
});

test("a step that cannot run for the missing package refuses the gate under its own label", () => {
  const tree = scratch("gate-install-red", null, null, { declares: DECLARED, needing: NEEDS }).work;
  install(tree);
  touchedEverywhere(tree, "one");
  assert.equal(run(tree).status, 0);
  rmSync(join(tree, "node_modules", "widget"), { recursive: true });
  const said = run(tree);
  assert.notEqual(said.status, 0);
  assert.match(said.stderr, new RegExp(`Gate failed: ${NEEDS.step}`, "u"));
});
