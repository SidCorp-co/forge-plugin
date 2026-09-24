/* `forge stats change` — one change as the unit, over the runs that ran the copy carrying it. Why the
   copy is the clock, why the verdict associates and never credits, and what no population here can
   answer — docs/cli/stats-the-change.md. */
import { corpusOf } from "../corpus/read.mjs";
import { checkoutFrom, profileOf } from "../runs.mjs";
import { RELEASES, marksOf } from "../marks/marks.mjs";
import { A_PRICE, DISPOSITIONS, angleOf, anglesAsked, blocksOf, floorsOver } from "./angles.mjs";
import { mixFloorsOver, mixOver, mixWhy } from "./mix.mjs";
import { FLOOR } from "./eval.mjs";
import { claimAsked, claimFor, claimJudged, claimSaid, writeClaim } from "./claims.mjs";
import { changeLines, namedSet } from "./change-lines.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags } from "../../resolve/flags.mjs";

const KEY = /^ISS-\d+$/iu;

export const ALONE = "ran this change and no other";
export const WIDER = "began under this change, whatever ran later";

/** The three verdicts. `undetermined` is the ordinary answer on this corpus and not a degenerate
 *  number: a copy here serves two or three runs, so the isolated population clears no floor for most
 *  changes, and a reading that manufactured an association anyway would be worse than one declining. */
export const VERDICTS = {
  associated: "associated with",
  nothing: "no angle that returned a verdict moved past this corpus's own reference",
  undetermined: "undetermined",
};

/** What no design here supplies, stated on the screen and in `--json` alike, because a reader who
 *  takes an association for credit has been handed the one error this reading exists to refuse. */
export const NO_COUNTERFACTUAL = "No comparison here supplies a counterfactual: there is no control "
  + "arm, the copy a run began under is inferred exposure and not observed exposure, and two "
  + "populations separated in time differ for reasons this corpus does not observe. An association "
  + "would be credit only if the copy clock stood for exposure and nothing unobserved separated the "
  + "two populations, and neither is established here.";

/** What none of these figures measures. The angle set is prices end to end, and the phase durations
 *  `stats eval` prints are no part of this reading: a phase that lengthens because a run now reads a
 *  reference it once skipped is an improvement wearing a regression's shape. */
export const NOT_MEASURED = `Every figure here is ${A_PRICE} A phase duration is how the work was `
  + "spent and not whether the result was good, which is why no phase table is joined to this reading. "
  + "Nothing here is a quality measure.";

const BIRTH = "the directory's birth time";
const MODIFIED = "the directory's modification time, substituted because the filesystem reports no birth time";

const momentOf = (copy, which) => copy && ({ which, version: copy.copy, at: copy.at, born: copy.born,
  how: copy.born ? BIRTH : MODIFIED });

/** The three populations and the moments their bounds rest on. The isolated one rests on this copy's
 *  install and the next one's; **where no copy followed it there is no upper installation at all**, so
 *  the population is open-ended and the reading says so rather than inventing an endpoint. The wider
 *  and the before populations rest on this copy's install and on nothing else. */
export const populationsOf = (ordered, copies, version) => {
  const at = copies.findIndex((one) => one.copy === version);
  if (at < 0) return null;
  const copy = copies[at];
  const next = copies[at + 1] ?? null;
  const aloneRows = ordered.filter((run) => run.startedAt >= copy.at && (!next || run.endedAt < next.at));
  return {
    copy,
    next,
    open: !next,
    moments: {
      alone: [momentOf(copy, "the copy carrying this change"), momentOf(next, "the copy installed after it")].filter(Boolean),
      wider: [momentOf(copy, "the copy carrying this change")],
    },
    alone: aloneRows,
    wider: ordered.filter((run) => run.startedAt >= copy.at),
    before: ordered.filter((run) => run.endedAt < copy.at),
  };
};

const windowOf = (rows, declared, act) => ({ runs: rows.length, profile: profileOf(rows, declared, act) });

/* The before side is cut to the size of the side it answers, taken back from the change's own moment:
   a before window larger than the population it is compared with would put the two figures on
   different counts and the floor on a third. A side of nothing takes nothing — `slice(-0)` is
   `slice(0)` and would hand back the whole history to answer a population of none. */
const matched = (before, many) => (many ? before.slice(-many) : []);

const anglesFor = (ordered, before, now, names, declared, act) => {
  const sides = { before: before.length ? windowOf(before, declared, act) : null,
    now: windowOf(now, declared, act) };
  if (!before.length || !now.length) {
    return names.map((name) => angleOf(name, sides, null, FLOOR));
  }
  const befores = blocksOf(ordered, before.length);
  const nows = before.length === now.length ? befores : blocksOf(ordered, now.length);
  const floors = floorsOver(befores, nows, before.length, now.length, ordered.length, names);
  return names.map((name) => angleOf(name, sides, floors.get(name) ?? null, FLOOR));
};

const mixFor = (ordered, before, now) => {
  if (!before.length || !now.length) return mixOver(before, now, new Map());
  return mixOver(before, now, mixFloorsOver(ordered, before.length, now.length));
};

/** One comparison, with what makes it eligible to carry the association kept apart from what it
 *  found. **Being judged is not being eligible**: a comparison whose covariate mix moved, or whose
 *  bounds rest on a modification time, still holds real angle verdicts worth printing, and each of the
 *  four conditions vetoes this comparison alone and never the whole reading. */
export const comparisonOf = ({ ordered, name, before, now, moments, names, declared, act }) => {
  const sized = matched(before, now.length);
  const angles = anglesFor(ordered, sized, now, names, declared, act);
  const mix = mixFor(ordered, sized, now);
  const judged = angles.filter((one) => one.disposition !== DISPOSITIONS.unevaluable);
  const clock = moments.filter((one) => !one.born);
  const why = [
    ...(judged.length ? [] : [`no angle of this comparison returned a verdict, over ${sized.length} run(s) `
      + `against ${now.length}`]),
    ...clock.map((one) => `${one.which} is dated by ${one.how}, which is not an installation`),
    ...mix.filter((one) => one.holds).map((one) => mixWhy(one)),
  ];
  return {
    name,
    before: { runs: sized.length },
    now: { runs: now.length },
    angles,
    mix,
    judged: judged.length,
    moved: judged.filter((one) => one.disposition === DISPOSITIONS.improved
      || one.disposition === DISPOSITIONS.declined).map((one) => one.name),
    eligible: !why.length,
    why,
  };
};

const issuesFor = (releases, version) => releases.filter((one) => one.version === version)
  .flatMap((one) => one.issues ?? []);

/* A release with no keys on its reading is still one change, so it counts as one rather than as none:
   a reading held before readings carried keys knows a change landed and not which issue it was. */
const changesIn = (held) => held.reduce((many, one) => many + Math.max(one.issues.length, 1), 0);

/** The set of changes a population was exposed to: the release that carried this change for the
 *  isolated one, and that release plus every copy installed inside the population's own span for the
 *  wider one. The span bounds it and not the clock: a copy installed after the last run of the
 *  population reached nobody in it. */
export const exposureOf = (copies, releases, copy, until = null) => {
  const versions = until === null
    ? [copy.copy]
    : copies.filter((one) => one.at >= copy.at && one.at <= until).map((one) => one.copy);
  const set = (versions.length ? versions : [copy.copy])
    .map((version) => ({ version, issues: issuesFor(releases, version) }));
  return { releases: set, changes: changesIn(set), keys: set.flatMap((one) => one.issues) };
};

/** The verdict, the four rules in order. The narrowest eligible comparison decides — a precedence
 *  fixed in advance so neither result is chosen for looking better, and establishing no reliability of
 *  its own. The other comparison prints whatever this returns. */
export const verdictOf = (comparisons, exposures) => {
  const eligible = comparisons.find((one) => one.eligible);
  if (!eligible) {
    return { verdict: VERDICTS.undetermined, deciding: null, associated: null,
      why: comparisons.map((one) => ({ comparison: one.name, why: one.why })) };
  }
  const exposure = exposures[eligible.name];
  const why = comparisons.filter((one) => !one.eligible).map((one) => ({ comparison: one.name, why: one.why }));
  if (!eligible.moved.length) {
    return { verdict: VERDICTS.nothing, deciding: eligible.name, associated: null, why };
  }
  return {
    verdict: `${VERDICTS.associated} ${exposure.changes} change(s): ${namedSet(exposure)}`,
    deciding: eligible.name,
    associated: { ...exposure, angles: eligible.moved, single: exposure.changes === 1 },
    why,
  };
};

const byStart = (runs) => [...runs].sort((left, right) => left.startedAt - right.startedAt);

/** The whole reading for one change, as `--json` prints it and the screen is built from. */
export const changeOf = ({ ordered, copies, releases, version, names, declared, act, claim }) => {
  const held = populationsOf(ordered, copies, version);
  if (!held) return null;
  const comparisons = [
    comparisonOf({ ordered, name: ALONE, before: held.before, now: held.alone, moments: held.moments.alone, names, declared, act }),
    comparisonOf({ ordered, name: WIDER, before: held.before, now: held.wider, moments: held.moments.wider, names, declared, act }),
  ];
  const spanned = held.wider.length ? Math.max(...held.wider.map((run) => run.endedAt)) : held.copy.at;
  const exposures = {
    [ALONE]: exposureOf(copies, releases, held.copy),
    [WIDER]: exposureOf(copies, releases, held.copy, spanned),
  };
  const deciding = comparisons.find((one) => one.eligible) ?? comparisons[0];
  return {
    version,
    total: ordered.length,
    copy: { version: held.copy.copy, at: new Date(held.copy.at).toISOString(), born: held.copy.born },
    next: held.next ? { version: held.next.copy, at: new Date(held.next.at).toISOString(), born: held.next.born } : null,
    open: held.open,
    moments: held.moments,
    exposures,
    comparisons,
    ...verdictOf(comparisons, exposures),
    claim: claimJudged(claim, deciding.angles, held.copy.at),
    counterfactual: NO_COUNTERFACTUAL,
    notMeasured: NOT_MEASURED,
  };
};

export const CHANGE_USAGE = [
  "Usage: forge stats change <version|ISS-nn> [--checkout <dir>] [--angles a,a]",
  "                          [--claim <angle>:<falls|rises>] [--json]",
  "One change as the unit: the runs that ran the copy carrying it and no other, the runs that began",
  "under it whatever ran later, and the runs before it, each judged on the angles `stats eval` holds.",
  "",
  "The verdict associates a movement with the set of changes a population was exposed to. It never",
  "credits one: no comparison here has a control arm, and `undetermined` is the ordinary answer where",
  "a copy serves two or three runs.",
  "",
  "  --checkout <dir>   as for runs",
  "  --angles a,a       which angles to judge, as for the eval",
  "  --claim a:d        what this change says it will move, written before it lands and refused once a",
  "                     release reading held here names that issue. Takes an issue key, not a version",
  "  --json             the reading alone, one object",
].join("\n");

/* The version first, then the copy — the two questions are separate and a refusal that merged them
   would leave a caller unable to tell a key nobody recorded from a copy this machine has swept. */
const versionOf = (ref, releases) => {
  if (!KEY.test(ref)) return ref;
  const key = ref.toUpperCase();
  const found = releases.findLast((one) => (one.issues ?? []).includes(key));
  if (found) return found.version;
  return fail(`stats change: no release reading held for this project names ${key}, so the copy that `
    + "carried it cannot be worked out. `forge stats marks` lists what is held.");
};

const resolved = (ref, releases, copies) => {
  const version = versionOf(ref, releases);
  if (copies.some((one) => one.copy === version)) return version;
  return fail(`stats change: ${KEY.test(ref) ? `${ref.toUpperCase()} landed in ${version}, and no copy` : `no copy`}`
    + ` of ${version} is under this machine's plugin cache, so no run of it can be found. `
    + "`forge stats marks` lists the releases a reading is held for.");
};

const claimWritten = (ref, scope, raw) => {
  if (!KEY.test(ref)) {
    fail(`stats change: --claim is about an issue and ${ref} is a version. `
      + "Claim it by its issue key: `forge stats change ISS-nn --claim <angle>:<falls|rises>`.");
  }
  const { record } = writeClaim(scope, ref.toUpperCase(), claimAsked(raw));
  return console.log(claimSaid(record));
};

export const printChange = async (argv) => {
  const [ref, ...rest] = argv;
  /* The parser reads first, whether or not the change was named: a call that misspelled a flag AND
     named nothing is answered about the flag, which is the one thing the caller can act on. */
  const named = Boolean(ref) && !ref.startsWith("--");
  const { checkout, angles, claim, json } = flags(named ? rest : argv, "stats change", ["--json"],
    { usage: CHANGE_USAGE });
  if (!named) {
    console.error("stats change: name the change — a version, or the issue key that landed in it.\n");
    console.error(CHANGE_USAGE);
    return process.exit(1);
  }
  const names = anglesAsked(angles, "stats change");
  const directory = checkoutFrom(checkout, "stats change");
  const corpus = await corpusOf(directory);
  if (claim !== undefined) return claimWritten(ref, corpus.scope, claim);
  const releases = marksOf(RELEASES, corpus.scope);
  const version = resolved(ref, releases, corpus.copies);
  if (!corpus.runs.length) {
    return console.log(`No issue-flow run under ${corpus.root}, so ${version} has no population to be `
      + "judged over.");
  }
  const held = changeOf({
    ordered: byStart(corpus.runs),
    copies: corpus.copies,
    releases,
    version,
    names,
    declared: corpus.declared,
    act: corpus.act,
    claim: KEY.test(ref) ? claimFor(corpus.scope, ref.toUpperCase()) : null,
  });
  if (json) return console.log(JSON.stringify(held, null, 2));
  for (const line of changeLines(held)) console.log(line);
  return null;
};
