/* The Simplifier's rules: what it is told to look for, what it is told is not its own, and that a
   consult reviewed without it is sent none of them. Its findings are placed under it the way every
   angle's are, off the shipped table, so the stats need no second list. */
import assert from "node:assert/strict";
import test from "node:test";
import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-simplify-home-");
const { roleFor } = await import("../../../src/codex/codex-api.mjs");
const { anglesOfFindings } = await import("../../../src/codex/log/replies.mjs");
const { anglesOf } = await import("../../../src/codex/stats/figures.mjs");

const said = roleFor(["tech", "debt", "simplify"]);

test("the Simplifier is told to name what the checkout already has, by path and symbol", () => {
  assert.match(said, /Reuse: code the change writes that the checkout already has/u);
  assert.match(said, /the \*\*Fix\*\* names the path and symbol to call instead/u);
});

test("the Simplifier is told to name a copy where one shared shape belongs, or a layer with one caller", () => {
  assert.match(said, /Abstraction: a mechanism copied where one shared shape belongs, and a layer, wrapper, option or indirection with one caller/u);
});

test("the Simplifier is told to name work the change makes the code do twice or for nothing", () => {
  assert.match(said, /Efficiency: work the change makes the code do twice or for nothing/u);
});

test("each Simplifier fix states the lines it saves or the work it stops", () => {
  assert.match(said, /Each Simplifier \*\*Fix\*\* states the lines it saves or the work it stops\./u);
});

test("a shorter shape that changes behaviour is no Simplifier finding", () => {
  assert.match(said, /A shorter shape that changes what the code does is no Simplifier finding/u);
});

test("a test repeating a contract is the Debt Reviewer's, and the debt rules still name it", () => {
  assert.match(said, /A test repeating a contract is the Debt Reviewer's and no Simplifier finding/u);
  assert.ok(said.includes("a contract run again at a second layer that holds no risk of its own"),
    "the debt rule the Simplifier defers to is still sent");
});

test("the copied mechanism is the Simplifier's alone: the debt rules no longer name it", () => {
  const debt = roleFor(["debt"]);
  assert.ok(!debt.includes("a mechanism copied rather than shared"), "debt still names the copied mechanism");
  assert.ok(debt.includes("dead code or a branch left behind"), "and keeps the rest of its list");
});

test("a consult reviewed without the Simplifier is sent none of its rules", () => {
  for (const angles of [["tech"], ["tech", "debt"], ["tech", "ba", "user", "ux", "debt"]]) {
    const without = roleFor(angles);
    assert.ok(!without.includes("Simplifier"), `${angles.join(",")} names the Simplifier`);
    assert.ok(!without.includes("Reuse: code the change writes"), `${angles.join(",")} carries its rules`);
  }
});

const REPLY = [
  "CODEX: 2 findings (0 blocker, 1 major, 1 minor)",
  "",
  "### Tech Lead",
  "- **F1 — New — major:** `a.mjs:2` — a coupling.",
  "",
  "### Simplifier",
  "- **F2 — New — minor:** `a.mjs:7` — a second reader of the same file; saves 6 lines.",
].join("\n");

test("a reply's Simplifier part is placed under simplify", () => {
  assert.deepEqual([...anglesOfFindings(REPLY, ["tech", "simplify"])], [["F1", "tech"], ["F2", "simplify"]]);
});

test("the stats count a Simplifier finding, and the verdict that kept it, under simplify", () => {
  const rows = [{ kind: "consult", id: "s1", ok: true, root: "/r", at: "2026-10-06T00:00:00.000Z", model: "cx/alpha",
    reply: REPLY, angles: ["tech", "simplify"] }];
  const verdicts = [{ kind: "verdict", of: "s1", at: "2026-10-06T00:01:00.000Z", accepted: 1, rejected: 1, kept: ["F2"], dropped: { F1: "not so" } }];
  const by = Object.fromEntries(anglesOf(rows, verdicts).angles.map((one) => [one.angle, one]));
  assert.deepEqual(by.simplify, { angle: "simplify", consults: 1, findings: 1, accepted: 1, rejected: 0 });
});
