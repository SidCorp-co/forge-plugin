/* The pairing of a ruling call to the verdict its own run logged, where the log and the call both
   carry the run's id; the clock-and-`--of` cases it falls back to are outcomes.test.mjs's. */
import assert from "node:assert/strict";
import test from "node:test";

import { outcomesOf, parkedOver, ruledOver } from "../../../src/stats/eval/outcomes.mjs";
import { pairedOneToOne, rulingsIn } from "../../../src/stats/joined.mjs";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-20T00:00:00.000Z");

const call = (kind, over = {}) => ({ class: kind, at: 0, endedAt: 0, body: "", shell: "", ...over });
let made = 0;
const run = (over = {}) => ({
  path: `/fixture/run-${made += 1}.jsonl`,
  startedAt: NOW - 10 * DAY, endedAt: NOW - 9 * DAY, issues: [], rulings: [], parks: [], ...over,
});
const figureOf = (held, name) => held.figures.find((one) => one.name === name);
const read = (over = {}) => ({ threads: new Map(), ruled: new Map(), horizon: DAY, now: NOW, ...over });
const heldOf = (runs, given) =>
  outcomesOf(runs, { ...given, parks: parkedOver(runs, given.threads, given.documents) });

test("a ruling call pairs with the entry its own run wrote, whatever other runs wrote inside its span", () => {
  const entry = (when, over = {}) => ({ at: when, of: null, accepted: 1, rejected: 0, ...over });
  const span = (when, over = {}) => ({ at: when, endedAt: when + 100, of: null, run: null, ...over });
  const mine = entry(1050, { run: "iss-1-aaaaaaaa", runFrom: "asked" });
  const theirs = entry(1060, { run: "iss-2-bbbbbbbb", runFrom: "worktree" });

  const read = rulingsIn([
    call("forge codex verdict", { at: 1, endedAt: 2, command: "FORGE_SESSION_ID=iss-1-aaaaaaaa forge codex verdict --accepted F1" }),
    call("forge codex verdict", { at: 3, endedAt: 4, command: "export FORGE_SESSION_ID=iss-1-aaaaaaaa && forge codex verdict --accepted F1" }),
    call("forge codex verdict", { at: 5, endedAt: 6, command: "FORGE_SESSION_ID=a forge claim ISS-1; FORGE_SESSION_ID=b forge codex verdict --accepted F1" }),
    call("forge codex verdict", { at: 7, endedAt: 8, command: "forge codex verdict --accepted F1" }),
  ]);
  assert.deepEqual(read.map((one) => one.run), ["iss-1-aaaaaaaa", "iss-1-aaaaaaaa", null, null],
    "the id a prefix or an export grants the call, and none where the text names two or none");

  const wave = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" }), span(1010, { run: "iss-2-bbbbbbbb" })], [mine, theirs], 5000);
  assert.equal(wave.pairs.length, 2, "two runs' overlapping calls each take their own run's entry");
  assert.equal(wave.pairs.find((one) => one.entry === mine).span.run, "iss-1-aaaaaaaa");
  assert.equal(wave.pairs.find((one) => one.entry === theirs).span.run, "iss-2-bbbbbbbb");

  const others = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" })], [theirs], 5000);
  assert.equal(others.pairs.length, 0, "a sole entry another run wrote is not this call's, however the clock reads");
  assert.equal(others.unpaired.length, 1);

  for (const runFrom of ["inherited", "saved", "none", undefined]) {
    const wave2 = [entry(1050, { run: "iss-1-aaaaaaaa", runFrom }), entry(1060, { run: "iss-2-bbbbbbbb", runFrom })];
    const held = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" })], wave2, 5000);
    assert.equal(held.pairs.length, 0, `an id read from \`${runFrom}\` is no run's, so the two entries still contest the call`);
  }
  const inherited = entry(1050, { run: "wave", runFrom: "inherited" });
  const lone = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" })], [inherited], 5000);
  assert.equal(lone.pairs.length, 1, "and a sole entry carrying one pairs by the clock as an unnamed entry does");

  const old = entry(1050);
  const bare = pairedOneToOne([span(1000)], [old], 5000);
  assert.equal(bare.pairs.length, 1, "a call and an entry without identity pair by the clock as before");
  const bareContest = pairedOneToOne([span(1000), span(1100)], [old], 5000);
  assert.equal(bareContest.pairs.length, 0, "and contest as before");
  const named = pairedOneToOne([span(1000, { of: "abc", run: "iss-1-aaaaaaaa" })], [entry(9_000_000, { of: "abc" })], 5000);
  assert.equal(named.pairs.length, 1, "an --of still pairs an entry that carries no identity");
  const unnamedEntry = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" })], [old], 5000);
  assert.equal(unnamedEntry.pairs.length, 1, "and a call with a run pairs an entry without one by the clock");

  const both = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" }), span(1020)], [mine], 5000);
  assert.equal(both.pairs.length, 1, "the call granting the run's id takes that run's entry over a call with none");
  assert.equal(both.pairs[0].span.run, "iss-1-aaaaaaaa");
  assert.equal(both.unpaired[0].run, null, "and the call with none is the one left, still saying it carried no id");
  const twice = pairedOneToOne([span(1000, { run: "iss-1-aaaaaaaa" }), span(1020, { run: "iss-1-aaaaaaaa" })], [mine], 5000);
  assert.equal(twice.pairs.length, 0, "two calls of one run reaching its one entry leave it to neither");
});

/* The run corpus's figure and `forge codex log --score` read one helper, so the two cannot disagree
   about a verdict on a finding the consult never made (ISS-1680). */

test("the eval pairs each run's ruling to the verdict its own run logged, and says why a call went unpaired", () => {
  const verdict = (ms, over = {}) => ({ kind: "verdict", at: new Date(ms).toISOString(), accepted: 1, rejected: 1, ...over });
  const entries = [
    verdict(1050, { run: "iss-1-aaaaaaaa", runFrom: "asked", rejected: 2 }),
    verdict(1060, { run: "iss-2-bbbbbbbb", runFrom: "worktree", rejected: 0 }),
    verdict(5050, { run: "wave", runFrom: "inherited" }),
    verdict(5060, { run: "wave", runFrom: "inherited" }),
  ];
  const mine = { at: 1000, endedAt: 1100, of: null, run: "iss-1-aaaaaaaa" };
  const theirs = { at: 1010, endedAt: 1110, of: null, run: "iss-2-bbbbbbbb" };
  const lost = { at: 5000, endedAt: 5100, of: null, run: "iss-3-cccccccc" };
  const bare = { at: 5010, endedAt: 5110, of: null, run: null };
  const runs = [{ ...run(), rulings: [mine, lost] }, { ...run(), rulings: [theirs, bare] }];

  const ruled = ruledOver(runs, entries);
  assert.equal(ruled.get(mine).rejected, 2, "the call pairs with the verdict its run logged, over the neighbour's inside its span");
  assert.equal(ruled.get(theirs).rejected, 0, "and the neighbour's call with its own");
  assert.equal(ruled.has(lost), false, "two verdicts logged under the wave's id are nobody's, so neither pairs by identity");
  assert.equal(ruled.has(bare), false);

  const figure = figureOf(heldOf(runs, read({ ruled })), "consult findings rejected");
  assert.equal(figure.paired, 2);
  assert.equal(figure.unpaired, 2, "the total stays on the figure");
  assert.deepEqual(figure.unpairedBy, { unnamed: 1, unmatched: 1 },
    "and says how many named no run and how many named one no single entry answered");
});

/* A run standing in a worktree grants its calls no id in their text; its claims print the id the tree
   gave it and where it was read, and that is what its ruling calls are credited to (ISS-2396). */
test("a ruling call whose text names no id takes the one its run's claims printed under a source naming a run", () => {
  const claim = (id, source, over = {}) => call("forge claim", {
    command: "forge claim ISS-1",
    body: `ISS-1  claim: session ${id} (${source ? `id from ${source}; ` : ""}agent, pid 1), renewed for 30 minute(s)`,
    ...over,
  });
  const verdict = (command = "forge codex verdict --accepted F1") => call("forge codex verdict", { at: 9, endedAt: 10, command });
  const runOf = (calls) => rulingsIn(calls).map((one) => one.run);

  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), verdict()]), ["iss-1-aaaaaaaa"], "the tree's id, read off the claim");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "asked"), verdict()]), ["iss-1-aaaaaaaa"], "and the one the run was handed");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), verdict("FORGE_SESSION_ID=iss-9-cccccccc forge codex verdict --accepted F1")]),
    ["iss-9-cccccccc"], "the call's own text outranks its run's claims");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), verdict("FORGE_SESSION_ID=a forge claim ISS-1; FORGE_SESSION_ID=b forge codex verdict --accepted F1")]),
    [null], "and a text that names ids without granting one is not the run's either");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), verdict("unset FORGE_SESSION_ID; forge codex verdict --accepted F1")]),
    [null], "nor one that takes the environment back");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), claim("iss-2-bbbbbbbb", "worktree"), verdict()]),
    [null], "claims that printed two ids name none of them");
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "worktree"), claim("wave", "inherited"), verdict()]),
    [null], "whatever source the second was read under");
  for (const source of ["inherited", "saved", "minted", null]) {
    assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", source), verdict()]), [null],
      `an id a claim read from \`${source ?? "no source it printed"}\` is no run's`);
  }
  assert.deepEqual(runOf([claim("iss-1-aaaaaaaa", "asked", { command: "FORGE_SESSION_ID=iss-1-aaaaaaaa forge claim ISS-1" }), verdict()]),
    [null], "nor one a claim's own text granted, which says nothing of the calls that granted none");

  const entries = [
    { kind: "verdict", at: new Date(1050).toISOString(), accepted: 1, rejected: 2, run: "iss-1-aaaaaaaa", runFrom: "worktree" },
    { kind: "verdict", at: new Date(1060).toISOString(), accepted: 1, rejected: 0, run: "iss-2-bbbbbbbb", runFrom: "worktree" },
  ];
  const mine = rulingsIn([claim("iss-1-aaaaaaaa", "worktree"), call("forge codex verdict", { at: 1000, endedAt: 1100, command: "forge codex verdict --accepted F1" })]);
  const theirs = rulingsIn([claim("iss-2-bbbbbbbb", "worktree"), call("forge codex verdict", { at: 1010, endedAt: 1110, command: "forge codex verdict --accepted F1" })]);
  const lost = rulingsIn([call("forge codex verdict", { at: 1020, endedAt: 1120, command: "forge codex verdict --accepted F1" })]);
  const runs = [{ ...run(), rulings: mine }, { ...run(), rulings: theirs }, { ...run(), rulings: lost }];
  const ruled = ruledOver(runs, entries);
  assert.equal(ruled.get(mine[0])?.rejected, 2, "each call pairs with the verdict its run logged, the neighbour's inside its span");
  assert.equal(ruled.get(theirs[0])?.rejected, 0);
  const figure = figureOf(heldOf(runs, read({ ruled })), "consult findings rejected");
  assert.deepEqual(figure.unpairedBy, { unnamed: 1, unmatched: 0 }, "and only the run that printed no id is left naming no run");
});
