/* Which rung a whole run was worked at, apart from the rest of the profile because it is the one figure read out of a record this CLI wrote rather than off the harness's own timings, and it is read in two spellings for as long as transcripts carrying the retired one exist (ISS-822). */
import assert from "node:assert/strict";
import test from "node:test";

import { render } from "../../src/flow/record/page.mjs";
import { RUNG_UNKNOWN, rungRun } from "../../src/stats/transcripts.mjs";
import { RUNGS } from "../../src/ladder.mjs";

/* The call's own class says which call posted the record. Every line below carries the same words in a body some other verb printed: read from those, a run is filed at the rung of whatever issue it happened to read. */
const said = (klass, body) => ({ class: klass, body });

/* Written by `render`, the only writer of these records: a body composed by hand would not carry the tag and fence that say which record a stamped key belongs to, and asserting over one would re-derive the blind spot (F2 of the whole-set read). */
const wrote = (rung, extra = {}) =>
  render("confirmation", { where: ["src/a.mjs"], is: "a reading", finding: "holds", rung, ...extra });

test("a run's rung is read off the confirmation it wrote, and off no other call that echoes one", () => {
  const [trivial, , feature] = RUNGS;
  assert.equal(rungRun([said("forge record confirmation", wrote(trivial))]), trivial);
  assert.equal(rungRun([]), RUNG_UNKNOWN, "a run that confirmed nothing is filed under no rung");
  for (const klass of ["forge issue", "forge resume", "read", "forge record verdict"]) {
    assert.equal(rungRun([said(klass, wrote(trivial))]), RUNG_UNKNOWN,
      `\`${klass}\` printing the record is a run reading a thread, not a run that claimed a rung`);
  }
  assert.equal(rungRun([said("forge record confirmation", wrote("enormous"))]), RUNG_UNKNOWN,
    "a word this ladder has not got names no rung, and is not folded into the nearest one");
  assert.equal(rungRun([said("forge record confirmation", `${wrote(trivial)}\n\nrung: ${feature}`)]), trivial,
    "and a line the same call printed after the record is prose: the class covers the shell, not the write");
  assert.equal(
    rungRun([said("forge record confirmation", wrote(trivial)), said("forge record confirmation", wrote(feature))]),
    feature,
    "a batch is as heavy as its heaviest member, never the cheapest of them",
  );
});

/* Two ways a body carries the word without a record having stamped it, and the writer makes both: `blockOf` indents every continuation line of a multi-line field, and a chained read prints whole records of its own. A reading that took either would re-file the run that wrote it (F2, F3). */
test("prose inside a field cannot claim a rung the run did not stamp", () => {
  const [trivial, , feature] = RUNGS;
  const written = wrote(trivial, { detail: `the plan said one thing\nrung: ${feature}` });
  assert.match(written, /\n {2}rung: feature/u, "the writer really does indent a continuation line");
  assert.equal(rungRun([said("forge record confirmation", written)]), trivial,
    "so the stamped key decides, and a sentence a person typed under another field does not");
  assert.equal(rungRun([said("forge record confirmation", `${wrote(trivial)}\n\n${wrote(feature)}`)]), trivial,
    "and the record the write printed is the first one: a thread read after it belongs to another issue");
  assert.equal(rungRun([said("forge record confirmation", wrote(feature))]), feature,
    "while the key the writer really wrote is read, or nothing would be");
});

/* Every transcript older than the rename stamped `tier:`, and both stats screens classify every run by reading it: a reader taking only the new key would re-file the whole corpus under the row for the runs that named none. */
test("a transcript stamped in the retired spelling classifies at the rung the canonical one does", () => {
  const [trivial, , feature] = RUNGS;
  const retired = (rung) => wrote(rung).replace(/^rung: /mu, "tier: ");
  assert.match(retired(trivial), /^tier: trivial$/mu, "the fixture really is the retired spelling");
  for (const rung of [trivial, feature]) {
    assert.equal(rungRun([said("forge record confirmation", retired(rung))]),
      rungRun([said("forge record confirmation", wrote(rung))]),
      `a \`${rung}\` reads the same in either spelling, which is what keeps an eval window still`);
  }
  assert.equal(rungRun([said("forge issue", retired(trivial))]), RUNG_UNKNOWN,
    "and the record boundary holds for the retired key: a thread read is not a claim");
  assert.equal(rungRun([said("forge record confirmation", retired(trivial).replace(/^tier: /mu, "  tier: "))]),
    RUNG_UNKNOWN, "as does the indentation rule, an indented lookalike being prose inside a field");
});
