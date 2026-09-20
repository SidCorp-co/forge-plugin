/* A goal CLAUDE.md names is answered by the requirements tree or by nothing, which is a different
   question from the claims the checkout itself answers — and the reason the tree is not on the path
   of the gate that reads a CLAUDE.md write. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { checkGoals } from "../../src/checks/claude-md-goals.mjs";
import { tempRoom } from "../fixtures.mjs";

const fixture = () => {
  const root = tempRoom("cm-goals-");
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  return root;
};

/* The goal table of a requirements tree, in the notation `docs/requirements/` states: one bold
   identifier per row, so `specTreeAt` reads clauses out of it rather than the words around them. */
function withGoals(root, ...ids) {
  mkdirSync(path.join(root, "docs", "requirements", "brd"), { recursive: true });
  const rows = ids.map((id) => `| **${id}** A goal this tree states. | |`).join("\n");
  writeFileSync(
    path.join(root, "docs", "requirements", "brd", "03-goals-non-goals.md"),
    `# Goals\n\n## Goals\n\n*What is this product for?*\n\n| Goal | Met by |\n|---|---|\n${rows}\n`,
  );
  return root;
}

/* The defect this check was written for: ISS-1764 found G-11, G-12 and G-13 primary in CLAUDE.md
   and in the brief while the tree's table still ran the pre-fold ten, and `forge spec G-11` refused
   the identifier. Nothing failed, because a goal was no claim to this reader at all. */
test("a goal CLAUDE.md names that the tree defines no clause for is a claim that failed", () => {
  const root = withGoals(fixture(), "G-01", "G-12");
  const text = "Two goals rank above the rest: `G-11` and `G-12`, and `G-01` stands behind them.\n";
  assert.deepEqual(checkGoals(text, root).uncitedGoals, ["G-11"]);
});

test("a goal is read from the tree's clauses, not from a mention anywhere in the repository", () => {
  const root = withGoals(fixture(), "G-01");
  writeFileSync(path.join(root, "scripts", "mentions.mjs"), 'const ADDED = "G-11";\n');
  assert.deepEqual(checkGoals("The goal `G-11` settles it.\n", root).uncitedGoals, ["G-11"]);
});

/* The tree's grammar carries a sub-numbered identifier, and a second grammar written here read
   `G-11-1` as `G-11`: the claim was then answered by a clause nobody had named. */
test("a goal is spelled the way the tree spells it, sub-number and all", () => {
  const root = withGoals(fixture(), "G-11");
  assert.deepEqual(checkGoals("The goal `G-11-1` settles it.\n", root).uncitedGoals, ["G-11-1"]);
  assert.deepEqual(checkGoals("The goal `G-11` settles it.\n", withGoals(fixture(), "G-11-1")).uncitedGoals, ["G-11"]);
  assert.deepEqual(checkGoals("The goal `G-11-1` settles it.\n", withGoals(fixture(), "G-11-1")).uncitedGoals, []);
});

test("a project that keeps no requirements tree is told nothing about the goals it names", () => {
  const root = fixture();
  assert.deepEqual(checkGoals("The goal `G-11` settles it.\n", root), { uncitedGoals: [] });
});
