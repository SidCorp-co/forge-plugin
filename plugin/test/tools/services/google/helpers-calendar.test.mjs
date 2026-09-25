/* The calendar helpers against the fake: the window an agenda asks for, in the zone Calendar's
   settings name rather than this machine's, the event a schedule inserts, and a bare Meet space. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import { ENV_ACCESS, google, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let room = null;

/* An offset with no daylight saving and a half hour in it, so neither the host's zone nor a whole-hour guess passes. */
const ZONE = "Asia/Kolkata";

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-helpers-calendar-");
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  fake.answers["GET /calendar/v3/users/me/settings/timezone"] = () => [200, { id: "timezone", value: ZONE }];
  return google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS, TZ: "America/Los_Angeles" }, cwd: room });
};

const EVENTS = "/calendar/v3/calendars/primary/events";

const windowAsked = () => {
  const [sent] = fake.sent("GET", EVENTS);
  return { from: sent.query.get("timeMin"), to: sent.query.get("timeMax"), zone: sent.query.get("timeZone") };
};

const dayOf = (stamp) => Date.parse(stamp.slice(0, 10));

test("+agenda --today asks from the start to the end of today in the account's own zone", async () => {
  fake.answers[`GET ${EVENTS}`] = () => [200, { items: [{ id: "e1", summary: "Stand-up", start: { dateTime: "x" }, end: { dateTime: "y" } }] }];
  const answer = await ran("+agenda", "--today");
  assert.equal(answer.status, 0, answer.stderr);
  const asked = windowAsked();
  assert.match(asked.from, /T00:00:00\+05:30$/u);
  assert.match(asked.to, /T00:00:00\+05:30$/u);
  assert.equal(dayOf(asked.to) - dayOf(asked.from), 24 * 3600 * 1000);
  assert.equal(asked.zone, ZONE);
  assert.equal(JSON.parse(answer.stdout).events[0].summary, "Stand-up");
});

test("+agenda --week asks for the seven days from the start of today", async () => {
  fake.answers[`GET ${EVENTS}`] = () => [200, { items: [] }];
  assert.equal((await ran("+agenda", "--week")).status, 0);
  const asked = windowAsked();
  assert.match(asked.from, /T00:00:00\+05:30$/u);
  assert.equal(dayOf(asked.to) - dayOf(asked.from), 7 * 24 * 3600 * 1000);
});

test("+agenda reads the zone through Calendar settings get, the method a caller types for it too", async () => {
  fake.answers[`GET ${EVENTS}`] = () => [200, { items: [] }];
  await ran("+agenda");
  assert.equal(fake.sent("GET", "/calendar/v3/users/me/settings/timezone").length, 1);
  fake.answers["GET /calendar/v3/users/me/settings/timezone"] = () => [200, { value: ZONE }];
  const typed = await ran("calendar", "settings", "get", "timezone");
  assert.equal(typed.status, 0, typed.stderr);
  assert.equal(JSON.parse(typed.stdout).value, ZONE);
});

test("+schedule inserts an event with that title, those times in the account's zone, and that attendee", async () => {
  fake.answers[`POST ${EVENTS}`] = () => [200, { id: "e9" }];
  const answer = await ran("+schedule", "--title", "Review", "--start", "2026-10-01T10:00", "--end", "2026-10-01T10:30",
    "--attendee", "dana@example.com", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  const body = JSON.parse(fake.sent("POST", EVENTS)[0].body.toString("utf8"));
  assert.equal(body.summary, "Review");
  assert.deepEqual(body.start, { dateTime: "2026-10-01T10:00", timeZone: ZONE });
  assert.deepEqual(body.attendees, [{ email: "dana@example.com" }]);
});

test("+schedule --meet asks Calendar to attach a Meet link", async () => {
  fake.answers[`POST ${EVENTS}`] = () => [200, { id: "e10", hangoutLink: "https://meet.google.com/abc-defg-hij" }];
  const answer = await ran("+schedule", "--title", "Sync", "--start", "2026-10-01T10:00+05:30", "--end", "2026-10-01T10:30+05:30", "--meet");
  assert.equal(answer.status, 0, answer.stderr);
  const [sent] = fake.sent("POST", EVENTS);
  assert.equal(sent.query.get("conferenceDataVersion"), "1");
  assert.equal(JSON.parse(sent.body.toString("utf8")).conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
});

test("+schedule --dry-run sends nothing, and prints the zone read and then the insert in a zone it names as the account's", async () => {
  const answer = await ran("+schedule", "--title", "Review", "--start", "2026-10-01T10:00", "--end", "2026-10-01T10:30", "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.requests.length, 0);
  const read = answer.stdout.search(/^GET http:\/\/127\.0\.0\.1:\d+\/calendar\/v3\/users\/me\/settings\/timezone$/mu);
  const insert = answer.stdout.search(new RegExp(`^POST http://127\\.0\\.0\\.1:\\d+${EVENTS}$`, "mu"));
  assert.ok(read >= 0 && insert > read, answer.stdout);
  assert.match(answer.stdout, /"timeZone": "<the account's calendar time zone>"/u);
});

test("+meet creates a Meet space and prints its link", async () => {
  fake.answers["POST /v2/spaces"] = () => [200, { name: "spaces/s1", meetingUri: "https://meet.google.com/xyz-abcd-efg", meetingCode: "xyz-abcd-efg" }];
  const answer = await ran("+meet");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(JSON.parse(answer.stdout).meetingUri, "https://meet.google.com/xyz-abcd-efg");
});
