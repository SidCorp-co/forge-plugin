/* The contract is a document a verb serves, so its addresses are checked the way a route is: the
   parts are the file's own headings, and a heading renamed, dropped or added fails here rather than
   turning one command into a near miss for whoever reaches for it next. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { flat, tempHome } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("contract").path;
const {
  CONTRACT,
  contentsOf,
  contractAnswer,
  contractParts,
  contractPath,
  keysOfAll,
  listingRow,
  partFor,
  partsOf,
  readContract,
  stageLine,
  statesContract,
} = await import("../../src/guides/contract.mjs");
const { DEFAULT } = await import("../../src/guides/flow.mjs");
const { servedBody } = await import("../../src/guides/skill-guides.mjs");
const { CHECKS, ORDER, deployedOwed, judgedOwed, viewFrom } = await import("../../src/flow/earned.mjs");
const { PHASE } = await import("../../src/guides/phases.mjs");
const { FLOW_SLUGS } = await import("../../src/guides/flow.mjs");
const { LIGHTER, RUNGS, SPARES, complexityFor } = await import("../../src/ladder.mjs");
const { rungReport } = await import("../../src/ladder-report.mjs");
const { render } = await import("../../src/flow/record/page.mjs");

const ROOT = new URL("../../../", import.meta.url).pathname;
const PLUGIN = join(ROOT, "plugin");
const TEXT = readContract();
const PARTS = partsOf(TEXT);
const STAGED = [...ORDER, "dropped"];
const TRACKED = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

test("the contract is inside the plugin, at one path, and nothing else in the tree holds it", () => {
  assert.equal(contractPath(), join(PLUGIN, "guides", "contract", "default"));
  assert.ok(existsSync(contractPath()), `${contractPath()} is what every route now names`);
  const holding = TRACKED.filter((rel) =>
    readFileSync(join(ROOT, rel), "utf8").includes("## Two layers, one record"));
  /* One file per flow: a flow's directory is the whole of what it serves, so the part exists once under each and nowhere else. */
  assert.deepEqual(holding, FLOW_SLUGS.map((flow) => `plugin/guides/contract/${flow}/02-two-layers-one-record.md`),
    "one source per flow, each flow's own, and nothing outside the served trees holds it");
});

test("every status of the flow has a part, and the sections are the files' own headings", () => {
  for (const status of STAGED) {
    assert.ok(partFor(PARTS, status), `no part of the contract states the ${status} stage`);
  }
  assert.deepEqual(keysOfAll(PARTS), [
    "the-issue-flow-contract", "two-layers-one-record", "the-flow", "the-stages",
    ...STAGED, "when-the-run-breaks", "the-mechanics",
    "earning-and-unearning", "the-review", "evidence", "release-and-routes", "what-it-does-not-do",
  ], "a heading renamed, dropped or added moves the command that reaches it, and says so here");
  const keys = keysOfAll(PARTS);
  assert.equal(new Set(keys).size, keys.length, "two parts under one key would serve whichever came first");
});

/* One file per part, and the file name is what a reader opens to find the part `forge guide contract
   <slug>` printed: the number orders the join and the slug is the address. */
test("each part is one file, whose name carries its order and its slug", () => {
  const files = contractParts({});
  assert.equal(files.length, PARTS.length, `${files.length} file(s) and ${PARTS.length} part(s)`);
  files.forEach(({ name }, at) => {
    assert.match(name, /^\d\d-[a-z][a-z0-9-]*\.md$/u, `${name} does not name an order and a slug`);
    const slug = name.slice(3, -3);
    const keys = PARTS[at].keys.map((one) => one.replace(/_/gu, "-"));
    assert.ok(keys.some((one) => slug === one || slug.startsWith(`${one}-`)) || keys.join("-") === slug,
      `${name} sits at part ${at} whose keys are ${PARTS[at].keys.join(", ")}`);
  });
});


/* A part arrives whole in one call, so its size is what a reader pays to reach one rule. The whole
   was 70,809 characters over 25 parts, most of them about a stage the reader is not at (ISS-802). */
const PART_MAX = 3000;
const WHOLE_MAX = 20000;
test("no part is longer than one pass, and the contract is shorter than what it replaced", () => {
  const over = PARTS.filter((part) => part.chars > PART_MAX)
    .map((part) => `${part.keys[0]} is ${part.chars} characters`);
  assert.deepEqual(over, [], `a part over ${PART_MAX} characters is two parts: split it at a heading, `
    + "which gives each half its own address");
  assert.ok(TEXT.length <= WHOLE_MAX,
    `the contract is ${TEXT.length} characters, over the ${WHOLE_MAX} it is held to: what has a `
    + "checker is said by the checker, and `npm run check` names the case that measures it");
});

test("the parts partition the whole, so nothing is served twice and nothing is unreachable", () => {
  const rejoined = PARTS.map((part) => part.text).join("\n");
  assert.equal(flat(rejoined), flat(TEXT));
  assert.ok(PARTS.every((part) => part.chars > 100), "a part with no body is a heading nobody wrote under");
});

/* The derivation, on headings this file does not have: the rule is a heading's words up to the em
   dash, and the statuses of a part are the code spans in that half. */
test("a heading becomes its own address, and a heading of statuses becomes one part per status", () => {
  const made = partsOf("# A Title — with a tail\n\nx\n\n### `alpha`, `beta` — reads two things\n\ny\n");
  assert.deepEqual(made.map((part) => part.keys), [["a-title"], ["alpha", "beta"]]);
  assert.equal(made[1].said, "reads two things");
  assert.deepEqual(partsOf("## Two\n\na\n\n#### Deeper still\n\nb\n").map((part) => part.keys),
    [["two"], ["deeper-still"]], "every heading level is an address, so none of the text is unreachable");
  assert.deepEqual(partsOf("## Two layers, one record\n\nz\n")[0].keys, ["two-layers-one-record"]);
});

/* The body `forge guide issue-flow` serves, not the stub Claude Code loads (ISS-353), joined from
   the parts of the flow that serves it: a phase read out of one part file would be measured against
   a fragment of the method rather than the method. */
const SKILL = servedBody("issue-flow", PLUGIN);
const VERIFICATION = join(PLUGIN, "guides", "skills", "issue-flow", DEFAULT, "references", "verification.md");
/* Split rather than matched to a lookahead: a lazy body against a multiline `$` ends at the first
   line break, and every phase then reads as empty. */
const phasesOf = (text) => Object.fromEntries(
  text.split(/^## /mu)
    .map((one) => [/^Phase (\d)/u.exec(one)?.[1], flat(one)])
    .filter(([n]) => n),
);

/* The pass that earns a review has a place as well as a shape, and the place is the last step of the
   phase the ladder names the review in: met after the judging instead, it moves a path and every
   verdict is owed again — thirty-eight records for nineteen criteria, once (ISS-236). The replay
   before it is the method's and has one home; what the contract keeps is that the pass is what earns
   the review, and no surface may send a landing back for a recheck (ISS-51, ISS-230). */
test("the read that earns the review has one place, and no landing owes a recheck", () => {
  const phases = phasesOf(SKILL);
  assert.match(PHASE.in_progress[0], /to the review/u, "the ladder names the review in Phase 4");
  const naming = Object.keys(phases).filter((n) => /read that earns the review/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the spine names that read in Phase 4 and in no other phase");
  /* By place and not by presence: a read named before the replay leaves both phrases in the section
     and judges a head earlier than the one the mark's note can bridge. */
  const order = (text, first, then) => text.includes(first) && text.indexOf(first) < text.indexOf(then);
  assert.ok(order(phases["4"], "Replay the change onto", "the read of the whole set"),
    "the replay comes before the read it is taken after");
  const naming4 = Object.keys(phases).filter((n) => /Replay the change onto/u.test(phases[n]));
  assert.deepEqual(naming4, ["4"], "and the replay is stated in that phase and nowhere else");
  const held = flat(partFor(PARTS, "in_progress").text);
  assert.match(held, /the pass the review is earned by/u, "the contract names what earns the review");
  assert.match(held, /never a recheck/u, "and says what a landing owes instead");
  /* Every surface, not the two that state the rule: one left prescribing the retired round is a run
     reading that one and taking a step the CLI refuses. */
  for (const [what, held2] of [["the contract", TEXT], ["the served method", SKILL],
    [VERIFICATION, readFileSync(VERIFICATION, "utf8")]]) {
    assert.doesNotMatch(held2, /owes its own recheck/u, `${what} sends a landing back for a recheck`);
  }
});

/* A case's name is prose, so one named for two properties while asserting one is green forever and
   the reviewer reading the diff agrees, every assertion present being correct — two of ISS-791's
   criteria were met by nothing and its own run judged them met. Nothing compares a title to its
   assertions mechanically, so the method names the comparison target instead, in the phase that
   judges and in no other: two phases answering it is a run reading whichever it reached first. */
test("Phase 5 names what a criterion is matched against, and no other phase answers that", () => {
  const phases = phasesOf(SKILL);
  for (const [beat, phrase] of [
    ["the comparison target", "the assertion lines that would go red"],
    ["that a case's name is not it", "never a case's name"],
    ["what a name carrying two claims costs", "two searches rather than one"],
    ["that an assertion which cannot fail is not coverage", "cannot fail covers nothing"],
  ]) {
    assert.ok(phases["5"].includes(phrase), `Phase 5 no longer names ${beat}, so a run judging a `
      + "criterion is back to reading a case's title for the assertions under it (ISS-960)");
  }
  /* The instruction's own words, not the two ordinary ones in it: a phase saying anything else is
     matched against anything is prose this rule has no claim on (review 6cae45, F2). */
  const naming = Object.keys(phases).filter((n) => /criterion is matched against/u.test(phases[n]));
  assert.deepEqual(naming, ["5"], "and the phase that judges the criteria is the only one that says "
    + "what they are matched against");
});

/* The tree keeps moving after the read, and what moves it is this repository's own checkers; three
   runs in one night each invented a different amount of what that owes. Whether behaviour moved is
   not mechanical, so the method names the test, in the phase that takes the read and in no other. */
test("Phase 4 says what a refusal arriving after that read owes, and no other phase does", () => {
  const phases = phasesOf(SKILL);
  for (const [beat, phrase] of [
    ["the case at all", "refusing the tree after that read"],
    ["what the fix is measured against", "measured against the set the read carried"],
    ["what a fix inside that set owes", "moving no behaviour owes no second read for what it changed"],
    ["what it says instead", "a correction naming it and why the read still holds"],
    ["the read a wider fix owes", "widening the set or moving behaviour owes a fresh read of the "
      + "whole set at the new head"],
    ["the verdicts it owes with it", "every verdict re-judged there"],
  ]) {
    assert.ok(phases["4"].includes(phrase), `Phase 4 no longer names ${beat}, so a run whose own fix `
      + "moved the head after the read is back to inventing what the record owes (ISS-1008)");
  }
  const naming = Object.keys(phases).filter((n) => /the tree after that read/u.test(phases[n]));
  assert.deepEqual(naming, ["4"], "and the phase that takes the read is the only one that says what "
    + "a refusal arriving after it owes");
});

/* The cadence has one home, and a retirement leaving a copy behind is what ISS-108 refuses. Both
   directions are asserted: absence alone passes on a file somebody emptied, reading exactly like a
   clean repository. The history doc is no rule surface — it records what runs did, not what to do. */
const RETIRED_CADENCE = /as often as the work changes it/u;
const HISTORY = "docs/issue-flow-dry-runs.md";
test("the gate's cadence is stated in the verification reference and restated nowhere", () => {
  const held = flat(readFileSync(VERIFICATION, "utf8"));
  for (const [beat, phrase] of [
    ["how often the gate is spent", "The gate is spent once per unit of work"],
    ["that the baseline is the only whole run", "the only whole run the work owes"],
    ["what a finished unit spends", "one scoped run when a unit of work is finished"],
    ["that a unit is not an edit", "never each edit inside one"],
    ["what runs between units", "the changed file's own suite"],
    ["that the ship's gate is the release's",
      "the release's gate is that run and there is nothing left to spend after the push"],
  ]) {
    assert.ok(held.includes(phrase), `the verification reference no longer states ${beat}, so a run `
      + `reading it is back to guessing how often to spend the gate (ISS-290)`);
  }
  const tracked = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  const holding = tracked.filter((rel) =>
    rel !== HISTORY && RETIRED_CADENCE.test(readFileSync(join(ROOT, rel), "utf8")));
  assert.deepEqual(holding, [], "a surface still tells a run to spend the gate as often as the work "
    + "changes it, which the cadence above replaced: a sentence retired is retired from every surface "
    + "at once, so delete it there rather than leaving two answers to one question (ISS-108, ISS-290)");
});

/* A guide carries fact and method, never live data. An issue key is live data: it is open until the
   tracker says otherwise, and ISS-14 outlived its rule on three surfaces at once (ISS-226). A date is
   the same defect wearing a number. */
test("the contract names no issue and no date, which the tracker and git hold", () => {
  const live = [[/\bISS-\d+\b/gu, "an issue key, which is open until the tracker says otherwise"],
    [/\b20\d\d-\d\d-\d\d\b/gu, "a date, which git holds"]];
  for (const [pattern, what] of live) {
    const found = PARTS.flatMap((part) =>
      [...part.text.matchAll(pattern)].map((one) => `${part.keys[0]}: ${one[0]}`));
    assert.deepEqual(found, [], `the contract names ${what}: a served guide carries fact and method, `
      + "and live data in it is a claim that stops being true with nothing failing");
  }
});

/* One rung per actor, so a reader at either is told what that actor owes and not the other's: a part stating both is the composed rung wearing two file names (ISS-1065). */
test("each rung at the end of a run has a part, and neither states the other's half", () => {
  const judging = flat(partFor(PARTS, "testing").text);
  const deploying = flat(partFor(PARTS, "awaiting_release").text);
  assert.match(judging, /verdict/u, "the judging rung's part is about the verdicts");
  assert.doesNotMatch(judging, /verification/u, "and says nothing of what the deploying actor owes");
  assert.match(deploying, /verification/u, "the deploying rung's part is about the verification");
  assert.doesNotMatch(deploying, /verdict/u, "and nothing of the judge's");
});

test("a separator misremembered costs no round", () => {
  assert.equal(partFor(PARTS, "in-progress"), partFor(PARTS, "in_progress"));
  assert.equal(partFor(PARTS, "mechanics"), null, "and only a separator or a case is forgiven");
});

test("the table of contents is one line per part and per status, and none of the prose", () => {
  const lines = contentsOf(PARTS, statesContract(TEXT));
  const rows = lines.slice(3);
  assert.equal(rows.length, keysOfAll(PARTS).length);
  for (const row of rows) assert.match(row, /^ {2}\S+ +\d+ {2}forge guide contract \S+$/u);
  assert.match(lines[0], new RegExp(`contract ${CONTRACT}`, "u"));
  assert.equal(lines.join("\n").includes("Presence is checked and fit is judged"), false,
    "no sentence of the contract");
  assert.match(listingRow(), /^contract\n {2}this plugin's own, not the tracker's/u);
});

test("the number the file states is its own line, and the prose about versions is not it", () => {
  assert.equal(statesContract(TEXT), CONTRACT);
  assert.equal(statesContract("Every typed write carries the contract version it was written under."), null);
  assert.equal(statesContract("**Contract 4.** and then some prose"), 4);
});


test("the stage line names the part for the status and the command that prints it", () => {
  for (const status of STAGED) {
    const said = stageLine(status, PARTS);
    assert.match(said, new RegExp(`the ${status} stage`, "u"), status);
    assert.match(said, new RegExp(`\`forge guide contract ${status}\``, "u"), status);
    assert.match(said, /\(\d+ characters\)/u, status);
  }
  assert.match(
    stageLine("needs_info", PARTS),
    /No needs_info stage in the contract at \S+ — `forge doctor`/u,
    "a status no part covers is said out loud, never left silent",
  );
  assert.match(
    stageLine("confirmed", partsOf(null), "/gone/guides/v1/contract"),
    /No confirmed stage in the contract at \/gone\/guides\/v1\/contract/u,
    "and a copy that arrived without the parts reads the same way, which `forge doctor` tells apart",
  );
});

test("the verb's answer is one part, the contents, or one refusal that names the way out", () => {
  assert.deepEqual(contractAnswer({ part: "awaiting_release" }).lines,
    [partFor(PARTS, "awaiting_release").text, "",
      "No rung was named, so this is the `feature` text — the top rung, which is what an unstated"
        + " rung resolves to. `--rung <name>` serves a lighter one.", "",
      "Flow default, which this project runs; `forge doctor` names its source."],
    "the part, the rung it was rendered for, and then the flow it was served for");
  assert.equal(contractAnswer({}).lines[0].startsWith("The issue-flow contract"), true);
  const flag = contractAnswer({ tracker: true }).refusal;
  assert.match(flag, /--tracker does not apply to contract/u);
  assert.doesNotMatch(flag, /a guide's own text/u, "and a refusal says nothing about what the flag does");
  assert.match(contractAnswer({ part: "open", extra: ["more"] }).refusal, /takes one part/u);
  assert.match(contractAnswer({ part: "mechanics" }).refusal, /Did you mean: the-mechanics\?/u);
  assert.match(contractAnswer({ part: "nothing-like-it" }).refusal, /lists every part/u);
});


let clock = 0;
const recorded = (kind, fields) =>
  ({ createdAt: `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`, body: render(kind, fields) });
const UNMARKED = "`forge issue` should take the `data.relations` route.";
const VERIFIED = [recorded("verification", { where: "the installed plugin", commit: "43b811e", evidence: ["43b811e"] })];
const climbed = (moved) => [recorded("correction", { moved, why: "what the work turned out to be" })];
/* One rung asks both halves, so a case reading the note's drop satisfies the judging half as well, on the one criterion `weighed` carries: judging items left owed would answer for the deploying half never being asked (ISS-1022). */
const JUDGED = [recorded("verdict", { criterion: "1. The one check that fails without the change.",
  verdict: "pass", commit: "43b811e", evidence: ["43b811e"] })];
/* A rung is the tracker's complexity and nothing else, so a case at a rung sets the field the entry
   checks read; `null` is the issue that holds none, which is the top rung by the upward rule. */
const weighed = (rung, extra = {}) => ({
  description: UNMARKED,
  plan: "",
  acceptanceCriteria: "1. The one check that fails without the change.",
  ...(rung ? { complexity: complexityFor(rung) } : {}),
  ...extra,
});
const missing = (status, issue, comments = []) =>
  CHECKS[status](viewFrom("the-uuid", issue, comments), "ISS-3").map((one) => one.what);
const deploying = (issue, comments = []) =>
  deployedOwed(viewFrom("the-uuid", issue, comments), "ISS-3").map((one) => one.what);
/* One case per row, keyed by the payload the row drops rather than by the status: a status carries a
   row per payload, and two rows under one key would leave the second unasked (ISS-1066). */
const CASES = {
  decision: { owed: /^no decision record/u },
  plan: { owed: /^the plan field is empty$/u },
  note: { comments: [...VERIFIED, ...JUDGED], owed: /^no release note/u },
};

test("every payload a rung lightens is dropped by its own check, and the rung report is the one home", () => {
  assert.deepEqual(LIGHTER.map((one) => one.kind), Object.keys(CASES),
    "a row this test has no case for is a payload lightened and unasked");
  for (const row of LIGHTER) {
    assert.ok(CHECKS[row.status], `the ladder drops ${row.drops} at ${row.status}, which is no entry check`);
    assert.ok(row.because, `${row.status} drops ${row.drops} and says why nowhere`);
    const held = CASES[row.kind].comments ?? [];
    for (const rung of row.rungs) {
      assert.ok(!missing(row.status, weighed(rung), held).some((one) => CASES[row.kind].owed.test(one)),
        `${row.status} is reported to drop ${row.drops} for a ${rung} and the check still asks for it`);
    }
    const heavy = missing(row.status, weighed(null), held);
    assert.ok(heavy.some((one) => CASES[row.kind].owed.test(one)),
      `and the complexity is the whole difference at ${row.status}: ${heavy.join("; ") || "nothing owed"}`);
  }
  for (const [status, rows] of Object.entries(Object.groupBy(LIGHTER, (one) => one.status))) {
    assert.deepEqual(missing(status, weighed(rows[0].rungs[0]), CASES[rows.at(-1).kind].comments ?? []), [],
      `${status} carries ${rows.length} row(s) and a rung granted every one of them is still asked for something`);
  }
});

/* What a rung drops, why, and the rounds it spares are `LIGHTER`, `LIGHTER.because` and `SPARES`,
   printed for the issue in hand by `forge advance --owed`. A guide restating any of it is a second
   copy that goes stale when the data moves, and the contract carried one for months (ISS-802). */
test("what a rung drops and the rounds it spares are the rung report's, and no guide restates them", () => {
  const top = rungReport({ plan: "", moved: [], whole: true, complexity:null }, "ISS-3");
  for (const rung of RUNGS) {
    for (const one of SPARES[rung]) {
      const words = one.split(";")[0].split(",")[0].trim();
      const said = rungReport({ plan: "", moved: [], whole: true, complexity:complexityFor(rung) }, "ISS-3");
      assert.ok(said.includes(words), `\`${rung}\` may spend fewer rounds on "${words}" and --owed does not say so`);
    }
  }
  for (const row of LIGHTER) {
    const said = rungReport({ plan: "", moved: [], whole: true, complexity:complexityFor(row.rungs[0]) }, "ISS-3");
    assert.ok(said.includes(row.drops) && said.includes(row.because),
      `${row.status} drops ${row.drops} and --owed prints neither it nor the reason`);
  }
  assert.ok(top.includes("nothing dropped"), "and a feature is told it drops nothing");
  const restating = PARTS.filter((part) =>
    RUNGS.some((name) => new RegExp(`\`${name}\``, "u").test(part.text))
    && Object.values(SPARES).flat().concat(LIGHTER.map((one) => one.drops))
      .some((one) => part.text.includes(one.split(";")[0].split(",")[0].trim())));
  assert.deepEqual(restating.map((part) => part.keys[0]), [], "a part of the contract restates what "
    + "`forge advance --owed` prints about a rung: cut it to the command, which prints it for the "
    + "issue in hand rather than in general");
  const [lowest] = RUNGS;
  assert.deepEqual(SPARES[lowest], SPARES[RUNGS[1]],
    "the two rungs below the top spare different rounds, and the contract says they differ by ceiling alone");
});

/* A rung's claim is that the work is small, never a claim about what the gate found: this gate is
   scoped and remembers, so its failure mode is a step ABSENT rather than red, and a rung skipping
   the one whole run would hand later scoped runs a green nothing established. */
test("no rung buys a judgement: the baseline and the migration classification cost every rung alike", () => {
  for (const rung of RUNGS) {
    const held = weighed(rung, { plan: "Schema coupling: yes" });
    assert.ok(missing("in_progress", held).some((one) => /^no baseline/u.test(one)),
      `a ${rung} is asked for no baseline, and the one whole gate run of the work is what it skipped`);
    assert.ok(missing("awaiting_release", { ...held, acceptanceCriteria: "" }).length,
      `a ${rung} declaring schema coupling earns the rung with nothing said about the migration`);
  }
  assert.equal(LIGHTER.some((row) => row.status === "in_progress"), false,
    "and no row lightens in_progress, so the demand is the table's and not this case's");
});

test("the rung drops nothing the contract keeps, and a declared person takes a fix off the path", () => {
  assert.equal(missing("confirmed", weighed("fix")).length, 1, "the confirmation with its where");
  assert.deepEqual(missing("approved", weighed("fix", { acceptanceCriteria: "" })),
    ["the criteria field holds no numbered line `N. outcome`"], "the criteria, being the whole of a fix's plan");
  assert.deepEqual(deploying(weighed("fix")).map((one) => one.slice(0, 16)), ["no verification:"]);
  const seen = missing("awaiting_release", weighed("fix", { plan: "User-facing outcome: yes" }), VERIFIED);
  assert.ok(seen.includes("no release note and no withholding either"), "declaring a person owes the note again");
  assert.ok(seen.some((one) => /no person has answered/u.test(one)), "and the park with it");
});

test("a climb outlives the corrections written after it, and a shortened page never lightens", () => {
  const both = [...climbed("Size: fix -> feature"), ...climbed("criterion 2 | the review proved it impossible")];
  assert.equal(missing("approved", weighed("fix"), both).length, 2,
    "the newest correction is the plan's, and `assemble` keeps that one alone (ISS-161): the climb is "
    + "read off every comment, or the correction `approved` asks for would put the issue back on the light path");
  const cut = CHECKS.approved(viewFrom("the-uuid", weighed("fix"), [], "2 of 40 comments read"), "ISS-3");
  assert.equal(cut.length, 2,
    "and a cut cannot show a climb, so losing one would shrink a shortfall every other check only grows");
  /* Read like every other record and not by its tag alone: a comment carrying `moved` and no `why`
     is no correction, and taking it for one would un-lighten an issue on a payload nothing wrote. */
  const half = [{ createdAt: "2026-09-02T11:00:00.000Z", body: `\`\`\`forge-record
moved: Size: fix -> feature
\`\`\`

\`forge-record: correction · contract 1\`` }];
  assert.deepEqual(missing("approved", weighed("fix"), half), [],
    "a correction missing its why is not the climb, and the light path stands");
});

test("a correction climbs a fix back onto the full path, and reads one direction only", () => {
  const back = (status) => missing(status, weighed("fix"), [...climbed("Size: fix -> feature"), ...VERIFIED]);
  assert.deepEqual(back("approved"), [
    "no decision record: each reading decided with its assumption and undo, or an explicit none",
    "the plan field is empty",
  ], "both rows the climb takes back are owed again, and neither answers for the other");
  assert.ok(back("awaiting_release").includes("no release note and no withholding either"));
  for (const moved of ["Size: feature -> fix", "Size: fix later"]) {
    assert.deepEqual(missing("approved", weighed("fix"), climbed(moved)), [],
      `\`${moved}\` is not the climb, and reading it as one unearns a status the issue holds`);
  }
  assert.equal(missing("approved", weighed("fix"), climbed("Size: fix to feature")).length, 2,
    "while the word and the arrow are both the author's");
});

/* CLAUDE.md, Rules only: the checker is the one statement, so the guide may not keep the sentence. */
const RETIRED_BY_CHECK = [
  [/the project's gate run once, whole and\s+distrusting any remembered pass/u,
    "the baseline's wholeness, which `in_progress` now refuses on the record's own scope"],
  [/An image left on your disk proved nothing to anyone/u,
    "that a screen's proof is an attachment, which the rung now refuses a verdict for lacking"],
  [/Do not silently expand scope/u,
    "that a file the plan does not name is a correction, which `developed` now refuses the mark for"],
];

test("a sentence an entry check now enforces is stated by the check and by no guide", () => {
  const tracked = execFileSync("git", ["-C", ROOT, "ls-files", "*.md"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  for (const [pattern, what] of RETIRED_BY_CHECK) {
    const holding = tracked.filter((rel) =>
      rel !== HISTORY && pattern.test(readFileSync(join(ROOT, rel), "utf8")));
    assert.deepEqual(holding, [], `a surface still states ${what}: a rule with a checker is stated `
      + `once, in the checker, and the guide points at it (ISS-108, ISS-359)`);
  }
});

test("the checks point back from the guides, and the evidence table keeps the kinds no check can detect", () => {
  const held = flat(readFileSync(VERIFICATION, "utf8"));
  for (const [beat, phrase] of [
    ["that the baseline's scope is the check's demand", "`in_progress` refuses one saying it was not"],
    ["what the check cannot judge", "a gate that stops at its first failure has measured only what"],
    ["that a screen's verdict owes an attachment", "refuses a verdict under a declared screen change"],
  ]) {
    assert.ok(held.toLowerCase().includes(phrase.toLowerCase()),
      `the verification reference no longer names ${beat}, so a run meets the refusal with no page behind it`);
  }
  /* The half ISS-318's fold would have deleted: no declaration says a change is an API or a batch
     job, so no check can speak for those rows and the prose is still the only thing that does. */
  for (const kind of ["An API", "A CLI", "A library", "A batch or data job", "Generated output", "Infrastructure"]) {
    assert.ok(held.includes(`| ${kind} |`), `the evidence table no longer names ${kind}, which no check replaced`);
  }
  const guide = flat(SKILL);
  assert.ok(guide.includes("`developed` refuses a path in it that neither the plan nor a correction"),
    "Phase 4 no longer names the check that refuses a file the plan does not name");
});

/* The fallback is prose about a refusal, so it can drift from the refusal without failing anything.
   The shapes are parsed out of the section rather than asserted beside it: a third bullet, or one
   opening on a verdict the check refuses, is a run told to spend a Phase 5 on evidence the rung will
   not take, and it fails here. The check's own file is another run's (ISS-72). */
const SHAPES = { skipped: [], pass: ["rendered.png"] };
const SECTION = "## When no login reaches the rendered state";
/* The whole section, not the one list in it: a shape offered in a second list, or in a sentence
   under its own bullet, reaches a run exactly as the first list does. */
const shapesIn = (text) => {
  const at = text.indexOf(SECTION);
  const held = at < 0 ? "" : text.slice(at + SECTION.length).split("\n## ")[0];
  return [...held.matchAll(/^- \*\*`(\w+)`/gmu)].map((found) => found[1]);
};

test("the fallback for a screen with no credential names the two shapes the judging check leaves", () => {
  const text = readFileSync(VERIFICATION, "utf8");
  const held = flat(text);
  for (const [beat, phrase] of [
    ["that a missing credential does not park the issue", "not a reason to set the work down"],
    ["that routing evidence carries no rendered-state criterion", "nothing about what that commit draws"],
    ["that the attachment shows its own criterion's state", "show the state that criterion is about"],
  ]) {
    assert.ok(held.includes(phrase), `the verification reference no longer names ${beat}, so a run `
      + "with no login is back to guessing what evidence earns a verdict");
  }
  const criteria = "1. The first outcome.";
  const judged = (verdict, evidence) => [{
    createdAt: "2026-09-02T10:01:00.000Z",
    authorId: "agent",
    body: render("verdict", { criterion: "1. The outcome.", verdict, commit: "43b811e", evidence, why: "no credential on record" }),
  }];
  const seen = (comments) => viewFrom("the-uuid", {
    plan: "Screen change: yes\nSchema coupling: no",
    acceptanceCriteria: criteria,
    attachments: [{ name: "rendered.png" }],
  }, comments);
  const owed = (comments) => judgedOwed(seen(comments), "ISS-72").map((one) => one.what);
  /* Every shape the section offers, and only those: an offer the check refuses fails on the drive,
     and one it accepts that nobody wrote a case for fails on the name. */
  const offered = shapesIn(text);
  assert.deepEqual(offered, Object.keys(SHAPES), "the fallback section offers a set of verdict "
    + "shapes this test has no case for, so the guide and the check are no longer held together");
  for (const verdict of offered) {
    assert.deepEqual(owed(judged(verdict, SHAPES[verdict])), [], `the reference sends a criterion to `
      + `\`${verdict}\` and the check does not leave it, so the guide asks for evidence the rung refuses`);
  }
  const refused = owed(judged("pass", ["https://host.test/ 200", "43b811e"]));
  assert.equal(refused.length, 1, "while routing evidence alone earns the refusal the reference warns of");
  assert.match(refused[0], /cites no attachment/u);
});
