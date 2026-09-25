/* The Drive and Sheets helpers against the fake: which calls each one composes, and what it wrote. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { ENV_ACCESS, google, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let room = null;

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-helpers-drive-");
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  return google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS }, cwd: room });
};

test("+upload creates a Drive file named --name under --parent, carrying the file's bytes", async () => {
  writeFileSync(join(room, "report.csv"), "a,b\n1,2\n");
  fake.answers["POST /upload/drive/v3/files"] = () => [200, { id: "F-new", name: "Q3 report" }];
  const answer = await ran("+upload", "report.csv", "--parent", "P1", "--name", "Q3 report");
  assert.equal(answer.status, 0, answer.stderr);
  const body = fake.requests[0].body.toString("utf8");
  assert.ok(body.includes('{"name":"Q3 report","parents":["P1"]}'), body);
  assert.ok(body.includes("Content-Type: text/csv\r\n\r\na,b\n1,2\n"), body);
  assert.equal(JSON.parse(answer.stdout).id, "F-new");
});

test("+download writes a file that is not Google-native to the path --output names", async () => {
  fake.answers["GET /drive/v3/files/F1"] = (seen) => (seen.query.get("alt") === "media"
    ? [200, "%PDF-bytes", "application/pdf"]
    : [200, { id: "F1", name: "report.pdf", mimeType: "application/pdf" }]);
  const out = join(room, "got.pdf");
  const answer = await ran("+download", "F1", "--output", out);
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(readFileSync(out, "utf8"), "%PDF-bytes");
});

test("+download refuses an --output that already exists, before any request", async () => {
  const out = join(room, "taken.pdf");
  writeFileSync(out, "mine");
  const answer = await ran("+download", "F1", "--output", out);
  assert.equal(answer.status, 3);
  assert.ok(answer.stderr.includes(`${out} already exists`));
  assert.deepEqual(fake.requests, []);
  assert.equal(readFileSync(out, "utf8"), "mine");
});

test("+download --mime exports a Google-native file to that type", async () => {
  fake.answers["GET /drive/v3/files/D1"] = () => [200, { id: "D1", name: "Plan", mimeType: "application/vnd.google-apps.document" }];
  fake.answers["GET /drive/v3/files/D1/export"] = (seen) => [200, `exported as ${seen.query.get("mimeType")}`, "text/markdown"];
  const out = join(room, "plan.md");
  const answer = await ran("+download", "D1", "--mime", "text/markdown", "--output", out);
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(readFileSync(out, "utf8"), "exported as text/markdown");
});

test("+find lists the files whose name contains the text and are not trashed", async () => {
  fake.answers["GET /drive/v3/files"] = () => [200, { files: [{ id: "F1", name: "budget 2026" }] }];
  const answer = await ran("+find", "budget's");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.requests[0].query.get("q"), "name contains 'budget\\'s' and trashed = false");
  assert.equal(JSON.parse(answer.stdout).files[0].id, "F1");
});

test("+read prints the values of a range", async () => {
  fake.answers["GET /v4/spreadsheets/S1/values/Sheet1!A1%3AB2"] = () => [200, { range: "Sheet1!A1:B2", values: [["a", "b"]] }];
  const answer = await ran("+read", "S1", "Sheet1!A1:B2");
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(JSON.parse(answer.stdout).values, [["a", "b"]]);
});

test("+append appends the --values rows to the range", async () => {
  fake.answers["POST /v4/spreadsheets/S1/values/Sheet1!A1:append"] = () => [200, { updates: { updatedRows: 1 } }];
  const answer = await ran("+append", "S1", "Sheet1!A1", "--values", '[["a","b"]]');
  assert.equal(answer.status, 0, answer.stderr);
  const [sent] = fake.requests;
  assert.equal(sent.query.get("valueInputOption"), "USER_ENTERED");
  assert.deepEqual(JSON.parse(sent.body.toString("utf8")), { values: [["a", "b"]] });
});
