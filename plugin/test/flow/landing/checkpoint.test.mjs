/* The checkpoint a build ready to land leaves, and the turn each of its states names. A state
   machine is where a suite passes for the wrong reason, so the table is walked as a table — every
   state reachable, every state one turn — and each refusal is read for the state it names rather
   than for its exit code (ISS-673). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-checkpoint").path;
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";
const {
  LANDING_READY, LANDING_STATES, claimed, landingLine, landingOf, landingTurn, leaseOf, takeRefusal,
} = await import("../../../src/flow/lease.mjs");

const AT = "2026-09-07T12:00:00.000Z";
const NOW = Date.parse(AT);
const LIVE = { holder: "the-lander", agent: "a-test-agent", pid: "4242", renewedAt: AT, minutes: 30, next: null, history: [] };
const DEAD = { ...LIVE, renewedAt: "2026-09-07T10:00:00.000Z" };
const BUILT = {
  state: "ready",
  builder: "the-builder",
  branch: "iss-673-6",
  head: "9e24c2af0000000000000000000000000000abcd",
  base: "c4890050000000000000000000000000000dcba",
  files: ["plugin/src/flow/claim.mjs", "plugin/src/flow/lease.mjs"],
  at: AT,
};
const at = (state, over = {}) => ({ landing: { ...BUILT, state, ...over } });
const refused = (state, holder, lease = LIVE, read = {}) =>
  takeRefusal("ISS-673", landingOf(at(state)), holder, lease, { now: NOW, ...read });

/* A state nothing reaches and a state two roles claim are both bugs a green suite would not show,
   so the shape of the table is asserted rather than the behaviour of the states one at a time. */
test("every state is reachable from ready, names exactly one turn, and ends at done", () => {
  const names = Object.keys(LANDING_STATES);
  const seen = new Set([LANDING_READY]);
  const walk = [LANDING_READY];
  while (walk.length) {
    for (const one of LANDING_STATES[walk.pop()].next) if (!seen.has(one)) seen.add(one), walk.push(one);
  }
  assert.deepEqual([...seen].sort(), [...names].sort(), "a state the walk never reaches is a state nothing can enter");
  for (const [name, row] of Object.entries(LANDING_STATES)) {
    assert.ok(["lander", "builder", "qa", null].includes(row.turn), `${name} names ${row.turn}`);
    assert.equal(typeof row.turn === "string" || row.turn === null, true, `${name} names two turns or none`);
    for (const one of row.next) assert.ok(names.includes(one), `${name} names ${one}, which is no state`);
  }
  assert.deepEqual(LANDING_STATES.done, { turn: null, next: [] }, "the end of the landing is the one terminal state");
  assert.equal(names.filter((one) => LANDING_STATES[one].turn === null).length, 1, "and the only state with no turn");
  assert.ok(names.every((one) => one === LANDING_READY || names.some((two) => LANDING_STATES[two].next.includes(one))),
    "every state but the first is some state's successor");
  assert.deepEqual(LANDING_STATES["builder-owed"], { turn: "builder", next: ["reconciled"] },
    "the one state the builder is owed, and the one state it leads to");
});

test("the checkpoint is read by its declared fields, and a state nothing wrote is no checkpoint", () => {
  const read = landingOf(at("ready", { pinned: "abc1234", nonsense: "another client's" }));
  assert.equal(read.builder, "the-builder");
  assert.equal(read.head, BUILT.head);
  assert.equal(read.pinned, "abc1234", "a field the landing itself writes is declared too");
  assert.equal(read.nonsense, undefined, "and a key this reader does not name is dropped, not carried as a fact");
  assert.deepEqual(read.files, BUILT.files, "the files are the paths, where the worklog's `files` is how many");
  assert.deepEqual(landingOf({ landing: { ...BUILT, files: "not a list" } }).files, []);
  assert.equal(landingOf(null), null, "an issue with no checkpoint");
  assert.equal(landingOf({ lease: LIVE }), null, "a field holding only a lease");
  assert.equal(landingOf({ landing: { builder: "the-builder" } }), null, "and a checkpoint with no state is none");
  assert.equal(landingTurn(landingOf(at("qa-owed"))), "qa");
  assert.equal(landingTurn(null), null);
  assert.match(landingLine(landingOf(at("ready"))), /landing `ready`: iss-673-6 at 9e24c2a, base c489005, 2 file\(s\)/u);
});

test("a take with no checkpoint and a take at done are each refused naming what was read", () => {
  const none = takeRefusal("ISS-673", null, "the-lander", null, { now: NOW });
  assert.match(none, /carries no landing checkpoint/u, none);
  assert.match(none, /forge claim ISS-673 --pushed --ready/u, "and the one command that writes one");
  const over = refused("done", "the-lander");
  assert.match(over, /reads `done`/u, over);
  assert.match(over, /forge claim ISS-673$/mu, "the lease is still takeable the ordinary way");
  const unknown = takeRefusal("ISS-673", { state: "half-landed", files: [] }, "the-lander", LIVE, { now: NOW });
  assert.match(unknown, /reads `half-landed`/u, "a state written by a version this one does not know");
  assert.match(unknown, /forge resume ISS-673/u);
});

test("at builder-owed the named builder takes the turn, and a live lease refuses everybody else", () => {
  assert.equal(refused("builder-owed", "the-builder"), null, "the run the state names, whoever holds the lease");
  const third = refused("builder-owed", "a-third-run");
  assert.match(third, /reads `builder-owed`/u, third);
  assert.match(third, /the builder the-builder's/u, "the refusal says whose turn it is");
  assert.match(third, /a successor is eligible only once that lease is dead/u, "and what would make it this run's");
  assert.equal(refused("builder-owed", "a-third-run", DEAD), null,
    "a lease dead by the reclaim rules is any run's, so a successor may reconcile where the builder is gone");
  const lander = refused("builder-owed", "the-lander");
  assert.match(lander, /reads `builder-owed`/u, "the lander is refused at the builder's state as any other run is");
});

test("at the lander's states the builder is refused, and so is a second lander on a live lease", () => {
  for (const state of ["ready", "candidate", "reconciled", "judged", "promoting", "promoted", "installed", "marked"]) {
    assert.equal(landingTurn(landingOf(at(state))), "lander", state);
    const said = refused(state, "the-builder");
    assert.match(said, new RegExp(`reads \`${state}\``, "u"), said);
    assert.match(said, /comes back at `builder-owed`/u, "the builder's turn is that state and no other");
    assert.equal(refused(state, "the-lander", { ...LIVE, holder: "the-builder" }), null,
      "and the lander takes the lease the builder still holds live, which is what the handoff is");
    assert.equal(refused(state, "the-lander", null), null, "or takes a lease nobody holds");
    assert.equal(refused(state, "the-lander", LIVE), null,
      "and the lander whose live lease this already is takes its own turn again, which a re-run is");
    const second = refused(state, "another-lander", LIVE);
    assert.match(second, /is already on it/u, `${state}: a live lander is not taken over from`);
    assert.match(second, new RegExp(`reads \`${state}\``, "u"), second);
  }
});

/* The judge writes its hand-back under a lease still live, so the lander's way back in is a hole cut
   in the live-lease guard — and one cut a state too wide would hand a third run any lander's lease,
   the judge that went on to land holding one under the same id. At `judged` and spent there. */
test("the judge's spent lease is taken back from at judged alone, and its own landing lease is not", () => {
  const judged = (state, holder, lease) =>
    takeRefusal("ISS-673", landingOf(at(state, { judge: "the-judge" })), holder, lease, { now: NOW });
  const JUDGES = { ...LIVE, holder: "the-judge" };
  assert.equal(judged("judged", "the-lander", JUDGES), null,
    "the hand-back leaves the judge's lease live, and the lander takes the turn the state names");
  for (const state of ["promoting", "promoted", "installed", "marked"]) {
    const said = judged(state, "another-lander", JUDGES);
    assert.match(said, /is already on it/u,
      `${state}: the judge that went on to land holds an ordinary lander's lease, not a spent one`);
    assert.match(said, new RegExp(`reads \`${state}\``, "u"), said);
  }
  assert.match(judged("judged", "another-lander", { ...LIVE, holder: "a-live-lander" }), /is already on it/u,
    "and a lander that is not the named judge is no more takeable at judged than anywhere else");
  assert.equal(landingOf(at("judged", { judge: "the-judge" })).judge, "the-judge",
    "the name is a declared field, so the checkpoint carries it rather than dropping it");
});

/* Every agent of a dispatched wave inherits one id (ISS-445), so builder equality is no proof for
   the one write that replaces another run's live lease. Told, everywhere else; refused here. */
test("a wave's shared id is refused the builder's turn where the take would replace a live lease", () => {
  const shared = refused("builder-owed", "the-builder", LIVE, { source: "inherited" });
  assert.match(shared, /reads `builder-owed`/u, shared);
  assert.match(shared, /names a wave and not a run/u, "and says what the id it matched on means");
  assert.match(shared, /FORGE_SESSION_ID/u, "with the one thing that gives the run an id of its own");
  assert.equal(refused("builder-owed", "the-builder", LIVE, { source: "asked" }), null,
    "a run that said which run it is takes its turn");
  assert.equal(refused("builder-owed", "the-builder", DEAD, { source: "inherited" }), null,
    "and a lease already dead is any run's, so nothing is taken from anybody");
  assert.equal(refused("builder-owed", "the-builder", { ...LIVE, holder: "the-builder" }, { source: "inherited" }), null,
    "as is the lease this session already holds");
});

/* Nothing here can prove a session is the QA run, and the checkpoint names no lander to spare, so a
   live-lease guard could not tell a spent one from a judge's. Not the builder is the whole rule. */
test("the QA turn is any session's but the builder's, whose own work it would be judging", () => {
  assert.equal(refused("qa-owed", "the-lander"), null,
    "the handoff is to a judge, and a lander lease still live is what --take is for");
  assert.equal(refused("qa-owed", "another-judge", DEAD), null, "as is a turn nobody is holding");
  const said = refused("qa-owed", "the-builder");
  assert.match(said, /reads `qa-owed`/u, said);
  assert.match(said, /judge its own work/u, "the one session the state cannot mean");
  assert.match(refused("qa-owed", "the-builder", DEAD), /judge its own work/u,
    "and a lease going dead does not make the builder independent of itself");
});

/* The checkpoint sits beside the lease in one field, and every lease write rebuilds that field:
   a renew or a transition that dropped it would lose the whole landing. */
test("a claim, a renew and a transition each leave the checkpoint exactly where it was", () => {
  const held = { ...at("builder-owed", { builder: "the-builder" }), lease: LIVE };
  const claim = claimed(held, { holder: "the-builder", at: AT, minutes: 30, how: "take", status: "developed" });
  assert.deepEqual(claim.landing, held.landing, "the take writes no checkpoint of its own");
  const renewed = claimed(claim, { holder: "the-builder", at: AT, minutes: 30 });
  assert.deepEqual(renewed.landing, held.landing, "a payload write is not a transition");
  const moved = claimed(renewed, { holder: "the-builder", at: AT, minutes: 30, next: null });
  assert.deepEqual(moved.landing, held.landing, "and a transition clears the line, not the landing");
  assert.equal(landingOf(moved).state, "builder-owed");
});

test("the history row a take appends names the state it was taken at", () => {
  const held = { ...at("ready"), lease: LIVE };
  const taken = claimed(held, { holder: "the-lander", at: AT, minutes: 30, how: "take", status: "developed" });
  assert.deepEqual(leaseOf(taken).history.at(-1),
    { holder: "the-lander", at: AT, how: "take", status: "developed", next: null, landing: "ready" });
  const plain = claimed({ lease: LIVE }, { holder: "one", at: AT, minutes: 30, how: "claim", status: "open" });
  assert.equal(leaseOf(plain).history.at(-1).landing, undefined, "an issue with no landing names no state");
  const written = claimed({ lease: LIVE }, {
    holder: "the-builder", at: AT, minutes: 30, how: "claim", status: "developed", landing: { ...BUILT },
  });
  assert.equal(leaseOf(written).history.at(-1).landing, "ready", "and the write that makes one names it too");
  assert.deepEqual(landingOf(written), landingOf(at("ready")), "the checkpoint the claim was handed");
});

/* The table above walks its own rows and says nothing about a row nobody writes, which is how
   `qa-owed → judged`, `judged → …` and `marked → done` shipped green as a dead end (ISS-673). Every
   state is asked for by name in the two files that write one, so a row added without its writer is
   red here rather than a landing that parks for good. */
test("every state some step is meant to write is named in the source of the two files that write one", () => {
  const root = new URL("../../../../", import.meta.url);
  /* Below the imports: a name a file only imports is a name nothing there writes, and reading the
     whole file would let the import that survived a deleted write answer for it. */
  const src = ["plugin/src/flow/claim.mjs", "tools/run/land-ready.mjs"]
    .map((one) => readFileSync(new URL(one, root), "utf8").split("\n")
      .filter((line) => !/^(?:import\b|\s*[\w{},]+\s*(?:,|\}\s*from))/u.test(line)).join("\n"))
    .join("\n");
  const named = (state) =>
    src.includes(`"${state}"`) || src.includes(`LANDING_${state.toUpperCase().replaceAll("-", "_")}`);
  for (const state of Object.keys(LANDING_STATES)) {
    assert.ok(named(state), `nothing under plugin/src/flow/claim.mjs or tools/run/land-ready.mjs asks `
      + `for \`${state}\`, so the table offers a state no step writes and a landing reaching the row `
      + `above it parks there for good`);
  }
});
