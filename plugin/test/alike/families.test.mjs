/* The families and the lines, with no tracker in it: what a sweep collected is a list of scored
   links, and everything below is what the report makes of one. The floor is asserted to be the
   create path's own, because a second copy of it here is the one thing this module may not have. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { familiesOf, linksFrom, sweepLines } from "../../src/alike/families.mjs";
import { FLOOR } from "../../src/tracker/filing/neighbours.mjs";

const titlesOf = (...keys) => new Map(keys.map((key) => [key, `${key} as it reads`]));

const swept = (links, held = {}) => sweepLines({
  families: familiesOf(links),
  titles: titlesOf("ISS-1", "ISS-2", "ISS-3", "ISS-4"),
  measured: 4,
  saturated: [],
  notes: [],
  short: null,
  ...held,
}).join("\n");

test("the better of the two readings is the link's score, and the end that measured it is named", () => {
  const links = linksFrom([
    { from: "ISS-1", to: "ISS-2", score: 0.74 },
    { from: "ISS-2", to: "ISS-1", score: 0.72 },
  ]);
  assert.equal(links.length, 1, "one unordered pair is one link");
  assert.equal(links[0].score, 0.74);
  assert.match(swept(links), /ISS-1 ~ ISS-2 {2}0\.74 {2}off ISS-1's own title/u);
});

test("a chain is not a family: only a set that reads alike all round is one", () => {
  const chain = linksFrom([
    { from: "ISS-1", to: "ISS-2", score: 0.76 },
    { from: "ISS-3", to: "ISS-4", score: 0.76 },
    { from: "ISS-2", to: "ISS-3", score: 0.71 },
  ]);
  assert.deepEqual(familiesOf(chain).map((one) => one.members),
    [["ISS-1", "ISS-2"], ["ISS-3", "ISS-4"], ["ISS-2", "ISS-3"]],
    "three pairs, and nothing claims the ends of the chain read alike");
  const round = familiesOf(linksFrom([...chain, { from: "ISS-1", to: "ISS-3", score: 0.72 },
    { from: "ISS-1", to: "ISS-4", score: 0.72 }, { from: "ISS-2", to: "ISS-4", score: 0.72 }]));
  assert.deepEqual(round.map((one) => one.members), [["ISS-1", "ISS-2", "ISS-3", "ISS-4"]],
    "every pair of the four measured, so the four are one family");
  assert.equal(round[0].links.length, 6, "and each of the six readings is carried");
});

test("the strongest family is first, and every reading inside it is printed", () => {
  const said = swept(linksFrom([
    { from: "ISS-1", to: "ISS-2", score: 0.71 },
    { from: "ISS-3", to: "ISS-4", score: 0.79 },
  ]));
  assert.ok(said.indexOf("ISS-3 ~ ISS-4") < said.indexOf("ISS-1 ~ ISS-2"),
    `the order is by score:\n${said}`);
  assert.match(said, /reads alike to every other member/u);
});

/* The pivot the recursion takes to stay bounded is the one thing that could drop a family or report
   one twice, and a set that reads alike all round is where it does the most work. */
test("a set of twenty-one that all read alike is one family, and every reading in it is carried", () => {
  const links = [];
  for (let one = 1; one <= 21; one += 1) {
    for (let two = one + 1; two <= 21; two += 1) links.push({ from: `ISS-${one}`, to: `ISS-${two}`, score: 0.71 });
  }
  const held = familiesOf(linksFrom(links));
  assert.equal(held.length, 1, "one family, not one per subset of it");
  assert.equal(held[0].members.length, 21);
  assert.equal(held[0].links.length, 210);
});

test("the floor the report names is the create path's own, and neither module holds a number", () => {
  assert.match(swept(linksFrom([{ from: "ISS-1", to: "ISS-2", score: 0.71 }])),
    new RegExp(`${FLOOR.toFixed(2)}, the floor`, "u"));
  for (const at of ["families.mjs", "alike.mjs"]) {
    const source = readFileSync(new URL(`../../src/alike/${at}`, import.meta.url), "utf8");
    const found = source.match(/\b\d+\.\d+\b/gu) ?? [];
    assert.deepEqual(found, [], `${at} declares a threshold of its own: ${found.join(", ")}`);
  }
});

test("nothing joined is an answer with the count in it, not an empty one", () => {
  const said = swept([]);
  assert.match(said, /No two of the 4 open issue\(s\) measured read alike/u);
  assert.doesNotMatch(said, /family 1/u);
});

test("a saturated query and a refused one are two sentences, and neither claims a size", () => {
  const said = swept([], { saturated: ["ISS-3"], notes: ["ISS-4, the semantic query could not run: gone"] });
  assert.match(said, /ISS-3/u);
  assert.match(said, /short by an unknown amount/u);
  assert.match(said, /measured against\s+nothing: ISS-4, the semantic query could not run: gone/u);
});

test("a walk that did not come back whole carries the reading's own sentence", () => {
  assert.match(swept([], { short: "The walk over the open issues reached 2 issue(s)" }),
    /The walk over the open issues reached 2 issue\(s\)/u);
});
