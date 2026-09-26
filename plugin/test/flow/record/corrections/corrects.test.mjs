/* A correction names what it corrects, so it is found by that rather than by reading its sentence
   (ISS-74): the field is asked at the write, validated against the kinds this verb writes and the
   issue's own fields, and excused on every correction written before it existed. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("corrects").path;
const { SHAPES, correctedKind } = await import("../../../../src/flow/machine.mjs");
const { render, parse } = await import("../../../../src/flow/record/page.mjs");
const { shapeGaps } = await import("../../../../src/flow/earned.mjs");
const { KINDS } = await import("../../../../src/flow/record/record-rows.mjs");

const { check } = SHAPES.correction;
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", env: process.env });

test("--corrects takes a kind this verb writes or a field of the issue, either with an occasion after it", () => {
  for (const kind of KINDS) assert.equal(check({ corrects: kind }), null, `${kind} is a kind the verb writes`);
  for (const good of ["plan:steps", "criteria:3", "verdict:2", "review:43b811e", "issue:status", "issue:status:2", "issue:complexity,priority"]) {
    assert.equal(check({ corrects: good }), null, good);
  }
  for (const bad of ["plans", "superseded", "folded", "issue", "issue:", "plan:", "plan: steps", "issue::2", "issue:status:"]) {
    assert.match(check({ corrects: bad }), new RegExp(`^--corrects as a record kind, or \`issue:<field>\`.*, not \`${bad.replace(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}\``, "u"),
      `${bad} is refused with the form it takes`);
  }
  assert.match(check({ corrects: "plans" }), /the kinds are confirmation, .*, plan$/u, "an unknown kind is answered with the kinds");
  assert.equal(correctedKind("criteria:3"), "criteria", "the kind is read with the occasion dropped");
});

test("a correction written before the field reads back whole", () => {
  const older = render("correction", { moved: "criterion 2 names the order", why: "the finding showed it" });
  const read = parse(older);
  assert.equal(read.fields.corrects, undefined);
  assert.deepEqual(shapeGaps("correction", read), [], "no gap: the field is asked at the write and excused at the read");
  const newer = parse(render("correction", { moved: "m", why: "w", corrects: "plan" }));
  assert.equal(newer.fields.corrects, "plan", "and one carrying it reads it back");
  assert.deepEqual(shapeGaps("correction", parse(render("correction", { moved: "m", why: "w", corrects: "nothing" }))).length, 1,
    "while one naming no kind is a gap, however it reached the page");
});

test("a correction with no --corrects is refused before any call, naming the flag and the form it takes", () => {
  const run = ask("record", "correction", "ISS-1", "--moved", "the reading moved", "--why", "the code said otherwise");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^record correction needs --corrects \(what it corrects\), which takes a record kind, or `issue:<field>`/mu);
  assert.doesNotMatch(run.stderr, /No Forge endpoint|forge doctor/u, "a flag error costs no call");
});

test("the help names the field on the kind's own row, and says which kinds refuse a replacement", () => {
  const own = ask("record", "correction", "-h").stdout;
  assert.match(own, /^ {2}correction {3}--moved M --why W --corrects K /mu, "on the row the parse reads its flags off");
  const all = ask("record", "-h").stdout;
  assert.match(all, /^Every other kind is latest-wins, an earned plan, criteria, note only after a correction\.$/mu);
});
