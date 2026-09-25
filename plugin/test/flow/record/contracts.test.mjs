/* A record is judged by the shapes of the contract number in its tag, so a bump re-judges nothing
   earned before it (ISS-60). The bump is simulated with a table of two rows: the real contract
   stays where it is. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("contracts-");
const { parseAll, printRecord, render } = await import("../../../src/flow/record/page.mjs");
const { shapeGaps } = await import("../../../src/flow/earned.mjs");
const { SHAPES_AT, newestOf } = await import("../../../src/flow/machine/contracts.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { CONTRACT } = await import("../../../src/guides/contract.mjs");

/* Contract 2 renames the confirmation's `is` to `what`, which is the change FR-04's way back says
   makes every older record unreadable unless the old reader stays. */
const renamed = {
  ...SHAPES.confirmation,
  fields: SHAPES.confirmation.fields.map((one) => (one.flag === "is" ? { ...one, flag: "what", label: "What" } : one)),
};
const BUMPED = { 1: SHAPES_AT[1], 2: { ...SHAPES_AT[1], confirmation: renamed } };
const WRITTEN = render("confirmation", { is: "the reader is not versioned", where: ["a.mjs"], finding: "holds" });
const tagged = (contract) => WRITTEN.replace(/contract \d+`$/u, `contract ${contract}\``);

test("a payload written under contract 1 reads whole after a bump to 2 whose shapes would refuse it", () => {
  assert.match(WRITTEN, /· contract 1`$/u, "the payload is written under contract 1");
  const [old] = parseAll(WRITTEN, BUMPED);
  assert.equal(old.fields.is, "the reader is not versioned", "read by contract 1's keys");
  assert.deepEqual(shapeGaps("confirmation", old, [], BUMPED), []);
  const [under2] = parseAll(tagged(2), BUMPED);
  assert.equal(under2.fields.is, undefined, "contract 2 has no `is` to read");
  assert.deepEqual(shapeGaps("confirmation", under2, [], BUMPED), ["--what"],
    "the same payload under contract 2 is judged by contract 2");
});

test("a number past the newest is read, and refused by name with the update that clears it", () => {
  const [ahead] = parseAll(tagged(3), BUMPED);
  assert.equal(ahead.contract, 3, "the page keeps it rather than dropping it unread");
  assert.deepEqual(shapeGaps("confirmation", ahead, [], BUMPED),
    ["a contract 3 record, and this build reads contract 1 to 2: `claude plugin update` then restart the session"]);
  assert.deepEqual(shapeGaps("confirmation", parseAll(tagged(9))[0], []),
    [`a contract 9 record, and this build reads contract ${CONTRACT}: \`claude plugin update\` then restart the session`]);
});

test("every number up to the current one keeps a shape table of its own", () => {
  const numbers = Array.from({ length: CONTRACT }, (_, at) => at + 1);
  assert.deepEqual(Object.keys(SHAPES_AT).map(Number), numbers,
    "a bump keeps the old SHAPES under its own number in plugin/src/flow/machine/contracts.mjs before the live one changes");
  assert.equal(new Set(Object.values(SHAPES_AT)).size, CONTRACT, "no two numbers share one table");
  assert.equal(SHAPES_AT[CONTRACT], SHAPES, "the current number reads the shapes this build writes");
  assert.equal(newestOf(), CONTRACT);
});

const printed = (record) => {
  const lines = [];
  const was = console.log;
  console.log = (line) => lines.push(line);
  try {
    printRecord({ at: "2026-09-25T10:00:00Z", record });
  } finally {
    console.log = was;
  }
  return lines[0];
};

test("the page names a record's number only where it differs from the current one", () => {
  assert.equal(printed(parseAll(WRITTEN)[0]), "Confirmation  (2026-09-25T10:00)");
  assert.equal(printed(parseAll(tagged(9))[0]), "Confirmation  (2026-09-25T10:00, contract 9)");
});
