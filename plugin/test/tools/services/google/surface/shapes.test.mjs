/* Each shape the consent table refuses, end to end against the fake: refused with 3 naming the rule,
   and nothing reaching the fake; the same batch and invite methods sent unasked where the request only
   adds or names nobody; and a preview of a refused write sent nowhere. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { ENV_ACCESS, google, googleHome, startFake } from "../fake.mjs";

let fake = null;
let home = null;

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  return google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS } });
};

const OWED = [
  ["deletes", ["drive", "files", "delete", "F1"]],
  ["overwrites content", ["gmail", "users", "settings", "updateVacation", "--json", JSON.stringify({ enableAutoReply: true })]],
  ["overwrites content", ["sheets", "spreadsheets", "values", "batchUpdate", "S1", "--json", JSON.stringify({ data: [] })]],
  ["overwrites content", ["drive", "comments", "update", "F1", "C1", "--json", JSON.stringify({ content: "replacement" })]],
  ["overwrites content", ["drive", "replies", "update", "F1", "C1", "R1", "--json", JSON.stringify({ content: "replacement" })]],
  ["changes who has access", ["calendar", "acl", "insert", "--json", JSON.stringify({ role: "reader", scope: { type: "default" } })]],
  ["changes who has access", ["gmail", "users", "settings", "delegates", "create", "--json", JSON.stringify({ delegateEmail: "a@x.com" })]],
  ["changes who has access", ["meet", "spaces", "members", "create", "spaces/s1", "--json", JSON.stringify({ email: "a@x.com" })]],
  ["changes who has access", ["drive", "revisions", "update", "F1", "R1", "--json", JSON.stringify({ published: true })]],
  ["changes where mail goes", ["gmail", "users", "settings", "forwardingAddresses", "create", "--json", JSON.stringify({ forwardingEmail: "a@x.com" })]],
  ["changes where mail goes", ["gmail", "users", "settings", "filters", "create", "--json", JSON.stringify({ action: { forward: "a@x.com" } })]],
  ["changes where mail goes", ["gmail", "users", "settings", "updateAutoForwarding", "--json", JSON.stringify({ enabled: true })]],
  ["sends mail", ["gmail", "users", "messages", "send", "--json", JSON.stringify({ raw: "eA" })]],
  ["removes", ["gmail", "users", "messages", "batchDelete", "--json", JSON.stringify({ ids: ["m1"] })]],
  ["removes", ["sheets", "spreadsheets", "values", "clear", "S1", "A1:B2", "--json", "{}"]],
  ["removes", ["sheets", "spreadsheets", "values", "batchClear", "S1", "--json", JSON.stringify({ ranges: ["A1"] })]],
  ["removes", ["calendar", "calendars", "clear", "C1"]],
  ["removes", ["meet", "spaces", "endActiveConference", "spaces/s1", "--json", "{}"]],
  ["removes", ["gmail", "users", "settings", "cse", "keypairs", "obliterate", "K1", "--json", "{}"]],
  ["invites to an event", ["calendar", "events", "import", "--json", JSON.stringify({ iCalUID: "u1", attendees: [{ email: "a@x.com" }] })]],
  ["invites to an event", ["calendar", "events", "quickAdd", "Lunch with a@x.com tomorrow"]],
  ["removes or overwrites content in its batch", ["sheets", "spreadsheets", "batchUpdate", "S1", "--json", JSON.stringify({ requests: [{ addSheet: {} }, { deleteSheet: { sheetId: 1 } }] })]],
  ["removes or overwrites content in its batch", ["sheets", "spreadsheets", "batchUpdate", "S1", "--json", JSON.stringify({ requests: [{ updateCells: { range: {} } }] })]],
  ["removes or overwrites content in its batch", ["sheets", "spreadsheets", "batchUpdate", "S1", "--json",
    JSON.stringify({ requests: [{ updateCells: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2 }, fields: "userEnteredValue" } }] })]],
  ["removes or overwrites content in its batch", ["sheets", "spreadsheets", "batchUpdate", "S1", "--json", JSON.stringify({ requests: [{ repeatCell: { range: {}, fields: "*" } }] })]],
  ["removes or overwrites content in its batch", ["docs", "documents", "batchUpdate", "D1", "--json", JSON.stringify({ requests: [{ deleteContentRange: { range: {} } }] })]],
];

for (const [reason, argv] of OWED) {
  test(`${argv.slice(0, 5).filter((one) => !one.startsWith("{")).join(" ")} ${reason}, refused with 3 before any send`, async () => {
    const answer = await ran(...argv);
    assert.equal(answer.status, 3, answer.stderr);
    assert.ok(answer.stderr.includes(`${reason}, which --yes has to be given for`), answer.stderr);
    assert.deepEqual(fake.requests, []);
  });
}

test("a move of an event with an attendee reads the event at its own path and is refused", async () => {
  fake.answers["GET /calendar/v3/calendars/primary/events/E1"] = () => [200, { attendees: [{ email: "guest@x.com" }] }];
  const answer = await ran("calendar", "events", "move", "E1", "C2");
  assert.equal(answer.status, 3, answer.stderr);
  assert.match(answer.stderr, /invites to an event/u);
  assert.deepEqual(fake.requests.map((one) => `${one.method} ${one.path}`), ["GET /calendar/v3/calendars/primary/events/E1"]);
});

const SENT = [
  ["a sheets batchUpdate carrying only addSheet", "POST /v4/spreadsheets/S1:batchUpdate",
    ["sheets", "spreadsheets", "batchUpdate", "S1", "--json", JSON.stringify({ requests: [{ addSheet: { properties: { title: "t" } } }] })]],
  ["a docs batchUpdate carrying only insertText", "POST /v1/documents/D1:batchUpdate",
    ["docs", "documents", "batchUpdate", "D1", "--json", JSON.stringify({ requests: [{ insertText: { text: "x", location: { index: 1 } } }] })]],
  ["a quickAdd naming nobody", "POST /calendar/v3/calendars/primary/events/quickAdd", ["calendar", "events", "quickAdd", "Lunch tomorrow"]],
];

for (const [what, route, argv] of SENT) {
  test(`${what} is sent without --yes`, async () => {
    fake.answers[route] = () => [200, { ok: true }];
    const answer = await ran(...argv);
    assert.equal(answer.status, 0, answer.stderr);
    assert.deepEqual(fake.requests.map((one) => `${one.method} ${one.path}`), [route]);
  });
}

test("a move of an event nobody is invited to is sent without --yes", async () => {
  fake.answers["GET /calendar/v3/calendars/primary/events/E2"] = () => [200, {}];
  fake.answers["POST /calendar/v3/calendars/primary/events/E2/move"] = () => [200, { id: "E2" }];
  const answer = await ran("calendar", "events", "move", "E2", "C2");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.sent("POST", "/calendar/v3/calendars/primary/events/E2/move")[0].query.get("destination"), "C2");
});

test("--dry-run of a refused write prints it with the credential masked and sends nothing", async () => {
  const answer = await ran("sheets", "spreadsheets", "batchUpdate", "S1", "--json", JSON.stringify({ requests: [{ deleteSheet: { sheetId: 1 } }] }), "--dry-run");
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stdout, /^POST http:\/\/127\.0\.0\.1:\d+\/v4\/spreadsheets\/S1:batchUpdate$/mu);
  assert.match(answer.stdout, new RegExp(`^Authorization: Bearer set \\(${ENV_ACCESS.length} chars\\)$`, "mu"));
  assert.ok(!answer.stdout.includes(ENV_ACCESS));
  assert.deepEqual(fake.requests, []);
});
