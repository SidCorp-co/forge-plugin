/* Seven readers over 379 files found one shape and nothing else: a module composes a refusal, the
   test file importing it pins the wording, and a file reaching the same refusal through a verb
   re-states the whole sentence instead of proving its route (ISS-2122). Three issues cut the rows
   that reading verified; nothing refused the fourteenth, which a run that cannot know the first
   thirteen existed writes next week.

   The fixture is that census. Run over a tree at `976545b2` this check names eighteen sentences, and
   over the tree those three cuts landed on it names fifteen — the three that fall away being exactly
   the ones ISS-2217 cut. Those figures are on ISS-2216 as the evidence its criteria were judged
   against; what is held here is the second of them, against the table this repository declares. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { FLOOR, against, composedIn, pairsOver, pinnedIn, reachedBy, refusalFor } from "../../../src/checks/suite/one-wording.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;

const TREES = ["plugin", "tools"];

const files = () => {
  const out = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.name === "node_modules") continue;
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) {
        out.push({ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") });
      }
    }
  };
  for (const tree of TREES) walk(join(ROOT, tree), tree);
  return out;
};

/* What stands in this repository today, one entry per sentence and file that re-proves it, each
   naming the issue that will cut it.

   An entry is a debt and not a licence. Writing one costs a filing — the case below refuses an entry
   naming no issue — so the table only shrinks as those filings land, and it was full on the day the
   rule was written because ISS-2122's reading filed the rows it verified by hand and recorded the
   rest as too small for a run of their own. ISS-2264 carries them.

   It sits in this case and not beside the rule because a module under `plugin/src` spelling these
   sentences is a module composing them, which is what the rule reads a source for: declared there,
   the table gave every sentence in it a second composer and the walk went silent over all fifteen.
   Nothing reads a table in a case as either a composition or an assertion. */
const STANDING = [
  { sentence: "one call writes each field once.",
    module: "plugin/src/resolve/flags.mjs",
    home: "plugin/test/resolve/repeated-flag.test.mjs",
    elsewhere: "plugin/test/cli/project-verb.test.mjs",
    issue: "ISS-2264" },
  { sentence: "nothing was worked under this lease",
    module: "plugin/src/flow/lease.mjs",
    home: "plugin/test/flow/renew.test.mjs",
    elsewhere: "plugin/test/cli/reference-lookup.test.mjs",
    issue: "ISS-2264" },
  { sentence: "has not read what this commit stages",
    module: "plugin/hooks/gates/codex/codex-second.mjs",
    home: "plugin/test/gates/codex/codex-second.test.mjs",
    elsewhere: "plugin/test/codex/codex-record.test.mjs",
    issue: "ISS-2264" },
  { sentence: "answer for a judgement the run that built the change made",
    module: "plugin/src/flow/lease/takeover.mjs",
    home: "plugin/test/flow/landing/checkpoint.test.mjs",
    elsewhere: "plugin/test/flow/landing/take.test.mjs",
    issue: "ISS-2264" },
  { sentence: "its own base at that reading, so nothing of its own on it",
    module: "plugin/src/guides/phases.mjs",
    home: "plugin/test/flow/resume/worklog.test.mjs",
    elsewhere: "plugin/test/flow/landing/take.test.mjs",
    issue: "ISS-2264" },
  { sentence: "nothing was worked under this lease",
    module: "plugin/src/flow/lease.mjs",
    home: "plugin/test/flow/renew.test.mjs",
    elsewhere: "plugin/test/flow/override.test.mjs",
    issue: "ISS-2264" },
  { sentence: "no park record on the page is paired with the entry into it",
    module: "plugin/src/flow/route.mjs",
    home: "plugin/test/flow/route/reopen.test.mjs",
    elsewhere: "plugin/test/flow/park/park.test.mjs",
    issue: "ISS-2264" },
  { sentence: "the release is an act on this project's live deploy binding",
    module: "plugin/src/tracker/project-config.mjs",
    home: "plugin/test/flow/close.test.mjs",
    elsewhere: "plugin/test/flow/record/record.test.mjs",
    issue: "ISS-2264" },
  { sentence: "no merged mark, so nothing says the change landed",
    module: "plugin/src/flow/earned.mjs",
    home: "plugin/test/flow/route/credential-ahead.test.mjs",
    elsewhere: "plugin/test/flow/record/rung.test.mjs",
    issue: "ISS-2264" },
  { sentence: "every agent it dispatched carries the same value",
    module: "plugin/src/resolve/config.mjs",
    home: "plugin/test/tools/doctor.test.mjs",
    elsewhere: "plugin/test/flow/shared-holder.test.mjs",
    issue: "ISS-2264" },
  { sentence: "the release is an act on this project's live deploy binding",
    module: "plugin/src/tracker/project-config.mjs",
    home: "plugin/test/flow/close.test.mjs",
    elsewhere: "plugin/test/run/landing/land-ready.test.mjs",
    issue: "ISS-2264" },
  { sentence: "forge doctor --set project.review.paths=<paths>",
    module: "plugin/src/git/reviewed.mjs",
    home: "plugin/test/git/reviewed.test.mjs",
    elsewhere: "plugin/test/run/run-review-declared.test.mjs",
    issue: "ISS-2264" },
  { sentence: "not a clause of the specification",
    module: "plugin/src/spec/citation.mjs",
    home: "plugin/test/spec/citation.test.mjs",
    elsewhere: "plugin/test/spec/checked.test.mjs",
    issue: "ISS-2264" },
  { sentence: "change the flow, or the project's qa configuration",
    module: "plugin/src/flow/earned.mjs",
    home: "plugin/test/flow/earned/flow-is-not-read.test.mjs",
    elsewhere: "plugin/test/tools/doctor.test.mjs",
    issue: "ISS-2264" },
  { sentence: "a write is refused without --yes",
    module: "plugin/src/tools/services/coolify/chosen-route.mjs",
    home: "plugin/test/tools/services/coolify/tracker-route.test.mjs",
    elsewhere: "plugin/test/tools/services/coolify/request.test.mjs",
    issue: "ISS-2264" },
  { sentence: "answered without the field that would place it in a project",
    module: "plugin/src/tools/services/coolify/scope.mjs",
    home: "plugin/test/tools/services/coolify/scope.test.mjs",
    elsewhere: "plugin/test/tools/services/coolify/request.test.mjs",
    issue: "ISS-2264" },
  { sentence: "forge doctor --set project.review.paths=<paths>",
    module: "plugin/src/git/reviewed.mjs",
    home: "plugin/test/git/reviewed.test.mjs",
    elsewhere: "plugin/test/tools/services/doctor/keys.test.mjs",
    issue: "ISS-2264" },
  { sentence: "this filing was made as it would have been without it",
    module: "plugin/src/tracker/filing/neighbours.mjs",
    home: "plugin/test/tracker/filing/fold.test.mjs",
    elsewhere: "plugin/test/tracker/filing/beside.test.mjs",
    issue: "ISS-2264" },
  { sentence: "a heading naming the outcome",
    module: "plugin/src/tracker/issue-shape.mjs",
    home: "plugin/test/tracker/issue/shape.test.mjs",
    elsewhere: "plugin/test/tracker/issue/read-first/targets.test.mjs",
    issue: "ISS-2264" },
];

const keyed = (one) => `${one.sentence} · ${one.elsewhere}`;
const walked = () => files();

const HOME = `export const said = () => "a refusal this module composes and nothing else does";\n`;
const IMPORTS = `import { said } from "../../src/only/here.mjs";\n`;
const PINS = `assert.match(out, /a refusal this module composes and nothing else does/u);\n`;

const tree = (homeBody, elsewhereBody) => [
  { rel: "plugin/src/only/here.mjs", text: HOME },
  { rel: "plugin/test/only/home.test.mjs", text: `${IMPORTS}${homeBody}` },
  { rel: "plugin/test/other/away.test.mjs", text: elsewhereBody },
];

test("the walk reaches the suite's test files, so no pairs is a clean suite and not an empty selector", () => {
  const all = walked();
  const tests = all.filter((one) => /^plugin\/test\/.*\.test\.mjs$/u.test(one.rel));
  assert.ok(tests.length > 300, `the walk found ${tests.length} test files, and this suite has hundreds`);
  for (const one of ["plugin/test/flow/park/park.test.mjs", "plugin/test/run/run-script.test.mjs",
    "plugin/src/flow/route.mjs", "plugin/hooks/gates/codex/codex-second.mjs", "tools/run/land-ready.mjs"]) {
    assert.ok(all.some((each) => each.rel === one), `${one} is in the walk`);
  }
  assert.ok(all.flatMap((one) => (/\.test\.mjs$/u.test(one.rel) ? pinnedIn(one.text) : [])).length > 100,
    "and it read assertion patterns out of them, a reader that pins nothing being the same silence");
});

/* The green condition and the staleness condition are one assertion, because they are one property:
   the table says what stands, so a pair it does not carry is a new debt and an entry the walk no
   longer finds is a cut somebody made without closing its record. */
test("what the walk reports over this repository is what the declared table carries, entry for entry", () => {
  const { fresh, stale } = against(pairsOver(walked()), STANDING);
  assert.deepEqual(fresh, [], "each line above is the refusal itself, naming the file to shorten and "
    + "the fragment to shorten it to; a sentence has just gained a second home");
  assert.deepEqual(stale, [], "delete these from STANDING in this file: the cut landed and its record "
    + "was left behind, and a table claiming a debt already paid is the same stale record from the "
    + "other side");
});

/* The refusal a developer reads is this case's own message and never a table diff: a mismatch
   naming only the sentence sends them to the checker to learn which of two files to shorten. */
test("a pair the table does not carry is reported as the refusal, and one it carries too long as a line to delete", () => {
  const found = pairsOver(tree(PINS, PINS));
  const { fresh, stale } = against(found, []);
  assert.equal(fresh.length, 1);
  assert.equal(stale.length, 0);
  assert.equal(fresh[0], refusalFor(found[0]), "the message is the refusal, whole");
  assert.match(fresh[0], /plugin\/test\/other\/away\.test\.mjs pins, at line 1/u);
  assert.match(fresh[0], /plugin\/test\/only\/home\.test\.mjs pins the same pattern at line 2/u);
  assert.deepEqual(against([], [{ sentence: "gone", elsewhere: "plugin/test/other/away.test.mjs" }]),
    { fresh: [], stale: ["gone · plugin/test/other/away.test.mjs"] });
});

test("every entry of the table names the open issue that will cut it", () => {
  const silent = STANDING.filter((one) => !/^ISS-\d+$/u.test(one.issue ?? "")).map(keyed);
  assert.deepEqual(silent, [], "an entry is a debt and not a licence, so it names the issue that pays it");
  for (const one of STANDING) {
    assert.ok(one.home && one.elsewhere && one.module && one.sentence, `${keyed(one)} is a whole entry`);
  }
});

test("a sentence pinned on both sides of the import line is named with both lines and the home", () => {
  const found = pairsOver(tree(PINS, PINS));
  assert.equal(found.length, 1);
  assert.equal(found[0].home, "plugin/test/only/home.test.mjs");
  assert.equal(found[0].elsewhere, "plugin/test/other/away.test.mjs");
  assert.equal(found[0].homeAt, 2);
  assert.equal(found[0].at, 1);
  assert.equal(found[0].module, "plugin/src/only/here.mjs");
  assert.equal(found[0].sentence, "a refusal this module composes and nothing else does");
});

test("the refusal names the file to shorten and the fragment to shorten it to", () => {
  const said = refusalFor(pairsOver(tree(PINS, PINS))[0]);
  assert.match(said, /^plugin\/test\/other\/away\.test\.mjs pins, at line 1,/u);
  assert.match(said, /plugin\/test\/only\/home\.test\.mjs pins the same pattern at line 2/u);
  assert.match(said, /is the sentence's home/u);
  assert.match(said, /shorten the pattern in plugin\/test\/other\/away\.test\.mjs to `a refusal this/u);
  assert.match(said, /The measure is lexical/u, "and says so, since a restatement in other words is ISS-2147's");
});

test("a negated assertion is a marker for a refusal that must not fire, not a second home", () => {
  const negated = `assert.doesNotMatch(out, /a refusal this module composes and nothing else does/u);\n`;
  assert.deepEqual(pairsOver(tree(PINS, negated)), []);
  assert.deepEqual(pairsOver(tree(negated, PINS)), [],
    "either way round: what is proved absent is a different claim from what is proved");
  assert.equal(pairsOver(tree(PINS, `${negated}${PINS}`)).length, 1,
    "and a file doing both is read on the assertion that pins, not on the one beside it");
});

test("a wording more than one module composes names no one sentence", () => {
  const twice = [...tree(PINS, PINS),
    { rel: "plugin/src/also/here.mjs", text: HOME.replace("said", "alsoSaid") }];
  assert.deepEqual(pairsOver(twice), [],
    "there is then no one module to name as the home and no one sentence to have one");
});

/* Watched failing: `carries no landing checkpoint` is composed by three modules — the takeover
   refusal, the land-ready stop and the ship's own line — and a rule reading the first module it
   found as the home paired two files asserting two different sentences. */
test("the three modules that share a wording produce no pair between the files reading each", () => {
  const found = pairsOver(walked()).filter((one) => one.sentence.includes("carries no landing checkpoint"));
  assert.deepEqual(found, []);
});

test("a wording shorter than the floor is a status word and not a sentence", () => {
  const short = "reads `done`";
  assert.ok(short.length < FLOOR);
  const shortHome = `export const said = () => "${short}";\n`;
  const pins = `assert.match(out, /${short}/u);\n`;
  assert.deepEqual(pairsOver([{ rel: "plugin/src/only/here.mjs", text: shortHome },
    { rel: "plugin/test/only/home.test.mjs", text: `${IMPORTS}${pins}` },
    { rel: "plugin/test/other/away.test.mjs", text: pins }]), []);
});

/* Watched failing: a case reaching its subject through the fixture beside it reads as a second home
   where only the direct import line is followed, and `run/landing/moved-pin.test.mjs` is that case. */
test("a test file reaching the module through a helper it imports is the home and forms no pair", () => {
  const through = [
    { rel: "plugin/src/only/here.mjs", text: HOME },
    { rel: "plugin/test/other/fixture.mjs", text: `import { said } from "../../src/only/here.mjs";\n` },
    { rel: "plugin/test/only/home.test.mjs", text: `${IMPORTS}${PINS}` },
    { rel: "plugin/test/other/away.test.mjs", text: `import { ran } from "./fixture.mjs";\n${PINS}` },
  ];
  assert.deepEqual(pairsOver(through), []);
  assert.ok(reachedBy("plugin/test/other/away.test.mjs",
    (rel) => through.find((one) => one.rel === rel)?.text).has("plugin/src/only/here.mjs"));
});

/* ISS-2218's finding, kept as a case because the two files still read the same sentences: one asserts
   that the usage carries the reckoning at all, the other pins the values in it. */
test("a presence check is not the same pattern as the wording check beside it", () => {
  const found = pairsOver(walked()).filter((one) =>
    one.elsewhere === "plugin/test/run/run-script.test.mjs"
    || one.home === "plugin/test/run/run-script.test.mjs");
  assert.deepEqual(found, [],
    "a pattern whose variable parts are captured or classed is a different pattern from one whose "
    + "parts are literal, so the two never form a pair");
});

/* ISS-2219 left one sentence asserted on both sides on purpose: AC-01-5-44 obliges the derivation
   and the report row alike, and the sentence has no fragment shorter than the clause. The two sides
   pin it under different patterns, so the lexical rule passes it without an exemption to maintain. */
test("a clause obliging both the derivation and the report row produces no pair", () => {
  const found = pairsOver(walked()).filter((one) =>
    [one.home, one.elsewhere].includes("plugin/test/tools/doctor/release.test.mjs")
    || [one.home, one.elsewhere].includes("plugin/test/tracker/release-switch.test.mjs"));
  assert.deepEqual(found, []);
});

/* Watched failing: a sentence a `+` split for the line width was held as two runs, so a pattern
   pinning it whole matched neither half and the pair went unreported. The join is the output, and
   only what the output does not carry — an interpolation, a newline — breaks a run. */
test("a sentence is every quoted run a plus chain joins, split at what it interpolates", () => {
  const composed = composedIn('const said = `${ref} carries no turn, so `\n  + "the take is refused";\n');
  assert.equal(composed.length, 1);
  assert.deepEqual(composed[0].runs, ["", " carries no turn, so the take is refused"]);
  assert.equal(composed[0].line, 1);
  assert.deepEqual(composedIn('const a = "one";\nconst b = "two";\n').map((one) => one.runs),
    [["one"], ["two"]], "two statements are two sentences, whatever sits between them");
});

/* Watched failing: a group's own syntax read as text. `(?:` put a `:` at the head of every run of a
   grouped pattern, so its longest literal run matched no source and the pair went unreported. */
test("a group's introducer is syntax, so a grouped pattern reads as the sentence inside it", () => {
  const grouped = `assert.match(out, /(?:a refusal this module composes and nothing else does)/u);\n`;
  const found = pairsOver(tree(grouped, grouped));
  assert.equal(found.length, 1);
  assert.equal(found[0].sentence, "a refusal this module composes and nothing else does");
  for (const opener of ["?:", "?=", "?!", "?<=", "?<!", "?<said>"]) {
    const one = `assert.match(out, /(${opener}a refusal this module composes and nothing else does)/u);\n`;
    assert.equal(pairsOver(tree(one, one)).length, 1, opener);
  }
});

/* Watched failing: the four below each unpinned or mis-sliced a real pair, and three of them were
   found by the review of 7983d6d8 rather than by the walk, which reports a missed pair as silence. */
test("a sentence the source split for the line width is one sentence, and pairs as one", () => {
  const split = 'export const said = () => "a refusal this module " + "composes and nothing else does";\n';
  const found = pairsOver([{ rel: "plugin/src/only/here.mjs", text: split },
    { rel: "plugin/test/only/home.test.mjs", text: `${IMPORTS}${PINS}` },
    { rel: "plugin/test/other/away.test.mjs", text: PINS }]);
  assert.equal(found.length, 1);
  assert.equal(found[0].sentence, "a refusal this module composes and nothing else does");
});

test("an escape naming one character is that character, not the digits spelling it", () => {
  const hex = `assert.match(out, /\\x61 refusal this module composes and nothing else does/u);\n`;
  const found = pairsOver(tree(hex, hex));
  assert.equal(found.length, 1);
  assert.equal(found[0].sentence, "a refusal this module composes and nothing else does");
});

/* A message is what a developer is shown when a case fails, not a wording the case holds the code
   to, and the two sit in the same call. Which argument it is turns on how many the verb spends on
   what it judges: `throws` spends two, and reading its second as a message unpinned every refusal
   this suite proves with `assert.throws`. */
test("the message an assertion prints is not a wording it pins", () => {
  const printed = `assert.ok(done, "a refusal this module composes and nothing else does");\n`;
  assert.deepEqual(pairsOver(tree(PINS, printed)), []);
  const said = `assert.equal(out, "a refusal this module composes and nothing else does");\n`;
  assert.equal(pairsOver(tree(said, said)).length, 1, "the same words as the expected value are pinned");
  const thrown = `assert.throws(run, /a refusal this module composes and nothing else does/u);\n`;
  assert.equal(pairsOver(tree(thrown, thrown)).length, 1, "and the error `throws` expects is not its message");
  const withMessage = `assert.match(out, /a refusal this module composes and nothing else does/u, "why");\n`;
  assert.equal(pairsOver(tree(withMessage, withMessage)).length, 1);
});

test("a module that re-exports another is that other's door, and an ordinary import is not", () => {
  const door = { rel: "plugin/src/only/door.mjs", text: `export { said } from "./here.mjs";\n` };
  const through = [{ rel: "plugin/src/only/here.mjs", text: HOME }, door,
    { rel: "plugin/test/only/home.test.mjs", text: `${IMPORTS}${PINS}` },
    { rel: "plugin/test/other/away.test.mjs", text: `import { said } from "../../src/only/door.mjs";\n${PINS}` }];
  assert.deepEqual(pairsOver(through), [], "the door's importer reaches what stands behind it");
  const uses = [...through];
  uses[1] = { rel: "plugin/src/only/door.mjs", text: `import { said } from "./here.mjs";\nexport const other = said;\n` };
  assert.equal(pairsOver(uses).length, 1,
    "a module using another does not make its wording the importer's subject");
});
