/* The served surface against the carried indexes: every method the issue names resolves from the words
   a caller types, the scopes asked for cover every one of them, and a served id the carried index lost
   is refused by name rather than gone. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { SCOPES, SERVED, carriedIndex, resolveTyped } from "../../../../src/tools/services/google/surface.mjs";

const SURFACE = new URL("../../../../src/tools/services/google/surface.mjs", import.meta.url).href;

const EXPECTED = {
  drive: ["files.list", "files.get", "files.create", "files.update", "files.copy", "files.export",
    "permissions.list", "permissions.create", "permissions.delete", "about.get"],
  sheets: ["spreadsheets.get", "spreadsheets.values.get", "spreadsheets.values.update", "spreadsheets.values.append"],
  docs: ["documents.get", "documents.create", "documents.batchUpdate"],
  gmail: ["users.messages.list", "users.messages.get", "users.messages.send", "users.messages.modify", "users.messages.trash",
    "users.threads.list", "users.threads.get", "users.labels.list", "users.drafts.create", "users.drafts.send"],
  calendar: ["events.list", "events.get", "events.insert", "events.patch", "events.delete", "calendarList.list", "freebusy.query"],
  meet: ["spaces.create", "spaces.get", "conferenceRecords.list", "conferenceRecords.get",
    "conferenceRecords.participants.list", "conferenceRecords.participants.get",
    "conferenceRecords.recordings.list", "conferenceRecords.recordings.get",
    "conferenceRecords.transcripts.list", "conferenceRecords.transcripts.get"],
};

for (const [service, methods] of Object.entries(EXPECTED)) {
  test(`every ${service} method of the served set resolves from the words a caller types`, () => {
    for (const method of methods) {
      const id = `${service}.${method}`;
      const found = resolveTyped([service, ...method.split("."), "--dry-run"]);
      assert.equal(found.id, id);
      assert.deepEqual(found.rest, ["--dry-run"]);
      assert.ok(SERVED.includes(id));
    }
  });
}

test("the served set is exactly the issue's, nothing beside it", () => {
  const named = Object.entries(EXPECTED).flatMap(([service, methods]) => methods.map((one) => `${service}.${one}`));
  assert.deepEqual([...SERVED].sort(), named.sort());
});

test("a service account's scope for each service is one every served method of it accepts", () => {
  for (const id of SERVED) {
    const [service] = id.split(".");
    const accepted = carriedIndex(service).methods[id].scopes;
    assert.ok(SCOPES[service].full.some((one) => accepted.includes(one)), `${id} accepts none of ${SCOPES[service].full}`);
  }
});

test("a served method the carried index no longer holds is refused by name with 4", () => {
  const script = `import { SERVED, resolveTyped } from ${JSON.stringify(SURFACE)};
SERVED.push("drive.files.vanished");
resolveTyped(["drive", "files", "vanished"]);`;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(run.status, 4, run.stderr);
  assert.match(run.stderr, /`drive\.files\.vanished` is served, and the carried drive document no longer holds it/u);
});
