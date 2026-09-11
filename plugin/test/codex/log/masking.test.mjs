/* The write-side mask reaches what is written and the printer reaches what is shown. Neither reaches
   what a consult sends: its request opens with stored exchanges, and one may be older than either
   (ISS-268). Two projections carry them out, and each takes clips of its own. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, as every suite reaching this module is: the developer's log
   is live, and nothing here may read or write it. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-masking-");

const { historyFor, recheckRisks } = await import("../../../src/codex/codex-log.mjs");

const FAKE = "7|notarealtokennotarealtokennotarealtoken";
const JWT = `eyJ${"z".repeat(30)}.${"y".repeat(30)}.${"x".repeat(30)}`;

const LEGACY = {
  kind: "consult",
  id: "old-1",
  ok: true,
  at: "2026-08-01T00:00:00.000Z",
  root: "/a",
  files: ["a.mjs"],
  intent: `check the header we send with --token ${FAKE}`,
  reply: `CODEX: 1 findings\n- **F1 — major:** \`a.mjs:3\` — it ships --token ${FAKE} in the header.`,
};

const RULED = {
  kind: "verdict",
  at: "2026-08-01T00:01:00.000Z",
  of: "old-1",
  accepted: 0,
  rejected: 1,
  kept: [],
  dropped: { F1: `not ours: the fixture logs in with ${FAKE}` },
};

const replayed = (entries) => historyFor(entries, "/a", 3, ["a.mjs"])[0];

test("an entry stored before the write-side mask is masked on the way into the next consult", () => {
  const entries = [LEGACY, RULED];
  const one = replayed(entries);
  assert.ok(!JSON.stringify(one).includes("notarealtoken"), "no part of the value reaches the provider");
  assert.equal(one.intent, "check the header we send with --token ***");
  assert.match(one.reply, /it ships --token \*\*\* in the header/u, "and the prose around it still reads");
  assert.match(one.reply, /^CODEX: 1 findings$/mu, "the digest still states the count it was given");
  assert.match(one.reply, /^- F1 — .*→ rejected — not ours: the fixture logs in with \*\*\*$/mu,
    "and carries the identifier with what was done with it, that reason masked too");
  assert.equal(one.verdict, "0 accepted, 1 rejected (F1: not ours: the fixture logs in with ***)");
  assert.ok(entries[0].intent.includes("notarealtoken"),
    "the entries handed in are untouched: the seat is the emission and the read stays raw");
});

/* Masked before a clip and never after: a shape the clip cuts in half matches no pattern, so the half
   that survives would travel whole. One case per clip, there being four across the two projections. */
test("a credential the intent's clip would cut in half leaves no fragment of itself behind", () => {
  const one = replayed([{ ...LEGACY, intent: `${"i".repeat(1480)} ${JWT} ${"t".repeat(200)}` }]);
  assert.ok(!one.intent.includes("eyJ"), "the clip falls past the shape, and the shape is already gone");
  assert.ok(one.intent.length <= 1500, "and the intent is still clipped");
});

test("a credential the reply digest's clip would cut in half leaves no fragment of itself behind", () => {
  const one = replayed([{ ...LEGACY, reply: `${"r".repeat(5990)} ${JWT} ${"t".repeat(200)}` }]);
  assert.ok(!one.reply.includes("eyJ"), "the digest's own slice cuts masked text, never the stored text");
  assert.ok(one.reply.length <= 6000, "and the digest is still clipped");
});

/* The other route out of a stored entry: a recheck opens with the last consult's findings and what was
   done with each, built from the same entries and sent in the same request. */
test("a recheck's risk lines are masked, the stored finding and the reason it was dropped alike", () => {
  const risks = recheckRisks([LEGACY, RULED], "/a", ["a.mjs"]);
  assert.ok(!risks.join("\n").includes("notarealtoken"), "no part of the value reaches the provider");
  assert.match(risks[0], /it ships --token \*\*\* in the header/u, "the finding still reads");
  assert.match(risks[0], /What I then did: rejected — not ours: the fixture logs in with \*\*\*/u,
    "and so does what was done with it");
});

test("a credential at a recheck's finding-text clip leaves no fragment of itself in the risk line", () => {
  const reply = `CODEX: 1 findings\n- **F1 — major:** \`a.mjs:3\` — ${"w".repeat(870)} ${JWT} and on.`;
  const [risk] = recheckRisks([{ ...LEGACY, reply }], "/a", ["a.mjs"]);
  assert.ok(!risk.includes("eyJ"), "the finding's own 900 characters cut masked text, never the stored text");
  assert.match(risk, /^Your earlier finding F1 still stands/u, "and the line is still the one the reviewer is asked");
});

test("a credential at a recheck's outcome clip leaves no fragment of itself in the risk line", () => {
  const dropped = { F1: `${"d".repeat(880)} ${JWT} and on.` };
  const [risk] = recheckRisks([LEGACY, { ...RULED, dropped }], "/a", ["a.mjs"]);
  assert.ok(!risk.includes("eyJ"), "the outcome's own 900 characters cut masked text too");
  assert.match(risk, /What I then did: rejected — d{10}/u, "and the reason still reads up to the cut");
});
