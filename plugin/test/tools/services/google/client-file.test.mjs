/* Which OAuth client file a login takes. Login listens on whichever loopback port is free, which only a
   Desktop app client (`installed`) accepts as a redirect, so a Web application client (`web`) and a file
   that is no client at all are refused before a server listens or an address is printed — against the
   local fake, so nothing here reaches Google. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import { CLIENT_ID, SENTINELS, clientFile, filesUnder, google, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let room = null;
const printed = [];

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-client-file-");
});

after(() => fake?.close());

const loggedIn = async (client) => {
  fake.requests.length = 0;
  const answer = await google(home, ["auth", "login", "--client-secret", client, "--wait", "1"], { cwd: room });
  printed.push(answer.stdout, answer.stderr);
  return answer;
};

test("a Web application client is refused with 3 before any consent address is printed or any request sent", async () => {
  const answer = await loggedIn(clientFile(fake, room, { types: ["web"], name: "web.json" }));
  assert.equal(answer.status, 3, answer.stderr);
  assert.doesNotMatch(answer.stderr, /Open this address|https?:\/\/\S+\/auth\?/u);
  assert.equal(fake.requests.length, 0);
});

test("the web refusal says login needs a Desktop app client, the route to make one, and the client id", async () => {
  const answer = await loggedIn(clientFile(fake, room, { types: ["web"], name: "web.json" }));
  assert.match(answer.stderr, /Login runs the installed-app loopback flow, which needs an OAuth client of type Desktop app\./u);
  assert.ok(answer.stderr.includes("APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app → Download JSON"),
    answer.stderr);
  assert.ok(answer.stderr.includes(CLIENT_ID), answer.stderr);
});

test("a file holding installed beside web is taken as the Desktop client and reaches the consent address", async () => {
  const answer = await loggedIn(clientFile(fake, room, { types: ["web", "installed"], name: "both.json" }));
  assert.match(answer.stderr, new RegExp(`^ {2}${fake.origin}/auth\\?\\S*client_id=${CLIENT_ID}`, "mu"));
  assert.equal(answer.status, 2, answer.stderr);
  assert.match(answer.stderr, /no redirect came back within 1s/u);
});

test("a file holding neither installed nor web is refused with 3 naming the top-level keys it holds", async () => {
  const answer = await loggedIn(clientFile(fake, room, { file: { type: "service_account", client_email: "x@y" }, name: "key.json" }));
  assert.equal(answer.status, 3, answer.stderr);
  assert.match(answer.stderr, /its top-level keys are `type`, `client_email`, where a Desktop app client's is `installed`/u);
  assert.match(answer.stderr, /forge google auth add <key\.json>/u);
  const empty = await loggedIn(clientFile(fake, room, { file: [], name: "empty.json" }));
  assert.equal(empty.status, 3, empty.stderr);
  assert.match(empty.stderr, /it holds no top-level key/u);
  assert.equal(fake.requests.length, 0);
});

test("nothing a refusal printed carries the client secret, and the home holds only the configuration", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `${secret.slice(0, 12)}… reached a stream`);
  assert.deepEqual(filesUnder(home), ["forge/config.json"]);
});
