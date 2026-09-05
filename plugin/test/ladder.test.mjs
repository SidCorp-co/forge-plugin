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
  CEILINGS, LIGHTER, SPARES, TIERS, bandFor, belowTop, climbsIn, escalatedBy, heightOf, lightens,
  markedIn, overCeiling, resizeForm, rungFrom, sizeFrom, splits, tierIn, tierOf,
} = await import("../src/ladder.mjs");
const { planFlags } = await import("../src/flow/machine.mjs");
const { render } = await import("../src/flow/record.mjs");

const FORGE = new URL("../bin/forge", import.meta.url).pathname;

const body = (tier) => `\`forge dep\` should take the \`data.relations\` route.\n\nSize: ${tier}.\n`;
const issue = (tier, extra = {}) => ({
  documentId: `${tier}-uuid`,
  issueId: `ISS-${TIERS.indexOf(tier) + 70}`,
  status: "open",
  title: `the change that rides the ${tier} rung`,
  description: body(tier),
  ...extra,
});

/* The tracker's five sizes on bodies claiming none, so the report is the field's doing alone. */
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
    issue("trivial"), issue("fix"), { ...issue("feature"), description: "no mark here" },
    { ...issue("feature"), documentId: "claimed-uuid", issueId: "ISS-73" },
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

test("a description names its rung, and one that names none is the top", () => {
  for (const tier of TIERS.filter((one) => one !== "feature")) {
    assert.equal(tierIn(body(tier)), tier, `\`Size: ${tier}.\` is the mark for ${tier}`);
    assert.equal(tierIn(`SIZE:${tier}`), tier, "the spacing and the full stop are the author's");
  }
  assert.equal(tierIn("a body with no mark at all"), "feature",
    "every issue filed before this ladder existed reads as the tier that owes everything");
  for (const near of ["Size: fix later", "the size: trivial matters", "Size: trivialities"]) {
    assert.equal(tierIn(near), "feature", `\`${near}\` is not the mark, and a body it appears in claims nothing`);
  }
});

/* Every case below is one a reader could resolve either way, and each was resolved downward until a
   consult on this change said so (F1, F2, F4). The rule they share is docs/cli/the-ladder.md's: the
   rung that owes more costs a run a payload it did not need, and the other costs the record a
   status nobody established. */
test("a doubtful reading answers with the rung that owes more, never the one that owes less", () => {
  const [lowest, middle] = TIERS;
  for (const order of [`Size: ${lowest}.\nSize: ${middle}.`, `Size: ${middle}.\nSize: ${lowest}.`]) {
    assert.equal(tierIn(order), middle,
      "a body claiming two rungs is unsettled, and whichever the reader met first must not decide it");
  }
  /* The top rung is the default, so writing it changes nothing alone and everything beside a lower
     mark. This repository's own issues write it in full, which is how the hole was found. */
  const top = TIERS.at(-1);
  assert.equal(tierIn(`Size: ${top}.`), top, "the top rung is a mark like any other, not an absence");
  assert.equal(tierIn(`Size: ${top}.\nSize: ${lowest}.`), top,
    "so a body claiming it beside a lower one has claimed it, and does not read as the lower");
  assert.deepEqual(climbsIn(`Size: ${TIERS.at(-1)} -> ${lowest}`), [],
    "a pair pointing down is no climb: read by its destination alone it would raise a trivial to a fix");
  assert.deepEqual(climbsIn(`Size: ${lowest} -> ${middle}\nSize: ${middle} -> ${TIERS.at(-1)}`),
    [middle, TIERS.at(-1)],
    "and every climb a page states, so the newest correction cannot erase the re-size before it");
  assert.equal(tierOf({ description: `Size: ${lowest}.`, plan: "", moved: [`Size: ${TIERS.at(-1)} -> ${middle}`], whole: true }),
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
      const said = lightens(row.status, { description: body(tier), plan: "", moved: [], whole: true });
      assert.equal(said, row.tiers.includes(tier),
        `at ${row.status} a \`${tier}\` ${row.tiers.includes(tier) ? "stops owing" : "owes"} ${row.drops}`);
    }
    assert.equal(lightens(row.status, { description: body(top), plan: "", moved: [], whole: true }), false,
      `${row.status} drops ${row.drops} for the top rung`);
  }
  for (const tier of TIERS) {
    assert.equal(lightens("in_progress", { description: body(tier), plan: "", moved: [], whole: true }), false,
      `${tier} is exempted from the baseline, which no rung buys`);
  }
});

/* The contract's own guide prints the mark inside a fence, so a reading that took one would leave
   every body quoting it claiming that rung. Why not the higher of two readings: the-ladder.md. */
test("a mark inside an example claims nothing, and does not move a mark the body really carries", () => {
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
    assert.equal(tierIn(shown), top, "an example is the only apparent mark, and the body claims nothing");
  }
  assert.equal(tierIn(`no mark\n\n\`\`\`\na\n\`\`\`\n\nSize: ${lowest}.\n\n\`\`\`\nb\n\`\`\`\n`), lowest,
    "while a mark standing between two examples is prose, so stripping cannot run past a closing wall");
  assert.equal(tierIn(`Size: ${lowest}.\n\n\`\`\`\nSize: ${top}.\n\`\`\`\n`), lowest,
    "and an example beside a real mark leaves the real one standing, rather than being read beside it");
  assert.equal(tierIn(`\`\`\`\nSize: ${top}.\n\`\`\`\`\n\nSize: ${lowest}.\n`), lowest,
    "a longer wall closes too, so a body writing one does not lose the mark standing after it");
  assert.equal(markedIn("a body with no mark at all"), null,
    "no mark is told from the top rung, so a report cannot say a body carrying one carries none");
  assert.equal(markedIn(`Size: ${top}.`), top, "and the top rung claimed in full reads as claimed");
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
  assert.equal(tierOf({ description: body(middle), plan: "User-facing outcome: no\nUser-facing outcome: yes", moved: [], whole: true }),
    top, "so a plan that names an outcome anywhere in it has named one");
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0,
    "while a plan declaring neither still climbs nothing");
});

test("a declaration climbs one rung and a correction climbs to what it names, and neither goes down", () => {
  assert.equal(escalatedBy("Screen change: yes"), 1, "a screen change is one rung, not a jump to the top");
  assert.equal(escalatedBy("User-facing outcome: yes"), 1);
  assert.equal(escalatedBy("Screen change: no\nUser-facing outcome: no"), 0);
  const climbed = (description, plan, moved = []) => tierOf({ description, plan, moved, whole: true });
  assert.equal(climbed(body("trivial"), "Screen change: yes"), "fix", "one rung up from the shortest");
  assert.equal(climbed(body("fix"), "User-facing outcome: yes"), "feature");
  assert.equal(climbed(body("trivial"), "", ["Size: trivial -> feature"]), "feature",
    "a correction names the rung it climbed to, and the mark it left decides nothing");
  assert.equal(climbed(body("fix"), "", ["Size: feature -> trivial"]), "fix",
    "a downward pair would unearn statuses already held, so it is read as no climb at all");
  assert.equal(climbed(body("fix"), "", ["Size: fix -> full"]), "feature", "and the older word still reads");
  assert.equal(climbed(body("trivial"), "Screen change: yes", ["Size: trivial -> feature"]), "feature",
    "the highest of the two, so a plan declaration cannot walk a re-size back down");
});

test("a page the tracker cut is judged at the top rung, whatever its mark says", () => {
  for (const tier of TIERS) {
    assert.equal(tierOf({ description: body(tier), plan: "", moved: [], whole: false }), "feature",
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

/* The stamp `forge stats runs` reads. Filled at the write from the description the write already
   has, so it proves the rung rather than proving somebody typed a word; refused as a flag, and a
   record that arrived without it is refused nothing, every entry check reading the body itself. */
test("a confirmation a write posts carries the rung, and one handed in without it is not refused", async () => {
  const [trivial] = TIERS;
  await ranAsync(FORGE, ["claim", "ISS-70"], tracker.env);
  const wrote = await ranAsync(FORGE,
    ["record", "confirmation", "ISS-70", "--where", "src/ladder.mjs", "--is", "a rung", "--finding", "holds"],
    tracker.env);
  assert.equal(wrote.status, 0, wrote.stderr);
  const posted = state.calls.filter((one) => one.args.action === "create").at(-1)?.args.data?.body ?? "";
  assert.match(posted, new RegExp(`^tier: ${trivial}$`, "mu"),
    "the rung is stamped at the write, off the body, rather than asked of whoever is writing");
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
  assert.match(run.stdout, /is a `fix`: its body is marked `Size: fix\.`\. The entry checks run that tier/u);
  const reported = (row) => [`at ${row.status}`, row.drops, row.because].every((one) => run.stdout.includes(one));
  for (const row of LIGHTER) assert.ok(reported(row), `${row.status} is lightened and the report omits ${row.drops}`);
  assert.match(run.stdout, /forge plan ISS-71 <plan\.md>/u, "one route up, in the form it wants");
  assert.match(run.stdout, /--moved "Size: fix -> feature"/u, "and the other, so neither is inferred");
  assert.match(run.stdout, /no confirmation/u, "while the confirmation with its where is owed all the same");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false, "and --owed moves nothing");
});

/* A rung whose saving is rounds rather than payloads is invisible to LIGHTER, so this report is the
   only place the difference between it and the rung above can be read: a run shown the same three
   drops and nothing else has been told the two rungs are the same thing. */
test("the shortest rung drops what the one above drops, and is told what else it may spend fewer of", async () => {
  const [trivial, fix, feature] = [await owed("ISS-70"), await owed("ISS-71"), await owed("ISS-72")];
  assert.match(trivial.stdout, /is a `trivial`: its body is marked `Size: trivial\.`/u);
  for (const row of LIGHTER) {
    assert.ok(trivial.stdout.includes(row.drops), `the shortest rung is reported to owe ${row.drops}`);
  }
  const roundsIn = (text) => text.split("and fewer rounds")[1]?.split("Every other demand")[0] ?? "";
  const [under, above] = [roundsIn(trivial.stdout), roundsIn(fix.stdout)];
  assert.ok(SPARES.trivial.every((one) => under.includes(one)), "each round it may spend fewer of is named");
  assert.ok(SPARES.trivial.some((one) => !above.includes(one)),
    "and one of them is not the rung above's, or the two differ in nothing a reader can act on");
  assert.match(trivial.stdout, /--moved "Size: trivial -> fix"/u, "the route up names the next rung, not the top");
  assert.match(feature.stdout, /claims no size on either source, so it is a `feature`/u);
  assert.match(feature.stdout, /a feature owes the whole set/u, "the top rung says so rather than saying nothing");
  assert.doesNotMatch(feature.stdout, /Two routes up/u, "and has none to offer");
});

/* The top rung is both a mark and the default, and a report reading only the answer cannot tell the
   two apart — so it told a body carrying `Size: feature.` in full that it carried no mark, which is
   the tool stating something false about text the reporter wrote. This repository's own issues are
   marked that way, which is how it was found. */
test("a body claiming the top rung in full is not told it carries no mark", async () => {
  const claimed = await owed("ISS-73");
  assert.match(claimed.stdout, /is a `feature`: its body is marked `Size: feature\.`/u,
    "the mark the body carries is read back to whoever wrote it");
  assert.doesNotMatch(claimed.stdout, /claims no size on either source/u,
    "and is not reported as an absence, which would send a reporter to add a line already there");
  assert.match(claimed.stdout, /a feature owes the whole set/u, "while it owes exactly what an unmarked body owes");
  assert.doesNotMatch(claimed.stdout, /Two routes up/u, "and has nowhere to climb either");
});


/* Every size claims a rung, the report says which source decided, and neither is named on screen the
   way the tracker names it — a name a reader has to translate back costs a round. */
test("each of the tracker's five sizes claims a rung, and the report says it was the field", async () => {
  const wanted = ["trivial", "fix", "feature", "feature", "feature"];
  for (const [at, band] of BANDS.entries()) {
    assert.equal(rungFrom(band), wanted[at], band);
    const run = await owed(`ISS-${80 + at}`);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`is a \`${wanted[at]}\`: its size on the tracker is a \`${wanted[at]}\``, "u"),
      `${band} is reported at ${wanted[at]}, and the source that decided it is named`);
    assert.doesNotMatch(run.stdout, /complexity/iu, "and never by the name only the tracker uses");
    assert.doesNotMatch(run.stdout, /claims no size on either source/u, "a set field is not an absence");
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

/* A rung lowered after the plan would make a later status demand less than an earlier one established. */
test("where the two sources disagree the higher rung decides, and the outranked one is said", async () => {
  assert.equal(sizeFrom({ band: "xs", description: body("feature") }).rung, "feature");
  assert.equal(sizeFrom({ band: "xl", description: body("trivial") }).rung, "feature");
  assert.equal(sizeFrom({ band: "xs" }).rung, "trivial", "an unmarked body is lifted off the top rung");
  assert.equal(sizeFrom({ description: body("fix") }).rung, "fix", "and an unset field falls back to the mark");
  assert.equal(sizeFrom({}).rung, "feature", "with neither source, the rung that owes everything");
  const run = await owed("ISS-90");
  assert.match(run.stdout, /is a `feature`: its body is marked `Size: feature\.`/u);
  assert.match(run.stdout, /its size on the tracker is a `trivial`, which does not lower a rung the other claimed/u,
    "the source that lost is said, so a reader is not left to guess why the field did not decide");
});

/* The contract's existing rule, now read over a size as well as over a mark. */
test("a correction re-sizing upward outranks a tracker size naming a lower rung", () => {
  const moved = ["Size: trivial -> feature"];
  assert.equal(tierOf({ description: UNMARKED, plan: "", moved, band: "xs" }), "feature");
  assert.equal(tierOf({ description: UNMARKED, plan: "", moved: ["Size: feature -> fix"], band: "xs" }), "trivial",
    "while a correction pointing downward moves nothing, as it moves nothing off a mark");
  assert.equal(tierOf({ description: UNMARKED, plan: "", moved: [], band: "xs", whole: false }), "feature",
    "and a cut page is a feature whatever the field says: it cannot show the correction it hid");
});


/* Two of the five are words nothing else spells, so a second copy of the table is a file this finds.
   `rank/weights.mjs` scores a value rather than mapping it, and a project may override that table. */
test("the table from a tracker size to a rung lives in one file, and the one carve-out is named", () => {
  const ROOT = new URL("../src", import.meta.url).pathname;
  const found = [];
  const walk = (dir, at) => {
    for (const one of readdirSync(dir, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(dir, one.name), `${at}/${one.name}`);
      else if (one.name.endsWith(".mjs")) {
        const text = readFileSync(join(dir, one.name), "utf8");
        if (/\bxs\b/u.test(text) && /\bxl\b/u.test(text)) found.push(`${at}/${one.name}`);
      }
    }
  };
  walk(ROOT, "plugin/src");
  assert.deepEqual(found.sort(), ["plugin/src/ladder.mjs", "plugin/src/rank/weights.mjs"],
    `a size a reader has to map to a rung is spelt outside the ladder:\n${found.join("\n")}`);
});
