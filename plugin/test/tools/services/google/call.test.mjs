/* A typed call end to end against the fake: what reached it, what came back on stdout, and what every
   input the verb could not use was refused as. Every case here answers on the environment's token, the
   one route that needs no saved account; the accounts are service-account.test.mjs's and login.test.mjs's. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ENV_ACCESS, SENTINELS, filesUnder, google, googleHome, startFake } from "./fake.mjs";
import { tempRoom } from "../../../fixtures.mjs";

let fake = null;
let home = null;
let room = null;
const printed = [];

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-call-");
});

after(() => fake?.close());

const ran = async (...argv) => {
  fake.requests.length = 0;
  const answer = await google(home, argv, { env: { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS }, cwd: room });
  printed.push(answer.stdout, answer.stderr);
  return answer;
};

const decodedPaths = () => fake.requests.map((one) => decodeURIComponent(one.path));

test("a typed call sends one GET with its --params on the query and prints the answer as JSON", async () => {
  fake.answers["GET /drive/v3/files"] = () => [200, { files: [{ id: "f1", name: "one" }] }];
  const answer = await ran("drive", "files", "list", "--params", '{"pageSize":2}');
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.requests.length, 1);
  assert.equal(fake.requests[0].query.get("pageSize"), "2");
  assert.deepEqual(JSON.parse(answer.stdout), { files: [{ id: "f1", name: "one" }] });
});

test("positionals and --params fill the path, and a reserved parameter keeps its slashes", async () => {
  fake.answers["GET /v4/spreadsheets/S1/values/A1%3AB2"] = () => [200, { values: [] }];
  assert.equal((await ran("sheets", "spreadsheets", "values", "get", "S1", "A1:B2")).status, 0);
  assert.deepEqual(decodedPaths(), ["/v4/spreadsheets/S1/values/A1:B2"]);
  fake.answers["GET /v2/conferenceRecords/c1/participants"] = () => [200, { participants: [] }];
  const meet = await ran("meet", "conferenceRecords", "participants", "list", "--params", '{"parent":"conferenceRecords/c1"}');
  assert.equal(meet.status, 0, meet.stderr);
  assert.deepEqual(fake.requests.map((one) => one.path), ["/v2/conferenceRecords/c1/participants"]);
});

test("a Gmail call with no userId is sent for me, and a Calendar call with no calendarId for primary", async () => {
  fake.answers["GET /gmail/v1/users/me/messages"] = () => [200, { messages: [] }];
  fake.answers["GET /calendar/v3/calendars/primary/events"] = () => [200, { items: [] }];
  assert.equal((await ran("gmail", "users", "messages", "list")).status, 0);
  assert.deepEqual(decodedPaths(), ["/gmail/v1/users/me/messages"]);
  assert.equal((await ran("calendar", "events", "list")).status, 0);
  assert.deepEqual(decodedPaths(), ["/calendar/v3/calendars/primary/events"]);
});

test("too few positionals are refused with 3 naming how many the method takes and how many came", async () => {
  const answer = await ran("sheets", "spreadsheets", "values", "get", "S1");
  assert.equal(answer.status, 3);
  assert.match(answer.stderr, /sheets\.spreadsheets\.values\.get takes 2 positional\(s\), <spreadsheetId> <range>, and was given 1: give <range>/u);
  assert.equal(fake.requests.length, 0);
});

test("a parameter in --params fills its slot, and the positionals take the slots left in parameterOrder", async () => {
  fake.answers["GET /v4/spreadsheets/S1/values/A1%3AB2"] = () => [200, { values: [] }];
  const answer = await ran("sheets", "spreadsheets", "values", "get", "A1:B2", "--params", '{"spreadsheetId":"S1"}');
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(decodedPaths(), ["/v4/spreadsheets/S1/values/A1:B2"]);
  fake.answers["GET /gmail/v1/users/me/messages/M1"] = () => [200, { id: "M1" }];
  assert.equal((await ran("gmail", "users", "messages", "get", "--params", '{"id":"M1"}')).status, 0);
  assert.deepEqual(decodedPaths(), ["/gmail/v1/users/me/messages/M1"]);
});

test("an unknown --params key is refused with 3 naming the nearest, and nothing is sent", async () => {
  const answer = await ran("drive", "files", "list", "--params", '{"pageSiz":2}');
  assert.equal(answer.status, 3);
  assert.match(answer.stderr, /No --params key named pageSiz\. Did you mean: pageSize\?/u);
  assert.equal(fake.requests.length, 0);
});

test("an unknown flag and a positional past the path are each refused with 3 before a send", async () => {
  const flag = await ran("drive", "files", "list", "--page-size", "2");
  assert.equal(flag.status, 3);
  assert.match(flag.stderr, /No flag named --page-size/u);
  const extra = await ran("drive", "files", "get", "F1", "F2");
  assert.equal(extra.status, 3);
  assert.match(extra.stderr, /drive\.files\.get takes 1 positional\(s\), <fileId>, and was given 2; unexpected argument `F2`/u);
  assert.equal(fake.requests.length, 0);
});

test("--upload, --json and --output are refused on a method with no use for them", async () => {
  const file = join(room, "note.txt");
  writeFileSync(file, "hello");
  const refusals = [
    [["drive", "files", "list", "--upload", file], /drive\.files\.list takes no upload/u],
    [["drive", "files", "get", "F1", "--json", "{}"], /drive\.files\.get takes no request body/u],
    [["drive", "files", "list", "--output", join(room, "x")], /drive\.files\.list neither downloads nor exports/u],
  ];
  for (const [argv, said] of refusals) {
    const answer = await ran(...argv);
    assert.equal(answer.status, 3, argv.join(" "));
    assert.match(answer.stderr, said);
  }
  assert.equal(fake.requests.length, 0);
});

test("schema prints a method's HTTP method, path and parameters from the carried index", async () => {
  const shown = JSON.parse((await ran("schema", "drive.files.list")).stdout);
  assert.equal(shown.http, "GET");
  assert.equal(shown.path, "files");
  assert.equal(shown.parameters.pageSize.type, "integer");
  assert.equal(shown.served, true);
});

const pages = () => {
  fake.answers["GET /drive/v3/files"] = (seen) => {
    const at = Number(seen.query.get("pageToken") ?? 0);
    return [200, { files: [{ id: `f${at}` }], ...(at < 3 ? { nextPageToken: String(at + 1) } : {}) }];
  };
};

test("--page-all prints one JSON line a page and stops at --page-limit", async () => {
  pages();
  const answer = await ran("drive", "files", "list", "--page-all", "--page-limit", "2", "--page-delay", "0");
  assert.equal(answer.status, 0, answer.stderr);
  const lines = answer.stdout.trim().split("\n").map((one) => JSON.parse(one));
  assert.deepEqual(lines.map((one) => one.files[0].id), ["f0", "f1"]);
  assert.deepEqual(fake.requests.map((seen) => seen.query.get("pageToken")), [null, "1"], "the limit bounds the requests, not only the lines");
  const all = await ran("drive", "files", "list", "--page-all", "--page-delay", "0");
  assert.equal(all.stdout.trim().split("\n").length, 4, "it stops where nextPageToken is absent");
});

test("--page-delay waits at least that long between two page requests", async () => {
  pages();
  await ran("drive", "files", "list", "--page-all", "--page-limit", "2", "--page-delay", "300");
  const [first, second] = fake.requests;
  assert.ok(second.at - first.at >= 300, `the second page came ${second.at - first.at}ms after the first`);
});

test("--upload sends multipart/related: the --json metadata first, the file's bytes second", async () => {
  const file = join(room, "upload.txt");
  writeFileSync(file, "the bytes themselves");
  fake.answers["POST /upload/drive/v3/files"] = () => [200, { id: "new" }];
  const answer = await ran("drive", "files", "create", "--json", '{"name":"upload.txt"}', "--upload", file);
  assert.equal(answer.status, 0, answer.stderr);
  const [sent] = fake.requests;
  assert.equal(sent.query.get("uploadType"), "multipart");
  assert.match(sent.headers["content-type"], /^multipart\/related; boundary=/u);
  const body = sent.body.toString("utf8");
  assert.ok(body.indexOf('{"name":"upload.txt"}') < body.indexOf("the bytes themselves"));
});

test("--output writes a download's bytes, fetched with alt=media, and prints the path and count", async () => {
  fake.answers["GET /drive/v3/files/F1"] = (seen) => [200, seen.query.get("alt") === "media" ? "raw file bytes" : { id: "F1" }, "application/octet-stream"];
  const out = join(room, "downloaded.bin");
  const answer = await ran("drive", "files", "get", "F1", "--output", out);
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(readFileSync(out, "utf8"), "raw file bytes");
  assert.deepEqual(JSON.parse(answer.stdout), { output: out, bytes: 14, mimeType: "application/octet-stream" });
});

test("--dry-run prints the request with the credential masked and sends nothing; the real send carries it whole", async () => {
  const preview = await ran("drive", "files", "create", "--json", '{"name":"x"}', "--dry-run");
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /^POST http:\/\/127\.0\.0\.1:\d+\/drive\/v3\/files$/mu);
  assert.match(preview.stdout, new RegExp(`^Authorization: Bearer set \\(${ENV_ACCESS.length} chars\\)$`, "mu"));
  assert.match(preview.stdout, /^Content-Type: application\/json$/mu);
  assert.match(preview.stdout, /"name": "x"/u);
  assert.equal(fake.requests.length, 0);
  fake.answers["POST /drive/v3/files"] = () => [200, { id: "x" }];
  await ran("drive", "files", "create", "--json", '{"name":"x"}');
  assert.equal(fake.requests[0].headers.authorization, `Bearer ${ENV_ACCESS}`);
});

test("a 401 or 403 exits 2 naming what clears it, and any other HTTP error exits 1 with the API's message and a next step", async () => {
  fake.answers["GET /drive/v3/about"] = () => [401, { error: { message: `Invalid Credentials ${ENV_ACCESS}` } }];
  const auth = await ran("drive", "about", "get", "--params", '{"fields":"user"}');
  assert.equal(auth.status, 2);
  assert.match(auth.stderr, /a fresh token in FORGE_GOOGLE_ACCESS_TOKEN/u);
  fake.answers["GET /drive/v3/about"] = () => [403, { error: { message: `Request had insufficient authentication scopes ${ENV_ACCESS}` } }];
  const scoped = await ran("drive", "about", "get", "--params", '{"fields":"user"}');
  assert.equal(scoped.status, 2);
  assert.match(scoped.stderr, /a fresh token in FORGE_GOOGLE_ACCESS_TOKEN/u);
  fake.answers["GET /drive/v3/files/F9"] = () => [404, { error: { message: "File not found: F9." } }];
  const missing = await ran("drive", "files", "get", "F9");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /answered 404: File not found: F9\.\n {2}check the id/u);
});

test("an --output whose directory does not exist exits 5, naming the path and what to do", async () => {
  fake.answers["GET /drive/v3/files/F1"] = () => [200, "bytes", "application/octet-stream"];
  const out = join(room, "no-such-dir", "file.bin");
  const answer = await ran("drive", "files", "get", "F1", "--output", out);
  assert.equal(answer.status, 5);
  assert.ok(answer.stderr.includes(`could not write ${out}`));
  assert.match(answer.stderr, /create its directory, or choose a writable one/u);
  assert.equal(existsSync(out), false);
});

test("nothing any case above printed carries a credential, and the home holds only the configuration", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `a credential reached a stream: ${secret.slice(0, 12)}…`);
  assert.deepEqual(filesUnder(home), ["forge/config.json"]);
});
