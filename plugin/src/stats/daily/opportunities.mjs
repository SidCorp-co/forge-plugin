/* Where the day's rounds went that could be saved, ranked by what they cost, each set beside the
   open issue that already owns it or said to have none. It ranks and counts and proposes nothing:
   what to change is the evaluator's reading — docs/cli/stats.md. */
import { PROJECT } from "../../tracker/filing/plugin-defect.mjs";
import { neighboursOf } from "../../tracker/filing/neighbours.mjs";
import { everyIssue, shortOf } from "../../tracker/issues.mjs";
import { accountCredentials, refusing, useProject } from "../../resolve/settings.mjs";

/** How many entries are listed, and so matched: each match is a search of the backlog. */
export const LISTED = 10;

/** The reading that says what to change, which this list does not. */
const EVALUATOR = "forge stats eval";

/* Each listing, as what the runs met and what it cost them in calls: a refused call is one call, a
   command typed again is one call per typing past the first in each run, and a guide part read again
   is one call per read past the first. A long wait costs minutes and one call a wait. */
export const entriesOf = (friction) => [
  /* By the cause and not the line: a refusal the gate reworded is still the one cause. */
  ...friction.refusalCauses.map((one) => ({ kind: "refusal", met: one.met, cause: one.key, gate: one.gate,
    runs: one.runs, calls: one.calls, minutes: null })),
  /* An error only: an exit that was the command's answer cost the run nothing it could have saved. */
  ...friction.errors.map((one) => ({ kind: "error", met: `a non-zero exit no rule refused, ${one.key}`,
    runs: one.runs, calls: one.calls, minutes: null })),
  ...friction.repeats.map((one) => ({ kind: "repeat", met: one.key, runs: one.runs, calls: Math.max(0, one.calls - one.runs), minutes: null })),
  ...friction.guideParts.filter((one) => one.again > 0).map((one) => ({ kind: "guide part", met: one.key, runs: one.again,
    calls: one.calls - one.runs, minutes: null })),
  ...friction.waits.map((one) => ({ kind: "wait", met: one.what, runs: one.runs, calls: one.waits, minutes: one.minutes })),
];

const ranked = (entries) => [...entries].sort((left, right) =>
  right.calls - left.calls || (right.minutes ?? 0) - (left.minutes ?? 0) || right.runs - left.runs);

const endpointHeld = () => Boolean(accountCredentials().url.value && accountCredentials().token.value);

/** A matcher over the plugin's open backlog, the nearest neighbour `neighboursOf` keeps being an
 *  entry's owner, and each issue's status and priority by its key; or why the backlog could not be
 *  asked. Every status is read, in the one walk the current report written beside the page reads too.
 *  The tracker's two reads are the caller's to stand in for. */
export const backlogMatcher = async (registered, { read = everyIssue, near = neighboursOf, held = endpointHeld } = {}) => {
  const plugin = registered.find((one) => one.slug === PROJECT);
  if (!plugin) return { refused: `the plugin's backlog, ${PROJECT}, is not a project registered on this device` };
  if (!held()) return { refused: "no Forge endpoint is saved on this machine" };
  try {
    return await refusing(async () => {
      useProject({ slug: PROJECT, from: "the plugin's own backlog" });
      const all = await read({}, { soft: true });
      if (all.refused) return { refused: String(all.refused).split("\n")[0] };
      /* A backlog read short cannot say an entry matches none of it. */
      const short = shortOf(all, "the plugin's backlog");
      if (short) return { refused: short.split("\n")[0] };
      const open = all.rows.filter((one) => one.status === "open");
      const byKey = new Map(all.rows.map((one) => [String(one.issueId ?? "").toUpperCase(), one]));
      return {
        issue: (key) => {
          const row = byKey.get(String(key ?? "").toUpperCase());
          return row ? { status: row.status ?? null, priority: row.priority ?? "none" } : null;
        },
        match: async (text) => {
          const found = await near({ seed: text, place: null }, open);
          const nearest = found.suggestions.find((one) => one.score !== null) ?? null;
          /* A search that could not run found nothing and is not a backlog without a match. */
          if (!nearest && found.notes.length) throw new Error(found.notes[0]);
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
