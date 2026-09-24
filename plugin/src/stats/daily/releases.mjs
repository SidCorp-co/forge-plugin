/* What was released into the harness on the day: each release reading the release step wrote, with
   the issues it carries read off the tracker for their titles and release-note lines, and each copy
   this device installed. Beside each release, the day's runs either side of it — docs/cli/stats.md. */
import { boundsOf, shifted, trendDays } from "./day.mjs";
import { FLOOR } from "../model-rows.mjs";
import { profileOf } from "../runs.mjs";
import { RELEASES, marksOf } from "../marks/marks.mjs";
import { cacheRoot, installedCopies } from "../versions.mjs";
import { readMember } from "../../flow/record/wave.mjs";
import { accountCredentials, refusing, useProject } from "../../resolve/settings.mjs";

const NO_ENDPOINT = "no Forge endpoint is saved on this machine";

const within = (at, day) => {
  const { from, to } = boundsOf(day);
  return at >= from && at < to;
};

const sideOf = (runs) => (runs.length
  ? { runs: runs.length, ...(({ medianMinutes, medianCalls }) => ({ medianMinutes, medianCalls }))(profileOf(runs)) }
  : { runs: 0, medianMinutes: null, medianCalls: null });

/** The day's runs that ended before a moment and those that began after it; a run spanning it is on
 *  neither side, since it ran under both copies. Too early to read where either side is under the
 *  floor `stats models` compares at. */
export const sidesOf = (runs, at) => {
  const before = sideOf(runs.filter((run) => run.endedAt < at));
  const after = sideOf(runs.filter((run) => run.startedAt > at));
  return { before, after, early: before.runs < FLOOR || after.runs < FLOOR };
};

/* One issue's title and release-note line, off the project the release reading was held under. A
   read that fails says so on its own row and never stops the report. */
const issueOf = async (key, scope) => {
  if (!accountCredentials().url.value || !accountCredentials().token.value) return { key, unread: NO_ENDPOINT };
  try {
    return await refusing(async () => {
      if (scope && !scope.includes(":")) useProject({ slug: scope, from: "the release reading's scope" });
      const got = await readMember(key);
      if (got.refused) return { key, unread: got.refused.split("\n")[0] };
      return { key, title: got.body?.title ?? null, note: got.body?.releaseNotes?.userFacing ?? null };
    });
  } catch (error) {
    return { key, unread: String(error.message).split("\n")[0] };
  }
};

const dayRuns = (runs, day) => runs.filter((run) => within(run.endedAt, day));

/** Every release reading and installed copy whose moment is on the day, oldest first. */
export const releasesOn = async (day, runs, { marks = marksOf(RELEASES), copies = installedCopies(cacheRoot()) } = {}) => {
  const today = dayRuns(runs, day);
  const landed = [];
  for (const mark of marks.filter((one) => within(Date.parse(one.at) || 0, day))) {
    const at = Date.parse(mark.at);
    const issues = [];
    for (const key of mark.issues ?? []) issues.push(await issueOf(key, mark.scope ?? null));
    landed.push({ version: mark.version ?? null, head: mark.head ?? null, at, scope: mark.scope ?? null,
      issues, ...sidesOf(today, at) });
  }
  landed.sort((left, right) => left.at - right.at);
  const installed = copies.filter((one) => within(one.at, day)).map((one) => ({ copy: one.copy, at: one.at, born: one.born }));
  const trend = trendDays(day).map((one) => marks.filter((mark) => within(Date.parse(mark.at) || 0, one)).length);
  /* What a move on the day can have followed: a release or an install on it or the day before. */
  const recent = [...marks.map((one) => ({ version: one.version ?? null, at: Date.parse(one.at) || 0, kind: "release" })),
    ...copies.map((one) => ({ version: one.copy, at: one.at, kind: "install" }))]
    .filter((one) => within(one.at, day) || within(one.at, shifted(day, -1)));
  return { landed, installed, trend, recent };
};
