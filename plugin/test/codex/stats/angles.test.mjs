/* Whether an angle pays is a figure only if each finding is placed under the angle that raised it: the
   one angle a consult asked for, or on a board the heading above it, and nobody's where there is none. */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: the live config directory holds the device's own log. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-stats-angles-");

const { logPath } = await import("../../../src/codex/codex-log.mjs");
const { printStats } = await import("../../../src/codex/codex-stats.mjs");
const { anglesOf } = await import("../../../src/codex/stats/figures.mjs");
const { anglesOfFindings } = await import("../../../src/codex/log/replies.mjs");

const BOARD = [
  "CODEX: 3 findings (0 blocker, 1 major, 2 minor)",
  "",
  "- **F1 — New — minor:** `a.mjs:1` — above every heading.",
  "",
  "### Tech Lead",
  "- **F2 — New — major:** `a.mjs:2` — a coupling.",
  "",
  "### Debt Reviewer",
  "- **F3 — New — minor:** `a.mjs:3` — a special case where configuration belongs.",
  "Removes: `a.mjs:9` — a copied helper.",
].join("\n");

test("a board's finding is placed under the heading above it, and one under no heading is nobody's", () => {
  assert.deepEqual([...anglesOfFindings(BOARD, ["tech", "debt"])], [["F1", null], ["F2", "tech"], ["F3", "debt"]]);
  assert.deepEqual([...anglesOfFindings(BOARD, ["tech", "ba"])], [["F1", null], ["F2", "tech"], ["F3", null]],
    "a heading naming an angle the consult did not ask for places nothing");
  assert.deepEqual([...anglesOfFindings(BOARD, ["debt"])], [["F1", "debt"], ["F2", "debt"], ["F3", "debt"]],
    "one angle asked for owns every finding, headings or none");
});

const row = (id, angles, reply) => ({ kind: "consult", id, ok: true, root: "/r", at: "2026-09-25T00:00:00.000Z",
  model: "cx/alpha", reply, ...(angles ? { angles } : {}) });
const ROWS = [row("a1", ["tech", "debt"], BOARD), row("a2", ["tech"], "CODEX: 1 findings (1 minor)\n\n- **F1 — New — minor:** `b.mjs:1` — x."),
  row("a3", undefined, "CODEX: 0 findings")];
const VERDICTS = [
  { kind: "verdict", of: "a1", at: "2026-09-25T00:01:00.000Z", accepted: 1, rejected: 1, kept: ["F3"], dropped: { F2: "not so" } },
  { kind: "verdict", of: "a2", at: "2026-09-25T00:01:00.000Z", accepted: 1, rejected: 0, counted: true },
];

test("each angle counts the consults that asked for it, its findings, and what the verdicts kept and dropped by id", () => {
  const { angles, unrecorded } = anglesOf(ROWS, VERDICTS);
  const by = Object.fromEntries(angles.map((one) => [one.angle ?? "unplaced", one]));
  assert.deepEqual(by.tech, { angle: "tech", consults: 2, findings: 2, accepted: 0, rejected: 1 },
    "a counted verdict names no id, so it rules on no angle's finding");
  assert.deepEqual(by.debt, { angle: "debt", consults: 1, findings: 1, accepted: 1, rejected: 0 });
  assert.deepEqual(by.unplaced, { angle: null, consults: 0, findings: 1, accepted: 0, rejected: 0 });
  assert.equal(unrecorded, 1, "a row recording no angles is counted apart");
});

test("forge codex stats prints one row per angle under the window", () => {
  mkdirSync(dirname(logPath()), { recursive: true });
  writeFileSync(logPath(), [...ROWS, ...VERDICTS].map((one) => JSON.stringify(one)).join("\n") + "\n");
  const lines = [];
  const log = mock.method(console, "log", (line) => lines.push(String(line)));
  try {
    printStats([]);
  } finally {
    log.mock.restore();
  }
  const said = lines.join("\n");
  assert.match(said, /^by angle, /mu, said);
  assert.match(said, /^tech +2 consult\(s\) +2 finding\(s\) +0 kept, 1 dropped, 0% of 1 ruled by id$/mu, said);
  assert.match(said, /^debt +1 consult\(s\) +1 finding\(s\) +1 kept, 0 dropped, 100% of 1 ruled by id$/mu, said);
  assert.match(said, /^under no heading +1 finding\(s\) +none ruled by id$/mu, said);
  assert.match(said, /^1 consult\(s\) recorded no angles, and are in no row above$/mu, said);
});
