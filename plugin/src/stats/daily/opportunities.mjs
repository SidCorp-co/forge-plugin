/* Where the day's rounds went that could be saved, ranked by what they cost, each set beside the
   open issue that already owns it or said to have none. It ranks and counts and proposes nothing:
   what to change is the evaluator's reading — docs/cli/stats.md. */
import { PROJECT } from "../../tracker/filing/plugin-defect.mjs";
import { neighboursOf } from "../../tracker/filing/neighbours.mjs";
import { everyIssue } from "../../tracker/issues.mjs";
import { accountCredentials, refusing, useProject } from "../../resolve/settings.mjs";

/** How many entries are listed, and so matched: each match is a search of the backlog. */
export const LISTED = 10;

/** The reading that says what to change, which this list does not. */
const EVALUATOR = "forge stats eval";

/* Each listing, as what the runs met and what it cost them in calls: a refused call is one call, a
   command typed again is one call per typing past the first in each run, and a guide part read again
   is one call per read past the first. A long wait costs minutes and one call a wait. */
const entriesOf = (friction) => [
  ...friction.refusals.map((one) => ({ kind: "refusal", met: one.key, runs: one.runs, calls: one.calls, minutes: null })),
  ...friction.errors.map((one) => ({ kind: "error", met: `a non-zero exit no rule refused, class ${one.key}`,
    runs: one.runs, calls: one.calls, minutes: null })),
  ...friction.repeats.map((one) => ({ kind: "repeat", met: one.key, runs: one.runs, calls: Math.max(0, one.calls - one.runs), minutes: null })),
  ...friction.guideParts.filter((one) => one.again > 0).map((one) => ({ kind: "guide part", met: one.key, runs: one.again,
    calls: one.calls - one.runs, minutes: null })),
  ...friction.waits.map((one) => ({ kind: "wait", met: one.what, runs: one.runs, calls: one.waits, minutes: one.minutes })),
];

const ranked = (entries) => [...entries].sort((left, right) =>
  right.calls - left.calls || (right.minutes ?? 0) - (left.minutes ?? 0) || right.runs - left.runs);

/** A matcher over the plugin's open backlog, the nearest neighbour `neighboursOf` keeps being an
 *  entry's owner; or why the backlog could not be asked. */
export const backlogMatcher = async (registered) => {
  const plugin = registered.find((one) => one.slug === PROJECT);
  if (!plugin) return { refused: `the plugin's backlog, ${PROJECT}, is not a project registered on this device` };
  if (!accountCredentials().url.value || !accountCredentials().token.value) return { refused: "no Forge endpoint is saved on this machine" };
  try {
    return await refusing(async () => {
      useProject({ slug: PROJECT, from: "the plugin's own backlog" });
      const open = await everyIssue({ status: "open" }, { soft: true });
      if (open.refused) return { refused: String(open.refused).split("\n")[0] };
      return {
        match: async (text) => {
          const found = await neighboursOf({ seed: text, place: null }, open.rows);
          const nearest = found.suggestions.find((one) => one.score !== null) ?? null;
          return nearest ? { key: nearest.issueId, title: nearest.title } : null;
        },
      };
    });
  } catch (error) {
    return { refused: String(error.message).split("\n")[0] };
  }
};

/** The ranked list, its first `LISTED` each matched, and how many the ranking left unlisted. */
export const opportunitiesOf = async (friction, matcher = { refused: "no backlog was asked" }) => {
  const all = ranked(entriesOf(friction));
  const listed = [];
  for (const one of all.slice(0, LISTED)) {
    if (!matcher.match) {
      listed.push({ ...one, match: null, unmatched: matcher.refused });
      continue;
    }
    try {
      listed.push({ ...one, match: await refusing(() => matcher.match(`${one.kind}: ${one.met}`)), unmatched: null });
    } catch (error) {
      listed.push({ ...one, match: null, unmatched: String(error.message).split("\n")[0] });
    }
  }
  return { listed, unlisted: Math.max(0, all.length - LISTED), evaluator: EVALUATOR };
};
