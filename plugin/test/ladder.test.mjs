/* The ladder has three rungs and two of them stop owing the same three payloads, so what keeps the
   shortest from being the middle one wearing another word is the report and the rounds it names.
   Spawned against a tracker rather than called: `--owed` reads the record before it says anything,
   and a run learns its rung from the same verb and the same record it learns the shortfall from. */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "./fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("ladder").path;
const {
  COMPLEXITY_NAMES, CEILINGS, FIX, LIGHTER, SPARES, RUNGS, complexityFor, belowTop, climbsIn,
  escalatedBy, heightOf, lightens, lighterRows, overCeiling, climbForm, rungFrom, rungClaimed,
  splits, rungOf,
} = await import("../src/ladder.mjs");
const { planFlags } = await import("../src/flow/machine.mjs");
const { render } = await import("../src/flow/record/page.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;

const body = (rung) => `\`forge issue\` should take the \`data.relations\` route.\n\nSize: ${rung}.\n`;

/* Every issue carries its rung as the tracker's own complexity; the line in the body is the prose a
   tracker full of issues filed under the two-source ladder still holds, and nothing reads it. */
const issue = (rung, extra = {}) => ({
  documentId: `${rung}-uuid`,
  issueId: `ISS-${RUNGS.indexOf(rung) + 70}`,
  status: "open",
  title: `the change that rides the ${rung} rung`,
  description: body(rung),
  complexity: complexityFor(rung),
  ...extra,
});

/* The tracker's five complexities, each on a body claiming nothing at all. */
const COMPLEXITIES = ["xs", "s", "m", "l", "xl"];
const UNMARKED = "`forge issue` should take the `data.relations` route.";
const weighed = (complexity, at, extra = {}) => ({
  documentId: `${complexity}-uuid`,
  issueId: `ISS-${at}`,
  status: "open",
  title: `the change the tracker weighed at ${complexity}`,
  description: UNMARKED,
  complexity: complexity,
  ...extra,
});

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [
    issue("trivial"), issue("fix"),
    /* The two holding no complexity: one whose body says nothing about a rung and one whose body
       names the top rung in full, which is the pair a report speaking of the body would tell apart. */
    { ...issue("feature"), description: "no mark here", complexity: null },
    { ...issue("feature"), documentId: "claimed-uuid", issueId: "ISS-73", complexity: null },
    ...COMPLEXITIES.map((complexity, at) => weighed(complexity, 80 + at)),
    weighed("xs", 90, { documentId: "disagree-uuid", description: body("feature") }),
  ],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    /* The lease is a payload write's own gate, so the fixture keeps what a claim puts on the issue. */
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const held = state.issues.find((one) => one.documentId === args.documentId) ?? state.issues[0];
      if (args.action === "get") return held;
      if (args.action === "update") return Object.assign(held, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const owed = (reference) => ranAsync(FORGE, ["advance", reference, "--owed"], tracker.env);

test("the complexity names the rung, and an issue holding none is at the top", () => {
  for (const rung of RUNGS) {
    assert.deepEqual(rungClaimed({ complexity: complexityFor(rung) }), { rung: rung, complexity: complexityFor(rung) },
      `\`${complexityFor(rung)}\` on the tracker is the ${rung} rung, and the field is what claimed it`);
  }
  assert.deepEqual(rungClaimed({}), { rung: "feature", complexity: null },
    "an issue holding no complexity reads as the rung that owes everything, claimed by nothing");
  assert.equal(rungClaimed({ complexity: "huge" }).rung, "feature", "as does one holding a word the ladder has no rung for");
});

/* Every case below is one a reader could resolve either way, and each was resolved downward until a
   consult on this change said so (F1, F2, F4). The rule they share is docs/cli/the-ladder.md's: the
   rung that owes more costs a run a payload it did not need, and the other costs the record a
   status nobody established. */
test("a doubtful reading answers with the rung that owes more, never the one that owes less", () => {
  const [lowest, middle] = RUNGS;
  assert.deepEqual(climbsIn(`Size: ${RUNGS.at(-1)} -> ${lowest}`), [],
    "a pair pointing down is no climb: read by its destination alone it would raise a trivial to a fix");
  assert.deepEqual(climbsIn(`Size: ${lowest} -> ${middle}\nSize: ${middle} -> ${RUNGS.at(-1)}`),
    [middle, RUNGS.at(-1)],
    "and every climb a page states, so the newest correction cannot erase the climb before it");
  assert.equal(rungOf({ complexity: complexityFor(lowest), plan: "", moved: [`Size: ${RUNGS.at(-1)} -> ${middle}`], whole: true }),
    lowest, "so a downward correction moves nothing at all");
});

/* The correction is written in one spelling and read in two: every record posted before the rung had one word says `Size:`, and a reader that dropped it would take a climb back off the issues that carry one (ISS-822). */
test("a correction in the retired spelling reads to the rung one in the canonical spelling reads to", () => {
  const [lowest, middle] = RUNGS;
  const top = RUNGS.at(-1);
  for (const [from, to] of [[lowest, middle], [lowest, top], [middle, top]]) {
    assert.deepEqual(climbsIn(`Rung: ${from} -> ${to}`), climbsIn(`Size: ${from} -> ${to}`),
      `\`${from} -> ${to}\` climbs to the same rung in either spelling`);
  }
  assert.deepEqual(climbsIn(`Rung: ${top} -> ${lowest}`), [], "and neither spelling reads a climb downward");
  const fields = (moved) => rungOf({ complexity: complexityFor(lowest), plan: "", moved, whole: true });
  assert.equal(fields([`Rung: ${lowest} -> ${top}`]), fields([`Size: ${lowest} -> ${top}`]),
    "so an issue corrected before the rename and one corrected after it are judged at one rung");
});

/* Read off the ladder rather than a list of its own: a rung added with no row here would be a rung
   the checks apply and this file never asks about. */
test("every rung the ladder has has its rows, its rounds, and a ceiling unless it is the top", () => {
  const [lowest, ...rest] = RUNGS;
  const top = RUNGS.at(-1);
  for (const rung of RUNGS) {
    assert.ok(Array.isArray(SPARES[rung]), `${rung} is a rung of the ladder with no rounds column`);
  }
  assert.deepEqual(SPARES[lowest], SPARES[rest[0]],
    "the two rungs below the top spare different rounds, so they differ in more than their ceiling");
  assert.notDeepEqual(CEILINGS[lowest], CEILINGS[rest[0]],
    "and the ceiling is then the whole of the difference, so the two cannot differ in nothing at all");
  assert.equal(SPARES[top].length, 0, "the top rung is what the others are measured against");
  assert.equal(CEILINGS[top], undefined, "and has nothing to climb to, so it has no ceiling");
  for (const rung of RUNGS.filter((one) => one !== top)) {
    assert.ok(CEILINGS[rung].files > 0 && CEILINGS[rung].lines > 0, `${rung} has no ceiling to be past`);
  }
  assert.ok(CEILINGS[lowest].lines < CEILINGS[rest[0]].lines, "and a lower rung admits a smaller landing");
});

/* Through `lightens`, which is what every entry check calls: asserting only that the top rung is
   absent from `row.rungs` passes with exemptions removed altogether, the list being data either
   way. The two spawned tests below carry the same claim end to end, through the checks themselves. */
const at = (rung) => ({ complexity: complexityFor(rung), plan: "", moved: [], whole: true });

test("what a rung stops owing is the row's, and a rung absent from a row owes that payload", () => {
  const top = RUNGS.at(-1);
  for (const row of LIGHTER) {
    for (const rung of RUNGS) {
      assert.equal(lightens(row.status, row.kind, at(rung)), row.rungs.includes(rung),
        `at ${row.status} a \`${rung}\` ${row.rungs.includes(rung) ? "stops owing" : "owes"} ${row.drops}`);
    }
    assert.equal(lightens(row.status, row.kind, at(top)), false,
      `${row.status} drops ${row.drops} for the top rung`);
  }
  for (const rung of RUNGS) {
    assert.equal(lightens("in_progress", "baseline", at(rung)), false,
      `${rung} is exempted from the baseline, which no rung buys`);
  }
});

/* Driven over a table of its own: the live one waives every kind of a status at the same rungs, so
   a reader keying on the status alone answers it correctly and the equality could not fail. What
   fails without the kind is exactly a rung that bought one payload of a status and not the other. */
test("a status carrying two rows is waived each payload by its own row and by neither of the other's", () => {
  const rows = [
    { status: "approved", rungs: [FIX], kind: "decision", drops: "a decision record", because: "the confirmation held it" },
    { status: "approved", rungs: [RUNGS[0]], kind: "plan", drops: "the plan field", because: "the criteria are the whole of it" },
  ];
  assert.equal(lightens("approved", "decision", at(FIX), rows), true, "the row for this kind names this rung");
  assert.equal(lightens("approved", "plan", at(FIX), rows), false,
    "and the other kind's row does not, so one answer for the status would waive a payload nothing bought");
  assert.deepEqual(lighterRows("approved", at(FIX), rows).map((one) => one.kind), ["decision"],
    "one row of the two is granted here, where taking the first of the status would have named the plan");
  assert.deepEqual(lighterRows("approved", at(FIX), LIGHTER).map((one) => one.kind), ["decision", "plan"],
    "while the live table grants both at this rung, and a reader of it reports both or reports half");
});

/* Read every declaration, not the first: a plan naming one twice is doubtful, and the order two
   lines happen to be in is not a thing the contract lets decide a payload (F2). */
test("a plan declaring a name twice is at the answer that owes more, whichever order it wrote them", () => {
  const [, middle] = RUNGS;
  const top = RUNGS.at(-1);
  for (const plan of ["Screen change: no\nScreen change: yes", "Screen change: yes\nScreen change: no"]) {
    assert.equal(escalatedBy(plan), 1, `\`${plan.replaceAll("\n", " / ")}\` declares a screen change`);
  }
  assert.equal(planFlags("Schema coupling: no\nSchema coupling: yes").schema, "yes",
    "and the migration classification is owed by the same reading, which no rung drops");
  assert.equal(rungOf({ complexity: complexityFor(middle), plan: "User-facing outcome: no\nUser-facing outcome: yes", moved: [], whole: true }),
    top, "so a plan that names an outcome anywhere in it has named one");
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0,
    "while a plan declaring neither still climbs nothing");
});

test("a declaration climbs one rung and a correction climbs to what it names, and neither goes down", () => {
  assert.equal(escalatedBy("Screen change: yes"), 1, "a screen change is one rung, not a jump to the top");
  assert.equal(escalatedBy("User-facing outcome: yes"), 1);
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0);
  const climbed = (rung, plan, moved = []) => rungOf({ complexity: complexityFor(rung), plan, moved, whole: true });
  assert.equal(climbed("trivial", "Screen change: yes"), "fix", "one rung up from the shortest");
  assert.equal(climbed("fix", "User-facing outcome: yes"), "feature");
  assert.equal(climbed("trivial", "", ["Size: trivial -> feature"]), "feature",
    "a correction names the rung it climbed to, and the complexity it left decides nothing");
  assert.equal(climbed("fix", "", ["Size: feature -> trivial"]), "fix",
    "a downward pair would unearn statuses already held, so it is read as no climb at all");
  assert.equal(climbed("fix", "", ["Size: fix -> full"]), "feature", "and the older word still reads");
  assert.equal(climbed("trivial", "Screen change: yes", ["Size: trivial -> feature"]), "feature",
    "the highest of the two, so a plan declaration cannot walk a climb back down");
});

test("a page the tracker cut is judged at the top rung, whatever its complexity says", () => {
  for (const rung of RUNGS) {
    assert.equal(rungOf({ complexity: complexityFor(rung), plan: "", moved: [], whole: false }), "feature",
      "a cut cannot show the correction that climbed it, and losing one would shrink a shortfall");
  }
});

test("the ceiling names which of the two a landing is past, and the route up names the next rung", () => {
  const [lowest] = RUNGS;
  const held = CEILINGS[lowest];
  assert.equal(overCeiling(lowest, { files: held.files, lines: held.lines }), null, "at it is not past it");
  assert.deepEqual(overCeiling(lowest, { files: held.files + 1, lines: 1 }), [`files (${held.files + 1} of ${held.files})`]);
  assert.deepEqual(overCeiling(lowest, { files: 1, lines: held.lines + 1 }), [`lines (${held.lines + 1} of ${held.lines})`]);
  assert.equal(overCeiling(lowest, { files: held.files + 1, lines: held.lines + 1 }).length, 2, "both, where both are");
  assert.equal(overCeiling(RUNGS.at(-1), { files: 9e3, lines: 9e3 }), null, "the top rung is past nothing");
  assert.match(climbForm("ISS-3", lowest), new RegExp(`Rung: ${lowest} -> ${RUNGS[1]}`, "u"));
  assert.match(climbForm("ISS-3", RUNGS[1]), /Rung: fix -> feature/u, "and the rung above it names the top");
  assert.equal(heightOf("a word this ladder has not got"), 0, "an unknown rung is the shortest, never negative");
});

/* The stamp `forge stats runs` reads. Filled at the write off the `get` the write already made, so
   it proves the rung rather than proving somebody typed a word; refused as a flag, and a record that
   arrived without it is refused nothing, every entry check reading the issue itself. */
test("a confirmation a write posts carries the rung, and one handed in without it is not refused", async () => {
  const [trivial] = RUNGS;
  await ranAsync(FORGE, ["claim", "ISS-70"], tracker.env);
  const wrote = await ranAsync(FORGE,
    ["record", "confirmation", "ISS-70", "--where", "src/ladder.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(wrote.status, 0, wrote.stderr);
  const posted = state.calls.filter((one) => one.args.action === "create").at(-1)?.args.data?.body ?? "";
  assert.match(posted, new RegExp(`^rung: ${trivial}$`, "mu"),
    "the rung is stamped at the write, off the issue, rather than asked of whoever is writing");
  /* ISS-81 is at `s` on the tracker with nothing in its body: the stamp and the checks read the
     one field, so a run cannot be stamped one rung and held to another (ISS-394). */
  await ranAsync(FORGE, ["claim", "ISS-81"], tracker.env);
  const field = await ranAsync(FORGE,
    ["record", "confirmation", "ISS-81", "--where", "src/rank/score.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(field.status, 0, field.stderr);
  const stamped = state.calls.filter((one) => one.args.action === "create").at(-1)?.args.data?.body ?? "";
  assert.match(stamped, new RegExp(`^rung: ${RUNGS[1]}$`, "mu"),
    "an issue whose rung comes from the field alone is stamped that rung, the body claiming none");
  const held = await owed("ISS-81");
  assert.match(held.stdout, new RegExp(String.raw`This issue is a \x60${RUNGS[1]}\x60`, "u"),
    "which is the rung --owed names as claimed, so the stamp and the checks cannot disagree");
  const asked = await ranAsync(FORGE, ["record", "confirmation", "ISS-70", "--rung", trivial], tracker.env);
  assert.notEqual(asked.status, 0, "and is not a flag, or a run could claim a rung its issue never carried");
  assert.match(`${asked.stdout}${asked.stderr}`, /--rung/u, "refused by the name it was given");
  const handed = render("confirmation", { where: ["src/ladder.mjs"], is: "a rung", finding: "holds" });
  assert.doesNotMatch(handed, /^rung:/mu, "the shape does not put the field there, so a person's record lacks it");
  state.comments["claimed-uuid"] = [{ createdAt: "2026-09-05T10:00:00.000Z", body: handed }];
  const read = await owed("ISS-73");
  assert.equal(read.status, 0, read.stderr);
  assert.match(read.stdout, /confirmed is next and the record earns it/u,
    "and it earns the status all the same: every entry check reads the description, never this copy");
});


/* The stamp said to the run that wrote it, since a run reading its own record back learns its rung
   after the phase that would have checked it. Four forms, because the route up exists on two of
   them: `climbForm` at the top rung renders `feature -> feature`, which `climbsIn` drops, so
   printing it there would send a run to a write that corrects nothing. */
const confirmed = async (key) => {
  await ranAsync(FORGE, ["claim", key], tracker.env);
  const run = await ranAsync(FORGE,
    ["record", "confirmation", key, "--where", "src/ladder.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(run.status, 0, run.stderr);
  return run.stderr;
};

test("the confirmation says the rung it stamped, the complexity that claimed it, and the route up", async () => {
  const [trivial, fix] = RUNGS;
  /* Complexity `xs` on a body naming the top rung: the line is held to the field's own value, so a
     line saying only "from the complexity" would pass while reading the wrong source (ISS-394). */
  const disagreeing = await confirmed("ISS-90");
  assert.match(disagreeing, new RegExp(String.raw`rung \x60${trivial}\x60, claimed by the complexity \x60xs\x60`, "u"));
  assert.match(disagreeing, /move it up before the plan:/u);
  assert.match(disagreeing, new RegExp(`Rung: ${trivial} -> ${fix}`, "u"), "one rung, not a jump to the top");
  const held = await confirmed("ISS-81");
  assert.match(held, new RegExp(`Rung: ${fix} -> ${RUNGS.at(-1)}`, "u"));
  assert.doesNotMatch(held, /Size: \w+ -> /u, "the retired spelling is read and never handed to anyone");
});

test("a confirmation at the top rung offers no upward correction, and one claimed by nobody says so", async () => {
  const top = RUNGS.at(-1);
  const nobody = await confirmed("ISS-72");
  assert.match(nobody, new RegExp(String.raw`rung \x60${top}\x60, claimed by nobody`, "u"));
  assert.match(nobody, /holds no complexity, so the top rung stands by the upward rule/u);
  assert.match(nobody, /No rung stands above it/u);
  assert.doesNotMatch(nobody, /(?:Rung|Size): \w+ -> /u, "a pair that does not climb is a write that corrects nothing");
  const atTop = await confirmed("ISS-82");
  assert.match(atTop, new RegExp(String.raw`rung \x60${top}\x60, claimed by the complexity \x60m\x60`, "u"));
  assert.doesNotMatch(atTop, /(?:Rung|Size): \w+ -> /u);
});

test("--owed reports the rung the checks run, what it drops and every route up from it", async () => {
  /* From a mark, not over the whole log: a record write of an earlier case moves what it earns. */
  const mark = state.calls.length;
  const run = await owed("ISS-71");
  assert.equal(run.status, 0, "asked what is owed, the shortfall is the answer and not a refusal");
  assert.match(run.stdout, /is a `fix`: the tracker's complexity is `s`\. The entry checks run that rung/u);
  const reported = (row) => [`at ${row.status}`, row.drops, row.because].every((one) => run.stdout.includes(one));
  for (const row of LIGHTER) assert.ok(reported(row), `${row.status} is lightened and the report omits ${row.drops}`);
  assert.match(run.stdout, /forge record plan ISS-71 <plan\.md>/u, "one route up, in the form it wants");
  assert.match(run.stdout, /--moved "Rung: fix -> feature"/u, "and the other, so neither is inferred");
  assert.match(run.stdout, /no confirmation/u, "while the confirmation with its where is owed all the same");
  assert.equal(state.calls.slice(mark).some((one) => one.args.action === "transition"), false,
    "and --owed moves nothing");
});

/* A rung whose saving is rounds rather than payloads is invisible to LIGHTER, so this report is the
   only place the difference between it and the rung above can be read: a run shown the same three
   drops and nothing else has been told the two rungs are the same thing. */
test("the shortest rung drops what the one above drops, and is told what else it may spend fewer of", async () => {
  const [trivial, fix, feature] = [await owed("ISS-70"), await owed("ISS-71"), await owed("ISS-72")];
  assert.match(trivial.stdout, /is a `trivial`: the tracker's complexity is `xs`/u);
  for (const row of LIGHTER) {
    assert.ok(trivial.stdout.includes(row.drops), `the shortest rung is reported to owe ${row.drops}`);
  }
  const roundsIn = (text) => text.split("and fewer rounds")[1]?.split("Every other demand")[0] ?? "";
  const [under, above, top] = [roundsIn(trivial.stdout), roundsIn(fix.stdout), roundsIn(feature.stdout)];
  assert.ok(SPARES.trivial.every((one) => under.includes(one)), "each round it may spend fewer of is named");
  assert.ok(SPARES.trivial.every((one) => above.includes(one)),
    "and the rung above is told every one of them, the two being granted one list");
  assert.ok(SPARES.trivial.every((one) => !top.includes(one)),
    "and the top rung is told none of them, which is what the two below it are measured against");
  /* The one the ladder gained: a run told the gate is the ship's spends none of its own, and a feature reading that would spend a judgement it owes. No rung is granted a cited baseline, because every rung has one — what a tree already fails is a property of the tree, so a waiver here would report a difference between the rungs that is not there, and the rehearsal is what tells any of them a result is published (ISS-1101). */
  for (const [rung, out] of [["trivial", trivial], ["fix", fix]]) {
    assert.match(out.stdout, /one gate run on the clean path, the ship's/u,
      `a \`${rung}\` is not told the gate is spent once, at the ship`);
  }
  assert.doesNotMatch(feature.stdout, /one gate run on the clean path/u, "and the top rung is offered one gate run");
  for (const out of [trivial, fix, feature]) {
    assert.doesNotMatch(out.stdout, /baseline citing/u, "no rung is told a cited baseline is its own to spend");
  }
  assert.match(trivial.stdout, /--moved "Rung: trivial -> fix"/u, "the route up names the next rung, not the top");
  assert.match(feature.stdout, /holds no complexity on the tracker, so it is a `feature`/u);
  assert.match(feature.stdout, /a feature owes the whole set/u, "the top rung says so rather than saying nothing");
  assert.doesNotMatch(feature.stdout, /Two routes up/u, "and has none to offer");
});

/* A body naming a rung is the shape of this repository's own older issues, and the report speaks of
   the field alone: what it must not do is read that line back as a claim, because a rung nothing set
   would be one no filing established and no `forge new --complexity` can be held to. */
test("a body naming the top rung in full is reported off the field, which holds none", async () => {
  const claimed = await owed("ISS-73");
  assert.match(claimed.stdout, /holds no complexity on the tracker, so it is a `feature`/u,
    "the field is what the report speaks of, and this issue holds nothing in it");
  assert.doesNotMatch(claimed.stdout, /Size: feature/u,
    "and the line in the body is not read back as a claim, the two sources being one now");
  assert.match(claimed.stdout, /a feature owes the whole set/u, "while it owes what the top rung owes");
  assert.doesNotMatch(claimed.stdout, /Two routes up/u, "and has nowhere to climb either");
});


/* Every complexity claims a rung, and the report names the field and its value in the tracker's own
   word: a reader who has to translate the CLI's word back to the field they set spends a round. */
test("each of the tracker's five complexities claims a rung, named as the field that set it", async () => {
  const wanted = ["trivial", "fix", "feature", "feature", "feature"];
  for (const [at, complexity] of COMPLEXITIES.entries()) {
    assert.equal(rungFrom(complexity), wanted[at], complexity);
    const run = await owed(`ISS-${80 + at}`);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`is a \`${wanted[at]}\`: the tracker's complexity is \`${complexity}\``, "u"),
      `${complexity} is reported at ${wanted[at]}, in the field's own name and the value as it stands`);
    assert.doesNotMatch(run.stdout, /holds no complexity/u, "a field that is set is not an absence");
  }
  assert.equal(rungFrom("xxl"), null, "a value the ladder has no rung for claims none");
  assert.deepEqual(RUNGS.map((one) => complexityFor(one)), ["xs", "s", "m"],
    "and the other direction is a declared complexity per rung, not the first key of the table above");
  /* The pair has to close: a complexity written back that reads as a different rung would let one filing
     claim two rungs, which is the whole of what the two directions are for. */
  for (const rung of RUNGS) {
    assert.equal(rungFrom(complexityFor(rung)), rung, `${rung} is written back as a complexity that reads as ${rung}`);
  }
  assert.deepEqual(COMPLEXITIES.map((one) => belowTop(rungFrom(one))), [true, true, false, false, false]);
  assert.deepEqual(RUNGS.map((one) => belowTop(one)), [true, true, false],
    "and the one predicate answers off a rung, whichever source the caller read it from");
  assert.equal(belowTop(null), false, "no rung is not a rung below the top");
});

/* The two largest are worth a question and no payload: a report that grew a demand is a second ladder. */
test("the two largest complexities ask whether the issue is one change, and the three below do not", async () => {
  assert.deepEqual(COMPLEXITIES.map((one) => splits(one)), [false, false, false, true, true]);
  for (const [at, complexity] of COMPLEXITIES.entries()) {
    const run = await owed(`ISS-${80 + at}`);
    assert.equal(/is this one change, or several\?/u.test(run.stdout), splits(complexity), complexity);
    assert.match(run.stdout, /a feature owes the whole set|not owed:/u, "while what it owes is unchanged");
  }
});

/* The reading a second source bought: an issue at `xs` whose body named the top rung had two answers, and whichever won, the other had to be printed for the losing claim to be actionable. One source, so the body is prose and the field is the answer at every reader (ISS-701). */
test("a body naming another rung changes nothing, the field being the only claim there is", async () => {
  const run = await owed("ISS-90");
  assert.match(run.stdout, /is a `trivial`: the tracker's complexity is `xs`/u);
  assert.doesNotMatch(run.stdout, /Size: feature|does not lower a rung/u,
    "with nothing said about a second claim, there being no second source to have made one");
});

/* The contract's existing rule, read over the one source. */
test("a correction climbing upward outranks a complexity naming a lower rung", () => {
  const moved = ["Size: trivial -> feature"];
  assert.equal(rungOf({ plan: "", moved, complexity: "xs" }), "feature");
  assert.equal(rungOf({ plan: "", moved: ["Size: feature -> fix"], complexity: "xs" }), "trivial",
    "while a correction pointing downward moves nothing, as it moves nothing off a mark");
  assert.equal(rungOf({ plan: "", moved: [], complexity: "xs", whole: false }), "feature",
    "and a cut page is a feature whatever the field says: it cannot show the correction it hid");
});


/* A complexity counts where it is spelt as a literal in code — a quoted string or a bare object key, with
   comments stripped first and a backtick span never counting — `s`, `m` and `l` being single letters
   this tree writes as prose, as a plural and as another table's key. Two of the five are words
   nothing else spells, so one alone is a copy and the other three are one in pairs; the complete
   table the last selector asked for matched no copy (ISS-403). `rank/weights.mjs` only scores one. */
const COMMENTS = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/[^\n]*/gmu;
const spelling = (complexity) => new RegExp(String.raw`(['"])${complexity}\1|(?<![\w$.'"\x60\\])${complexity}\s*:`, "u");
const TELLING = COMPLEXITIES.filter((one) => one.length > 1);
const copiesTable = (text) => {
  const code = text.replaceAll(COMMENTS, "");
  const named = COMPLEXITIES.filter((one) => spelling(one).test(code));
  return named.some((one) => TELLING.includes(one)) || named.length > 1;
};

test("the table from a tracker complexity to a rung lives in one file, and the one carve-out is named", () => {
  const ROOT = new URL("../src", import.meta.url).pathname;
  const found = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs") && copiesTable(readFileSync(join(dir, one.name), "utf8"))) {
        found.push(`${at}/${one.name}`);
      }
    }
  };
  walk(ROOT, "plugin/src");
  assert.deepEqual(COMPLEXITIES, COMPLEXITY_NAMES,
    "the selector asks about every size the ladder's table holds, or one added there goes unguarded");
  assert.deepEqual(found.sort(), ["plugin/src/ladder.mjs", "plugin/src/rank/weights.mjs"],
    "a size a reader has to map to a rung is spelt outside plugin/src/ladder.mjs, where the table"
    + " lives, and outside plugin/src/rank/weights.mjs, which is the one carve-out because it scores"
    + ` a size rather than mapping it. Collected:\n${found.join("\n")}`);
});

/* A walk is green over a clean tree whether its selector reads anything or not, which is how the last one shipped broken: three of these are the copies ISS-317 took out of the files named beside them, and the fourth is that table's top half, which the two-letter names alone walk past. */
test("a partial copy is collected, and a complexity that is prose, a plural or another table's key is not", () => {
  for (const [where, planted] of [
    ["plugin/src/rank/batch.mjs", `const FIX = ["xs", "s"];`],
    ["plugin/src/tracker/issue-shape.mjs", `export const SIZES = { xs: "fix" };`],
    ["plugin/src/rank/score.mjs", `if (fix === true) return { complexity: "xs", from: "the Size line" };`],
    ["the three complexities that claim the top rung", "const TOP = { m: FEATURE, l: FEATURE };"],
    ["a key on its own line", `const SIZES = { xs\n: "fix" };`],
    ["a key holding a comment off its colon", `const SIZES = { xs /* the smallest */: "fix" };`],
  ]) {
    assert.equal(copiesTable(planted), true, `${where}: \`${planted}\` is a partial table and goes uncollected`);
  }
  for (const [what, green] of [
    ["a plural", `const at = \`criterion\${numbers.length > 1 ? "s" : ""}\`;`],
    ["another table's key", "const UNITS = { d: 86_400_000, h: 3_600_000, m: 60_000 };"],
    ["one size, however often it is written", `const only = ["m", "m", "m"];`],
    ["a code span in a comment", "/* so `l` and `xl` still score apart on a three-wide rung */"],
    ["a count of seconds in a template", "const said = `${PAYLOAD_MS / 1000}s: nothing fed it`;"],
    ["a size named in prose", `/* The tracker calls the smallest "xs" and the largest "xl". */`],
    ["a whole copy quoted by the comment arguing against it", `/* never write const SIZES = { xs: "fix" }; */`],
  ]) {
    assert.equal(copiesTable(green), false, `${what}: \`${green}\` maps nothing and is collected`);
  }
});
