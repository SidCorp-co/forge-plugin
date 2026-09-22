/* The checkpoint a build ready to land leaves, and the turn each of its states names. A state
   machine is where a suite passes for the wrong reason, so the table is walked as a table — every
   state reachable, every state one turn — and each refusal is read for the state it names rather
   than for its exit code (ISS-673). */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("landing-checkpoint").path;
process.env.AI_AGENT = "a-test-agent";
process.env.CLAUDE_PID = "4242";
const { claimed, leaseOf } = await import("../../../src/flow/lease.mjs");
const { takeRefusal } = await import("../../../src/flow/lease/takeover.mjs");
const {
  LANDING_READY, LANDING_STATES, landingLine, landingOf, landingTurn, landingVoided,
} = await import("../../../src/flow/landing/checkpoint.mjs");

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
    "the turn a moved path hands back, and the one state it leads to");
  /* A row rather than `marked` renamed: the status step runs at two states, so the turn returns to
     the one it came from (ISS-923). */
  assert.deepEqual(LANDING_STATES["records-owed"], { turn: "builder", next: ["marked", "judged"] },
    "the turn a record only the builder can answer hands back, and the two states it returns to");
  for (const one of ["marked", "judged"]) {
    assert.ok(LANDING_STATES[one].next.includes("records-owed"),
      `${one} is a state the status step runs at, so the turn is handed back from it`);
  }
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
  assert.match(none, /carries no landing checkpoint, so no turn is handed off and --take is refused/u, none);
  assert.match(none, /forge claim ISS-673 --pushed --ready/u, "and the one command that writes one");
  const over = refused("done", "the-lander");
  assert.match(over, /reads `done`, so the landing is over and no turn is left to take/u, over);
  assert.match(over, /forge claim ISS-673$/mu, "the lease is still takeable the ordinary way");
  const unknown = takeRefusal("ISS-673", { state: "half-landed", files: [] }, "the-lander", LIVE, { now: NOW });
  assert.match(unknown, /reads `half-landed`/u, "a state written by a version this one does not know");
  assert.match(unknown, /forge resume ISS-673/u);
});

/* Whose liveness the successor is read against: taken off the record's lease, the lander's own stood in for the builder's after a hand-back and refused the one run left for being alive itself, so each reading is asserted by the sentence it earns (ISS-1639). */
test("at builder-owed a successor is held out by the builder's own lease and by nothing else", () => {
  const take = { taking: true };
  const BUILDS = { ...LIVE, holder: "the-builder" };
  assert.equal(refused("builder-owed", "the-builder", LIVE, take), null, "the run the state names, whoever holds the lease");
  const alive = refused("builder-owed", "a-third-run", BUILDS, take);
  assert.match(alive, /reads `builder-owed`/u, alive);
  assert.match(alive, /the builder the-builder's/u, "the refusal says whose turn it is");
  assert.match(alive, /that builder is on the issue under a lease of its own, .+, and a successor is eligible only once the builder's own lease is dead by the reclaim rules/u,
    "and that it is the builder's own run holding it out");
  assert.match(alive, /forge claim ISS-673 --take$/mu, "with the one command that clears it");
  assert.equal(refused("builder-owed", "a-third-run", { ...BUILDS, renewedAt: DEAD.renewedAt }, take), null,
    "a builder's lease dead by the reclaim rules is any run's, so a successor may take the turn");
  assert.equal(refused("builder-owed", "a-third-run", null, take), null, "and a field holding no lease holds nobody out");
  assert.equal(refused("builder-owed", "the-lander", LIVE, take), null,
    "the run whose own live lease is on the record succeeds the builder rather than being refused for being alive");
  const third = refused("builder-owed", "a-third-run", LIVE, take);
  assert.match(third, /is already on it/u, "and a live lease that is neither run's is nobody's to take over from");
  assert.match(third, /reads `builder-owed`/u, third);
});

/* The take and not the lease licenses the write it was taken for, the row it leaves being what says a successor answered for the builder (ISS-726). */
test("a successor's write at builder-owed is licensed by its own take and not by the lease it holds", () => {
  const took = { ...LIVE, history: [{ holder: "the-lander", at: AT, how: "take", status: "developed", landing: "builder-owed" }] };
  const early = refused("builder-owed", "the-lander", LIVE);
  assert.match(early, /has taken no turn/u, early);
  assert.match(early, /forge claim ISS-673 --take$/mu, "and the take it owes first");
  assert.equal(refused("builder-owed", "the-lander", took), null, "and the write lands once that row is on the record");
});

/* The other builder state keeps the reading it has, the records it is owed answering for a judgement only the run that built the change can sign (ISS-1649). */
test("at records-owed the run holding the lease is held out until nothing live is on the issue", () => {
  const owed = refused("records-owed", "the-lander", LIVE, { taking: true });
  assert.match(owed, /reads `records-owed`/u, owed);
  assert.match(owed, /answer for a judgement the run that built the change made/u, "naming what that turn is owed");
  assert.equal(refused("records-owed", "the-lander", DEAD, { taking: true }), null, "and a lease no longer live opens it");
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
  assert.match(said, /no run may judge its own work, and an id a run inherited is the builder's however it arrived/u,
    "the one session the state cannot mean");
  assert.equal(refused("qa-owed", "the-builder", DEAD), said,
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

/* Every field a promotion's evidence rests on, blanked together: the candidate, the identity judged
   against it, the judge who did, the sha meant for the push and the version it would have released.
   One left standing reads later as a fact about a landing that no longer exists — the release above
   all, which a resume could take for a push already made (ISS-673). */
test("a void gives up every field the candidate it built was the evidence for", () => {
  const held = landingVoided("a-fresh-pin");
  assert.equal(held.state, "candidate", "back to the state whose turn is the lander's own");
  assert.equal(held.pinned, "a-fresh-pin", "on the base it will build over");
  for (const name of ["candidate", "intended", "moved", "reconciled", "deployment", "judge", "release"]) {
    assert.equal(held[name], "", `\`${name}\` is what the void gives up, so it is blanked with the rest`);
  }
  assert.deepEqual(landingOf({ landing: { ...BUILT, ...held } }), landingOf({ landing: { state: "candidate", pinned: "a-fresh-pin", builder: BUILT.builder, branch: BUILT.branch, head: BUILT.head, base: BUILT.base, at: BUILT.at, files: BUILT.files } }),
    "and read back, the checkpoint carries none of them");
});

/* The table above walks its own rows and says nothing about a row nobody writes, which is how
   `qa-owed → judged` and `marked → done` shipped green as dead ends (ISS-673). Two readings, because
   a row can fail either way: written by neither file, or written only by the lander where the turn is
   somebody else's — a state its own turn holder cannot leave, which `builder-owed` was (ISS-726).
   The second was green on `marked` and the checker was right: it asks whose turn a state names, and
   `marked` named the lander's — the row was wrong, and the reading fires on one naming the builder's
   (ISS-923). Both read the source for `state:` and the state, a convention over the object handed to
   `landingSaved` rather than proof the line runs. */
const WRITERS = {
  /* The verb and every part of it, as the lander's is below: a checkpoint the verb composes rather
     than moves sits beside the table it is composed against, not in the file that walks it. */
  claim: ["plugin/src/flow/claim.mjs",
    ...readdirSync(new URL("../../../../plugin/src/flow/landing/", import.meta.url))
      .map((one) => `plugin/src/flow/landing/${one}`)],
  /* The verb and every part of it, read off the directory rather than listed: a state written in a
     part this table forgot to name would read exactly like a state nobody writes. */
  lander: ["tools/run/land-ready.mjs",
    ...readdirSync(new URL("../../../../tools/run/land-ready/", import.meta.url))
      .map((one) => `tools/run/land-ready/${one}`)],
};
const ROOT = new URL("../../../../", import.meta.url);
const source = Object.fromEntries(Object.entries(WRITERS).map(([who, paths]) =>
  [who, paths.map((path) => readFileSync(new URL(path, ROOT), "utf8")).join("\n")]));
const named = (who) => WRITERS[who].join(", ");
const WRITTEN = (state) =>
  new RegExp(`state:\\s*(?:"${state}"|LANDING_${state.toUpperCase().replaceAll("-", "_")}\\b)`, "u");
const writes = (who, state) => WRITTEN(state).test(source[who]);

test("every state some step is meant to write is written in the source of the files that write one", () => {
  for (const state of Object.keys(LANDING_STATES)) {
    assert.ok(writes("claim", state) || writes("lander", state),
      `neither ${named("claim")} nor ${named("lander")} writes \`state: ${state}\`, so the table `
      + `offers a state no step writes and a landing reaching the row above it parks there for good`);
  }
});

test("a state whose turn is a run's own has its successor written by that run's own verb", () => {
  for (const [state, row] of Object.entries(LANDING_STATES)) {
    if (row.turn !== "builder" && row.turn !== "qa") continue;
    for (const one of row.next) {
      assert.ok(writes("claim", one),
        `\`${state}\` is a ${row.turn}'s turn and ${named("claim")} writes no \`state: ${one}\`, so the `
        + `run the state names can take the turn and has nothing to run: the landing parks there for `
        + `good. A route out is a flag of that verb, as \`--judged\` is out of \`qa-owed\`, and a `
        + `write spelled other than \`state: <the state>\` is one this reading cannot see`);
    }
  }
});
