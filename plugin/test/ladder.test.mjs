/* The ladder has three rungs and two of them stop owing the same three payloads, so what keeps the
   shortest from being the middle one wearing another word is the report and the rounds it names.
   Spawned against a tracker rather than called: `--owed` reads the record before it says anything,
   and a run learns its tier from the same verb and the same record it learns the shortfall from. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "./fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("ladder").path;
const {
  CEILINGS, LIGHTER, SPARES, TIERS, climbsIn, escalatedBy, heightOf, lightens, markedIn, overCeiling,
  resizeForm, tierIn, tierOf,
} = await import("../src/ladder.mjs");
const { planFlags } = await import("../src/flow/machine.mjs");

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

const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [
    issue("trivial"), issue("fix"), { ...issue("feature"), description: "no mark here" },
    { ...issue("feature"), documentId: "claimed-uuid", issueId: "ISS-73" },
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
  ]) {
    assert.equal(tierIn(shown), top, "an example is the only apparent mark, and the body claims nothing");
  }
  assert.equal(tierIn(`no mark\n\n\`\`\`\na\n\`\`\`\n\nSize: ${lowest}.\n\n\`\`\`\nb\n\`\`\`\n`), lowest,
    "while a mark standing between two examples is prose, so stripping cannot run past a closing wall");
  assert.equal(tierIn(`Size: ${lowest}.\n\n\`\`\`\nSize: ${top}.\n\`\`\`\n`), lowest,
    "and an example beside a real mark leaves the real one standing, rather than being read beside it");
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
});

test("--owed reports the rung the checks run, what it drops and every route up from it", async () => {
  const run = await owed("ISS-71");
  assert.equal(run.status, 0, "asked what is owed, the shortfall is the answer and not a refusal");
  assert.match(run.stdout, /marked `Size: fix\.`, so it is a `fix`\. The entry checks run that tier/u);
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
  assert.match(trivial.stdout, /marked `Size: trivial\.`, so it is a `trivial`/u);
  for (const row of LIGHTER) {
    assert.ok(trivial.stdout.includes(row.drops), `the shortest rung is reported to owe ${row.drops}`);
  }
  const roundsIn = (text) => text.split("and fewer rounds")[1]?.split("Every other demand")[0] ?? "";
  const [under, above] = [roundsIn(trivial.stdout), roundsIn(fix.stdout)];
  assert.ok(SPARES.trivial.every((one) => under.includes(one)), "each round it may spend fewer of is named");
  assert.ok(SPARES.trivial.some((one) => !above.includes(one)),
    "and one of them is not the rung above's, or the two differ in nothing a reader can act on");
  assert.match(trivial.stdout, /--moved "Size: trivial -> fix"/u, "the route up names the next rung, not the top");
  assert.match(feature.stdout, /carries no size mark, so it is a `feature`/u);
  assert.match(feature.stdout, /a feature owes the whole set/u, "the top rung says so rather than saying nothing");
  assert.doesNotMatch(feature.stdout, /Two routes up/u, "and has none to offer");
});

/* The top rung is both a mark and the default, and a report reading only the answer cannot tell the
   two apart — so it told a body carrying `Size: feature.` in full that it carried no mark, which is
   the tool stating something false about text the reporter wrote. This repository's own issues are
   marked that way, which is how it was found. */
test("a body claiming the top rung in full is not told it carries no mark", async () => {
  const claimed = await owed("ISS-73");
  assert.match(claimed.stdout, /marked `Size: feature\.`, so it is a `feature`/u,
    "the mark the body carries is read back to whoever wrote it");
  assert.doesNotMatch(claimed.stdout, /carries no size mark/u,
    "and is not reported as an absence, which would send a reporter to add a line already there");
  assert.match(claimed.stdout, /a feature owes the whole set/u, "while it owes exactly what an unmarked body owes");
  assert.doesNotMatch(claimed.stdout, /Two routes up/u, "and has nowhere to climb either");
});
