/* The issues closed each day and the issue-flow minutes that went to them, off the tracker's own
   status history rather than off any transcript: a close is the tracker's fact, and a run is only
   what this device saw of the work. Where the history is read from, why each day is its own walk,
   and how a run's minutes are split between its issues: docs/cli/stats.md. */
import { boundsOf, weekBefore } from "./day.mjs";
import { byAlias, documentsOf, pairsOf } from "../eval/outcomes.mjs";
import { everyIssue, shortOf } from "../../tracker/issues.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { accountCredentials, refusing, useProject } from "../../resolve/settings.mjs";

const PAGE = 200;
const MOVED = "issue.statusChanged";
const CLOSED = "closed";

export const SPLIT = "a run that owned several issues lends each an equal share of its minutes";
export const REOPENED = "an issue closed again after a reopen counts on each day it closed";
export const NO_ENDPOINT = "no Forge endpoint is saved on this machine";
export const SATURATED = "more events share one timestamp than a page of the history carries, so the walk cannot get past them";
const NO_READING = "no tracker reading was made for this page";

const firstLine = (text) => String(text ?? "").split("\n")[0];
const tenth = (value) => Math.round(value * 10) / 10;

/** The events of one history inside `[from, to)`, newest first by the tracker's cursor. The cursor
 *  moves to a millisecond past the oldest event a page held and events are kept by id, so two sharing
 *  a timestamp across a page boundary are both kept. A page adding none is the end where it is short
 *  of `limit`, and where it is full a tie as long as a page, which no cursor on time can get past. */
export const walkBack = async (ask, from, to, limit = PAGE) => {
  const held = new Map();
  let before = to;
  for (;;) {
    const page = await ask(new Date(before).toISOString());
    if (page?.refused) return { unread: firstLine(page.refused) };
    const events = page?.events ?? [];
    let oldest = Infinity;
    let fresh = 0;
    for (const one of events) {
      const at = Date.parse(one.at);
      oldest = Math.min(oldest, at);
      if (at < from || at >= to || held.has(one.id)) continue;
      held.set(one.id, { ...one, at });
      fresh += 1;
    }
    if (!events.length || !page.nextBefore || oldest < from) return { events: [...held.values()] };
    if (!fresh) return events.length < limit ? { events: [...held.values()] } : { unread: SATURATED };
    before = oldest + 1;
  }
};

const closesIn = (events) => events.filter((one) => one.action === MOVED && one.to === CLOSED);

const tracker = {
  limit: PAGE,
  activity: (before) => scoped("forge_issues", { action: "activity", limit: PAGE, before }, true),
  history: (documentId, before) => scoped("forge_issues", { action: "issue_activity", documentId, limit: PAGE, before }, true),
  issues: () => everyIssue({}, { soft: true }),
};

/* Every close an issue ever had, off its own history. */
const everyCloseOf = async (documentId, reads) => {
  const walked = await walkBack((before) => reads.history(documentId, before), 0, Date.now() + 60_000, reads.limit);
  return walked.unread ? { unread: walked.unread } : { at: closesIn(walked.events).map((one) => one.at).sort((a, b) => a - b) };
};

const listedOf = async (reads, name) => {
  const read = await reads.issues();
  if (read.refused) return { unread: `${name}: ${firstLine(read.refused)}` };
  const short = shortOf(read, `${name}'s issue list`);
  return short ? { unread: firstLine(short) } : { documents: documentsOf(byAlias(read.rows)) };
};

/* A run lends a close only when it started after the close before, and the walked days hold every
   close since the first of them began: an issue's own history is read only where a run that owned
   it started before that, since a close earlier still could stand between that run and this one. */
const historiesOf = async (closedIds, pairs, since, reads) => {
  const early = new Set(pairs.filter((one) => one.run.startedAt < since && closedIds.has(one.key)).map((one) => one.key));
  const history = new Map();
  for (const documentId of early) history.set(documentId, await everyCloseOf(documentId, reads));
  return history;
};

/* One project's closes on each day, its runs paired with the issues they owned, and the whole close
   history of each closed issue a run began on before the walked days. Its eight walks run at once;
   the project a scoped call aims at is process-wide, so projects are read one after another. */
const projectRead = async (project, days, runs, reads) => {
  useProject({ slug: project.slug, from: "the daily page's closed count" });
  const walks = await Promise.all(days.map((day) => {
    const { from, to } = boundsOf(day);
    return walkBack(reads.activity, from, to, reads.limit);
  }));
  const perDay = Object.fromEntries(days.map((day, at) => [day, walks[at].unread
    ? { unread: `${project.name}: ${walks[at].unread}` }
    : { closes: closesIn(walks[at].events).map((one) => ({ slug: project.slug, issueId: one.issueId, at: one.at })) }]));
  const listed = await listedOf(reads, project.name);
  if (listed.unread) return { perDay, owners: listed, history: new Map() };
  const pairs = pairsOf(runs, listed.documents);
  const closedIds = new Set(Object.values(perDay).flatMap((one) => one.closes ?? []).map((one) => one.issueId));
  return { perDay, owners: { pairs }, history: await historiesOf(closedIds, pairs, boundsOf(days[0]).from, reads) };
};

const unreadProject = (project, days, why) => ({
  perDay: Object.fromEntries(days.map((day) => [day, { unread: `${project.name}: ${why}` }])),
  owners: { unread: `${project.name}: ${why}` },
  history: new Map(),
});

const safely = async (project, days, runs, reads) => {
  if (!project.slug) return unreadProject(project, days, "its record names no tracker project");
  try {
    return await refusing(() => projectRead(project, days, runs, reads));
  } catch (error) {
    return unreadProject(project, days, firstLine(error.message));
  }
};

const endpointHeld = () => Boolean(accountCredentials().url.value && accountCredentials().token.value);

/** The closes of a day and of the seven days before it over every registered project, each day
 *  unread where any project's walk of it was: a sum missing one project reads as fewer closes.
 *  `runs` is the reading's projects, whose runs are paired by the slug each was registered under. */
export const closesRead = async (registered, day, { runs = [], reads = tracker, held = endpointHeld } = {}) => {
  const days = [...weekBefore(day), day];
  const everywhere = (why) => ({ days: Object.fromEntries(days.map((one) => [one, { unread: why }])), owners: {}, history: new Map() });
  if (!registered.length) return everywhere("no project is registered on this device");
  if (!held()) return everywhere(NO_ENDPOINT);
  const read = [];
  for (const project of registered) {
    const own = runs.filter((one) => one.slug === project.slug).flatMap((one) => one.runs);
    read.push([project, await safely(project, days, own, reads)]);
  }
  const perDay = (one) => {
    const unread = read.map(([, got]) => got.perDay[one].unread).filter(Boolean);
    return unread.length ? { unread: unread.join("; ") } : { closes: read.flatMap(([, got]) => got.perDay[one].closes) };
  };
  return {
    days: Object.fromEntries(days.map((one) => [one, perDay(one)])),
    owners: Object.fromEntries(read.filter(([project]) => project.slug).map(([project, got]) => [project.slug, got.owners])),
    history: new Map(read.flatMap(([, got]) => [...got.history])),
  };
};

const grouped = (closes) => {
  const held = new Map();
  for (const one of closes) held.set(one.issueId, [...(held.get(one.issueId) ?? []), one]);
  return held;
};

/* A run's share of each close it lends to: every issue it owned takes an equal part of its minutes. */
const sharesOf = (pairs) => {
  const owned = new Map();
  for (const pair of pairs) owned.set(pair.run, (owned.get(pair.run) ?? 0) + 1);
  return (run) => run.seconds / 60 / owned.get(run);
};

/* Every close of an issue the page knows of: its own history where that was read, else every walked
   day's, which is whole for a run that began after the last walked day that could not be read. */
const timesOf = (closed, issueId, starts) => {
  const every = closed.history.get(issueId);
  if (every) return every;
  const gaps = Object.entries(closed.days).filter(([, one]) => one.unread).map(([day]) => boundsOf(day).to);
  if (starts.some((start) => gaps.some((end) => start < end))) {
    return { unread: "a walked day between a run that owned one of these issues and its close could not be read" };
  }
  const at = Object.values(closed.days).flatMap((one) => one.closes ?? []).filter((one) => one.issueId === issueId).map((one) => one.at);
  return { at: at.sort((a, b) => a - b) };
};

/* The minutes one issue's closes of the day were lent: a run lends a close when it started at or
   before it and after the close before it. */
const lentTo = (issueId, closes, closed, pairs, share) => {
  const owners = pairs.filter((one) => one.key === issueId);
  const times = timesOf(closed, issueId, owners.map((one) => one.run.startedAt));
  if (times.unread) return { unread: times.unread };
  let minutes = 0;
  let runs = 0;
  for (const close of closes) {
    const previous = times.at.filter((at) => at < close.at).at(-1) ?? -Infinity;
    for (const pair of owners.filter((one) => one.run.startedAt <= close.at && one.run.startedAt > previous)) {
      minutes += share(pair.run);
      runs += 1;
    }
  }
  return { minutes, runs };
};

const minutesOf = (closed, byIssue) => {
  let minutes = 0;
  let withoutRun = 0;
  const shares = new Map();
  for (const [issueId, closes] of byIssue) {
    const owners = closed.owners[closes[0].slug];
    if (!owners || owners.unread) return { unread: owners?.unread ?? `${closes[0].slug}: its issue list was not read` };
    if (!shares.has(owners)) shares.set(owners, sharesOf(owners.pairs));
    const lent = lentTo(issueId, closes, closed, owners.pairs, shares.get(owners));
    if (lent.unread) return { unread: lent.unread };
    minutes += lent.minutes;
    if (!lent.runs) withoutRun += 1;
  }
  return { minutes: tenth(minutes), withoutRun };
};

/** A day's figures: the distinct issues closed, the minutes runs lent those closes and how many had no run here; `unread` where the count could not
 *  be read, and `minutesUnread` where only the minutes could not. */
export const closedOn = (reading, day) => {
  const closed = reading.closed;
  const today = closed?.days?.[day];
  if (!today) return { unread: NO_READING };
  if (today.unread) return { unread: today.unread };
  const byIssue = grouped(today.closes);
  const lent = minutesOf(closed, byIssue);
  return { closed: byIssue.size, minutes: lent.minutes ?? null, withoutRun: lent.withoutRun ?? null, minutesUnread: lent.unread ?? null };
};
