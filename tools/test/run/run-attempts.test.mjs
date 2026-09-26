/* What a ship writes about its own landing attempt: one opening per issue its tree was started for at
   the gate of a pass that goes on to push, the gate's record, and the ending — landed once the push is
   taken, back for the branch when the gate fails and for a moved base when the push is refused because
   the remote moved (ISS-2425). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, GATE, committed, git, landIn, runIn, scratch } from "./run-fixtures.mjs";
import { mintRunId } from "../../run/workspace/run-id.mjs";

const KEY = "ISS-333";

/* Moves the remote once, during the gate, so the push after it is refused against the head it rebased onto. */
const MOVES = "if [ ! -f ../moved ]; then rm -rf ../mover"
  + " && git clone -q ../origin.git ../mover"
  + " && git -C ../mover -c user.email=t@example.test -c user.name=Test commit -q --allow-empty -m 'a sibling landed'"
  + " && git -C ../mover push -q origin HEAD:master; touch ../moved; fi";

const shipping = (name, gate = GATE) => {
  const room = scratch(name, gate);
  git(room.at, "init", "--bare", "origin.git");
  git(room.work, "init", "-b", "master");
  committed(room.work, "one");
  git(room.work, "remote", "add", "origin", join(room.at, "origin.git"));
  git(room.work, "push", "origin", "HEAD:master");
  mintRunId(room.work, [KEY]);
  landIn(room.work, join("plugin", "src", "one.mjs"), 4, `the change this release ships (${KEY})`);
  return room;
};

/* The store the ship's child wrote into: the configuration home BARE hands it. */
const attempts = () => {
  const path = join(BARE.XDG_CONFIG_HOME, "forge", "eval-marks.jsonl");
  return (existsSync(path) ? readFileSync(path, "utf8") : "").split("\n").filter(Boolean)
    .map((one) => JSON.parse(one)).filter((one) => one.kind === "landing-attempts");
};

const shipped = (room, argv = ["ship"]) => {
  const from = attempts().length;
  const run = runIn(room.work, argv, BARE);
  const records = attempts().slice(from);
  return { run, said: `${run.stdout}${run.stderr}`, records, phases: records.map((one) => one.phase),
    ended: records.find((one) => one.phase === "ended"), gate: records.find((one) => one.phase === "gate") };
};

test("ISS-2425 16, 17, 20. a ship that gates and pushes opens an attempt for its issue, records its gate, and ends it landed", () => {
  const room = shipping("attempt-lands");
  const gated = git(room.work, "rev-parse", "HEAD").stdout.trim();
  const { said, records, phases, ended, gate } = shipped(room);
  assert.deepEqual(phases, ["opened", "gate", "ended"], said);
  assert.equal(records[0].issue, KEY, said);
  assert.equal(records[0].verb, "ship", said);
  assert.deepEqual([gate.verdict, gate.candidate, gate.members], ["green", gated, [KEY]], said);
  assert.deepEqual([ended.outcome, ended.cause, ended.candidate], ["landed", null, gated],
    `landed once the push was taken, though the install after it stopped the pass:\n${said}`);
});

test("ISS-2425 18. a ship whose gate fails ends its attempt with cause branch", () => {
  const room = shipping("attempt-red", "node -e \"process.exit(1)\"");
  const { said, phases, ended, gate } = shipped(room);
  assert.deepEqual(phases, ["opened", "gate", "ended"], said);
  assert.equal(gate.verdict, "red", said);
  assert.deepEqual([ended.outcome, ended.cause], ["back", "branch"], said);
});

test("ISS-2425 19. a ship whose push is refused because the remote moved ends its attempt with cause moved-base", () => {
  const room = shipping("attempt-race", MOVES);
  const { said, ended } = shipped(room);
  assert.match(said, /Rejected means the remote moved/u, said);
  assert.deepEqual([ended.outcome, ended.cause], ["back", "moved-base"], said);
});

test("ISS-2425 16. a resume past the push re-runs the gate and opens no attempt", () => {
  const room = shipping("attempt-resume");
  shipped(room);
  const { said, phases } = shipped(room, ["ship", "--from", "9"]);
  assert.deepEqual(phases, ["gate"], `the gate is spent again and nothing is attempted:\n${said}`);
});
