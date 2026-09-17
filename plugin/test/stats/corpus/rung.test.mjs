/* Which rung a whole run was worked at, apart from the rest of the profile because it is the one figure read out of a record this CLI wrote rather than off the harness's own timings, and it is read in two spellings for as long as transcripts carrying the retired one exist (ISS-822). */
import assert from "node:assert/strict";
import test from "node:test";

import { SHAPES, readRecords, stampedIn, tagFor } from "../../../src/flow/machine.mjs";
import { RUNG_UNKNOWN, rungRun } from "../../../src/stats/corpus/transcripts.mjs";
import { render } from "../../../src/flow/record/page.mjs";
import { RUNGS } from "../../../src/ladder.mjs";

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

/* The host truncates a long tool result from the top, and a confirmation echo is long: what reaches the reading begins part way down the payload, having lost the opening fence and kept the closing one and the tag. Read through a fenced block alone, 73% of this project's own corpus filed at no rung at all (ISS-1689). */
const headless = (body) => {
  const lines = body.split("\n");
  const at = lines.findIndex((line) => /^`{3,}forge-record$/u.test(line));
  return lines.slice(at + 1).join("\n");
};

test("a record echo whose opening fence the host truncated away stamps the rung it wrote", () => {
  const [trivial, , feature] = RUNGS;
  const cut = headless(wrote(feature));
  assert.doesNotMatch(cut, /^`{3,}forge-record$/mu, "the fixture really has lost the fence that opened it");
  assert.match(cut, /forge-record: confirmation/u, "and really has kept the tag that says which record it is");
  assert.equal(rungRun([said("forge record confirmation", cut)]), feature);
  assert.equal(rungRun([said("forge record confirmation", headless(wrote(trivial)).replace(/^rung: /mu, "tier: "))]),
    trivial, "in the retired spelling too, which is most of what a truncated corpus holds");
});

test("a truncated body says which record it is by its tag line, or it says nothing", () => {
  const [trivial] = RUNGS;
  const cut = headless(wrote(trivial));
  assert.equal(rungRun([said("forge record confirmation", cut.replace(/`?forge-record: .*`?/u, ""))]),
    RUNG_UNKNOWN, "a body truncated past its own tag has nothing left saying which record the keys belong to");
  assert.equal(rungRun([said("forge record confirmation", cut.replace(/: confirmation ·/u, ": verdict ·"))]),
    RUNG_UNKNOWN, "and a tag naming another kind is that kind's body, whatever keys it carries");
});

test("what bounds a headless payload is the fence that closed it, above and below", () => {
  const [trivial, , feature] = RUNGS;
  const cut = headless(wrote(trivial));
  assert.equal(rungRun([said("forge record confirmation", cut.replace(/^`{3,}$/mu, ""))]),
    RUNG_UNKNOWN, "with no closing fence there is nothing to say the keys are a record's rather than prose");
  assert.equal(rungRun([said("forge record confirmation", cut.replace(/^rung: /mu, "  rung: "))]),
    RUNG_UNKNOWN, "an indented lookalike continues the field above it, as it does inside a fence");
  assert.equal(
    rungRun([said("forge record confirmation", cut.replace(/^rung: .*\n/mu, "").replace(/^(`{3,})$/mu, "$1\n\nrung: feature"))]),
    RUNG_UNKNOWN,
    `a \`${feature}\` the same call printed below that fence is prose, the record having ended at it`,
  );
});

test("a truncated body reads the same whichever of the two readers is asked", () => {
  const [, , feature] = RUNGS;
  const cut = headless(wrote(feature));
  assert.equal(readRecords(cut, (kind) => SHAPES[kind])[0]?.fields.finding, stampedIn(cut, "confirmation", "finding"),
    "the whole record and one stamped key come off one reading, so neither reads a body the other cannot");
  assert.equal(stampedIn(cut, "confirmation", "rung"), feature,
    "and the rung is there for the reading that wants it, being the stamp rather than a field of the record");
});

/* A body carrying a fenced example of its own closes that example on a bare fence too, so the fence alone does not say a record's head was cut off: one standing whole above the closing fence is an example, and the payload of a truncated record has none, every continuation of a field being indented (ISS-1689 F1). */
const example = (rung, lead = "", open = "```", close = "```") =>
  [`${lead}${open}yaml`, `rung: ${rung}`, close, "", tagFor("confirmation", 1)].join("\n");

test("an ordinary fenced example is not a record whose head was cut off", () => {
  const [, , feature] = RUNGS;
  assert.match(example(feature), /forge-record: confirmation/u, "the fixture really does carry the tag a record carries");
  assert.equal(rungRun([said("forge record confirmation", example(feature))]), RUNG_UNKNOWN,
    "the example opens a fence of its own, which a truncated payload cannot have above the fence that closed it");
  const quoted = ["rung: feature", "```", `Example: ${tagFor("confirmation", 1)}`, "```"].join("\n");
  assert.equal(rungRun([said("forge record confirmation", quoted)]), RUNG_UNKNOWN,
    "a sentence ending in the tag quotes a record rather than making one, and the tag is matched over the whole line");
  assert.equal(stampedIn(quoted, "confirmation", "rung"), null, "the stamped read says so too");
  const opener = ["rung: feature", "```", "ordinary example", "```", "", tagFor("confirmation", 1)].join("\n");
  assert.equal(rungRun([said("forge record confirmation", opener)]), RUNG_UNKNOWN,
    "a bare fence that opens an example is not the one that closed a payload: `render` writes the tag under that one");
  assert.equal(stampedIn(opener, "confirmation", "rung"), null, "the stamped read says so too");
  assert.equal(readRecords(`- **Nơi đã xem:** src/a.mjs\n\n${opener}`, (kind) => SHAPES[kind])[0]?.rewritten, true);
  const tilde = example(feature, "", "~~~", "```\n~~~");
  assert.equal(rungRun([said("forge record confirmation", tilde)]), RUNG_UNKNOWN,
    "markdown fences under tildes too, and a backtick run inside one is the example's text and not a fence");
  assert.equal(readRecords(`- **Nơi đã xem:** src/a.mjs\n\n${tilde}`, (kind) => SHAPES[kind])[0]?.rewritten, true);
  for (const lead of [" ", "  ", "   "]) {
    assert.equal(rungRun([said("forge record confirmation", example(feature, lead))]), RUNG_UNKNOWN,
      "markdown opens a fence under three spaces, and a payload of this CLI's own has no fence above the one that closed it");
    assert.equal(stampedIn(example(feature, lead), "confirmation", "rung"), null, "the stamped read says so too");
  }
  for (const lead of ["", " ", "  ", "   "]) {
    const rewritten = `- **Nơi đã xem:** src/a.mjs\n\n${example(feature, lead)}`;
    assert.equal(readRecords(rewritten, (kind) => SHAPES[kind])[0]?.rewritten, true,
      "so a body the prose pipeline rewrote still reads as rewritten, and not as the example's keys");
  }
});
