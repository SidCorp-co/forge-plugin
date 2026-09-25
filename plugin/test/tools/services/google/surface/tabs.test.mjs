/* `+addtab` and `+copytab` against the fake: the one request each sends, sent without `--yes` because
   neither takes anything away, and the inputs each refuses before a send. */
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

const bodyOf = (seen) => JSON.parse(seen.body.toString("utf8"));

test("+addtab sends one batchUpdate carrying one addSheet with the title and the grid", async () => {
  fake.answers["POST /v4/spreadsheets/S1:batchUpdate"] = () => [200, { replies: [{ addSheet: { properties: { sheetId: 9 } } }] }];
  const answer = await ran("+addtab", "S1", "Tab two", "--rows", "50", "--cols", "8");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.requests.length, 1);
  assert.deepEqual(bodyOf(fake.requests[0]),
    { requests: [{ addSheet: { properties: { title: "Tab two", gridProperties: { rowCount: 50, columnCount: 8 } } } }] });
  assert.equal(JSON.parse(answer.stdout).replies[0].addSheet.properties.sheetId, 9);
});

test("+addtab without a grid leaves the size to Sheets", async () => {
  fake.answers["POST /v4/spreadsheets/S1:batchUpdate"] = () => [200, {}];
  assert.equal((await ran("+addtab", "S1", "Plain")).status, 0);
  assert.deepEqual(bodyOf(fake.requests[0]), { requests: [{ addSheet: { properties: { title: "Plain" } } }] });
});

test("+copytab sends one copyTo naming the destination spreadsheet", async () => {
  fake.answers["POST /v4/spreadsheets/S1/sheets/7:copyTo"] = () => [200, { sheetId: 11, title: "Copy of Tab" }];
  const answer = await ran("+copytab", "S1", "7", "--to", "S2");
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(fake.requests.length, 1);
  assert.deepEqual(bodyOf(fake.requests[0]), { destinationSpreadsheetId: "S2" });
});

test("each refuses with 3 what it cannot use, before a send", async () => {
  const refusals = [
    [["+addtab", "S1"], /\+addtab takes a spreadsheet id and the new tab's title/u],
    [["+addtab", "S1", "T", "--rows", "0"], /--rows takes a whole number from 1, not `0`/u],
    [["+copytab", "S1", "7"], /\+copytab takes a spreadsheet id, a tab's sheetId and --to/u],
    [["+copytab", "S1", "Sheet1", "--to", "S2"], /`Sheet1` is not a sheetId/u],
  ];
  for (const [argv, said] of refusals) {
    const answer = await ran(...argv);
    assert.equal(answer.status, 3, argv.join(" "));
    assert.match(answer.stderr, said);
  }
  assert.deepEqual(fake.requests, []);
});
