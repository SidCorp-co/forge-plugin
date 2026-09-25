/* The writes that take `--yes`: each refused without it with exit 3 before anything reaches the fake,
   the refusal carrying the command that carries it out and the one that previews it, and the same call
   with `--yes` sent. A patch reaches invitees only if the event has some, so the fake answers that read. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ENV_ACCESS, google, googleHome, startFake } from "./fake.mjs";
import { tempRoom } from "../../../fixtures.mjs";

let fake = null;
let home = null;
let room = null;

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-consent-");
  writeFileSync(join(room, "new.txt"), "new content");
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  return google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS }, cwd: room });
};

const OWED = [
  ["deletes", ["drive", "permissions", "delete", "F1", "P1"]],
  ["trashes", ["gmail", "users", "messages", "trash", "M1"]],
  ["trashes", ["drive", "files", "update", "F1", "--json", '{"trashed":true}']],
  ["changes who has access", ["drive", "permissions", "create", "F1", "--json", '{"role":"reader","type":"anyone"}']],
  ["overwrites content", ["sheets", "spreadsheets", "values", "update", "S1", "A1", "--json", '{"values":[["x"]]}']],
  ["removes content in its batch", ["docs", "documents", "batchUpdate", "D1", "--json", '{"requests":[{"replaceAllText":{}}]}']],
  ["overwrites a file's content", ["drive", "files", "update", "F1", "--upload", "new.txt"]],
  ["sends mail", ["gmail", "users", "messages", "send", "--json", '{"raw":"eA"}']],
  ["sends mail", ["gmail", "users", "drafts", "send", "--json", '{"id":"d1"}']],
  ["invites to an event", ["calendar", "events", "insert", "--json", '{"summary":"s","attendees":[{"email":"a@x.com"}]}']],
];

for (const [reason, argv] of OWED) {
  test(`${argv.slice(0, 4).join(" ")} ${reason}, and is refused without --yes with 3 before any send`, async () => {
    const answer = await ran(...argv);
    assert.equal(answer.status, 3, answer.stderr);
    assert.ok(answer.stderr.includes(`${reason}, which --yes has to be given for`), answer.stderr);
    assert.deepEqual(fake.requests, []);
  });
}

test("the refusal carries the same command with --yes and with --dry-run", async () => {
  const answer = await ran("drive", "permissions", "delete", "F1", "P1");
  assert.match(answer.stderr, /^ {2}carry it out: forge google drive permissions delete F1 P1 --yes$/mu);
  assert.match(answer.stderr, /^ {2}see it first: forge google drive permissions delete F1 P1 --dry-run$/mu);
  const quoted = await ran("sheets", "spreadsheets", "values", "update", "S1", "A1", "--json", '{"values":[["x"]]}');
  assert.ok(quoted.stderr.includes(`--json '{"values":[["x"]]}' --yes`), quoted.stderr);
});

test("with --yes the refused call is sent", async () => {
  fake.answers["DELETE /drive/v3/files/F1/permissions/P1"] = () => [204, ""];
  const answer = await ran("drive", "permissions", "delete", "F1", "P1", "--yes");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.sent("DELETE", "/drive/v3/files/F1/permissions/P1").length, 1);
});

test("a patch of an event that has an attendee is refused without --yes, read first and never patched", async () => {
  fake.answers["GET /calendar/v3/calendars/primary/events/E1"] = () => [200, { attendees: [{ email: "guest@x.com" }] }];
  const answer = await ran("calendar", "events", "patch", "E1", "--json", '{"summary":"moved"}');
  assert.equal(answer.status, 3, answer.stderr);
  assert.match(answer.stderr, /invites to an event/u);
  assert.equal(fake.sent("PATCH", "/calendar/v3/calendars/primary/events/E1").length, 0);
});

test("a patch of an event with nobody invited goes without --yes", async () => {
  fake.answers["GET /calendar/v3/calendars/primary/events/E2"] = () => [200, {}];
  fake.answers["PATCH /calendar/v3/calendars/primary/events/E2"] = () => [200, { id: "E2" }];
  const answer = await ran("calendar", "events", "patch", "E2", "--json", '{"summary":"moved"}');
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.sent("PATCH", "/calendar/v3/calendars/primary/events/E2").length, 1);
});

test("an event insert with nobody invited, and a plain upload of a new file, owe no --yes", async () => {
  fake.answers["POST /calendar/v3/calendars/primary/events"] = () => [200, { id: "E3" }];
  assert.equal((await ran("calendar", "events", "insert", "--json", '{"summary":"alone"}')).status, 0);
  fake.answers["POST /upload/drive/v3/files"] = () => [200, { id: "F2" }];
  assert.equal((await ran("drive", "files", "create", "--upload", "new.txt")).status, 0);
});
