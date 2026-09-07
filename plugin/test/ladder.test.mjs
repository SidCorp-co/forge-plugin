/* The ladder has three rungs and two of them stop owing the same three payloads, so what keeps the
   shortest from being the middle one wearing another word is the report and the rounds it names.
   Spawned against a tracker rather than called: `--owed` reads the record before it says anything,
   and a run learns its tier from the same verb and the same record it learns the shortfall from. */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "./fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("ladder").path;
const {
  BAND_NAMES, CEILINGS, FIELD_SAID, LIGHTER, SPARES, TIERS, bandFor, belowTop, climbsIn, escalatedBy,
  heightOf, lightens, markedIn, overCeiling, resizeForm, rungFrom, sizeFrom, splits, tierOf,
} = await import("../src/ladder.mjs");
const { planFlags } = await import("../src/flow/machine.mjs");
const { render } = await import("../src/flow/record/record.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;

const body = (tier) => `\`forge dep\` should take the \`data.relations\` route.\n\nSize: ${tier}.\n`;

/* Every issue carries its rung as the tracker's own complexity; the line in the body is the prose a
   tracker full of issues filed under the two-source ladder still holds, and nothing reads it. */
const issue = (tier, extra = {}) => ({
  documentId: `${tier}-uuid`,
  issueId: `ISS-${TIERS.indexOf(tier) + 70}`,
  status: "open",
  title: `the change that rides the ${tier} rung`,
  description: body(tier),
  complexity: bandFor(tier),
  ...extra,
});

/* The tracker's five complexities, each on a body claiming nothing at all. */
const BANDS = ["xs", "s", "m", "l", "xl"];
const UNMARKED = "`forge dep` should take the `data.relations` route.";
const sized = (band, at, extra = {}) => ({
  documentId: `${band}-uuid`,
  issueId: `ISS-${at}`,
  status: "open",
  title: `the change the tracker sized at ${band}`,
  description: UNMARKED,
  complexity: band,
  ...extra,
});

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [
    issue("trivial"), issue("fix"),
    /* The two holding no complexity: one whose body says nothing about its size and one whose body
       names the top rung in full, which is the pair a report speaking of the body would tell apart. */
    { ...issue("feature"), description: "no mark here", complexity: null },
    { ...issue("feature"), documentId: "claimed-uuid", issueId: "ISS-73", complexity: null },
    ...BANDS.map((band, at) => sized(band, 80 + at)),
    sized("xs", 90, { documentId: "disagree-uuid", description: body("feature") }),
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
  for (const tier of TIERS) {
    assert.deepEqual(sizeFrom({ band: bandFor(tier) }), { rung: tier, band: bandFor(tier), claimed: FIELD_SAID },
      `\`${bandFor(tier)}\` on the tracker is the ${tier} rung, and the field is what claimed it`);
  }
  assert.deepEqual(sizeFrom({}), { rung: "feature", band: null, claimed: null },
    "an issue holding no complexity reads as the tier that owes everything, claimed by nothing");
  assert.equal(sizeFrom({ band: "huge" }).rung, "feature", "as does one sized a word the ladder has no rung for");
  for (const said of [body("trivial"), "Size: fix.", "no mark here"]) {
    assert.equal(sizeFrom({ description: said }).rung, "feature",
      `\`${said.trim()}\` is prose: what a body says about its size is read by nothing`);
  }
});

/* Every case below is one a reader could resolve either way, and each was resolved downward until a
   consult on this change said so (F1, F2, F4). The rule they share is docs/cli/the-ladder.md's: the
   rung that owes more costs a run a payload it did not need, and the other costs the record a
   status nobody established. */
test("a doubtful reading answers with the rung that owes more, never the one that owes less", () => {
  const [lowest, middle] = TIERS;
  for (const order of [`Size: ${lowest}.\nSize: ${middle}.`, `Size: ${middle}.\nSize: ${lowest}.`]) {
    assert.equal(markedIn(order), middle,
      "a body naming two rungs is unsettled, and whichever the reader met first must not decide it");
  }
  /* The top rung is the default, so a line naming it says nothing alone and everything beside a
     lower one. This repository's own issues write it in full, which is how the hole was found. */
  const top = TIERS.at(-1);
  assert.equal(markedIn(`Size: ${top}.`), top, "the top rung is a line like any other, not an absence");
  assert.equal(markedIn(`Size: ${top}.\nSize: ${lowest}.`), top,
    "so a body naming it beside a lower one has named it, and does not read as the lower");
  assert.deepEqual(climbsIn(`Size: ${TIERS.at(-1)} -> ${lowest}`), [],
    "a pair pointing down is no climb: read by its destination alone it would raise a trivial to a fix");
  assert.deepEqual(climbsIn(`Size: ${lowest} -> ${middle}\nSize: ${middle} -> ${TIERS.at(-1)}`),
    [middle, TIERS.at(-1)],
    "and every climb a page states, so the newest correction cannot erase the re-size before it");
  assert.equal(tierOf({ band: bandFor(lowest), plan: "", moved: [`Size: ${TIERS.at(-1)} -> ${middle}`], whole: true }),
    lowest, "so a downward correction moves nothing at all");
});

/* Read off the ladder rather than a list of its own: a rung added with no row here would be a tier
   the checks apply and this file never asks about. */
test("every rung the ladder has has its rows, its rounds, and a ceiling unless it is the top", () => {
  const [lowest, ...rest] = TIERS;
  const top = TIERS.at(-1);
  for (const tier of TIERS) {
    assert.ok(Array.isArray(SPARES[tier]), `${tier} is a rung of the ladder with no rounds column`);
  }
  assert.ok(SPARES[lowest].length > SPARES[rest[0]].length,
    "the shortest ladder saves no more rounds than the one above it, so a run cannot tell them apart");
  assert.equal(SPARES[top].length, 0, "the top rung is what the others are measured against");
  assert.equal(CEILINGS[top], undefined, "and has nothing to be re-sized to, so it has no ceiling");
  for (const tier of TIERS.filter((one) => one !== top)) {
    assert.ok(CEILINGS[tier].files > 0 && CEILINGS[tier].lines > 0, `${tier} has no ceiling to be past`);
  }
  assert.ok(CEILINGS[lowest].lines < CEILINGS[rest[0]].lines, "and a lower rung admits a smaller landing");
});

/* Through `lightens`, which is what every entry check calls: asserting only that the top rung is
   absent from `row.tiers` passes with exemptions removed altogether, the list being data either
   way. The two spawned tests below carry the same claim end to end, through the checks themselves. */
test("what a rung stops owing is the row's, and a rung absent from a row owes that payload", () => {
  const top = TIERS.at(-1);
  for (const row of LIGHTER) {
    for (const tier of TIERS) {
      const said = lightens(row.status, { band: bandFor(tier), plan: "", moved: [], whole: true });
      assert.equal(said, row.tiers.includes(tier),
        `at ${row.status} a \`${tier}\` ${row.tiers.includes(tier) ? "stops owing" : "owes"} ${row.drops}`);
    }
    assert.equal(lightens(row.status, { band: bandFor(top), plan: "", moved: [], whole: true }), false,
      `${row.status} drops ${row.drops} for the top rung`);
  }
  for (const tier of TIERS) {
    assert.equal(lightens("in_progress", { band: bandFor(tier), plan: "", moved: [], whole: true }), false,
      `${tier} is exempted from the baseline, which no rung buys`);
  }
});

/* The contract's own guide prints the line inside a fence, so a reading that took one would find it
   in every body quoting the guide. The same strip serves `goals.mjs`, which reads a live claim. */
test("a line inside an example is read as none, and does not move one the body really carries", () => {
  const [lowest] = TIERS;
  const top = TIERS.at(-1);
  /* A line before the mark in each: a pattern stopping at the first line end passed without it. */
  for (const shown of [
    `no mark here\n\n\`\`\`text\nExample:\nSize: ${lowest}.\n\`\`\`\n`,
    `no mark here\n\n~~~\nExample:\nSize: ${lowest}.\n~~~\n`,
    `no mark here\n\n\`\`\`\nExample:\nSize: ${lowest}.\n`,
    `no mark here\n\n    Example:\n    Size: ${lowest}.\n`,
    /* A wall closes on its own character and nothing else on the line: a pattern taking any line
       that starts with one ended the example here and read the mark below it as the body's (F1). */
    `no mark here\n\n\`\`\`text\nExample:\n\`\`\`not-a-closing-wall\nSize: ${lowest}.\n\`\`\`\n`,
    `no mark here\n\n~~~\nExample:\n\`\`\`\nSize: ${lowest}.\n~~~\n`,
  ]) {
    assert.equal(markedIn(shown), null, "an example holds the only apparent line, and the body carries none");
  }
  assert.equal(markedIn(`no mark\n\n\`\`\`\na\n\`\`\`\n\nSize: ${lowest}.\n\n\`\`\`\nb\n\`\`\`\n`), lowest,
    "while a line standing between two examples is the body's, so stripping cannot run past a closing wall");
  assert.equal(markedIn(`Size: ${lowest}.\n\n\`\`\`\nSize: ${top}.\n\`\`\`\n`), lowest,
    "and an example beside a real line leaves the real one standing, rather than being read beside it");
  assert.equal(markedIn(`\`\`\`\nSize: ${top}.\n\`\`\`\`\n\nSize: ${lowest}.\n`), lowest,
    "a longer wall closes too, so a body writing one does not lose the line standing after it");
  assert.equal(markedIn("a body with no mark at all"), null, "and a body with none reads as none");
});

/* Read every declaration, not the first: a plan naming one twice is doubtful, and the order two
   lines happen to be in is not a thing the contract lets decide a payload (F2). */
test("a plan declaring a name twice is at the answer that owes more, whichever order it wrote them", () => {
  const [, middle] = TIERS;
  const top = TIERS.at(-1);
  for (const plan of ["Screen change: no\nScreen change: yes", "Screen change: yes\nScreen change: no"]) {
    assert.equal(escalatedBy(plan), 1, `\`${plan.replaceAll("\n", " / ")}\` declares a screen change`);
  }
  assert.equal(planFlags("Schema coupling: no\nSchema coupling: yes").schema, "yes",
    "and the migration classification is owed by the same reading, which no rung drops");
  assert.equal(tierOf({ band: bandFor(middle), plan: "User-facing outcome: no\nUser-facing outcome: yes", moved: [], whole: true }),
    top, "so a plan that names an outcome anywhere in it has named one");
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0,
    "while a plan declaring neither still climbs nothing");
});

test("a declaration climbs one rung and a correction climbs to what it names, and neither goes down", () => {
  assert.equal(escalatedBy("Screen change: yes"), 1, "a screen change is one rung, not a jump to the top");
  assert.equal(escalatedBy("User-facing outcome: yes"), 1);
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0);
  const climbed = (tier, plan, moved = []) => tierOf({ band: bandFor(tier), plan, moved, whole: true });
  assert.equal(climbed("trivial", "Screen change: yes"), "fix", "one rung up from the shortest");
  assert.equal(climbed("fix", "User-facing outcome: yes"), "feature");
  assert.equal(climbed("trivial", "", ["Size: trivial -> feature"]), "feature",
    "a correction names the rung it climbed to, and the complexity it left decides nothing");
  assert.equal(climbed("fix", "", ["Size: feature -> trivial"]), "fix",
    "a downward pair would unearn statuses already held, so it is read as no climb at all");
  assert.equal(climbed("fix", "", ["Size: fix -> full"]), "feature", "and the older word still reads");
  assert.equal(climbed("trivial", "Screen change: yes", ["Size: trivial -> feature"]), "feature",
    "the highest of the two, so a plan declaration cannot walk a re-size back down");
});

test("a page the tracker cut is judged at the top rung, whatever its complexity says", () => {
  for (const tier of TIERS) {
    assert.equal(tierOf({ band: bandFor(tier), plan: "", moved: [], whole: false }), "feature",
      "a cut cannot show the correction that re-sized it, and losing one would shrink a shortfall");
  }
});

test("the ceiling names which of the two a landing is past, and the route up names the next rung", () => {
  const [lowest] = TIERS;
  const held = CEILINGS[lowest];
  assert.equal(overCeiling(lowest, { files: held.files, lines: held.lines }), null, "at it is not past it");
  assert.deepEqual(overCeiling(lowest, { files: held.files + 1, lines: 1 }), [`files (${held.files + 1} of ${held.files})`]);
  assert.deepEqual(overCeiling(lowest, { files: 1, lines: held.lines + 1 }), [`lines (${held.lines + 1} of ${held.lines})`]);
  assert.equal(overCeiling(lowest, { files: held.files + 1, lines: held.lines + 1 }).length, 2, "both, where both are");
  assert.equal(overCeiling(TIERS.at(-1), { files: 9e3, lines: 9e3 }), null, "the top rung is past nothing");
  assert.match(resizeForm("ISS-3", lowest), new RegExp(`Size: ${lowest} -> ${TIERS[1]}`, "u"));
  assert.match(resizeForm("ISS-3", TIERS[1]), /Size: fix -> feature/u, "and the rung above it names the top");
  assert.equal(heightOf("a word this ladder has not got"), 0, "an unknown rung is the shortest, never negative");
});

/* The stamp `forge stats runs` reads. Filled at the write off the `get` the write already made, so
   it proves the rung rather than proving somebody typed a word; refused as a flag, and a record that
   arrived without it is refused nothing, every entry check reading the issue itself. */
test("a confirmation a write posts carries the rung, and one handed in without it is not refused", async () => {
  const [trivial] = TIERS;
  await ranAsync(FORGE, ["claim", "ISS-70"], tracker.env);
  const wrote = await ranAsync(FORGE,
    ["record", "confirmation", "ISS-70", "--where", "src/ladder.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(wrote.status, 0, wrote.stderr);
  const posted = state.calls.filter((one) => one.args.action === "create").at(-1)?.args.data?.body ?? "";
  assert.match(posted, new RegExp(`^tier: ${trivial}$`, "mu"),
    "the rung is stamped at the write, off the issue, rather than asked of whoever is writing");
  /* ISS-81 is sized `s` on the tracker with nothing in its body: the stamp and the checks read the
     one field, so a run cannot be stamped one rung and held to another (ISS-394). */
  await ranAsync(FORGE, ["claim", "ISS-81"], tracker.env);
  const field = await ranAsync(FORGE,
    ["record", "confirmation", "ISS-81", "--where", "src/rank/score.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(field.status, 0, field.stderr);
  const stamped = state.calls.filter((one) => one.args.action === "create").at(-1)?.args.data?.body ?? "";
  assert.match(stamped, new RegExp(`^tier: ${TIERS[1]}$`, "mu"),
    "an issue whose rung comes from the field alone is stamped that rung, the body claiming none");
  const held = await owed("ISS-81");
  assert.match(held.stdout, new RegExp(String.raw`This issue is a \x60${TIERS[1]}\x60`, "u"),
    "which is the rung --owed names as claimed, so the stamp and the checks cannot disagree");
  const asked = await ranAsync(FORGE, ["record", "confirmation", "ISS-70", "--tier", trivial], tracker.env);
  assert.notEqual(asked.status, 0, "and is not a flag, or a run could claim a rung its issue never carried");
  assert.match(`${asked.stdout}${asked.stderr}`, /--tier/u, "refused by the name it was given");
  const handed = render("confirmation", { where: ["src/ladder.mjs"], is: "a rung", finding: "holds" });
  assert.doesNotMatch(handed, /^tier:/mu, "the shape does not put the field there, so a person's record lacks it");
  state.comments["claimed-uuid"] = [{ createdAt: "2026-09-05T10:00:00.000Z", body: handed }];
  const read = await owed("ISS-73");
  assert.equal(read.status, 0, read.stderr);
  assert.match(read.stdout, /confirmed is next and the record earns it/u,
    "and it earns the status all the same: every entry check reads the description, never this copy");
});


test("--owed reports the rung the checks run, what it drops and every route up from it", async () => {
  const run = await owed("ISS-71");
  assert.equal(run.status, 0, "asked what is owed, the shortfall is the answer and not a refusal");
  assert.match(run.stdout, /is a `fix`: the tracker's complexity is `s`\. The entry checks run that tier/u);
  const reported = (row) => [`at ${row.status}`, row.drops, row.because].every((one) => run.stdout.includes(one));
  for (const row of LIGHTER) assert.ok(reported(row), `${row.status} is lightened and the report omits ${row.drops}`);
  assert.match(run.stdout, /forge record plan ISS-71 <plan\.md>/u, "one route up, in the form it wants");
  assert.match(run.stdout, /--moved "Size: fix -> feature"/u, "and the other, so neither is inferred");
  assert.match(run.stdout, /no confirmation/u, "while the confirmation with its where is owed all the same");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false, "and --owed moves nothing");
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
  const [under, above] = [roundsIn(trivial.stdout), roundsIn(fix.stdout)];
  assert.ok(SPARES.trivial.every((one) => under.includes(one)), "each round it may spend fewer of is named");
  assert.ok(SPARES.trivial.some((one) => !above.includes(one)),
    "and one of them is not the rung above's, or the two differ in nothing a reader can act on");
  assert.match(trivial.stdout, /--moved "Size: trivial -> fix"/u, "the route up names the next rung, not the top");
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
  for (const [at, band] of BANDS.entries()) {
    assert.equal(rungFrom(band), wanted[at], band);
    const run = await owed(`ISS-${80 + at}`);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`is a \`${wanted[at]}\`: the tracker's complexity is \`${band}\``, "u"),
      `${band} is reported at ${wanted[at]}, in the field's own name and the value as it stands`);
    assert.doesNotMatch(run.stdout, /holds no complexity/u, "a field that is set is not an absence");
  }
  assert.equal(rungFrom("xxl"), null, "a value the ladder has no rung for claims none");
  assert.deepEqual(TIERS.map((one) => bandFor(one)), ["xs", "s", "m"],
    "and the other direction is a declared band per rung, not the first key of the table above");
  /* The pair has to close: a band written back that reads as a different rung would let one filing
     claim two sizes, which is the whole of what the two directions are for. */
  for (const rung of TIERS) {
    assert.equal(rungFrom(bandFor(rung)), rung, `${rung} is written back as a band that reads as ${rung}`);
  }
  assert.deepEqual(BANDS.map((one) => belowTop(rungFrom(one))), [true, true, false, false, false]);
  assert.deepEqual(TIERS.map((one) => belowTop(one)), [true, true, false],
    "and the one predicate answers off a rung, whichever source the caller read it from");
  assert.equal(belowTop(null), false, "no rung is not a rung below the top");
});

/* The two largest are worth a question and no payload: a report that grew a demand is a second ladder. */
test("the two largest sizes ask whether the issue is one change, and the three below do not", async () => {
  assert.deepEqual(BANDS.map((one) => splits(one)), [false, false, false, true, true]);
  for (const [at, band] of BANDS.entries()) {
    const run = await owed(`ISS-${80 + at}`);
    assert.equal(/is this one change, or several\?/u.test(run.stdout), splits(band), band);
    assert.match(run.stdout, /a feature owes the whole set|not owed:/u, "while what it owes is unchanged");
  }
});

/* The reading a second source bought: an issue sized `xs` whose body named the top rung had two answers, and whichever won, the other had to be printed for the losing claim to be actionable. One source, so the body is prose and the field is the answer at every reader (ISS-701). */
test("a body naming another rung changes nothing, the field being the only claim there is", async () => {
  assert.equal(sizeFrom({ band: "xs", description: body("feature") }).rung, "trivial");
  assert.equal(sizeFrom({ band: "xl", description: body("trivial") }).rung, "feature");
  assert.equal(sizeFrom({ description: body("fix") }).rung, "feature",
    "and a body naming a rung with the field unset claims nothing, so it owes what a feature owes");
  const run = await owed("ISS-90");
  assert.match(run.stdout, /is a `trivial`: the tracker's complexity is `xs`/u);
  assert.doesNotMatch(run.stdout, /Size: feature|does not lower a rung/u,
    "with nothing said about a second claim, there being no second source to have made one");
});

/* The contract's existing rule, read over the one source. */
test("a correction re-sizing upward outranks a complexity naming a lower rung", () => {
  const moved = ["Size: trivial -> feature"];
  assert.equal(tierOf({ plan: "", moved, band: "xs" }), "feature");
  assert.equal(tierOf({ plan: "", moved: ["Size: feature -> fix"], band: "xs" }), "trivial",
    "while a correction pointing downward moves nothing, as it moves nothing off a mark");
  assert.equal(tierOf({ description: UNMARKED, plan: "", moved: [], band: "xs", whole: false }), "feature",
    "and a cut page is a feature whatever the field says: it cannot show the correction it hid");
});


/* A size counts where it is spelt as a literal in code — a quoted string or a bare object key, with
   comments stripped first and a backtick span never counting — `s`, `m` and `l` being single letters
   this tree writes as prose, as a plural and as another table's key. Two of the five are words
   nothing else spells, so one alone is a copy and the other three are one in pairs; the complete
   table the last selector asked for matched no copy (ISS-403). `rank/weights.mjs` only scores one. */
const COMMENTS = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/[^\n]*/gmu;
const spelling = (band) => new RegExp(String.raw`(['"])${band}\1|(?<![\w$.'"\x60\\])${band}\s*:`, "u");
const TELLING = BANDS.filter((one) => one.length > 1);
const copiesTable = (text) => {
  const code = text.replaceAll(COMMENTS, "");
  const named = BANDS.filter((one) => spelling(one).test(code));
  return named.some((one) => TELLING.includes(one)) || named.length > 1;
};

test("the table from a tracker size to a rung lives in one file, and the one carve-out is named", () => {
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
  assert.deepEqual(BANDS, BAND_NAMES,
    "the selector asks about every size the ladder's table holds, or one added there goes unguarded");
  assert.deepEqual(found.sort(), ["plugin/src/ladder.mjs", "plugin/src/rank/weights.mjs"],
    "a size a reader has to map to a rung is spelt outside plugin/src/ladder.mjs, where the table"
    + " lives, and outside plugin/src/rank/weights.mjs, which is the one carve-out because it scores"
    + ` a size rather than mapping it. Collected:\n${found.join("\n")}`);
});

/* A walk is green over a clean tree whether its selector reads anything or not, which is how the last one shipped broken: three of these are the copies ISS-317 took out of the files named beside them, and the fourth is that table's top half, which the two-letter names alone walk past. */
test("a partial copy is collected, and a size that is prose, a plural or another table's key is not", () => {
  for (const [where, planted] of [
    ["plugin/src/rank/batch.mjs", `const FIX = ["xs", "s"];`],
    ["plugin/src/tracker/issue-shape.mjs", `export const SIZES = { xs: "fix" };`],
    ["plugin/src/rank/score.mjs", `if (fix === true) return { band: "xs", from: "the Size line" };`],
    ["the three sizes that claim the top rung", "const TOP = { m: FEATURE, l: FEATURE };"],
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
