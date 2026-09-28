/* The priority question's three parts — the tool, the role and the reader — built from the levels a
   project's scale states, and its one ask logged under its own kind. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("priority-question").path;
const { askPriority, priorityRole, priorityTool, readPriority } = await import("../../../src/codex/proposed/priority.mjs");
const { consults, isAnswered } = await import("../../../src/codex/codex-log.mjs");

const LEVELS = [["critical", "stops every run"], ["high", "a lost turn"], ["low", "wording"]];

test("the tool takes the stated levels and no other, and the role carries each level's own text", () => {
  assert.deepEqual(priorityTool(LEVELS).input_schema.properties.priority.enum, ["critical", "high", "low"]);
  const role = priorityRole(LEVELS);
  for (const [level, text] of LEVELS) assert.ok(role.includes(`- ${level}: ${text}`), `${level} is stated as the project wrote it`);
  assert.doesNotMatch(role, /medium/u, "a level the scale leaves out is not offered");
});

test("an answer outside the stated levels is refused as no proposal, and one inside is read with its confidence", () => {
  const read = readPriority(LEVELS);
  assert.match(read([{ name: "priority", input: { priority: "medium", why: "x" } }]).refused,
    /`medium` is no level of this project's scale; they are critical, high, low/u);
  assert.match(read([]).refused, /made no `priority` call/u);
  assert.deepEqual(read([{ name: "priority", input: { priority: "high", confidence: 0.7, why: " a lost turn " } }]),
    { proposed: "high", confidence: 0.7, why: "a lost turn" });
  assert.equal(read([{ name: "priority", input: { priority: "low", why: "w" } }]).confidence, null, "an absent confidence is none, not nought");
});

test("one ask writes one row under the kind priority, which no consult reading counts", async () => {
  const rows = [];
  const answered = await askPriority({}, "cx/astra", { issueId: "ISS-9", title: "filed 2026-09-01", description: "b", category: "bug" }, LEVELS, {
    ask: async (_values, model, messages, options) => {
      assert.equal(options.choose, "priority");
      assert.match(options.system, /- high: a lost turn/u);
      assert.match(messages[0].content, /<date>/u, "the state travels the complexity question's redaction");
      return { calls: [{ name: "priority", input: { priority: "critical", confidence: 0.9, why: "every run" } }], usage: { input_tokens: 5 } };
    },
    log: rows.push.bind(rows),
  });
  assert.equal(answered.proposed, "critical");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "priority");
  assert.deepEqual(consults(rows), [], "a proposal is no consult");
  assert.equal(isAnswered({ ...rows[0], reply: "x" }), false);
});
