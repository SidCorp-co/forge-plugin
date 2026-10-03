/* `forge next` and `forge doctor` word the drain from one state `drainOf` answers, so the same rows
   read the same in both: the verdict sentence after `drained by` is one string, compared whole. */
import assert from "node:assert/strict";
import test from "node:test";

import { declaring, issue, rankRoom, standing } from "../room.mjs";
import { drainVerdict } from "../../../src/rank/drain.mjs";

const { load, ran, state, close } = await rankRoom();
test.after(close);

state.config = { pipelineConfig: { qa: "independent" } };
state.answer.forge_config = () => ({ config: state.config });

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const DAYS = 3 * 24 * 60;
const stale = (issueId, held = {}) => issue(issueId, { status: "developed", updatedAt: ago(DAYS), ...held });
const leased = { sessionContext: { lease: { holder: "a-judging-run", agent: "an agent", pid: "9",
  renewedAt: new Date().toISOString(), minutes: 60, history: [] } } };

/* The sentence alone: `next` closes it with a full stop, the report adds the key's source. */
const nextSaid = (stdout) => stdout.match(/^ {2}drained by — (.*)\.$/mu)?.[1];
const doctorSaid = (stdout) => stdout.match(/^\[([^\]]*)\] drained by\s+(.*?)(?: {2}← .*)?$/mu)?.slice(1);

const both = async (room) => {
  const next = await ran(["next"], room);
  const doctor = await ran(["doctor"], room);
  assert.equal(next.status, 0, next.stderr);
  const said = nextSaid(next.stdout);
  const [level, row] = doctorSaid(doctor.stdout) ?? [];
  assert.ok(said, next.stdout);
  assert.ok(row, doctor.stdout);
  return { said, row, level: level.trim() };
};

const CASES = [
  ["a master the rows show draining", () => declaring("qa-master"), [issue("ISS-1"), stale("ISS-5"), stale("ISS-6", leased)],
    "ok", /^qa-master, declared and draining: 1 of the 2 row\(s\) .*\. Another master leaves these standing$/u],
  ["a master the rows do not show draining", () => declaring("qa-master"), [issue("ISS-1"), stale("ISS-5")],
    "miss", /^qa-master, declared and not draining: 0 of the 1 row\(s\) .*judged against `rank\.drainIdle` 60 minute\(s\)\. So any master that reads the queue takes the rows at developed: start qa-master, or take `drainedBy` out of the file$/u],
  ["a master over no row at developed", () => declaring("qa-master"), [issue("ISS-1")],
    "note", /^qa-master, declared; no row stands at developed, so nothing here says whether it is draining$/u],
  ["no key at all", () => standing(null), [issue("ISS-1"), stale("ISS-5")],
    "note", /^no master — `drainedBy` is unset, so any master that reads the queue takes the rows at developed\. 0 of the 1 row\(s\)/u],
  ["a value the key does not take", () => declaring("qa-mastre"), [issue("ISS-1"), stale("ISS-5")],
    "miss", /^`drainedBy` is `qa-mastre`, which is no master that drains developed: it takes dispatcher or qa-master\. No master is declared, so any master that reads the queue takes the rows at developed until it is put right\. 0 of the 1 row\(s\)/u],
];

for (const [what, room, rows, level, sentence] of CASES) {
  test(`${what}: next and doctor print one verdict`, async () => {
    load(rows);
    const { said, row, level: printed } = await both(room());
    assert.match(said, sentence, said);
    assert.equal(row, said, "the report's row is the queue's sentence, word for word");
    assert.equal(printed, level);
  });
}

test("a master over no row stands nobody down on the machine-readable form either", async () => {
  load([issue("ISS-1")]);
  const held = JSON.parse((await ran(["next", "--json"], declaring("qa-master"))).stdout).judging.drain;
  assert.equal(held.holds, false);
  assert.equal(held.standing, 0);
  assert.deepEqual(Object.keys(held), ["declared", "holds", "evidence", "standing", "leased", "whole",
    "lastClaimAt", "oldest", "idleMinutes"], "the drain object keeps the fields it carried");
});

/* The state alone picks the sentence: the same evidence under another state reads as that state. */
test("the verdict is chosen by the state and by nothing else the reading carries", () => {
  const reading = { drainedBy: "qa-master", unknown: null, holds: true, evidence: ["leased"], standing: 1,
    leased: 1, unreached: 0, whole: true, lastClaimAt: null, oldest: null, idle: 60 };
  assert.equal(drainVerdict({ ...reading, state: "empty" }).level, "note");
  assert.match(drainVerdict({ ...reading, state: "empty" }).said, /no row stands at developed/u);
  assert.equal(drainVerdict({ ...reading, state: "unheld" }).level, "miss");
  assert.match(drainVerdict({ ...reading, state: "unheld" }).said, /declared and not draining/u);
  assert.equal(drainVerdict({ ...reading, state: "holds" }).level, "ok");
});
