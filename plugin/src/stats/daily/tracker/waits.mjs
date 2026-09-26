/* How long work stood still for a person each day. A wait is the time an issue spent at a status a
   person's park lands it in, and it counts on the day it ended. Which statuses those are, where a
   wait's two ends are read and why the open ones stand apart: docs/cli/stats-the-reading.md. */
import { boundsOf, weekBefore } from "../day.mjs";
import { MOVED, NO_ENDPOINT, TRACKER, endpointHeld, firstLine, oncePerSlug, walkBack } from "./history.mjs";
import { PARK_STATUS, answersByComment } from "../../../flow/earned/park-status.mjs";
import { shortOf } from "../../../tracker/issues.mjs";
import { refusing, useProject } from "../../../resolve/settings.mjs";

const CREATED = "issue.created";
const MINUTE = 60_000;
/* A walk to now ends a little past it, so an event stamped by a clock ahead of this one is kept. */
const AHEAD = 60_000;
const NO_READING = "no tracker reading was made for this page";
const NO_START = "its history holds no creation to start the wait it began at";

/** The statuses a park answered by a person lands an issue in, read off the flow's own table. */
export const PERSON = new Set(Object.values(PARK_STATUS).filter(answersByComment));

const tenth = (value) => Math.round(value * 10) / 10;

/* The moves in the order they were made. Time orders them, and moves sharing a millisecond, which no
   cursor or page order says the order of, are put in the order whose statuses link: next is the one
   leaving from where the move before arrived, or, with none before or none leaving from there, the
   one no other of that millisecond arrives where it leaves from. */
const nextOf = (group, previous) => {
  const linked = group.findIndex((one) => one.from === previous);
  if (linked >= 0) return linked;
  return Math.max(group.findIndex((one) => !group.some((other) => other !== one && other.to === one.from)), 0);
};

const chained = (moves) => {
  const left = [...moves].sort((one, other) => one.at - other.at);
  const out = [];
  while (left.length) {
    const group = left.filter((one) => one.at === left[0].at);
    out.push(...left.splice(nextOf(group, out.at(-1)?.to), 1));
  }
  return out;
};

/** One issue's waits, off its whole history: from a move into a person's status, or from its creation
 *  where it began at one, to the first move out; a move between two of them continues the wait. A
 *  wait not yet ended has `end` null. `status` is where the issue list says it stands now. */
export const spansOf = (events, status = null) => {
  const created = events.find((one) => one.action === CREATED)?.at ?? null;
  const moves = chained(events.filter((one) => one.action === MOVED));
  const beganAtOne = moves.length ? PERSON.has(moves[0].from) : PERSON.has(status);
  if (beganAtOne && created === null) return { unread: NO_START };
  const spans = [];
  let start = beganAtOne ? created : null;
  for (const move of moves) {
    if (start === null && PERSON.has(move.to) && !PERSON.has(move.from)) start = move.at;
    if (start !== null && PERSON.has(move.from) && !PERSON.has(move.to)) {
      spans.push({ start, end: move.at });
      start = null;
    }
  }
  if (start !== null) spans.push({ start, end: null });
  return { spans };
};

const historyOf = async (documentId, status, reads) => {
  const walked = await walkBack((before) => reads.history(documentId, before), 0, Date.now() + AHEAD, reads.limit);
  return walked.unread ? { unread: walked.unread } : spansOf(walked.events, status);
};

const listedOf = async (reads, name) => {
  const read = await reads.issues();
  if (read.refused) return { unread: `${name}: ${firstLine(read.refused)}` };
  const short = shortOf(read, `${name}'s issue list`);
  return short ? { unread: firstLine(short) } : { rows: read.rows };
};

const touching = (walk) => (walk.events ?? []).filter((one) => one.action === MOVED && (PERSON.has(one.from) || PERSON.has(one.to)));
const ending = (walk) => touching(walk).filter((one) => PERSON.has(one.from) && !PERSON.has(one.to));

/* One project's day: every wait whose end falls inside it, unless the day's walk, or the history of
   an issue a wait ended for that day, came back short. */
const dayOf = (project, walk, day, histories, keyOf) => {
  if (walk.unread) return { unread: `${project.name}: ${walk.unread}` };
  for (const one of ending(walk)) {
    const held = histories.get(one.issueId);
    if (held.unread) return { unread: `${project.name}: ${keyOf(one.issueId)}'s history: ${held.unread}` };
  }
  const { from, to } = boundsOf(day);
  const answered = [...histories].flatMap(([documentId, held]) => (held.spans ?? [])
    .filter((span) => span.end !== null && span.end >= from && span.end < to)
    .map((span) => ({ project: project.name, issueId: keyOf(documentId), minutes: tenth((span.end - span.start) / MINUTE) })));
  return { answered };
};

/* The waits of one project open at the day's end: begun before it, and ended at or after it or not at
   all. Each was found by the walk from the day's end to now or by the list of where issues stand,
   whose reason already names the project. */
const openOf = (project, after, listed, histories, keyOf, end) => {
  if (listed.unread) return { unread: listed.unread };
  const unread = after.unread
    ?? [...histories].map(([documentId, held]) => held.unread && `${keyOf(documentId)}'s history: ${held.unread}`).find(Boolean);
  if (unread) return { unread: `${project.name}: ${unread}` };
  return { waits: [...histories].flatMap(([documentId, held]) => held.spans
    .filter((span) => span.start < end && (span.end === null || span.end >= end))
    .map((span) => ({ project: project.name, issueId: keyOf(documentId), since: new Date(span.start).toISOString(),
      minutes: Math.round((end - span.start) / MINUTE) }))) };
};

/* One project: the eight day walks, which the closes reader has already asked, one walk from the
   day's end to now, and the whole history of every issue either of them or the list finds waiting. */
const projectRead = async (project, day, reads) => {
  useProject({ slug: project.slug, from: "the daily page's owner wait" });
  const days = [...weekBefore(day), day];
  const end = boundsOf(day).to;
  const walks = await Promise.all([...days.map((one) => walkBack(reads.activity, boundsOf(one).from, boundsOf(one).to, reads.limit)),
    walkBack(reads.activity, end, Date.now() + AHEAD, reads.limit)]);
  const after = walks.pop();
  const listed = await listedOf(reads, project.name);
  const rows = new Map((listed.rows ?? []).map((row) => [row.documentId, row]));
  const waited = new Set([...walks, after].flatMap(touching).map((one) => one.issueId));
  for (const [documentId, row] of rows) if (PERSON.has(row.status)) waited.add(documentId);
  const histories = new Map(await Promise.all([...waited].map(async (documentId) =>
    [documentId, await historyOf(documentId, rows.get(documentId)?.status ?? null, reads)])));
  const keyOf = (documentId) => rows.get(documentId)?.issueId ?? documentId;
  return {
    days: Object.fromEntries(days.map((one, at) => [one, dayOf(project, walks[at], one, histories, keyOf)])),
    open: openOf(project, after, listed, histories, keyOf, end),
  };
};

const unreadProject = (project, days, why) => ({
  days: Object.fromEntries(days.map((one) => [one, { unread: `${project.name}: ${why}` }])),
  open: { unread: `${project.name}: ${why}` },
});

const safely = async (project, day, reads) => {
  const days = [...weekBefore(day), day];
  if (!project.slug) return unreadProject(project, days, "its record names no tracker project");
  try {
    return await refusing(() => projectRead(project, day, reads));
  } catch (error) {
    return unreadProject(project, days, firstLine(error.message));
  }
};

const joined = (parts, key) => {
  const unread = parts.map((one) => one.unread).filter(Boolean);
  return unread.length ? { unread: unread.join("; ") } : { [key]: parts.flatMap((one) => one[key]) };
};

/** Every registered project's waits, per day of the page's eight, with those still open when the
 *  page's day ended. One project unread leaves the day unread: a sum short of a project would read
 *  as less waiting. */
export const waitsRead = async (registered, day, { reads = TRACKER, held = endpointHeld } = {}) => {
  const days = [...weekBefore(day), day];
  const everywhere = (why) => ({ day, days: Object.fromEntries(days.map((one) => [one, { unread: why }])), open: { unread: why } });
  if (!registered.length) return everywhere("no project is registered on this device");
  if (!held()) return everywhere(NO_ENDPOINT);
  const read = [];
  for (const project of oncePerSlug(registered)) read.push(await safely(project, day, reads));
  return {
    day,
    days: Object.fromEntries(days.map((one) => [one, joined(read.map((got) => got.days[one]), "answered")])),
    open: joined(read.map((got) => got.open), "waits"),
  };
};

/** A day's figures: the minutes of the waits that ended on it and how many; beside them, on the day
 *  the page is for, the waits open at its end. `unread` where the day could not be read. */
export const waitsOn = (reading, day) => {
  const waits = reading.waits;
  const today = waits?.days?.[day];
  if (!today) return { unread: NO_READING };
  if (today.unread) return { unread: today.unread };
  return { minutes: tenth(today.answered.reduce((sum, one) => sum + one.minutes, 0)), ended: today.answered.length,
    open: day === waits.day ? waits.open : null };
};
