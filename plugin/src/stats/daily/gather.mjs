/* The day's content, the object `--json` prints and the page renders: every figure is a reader's that
   already computes it — `stats runs`'s profile, `codex stats`'s consult figures, the hook log — cut
   to the day, and what no reader computes is named as missing with the issue filed for it. Nothing
   here is a figure of its own: docs/cli/stats.md. */
import { boundsOf, dayOf, trendDays, weekBefore } from "./day.mjs";
import { releasesOn } from "./releases.mjs";
import { opportunitiesOf } from "./opportunities.mjs";
import { corpusOf } from "../corpus/read.mjs";
import { profileOf } from "../runs.mjs";
import { landingsOver, landingsUnder } from "../landings.mjs";
import { classesFor } from "../corpus/classes.mjs";
import { movedIn } from "../eval/eval.mjs";
import { FLOOR, THIN } from "../model-rows.mjs";
import { median } from "../median.mjs";
import { minutes } from "../figures.mjs";
import { answered, logEntries } from "../../codex/codex-log.mjs";
import { windowObject } from "../../codex/codex-stats.mjs";
import { hookEntries } from "../../hooks/log/hook-log-file.mjs";

/** What no reader computes yet, each with the issue that owes the reader: named on the page in the
 *  figure's place, never printed as a nought. */
export const MISSING = {
  effort: { reading: "issue-flow runs by the effort they ran at", issue: "ISS-2424" },
  firstGate: { reading: "the share of landings that landed on their first gate", issue: "ISS-2425" },
  causes: { reading: "hand-backs by cause", issue: "ISS-2425" },
  gateLost: { reading: "gate minutes lost", issue: "ISS-2425" },
  transport: { reading: "consult calls lost to transport failures", issue: "ISS-2426" },
};

/* A hook that could not judge and let the call through writes this decision to the hook log. */
const STOOD_DOWN = "error";
/* The class `stats runs` files a declared gate command under. */
const GATE_CLASS = "gate";

const within = (at, day) => {
  const { from, to } = boundsOf(day);
  return at >= from && at < to;
};

/* A run belongs to the day it ended on, as every `stats runs` window judges a run by its own end. */
const runsOn = (runs, day) => runs.filter((run) => within(run.endedAt, day));

const thinOf = (runs) => (runs < FLOOR ? THIN : null);

/** The three headline figures of a set of runs, off the profile; a set of none has no median, so it
 *  says none rather than the nought `profileOf` prints for an empty window. */
const figureOf = (runs) => {
  if (!runs.length) return { runs: 0, medianMinutes: null, medianCalls: null };
  const held = profileOf(runs);
  return { runs: runs.length, medianMinutes: held.medianMinutes, medianCalls: held.medianCalls };
};

/* The seven days before, as the median of their seven daily figures: a count over every day, a
   median over the days that held a run. */
const weekOf = (daily) => {
  const ran = daily.filter((one) => one.runs > 0);
  return {
    runs: median(daily.map((one) => one.runs)),
    medianMinutes: median(ran.map((one) => one.medianMinutes)),
    medianCalls: median(ran.map((one) => one.medianCalls)),
    days: ran.length,
  };
};

const rowOf = (name, runs) => ({ name, ...figureOf(runs), thin: thinOf(runs.length) });

const grouped = (runs, keyOf) => {
  const held = new Map();
  for (const run of runs) held.set(keyOf(run), [...(held.get(keyOf(run)) ?? []), run]);
  return [...held].sort((left, right) => right[1].length - left[1].length);
};

/* The runs behind a listing's row: those whose own map carries the row's key. */
const runsBehind = (runs, pick, key) => runs.filter((run) => pick(run).has(key)).length;

const runsSection = (all, day, projects) => {
  const today = runsOn(all, day);
  const profile = profileOf(today);
  const daily = weekBefore(day).map((one) => figureOf(runsOn(all, one)));
  return {
    headline: { day: figureOf(today), before: daily.at(-1), week: weekOf(daily) },
    trend: trendDays(day).map((one) => ({ day: one, ...figureOf(runsOn(all, one)) })),
    projects: projects.map((one) => rowOf(one.name, runsOn(one.runs, day))),
    phases: profile.phases.map((one) => ({ name: one.name, runs: one.runs, medianMinutes: one.runs ? one.medianMinutes : null,
      medianCalls: one.runs ? one.medianCalls : null, thin: thinOf(one.runs) })),
    rungs: profile.rungs.filter((one) => one.runs > 0).map((one) => ({ name: one.rung, runs: one.runs,
      medianMinutes: one.medianMinutes, medianCalls: one.medianCalls, thin: thinOf(one.runs) })),
    models: grouped(today, (run) => run.model).map(([model, runs]) => rowOf(model, runs)),
    effort: MISSING.effort,
    profile,
  };
};

/* The passes and their resumes are the landing reader's, off every transcript and at each pass's own
   time, because a landing a dispatching session types is in no run; the rejected pushes and the gate
   are figures of the day's runs. */
const landingsOf = (runs, passes) => {
  const landed = landingsOver(passes);
  if (!runs.length && !landed.passes) return null;
  const held = runs.length ? profileOf(runs) : null;
  const gate = held?.byClass.find(([label]) => label === GATE_CLASS)?.[1] ?? { calls: 0, wait: 0 };
  return { passes: landed.passes, resumed: landed.resumed, outsideRuns: landed.outsideRuns,
    rejectedRuns: held?.ships.rejectedRuns ?? 0, gateCalls: gate.calls, gateMinutes: minutes(gate.wait) };
};

const passesOn = (passes, day) => passes.filter((one) => within(one.at, day));

/** Where the page's landings begin: the first day its trend draws. */
export const landingsFrom = (day) => boundsOf(trendDays(day)[0]).from;

const landingsSection = (all, passes, day) => ({
  headline: landingsOf(runsOn(all, day), passesOn(passes, day)),
  trend: trendDays(day).map((one) => ({ day: one,
    passes: landingsOf(runsOn(all, one), passesOn(passes, one))?.passes ?? null })),
  missing: [MISSING.firstGate, MISSING.causes, MISSING.gateLost],
});

const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

const consultsOn = (entries, day) => answered(entries).filter((one) => within(Date.parse(one.at) || 0, day));

const consultsSection = (entries, day) => {
  const verdicts = entries.filter((one) => one.kind === "verdict");
  const rows = consultsOn(entries, day);
  const held = windowObject(rows, verdicts);
  return {
    headline: { answered: held.consults, atBudget: held.stats.atBudget, budgeted: held.stats.budgeted,
      incomplete: held.stats.incomplete, retried: held.stats.retried },
    trend: trendDays(day).map((one) => ({ day: one, answered: consultsOn(entries, one).length })),
    /* One row per model and prompt version, the reader's own groups: a share pooled across two
       prompt versions is two populations averaged. */
    groups: held.groups.map((group) => {
      const ruled = group.score.accepted + group.score.rejected;
      const how = (group.score.sound ?? 0) + (group.score.misreasoned ?? 0);
      return { model: group.model, prompt: group.prompt, consults: group.consults, findings: group.score.findings,
        ruled, kept: share(group.score.accepted, ruled), how, rightAboutHow: share(group.score.sound ?? 0, how),
        thin: thinOf(group.consults) };
    }),
    missing: [MISSING.transport],
  };
};

const listed = (pairs, runs, pick) => pairs.map(([key, calls]) => ({ key, calls, runs: runsBehind(runs, pick, key) }));

const waitsOf = (runs) => {
  const held = new Map();
  for (const run of runs) {
    for (const one of run.longest) {
      const was = held.get(one.what) ?? { what: one.what, waits: 0, minutes: 0, runs: new Set() };
      was.waits += 1;
      was.minutes = Math.round((was.minutes + one.minutes) * 10) / 10;
      was.runs.add(run);
      held.set(one.what, was);
    }
  }
  return [...held.values()].map((one) => ({ ...one, runs: one.runs.size })).sort((left, right) => right.minutes - left.minutes);
};

const standDownsOn = (entries, day) => {
  const held = new Map();
  for (const one of entries) {
    if (one.decision !== STOOD_DOWN || !within(Date.parse(one.at) || 0, day)) continue;
    const was = held.get(one.hook) ?? { hook: one.hook, count: 0, sessions: new Set() };
    was.count += 1;
    was.sessions.add(one.session || "(no session)");
    held.set(one.hook, was);
  }
  return [...held.values()].map((one) => ({ ...one, sessions: one.sessions.size })).sort((left, right) => right.count - left.count);
};

const refusalsOn = (all, day) => profileOf(runsOn(all, day)).refusals.reduce((sum, [, many]) => sum + many, 0);

const frictionSection = (all, day, profile, hooks) => {
  const today = runsOn(all, day);
  return {
    headline: { refusals: profile.refusals.reduce((sum, [, many]) => sum + many, 0), runs: today.length },
    trend: trendDays(day).map((one) => ({ day: one, refusals: runsOn(all, one).length ? refusalsOn(all, one) : null })),
    refusals: listed(profile.refusals, today, (run) => run.refusals),
    errors: listed(profile.errors, today, (run) => run.errors),
    repeats: listed(profile.repeats, today, (run) => run.repeats),
    waits: waitsOf(today),
    guideParts: profile.guideParts.map(([key, one]) => ({ key, ...one })),
    standDowns: standDownsOn(hooks, day),
  };
};

/* The newest release written or copy installed on the day or the day before: the one a move on the
   day can have followed. */
const followedOf = (releases) => [...releases.recent].sort((left, right) => right.at - left.at)[0] ?? null;

/* `stats eval`'s own moved-most selection, the week pooled as that reading pools a window. */
const movedOf = (all, day, profile) => {
  const week = profileOf(weekBefore(day).flatMap((one) => runsOn(all, one)));
  return { phases: movedIn(profile.phases, week.phases, "name"), rungs: movedIn(profile.rungs, week.rungs, "rung") };
};

/** The first moment anything was recorded on this device, for the range a refusal names. */
const firstOf = (all, entries) => {
  const moments = [...all.map((run) => run.startedAt), ...answered(entries).map((one) => Date.parse(one.at)).filter(Number.isFinite)];
  return moments.length ? Math.min(...moments) : null;
};

/** Every registered project's corpus, read once each, and its landings from `since` on. */
export const corporaOf = async (read, since = null) => {
  const projects = [];
  for (const one of read) {
    const corpus = await corpusOf(one.checkout);
    const passes = landingsUnder(corpus.root, classesFor(corpus.declared, corpus.act), corpus.passes, since);
    projects.push({ ...one, runs: corpus.runs, passes });
  }
  return projects;
};

/** What a day's report says. `held` is the corpora and logs already read, so the range a refusal
 *  names and the report itself come off one reading. */
export const readingOf = ({ projects, entries = logEntries(), hooks = hookEntries() }) => {
  const all = projects.flatMap((one) => one.runs).sort((left, right) => left.startedAt - right.startedAt);
  const passes = projects.flatMap((one) => one.passes ?? []);
  return { projects, all, passes, entries, hooks, first: firstOf(all, entries) };
};

export const contentOf = async (reading, day, { unread = [], match } = {}) => {
  const { projects, all, passes, entries, hooks } = reading;
  const runs = runsSection(all, day, projects);
  const { profile, ...runsShown } = runs;
  const releases = await releasesOn(day, all);
  const friction = frictionSection(all, day, profile, hooks);
  return {
    day,
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    written: new Date().toISOString(),
    projects: projects.map((one) => ({ name: one.name, slug: one.slug, checkout: one.checkout })),
    unread: unread.map((one) => ({ name: one.name, slug: one.slug })),
    runs: runsShown,
    landings: landingsSection(all, passes, day),
    consults: consultsSection(entries, day),
    friction,
    releases,
    opportunities: await opportunitiesOf(friction, match),
    moved: movedOf(all, day, profile),
    followed: followedOf(releases),
    trendDays: trendDays(day),
    dayOfFirst: reading.first === null ? null : dayOf(reading.first),
  };
};
