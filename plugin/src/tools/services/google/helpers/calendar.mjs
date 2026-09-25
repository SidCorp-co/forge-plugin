/* `+agenda`, `+schedule` and `+meet`: the day or week ahead in the account's own time zone, an event
   booked (with a Meet link when asked), and a bare Meet space. The time zone is the one Calendar's
   settings name for the account, never this machine's: a run in a container in UTC books the owner's
   ten o'clock at the owner's ten o'clock. */
import { randomBytes } from "node:crypto";

import { ACCOUNT_VALUES, PREVIEW_SWITCHES, invoke, optionsOf } from "../invocation.mjs";
import { VALIDATION, refuse, say } from "../exits.mjs";
import { parseFlags, requestFor } from "../request.mjs";
import { methodById } from "../surface.mjs";

const invalid = (message) => refuse(VALIDATION, `google ${message}`);

const printed = (answer) => {
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

/* A preview prints the settings read and names the zone it would have answered, since no zone guessed
   here would be the account's. */
const zoneOf = async (options) => {
  const method = methodById("calendar.settings.get");
  const setting = await invoke(method, requestFor(method, { positionals: ["timezone"] }), options);
  if (options.dryRun) return "<the account's calendar time zone>";
  return setting?.value ?? "UTC";
};

const MINUTE = 60000;

const partsIn = (zone, instant) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
  .formatToParts(instant).filter((one) => one.type !== "literal").map((one) => [one.type, Number(one.value)]));

/* The zone's offset at an instant, in minutes east of UTC: what the wall clock reads there, less UTC. */
const offsetAt = (zone, instant) => {
  const at = partsIn(zone, instant);
  return Math.round((Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second) - instant) / MINUTE);
};

const pad = (number) => String(Math.abs(number)).padStart(2, "0");

const stamped = (zone, instant) => {
  const offset = offsetAt(zone, instant);
  const at = partsIn(zone, instant);
  return `${at.year}-${pad(at.month)}-${pad(at.day)}T${pad(at.hour)}:${pad(at.minute)}:${pad(at.second)}`
    + `${offset < 0 ? "-" : "+"}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
};

/* Midnight of the zone's calendar day `days` after today's, found by guessing with today's offset and
   correcting once: a daylight-saving change between the two is what the correction absorbs. */
const midnight = (zone, days) => {
  const today = partsIn(zone, Date.now());
  const wall = Date.UTC(today.year, today.month - 1, today.day + days);
  const guess = wall - offsetAt(zone, wall) * MINUTE;
  return wall - offsetAt(zone, guess) * MINUTE;
};

const agenda = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ACCOUNT_VALUES, switches: ["--today", "--week"], verb: "google +agenda" });
  if (positionals.length) invalid(`+agenda takes no argument, not \`${positionals[0]}\`.`);
  if (flags.today && flags.week) invalid("+agenda takes --today or --week, not both.");
  const options = optionsOf(flags, ["+agenda", ...argv]);
  const zone = await zoneOf(options);
  const start = midnight(zone, 0);
  const end = midnight(zone, flags.week ? 7 : 1);
  const method = methodById("calendar.events.list");
  const params = { timeMin: stamped(zone, start), timeMax: stamped(zone, end), timeZone: zone, singleEvents: true, orderBy: "startTime" };
  const answer = await invoke(method, requestFor(method, { params }), options);
  say(JSON.stringify({ timeZone: zone, from: params.timeMin, to: params.timeMax, events: (answer?.items ?? []).map((one) => ({
    id: one.id, summary: one.summary ?? null, start: one.start, end: one.end, location: one.location ?? null,
    meet: one.hangoutLink ?? null, attendees: (one.attendees ?? []).map((two) => two.email) })) }, null, 2));
};

const OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/u;

/* A time with its own offset stands as written; one without is the account's wall clock, not this machine's. */
const whenOf = (text, zone) => (OFFSET.test(text) ? { dateTime: text } : { dateTime: text, timeZone: zone });

const schedule = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--title", "--start", "--end", "--attendee", "--description", ...ACCOUNT_VALUES],
    switches: ["--meet", ...PREVIEW_SWITCHES], verb: "google +schedule" });
  const missing = ["title", "start", "end"].filter((one) => flags[one] === undefined);
  if (positionals.length || missing.length) {
    invalid(`+schedule needs ${missing.map((one) => `--${one}`).join(", ") || "no argument"}: +schedule --title T --start 2026-10-01T10:00 --end 2026-10-01T10:30 [--attendee a@x,b@y] [--meet]`);
  }
  const options = optionsOf(flags, ["+schedule", ...argv]);
  const zone = OFFSET.test(flags.start) && OFFSET.test(flags.end) ? null : await zoneOf(options);
  const attendees = (flags.attendee ?? "").split(",").map((one) => one.trim()).filter(Boolean).map((email) => ({ email }));
  const body = { summary: flags.title, start: whenOf(flags.start, zone), end: whenOf(flags.end, zone),
    ...(flags.description ? { description: flags.description } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(flags.meet ? { conferenceData: { createRequest: { requestId: randomBytes(8).toString("hex"),
      conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}) };
  const method = methodById("calendar.events.insert");
  const params = flags.meet ? { conferenceDataVersion: 1 } : {};
  printed(await invoke(method, requestFor(method, { params, body }), options));
};

const meet = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ACCOUNT_VALUES, switches: PREVIEW_SWITCHES, verb: "google +meet" });
  if (positionals.length) invalid(`+meet takes no argument, not \`${positionals[0]}\`.`);
  const method = methodById("meet.spaces.create");
  const space = await invoke(method, requestFor(method, { body: {} }), optionsOf(flags, ["+meet", ...argv]));
  if (space !== null) say(JSON.stringify({ name: space.name, meetingUri: space.meetingUri, meetingCode: space.meetingCode }, null, 2));
};

export const CALENDAR_HELPERS = { "+agenda": agenda, "+schedule": schedule, "+meet": meet };
