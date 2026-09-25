/* A service account end to end: the key saved at 0600 and never printed, the JWT the fake verifies
   against the key's own public half, whose data it asks for under `--as`, the refusals that name what
   clears them, and the order in which a named account, the environment's token and the default answer. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempRoom } from "../../../fixtures.mjs";
import { ACCESS, DENIED, ENV_ACCESS, KEY_ID, KEY_LINE, SENTINELS, filesUnder, google, googleEnv, googleHome, keyFile, startFake } from "./fake.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;

let fake = null;
let home = null;
let room = null;
let key = null;
const printed = [];

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-sa-");
  key = keyFile(fake, room);
});

after(() => fake?.close());

const ran = async (argv, env = {}) => {
  fake.requests.length = 0;
  fake.jwts.length = 0;
  const answer = await google(home, argv, { env, cwd: room });
  printed.push(answer.stdout, answer.stderr);
  return answer;
};

const config = () => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8")).google;

test("auth add copies the key at 0600 and records its name, client email and masked key id", async () => {
  const answer = await ran(["auth", "add", key, "--account", "robot", "--as", "boss@example.com"]);
  assert.equal(answer.status, 0, answer.stderr);
  const saved = join(home, "forge", "google", "robot.json");
  assert.equal(statSync(saved).mode & 0o777, 0o600);
  assert.equal(JSON.parse(readFileSync(saved, "utf8")).private_key_id, KEY_ID);
  const record = config().accounts.robot;
  assert.equal(record.kind, "service");
  assert.equal(record.clientEmail, "robot@project.iam.gserviceaccount.com");
  assert.equal(record.keyId, `${KEY_ID.slice(0, 6)}…${KEY_ID.slice(-4)} (40 chars)`);
  assert.equal(config().default, "robot");
});

test("auth add prints neither the private key nor the whole key id", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `${secret.slice(0, 12)}… reached a stream`);
});

test("a call signs an RS256 JWT with the key, sends it to the key's token endpoint, and bears what comes back", async () => {
  fake.answers["GET /drive/v3/about"] = () => [200, { user: { emailAddress: "robot@project.iam.gserviceaccount.com" } }];
  const answer = await ran(["drive", "about", "get", "--params", '{"fields":"user"}']);
  assert.equal(answer.status, 0, answer.stderr);
  const [jwt] = fake.jwts;
  assert.ok(jwt, "the fake could not verify the JWT against the key's public half");
  assert.equal(jwt.header.alg, "RS256");
  assert.equal(jwt.claims.iss, "robot@project.iam.gserviceaccount.com");
  assert.equal(jwt.claims.aud, `${fake.origin}/token`);
  assert.equal(fake.sent("GET", "/drive/v3/about")[0].headers.authorization, `Bearer ${ACCESS}`);
});

test("the JWT asks the called service's scopes, and its subject is the default --as or the one given", async () => {
  fake.answers["GET /gmail/v1/users/me/labels"] = () => [200, { labels: [] }];
  await ran(["gmail", "users", "labels", "list"]);
  assert.equal(fake.jwts[0].claims.scope, "https://www.googleapis.com/auth/gmail.modify");
  assert.equal(fake.jwts[0].claims.sub, "boss@example.com");
  await ran(["gmail", "users", "labels", "list", "--as", "other@example.com"]);
  assert.equal(fake.jwts[0].claims.sub, "other@example.com");
});

test("a Drive call with no --as and no default runs as the account itself, with no subject", async () => {
  await ran(["auth", "set", "--account", "robot", "--as", ""]);
  fake.answers["GET /drive/v3/files"] = () => [200, { files: [] }];
  await ran(["drive", "files", "list"]);
  assert.equal(fake.jwts[0].claims.sub, undefined);
  assert.equal(fake.jwts[0].claims.scope, "https://www.googleapis.com/auth/drive");
});

test("a Gmail call through a service account with no --as anywhere is refused with 3, naming --as and auth set", async () => {
  const answer = await ran(["gmail", "users", "labels", "list"]);
  assert.equal(answer.status, 3);
  assert.match(answer.stderr, /name the user with --as user@domain/u);
  assert.match(answer.stderr, /forge google auth set --account robot --as user@domain/u);
  assert.deepEqual(fake.jwts, []);
});

test("auth set records a default --as and the services; a service left out is refused with 2 naming what adds it", async () => {
  const set = await ran(["auth", "set", "--account", "robot", "--as", "boss@example.com", "-s", "drive,gmail"]);
  assert.equal(set.status, 0, set.stderr);
  assert.equal(config().accounts.robot.as, "boss@example.com");
  assert.deepEqual(config().accounts.robot.services, ["drive", "gmail"]);
  const refused = await ran(["calendar", "events", "list"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /forge google auth set --account robot -s drive,gmail,calendar/u);
  await ran(["auth", "set", "--account", "robot", "-s", "drive,sheets,docs,gmail,calendar,meet"]);
});

test("unauthorized_client exits 2 naming the client id, the scopes and where delegation is granted", async () => {
  const answer = await ran(["gmail", "users", "labels", "list", "--as", DENIED]);
  assert.equal(answer.status, 2);
  assert.match(answer.stderr, /the key is good; the delegation is not granted/u);
  assert.match(answer.stderr, /client id 112233445566778899 with the scopes https:\/\/www\.googleapis\.com\/auth\/gmail\.modify/u);
  assert.match(answer.stderr, /Manage Domain Wide Delegation/u);
});

test("a second account saved does not move the default; --account picks it and an unknown name lists the saved", async () => {
  const other = keyFile(fake, tempRoom("google-sa-two-"), "helper@project.iam.gserviceaccount.com");
  await ran(["auth", "add", other, "--account", "helper"]);
  assert.equal(config().default, "robot");
  fake.answers["GET /drive/v3/files"] = () => [200, { files: [] }];
  await ran(["drive", "files", "list", "--account", "helper"]);
  assert.equal(fake.jwts[0].claims.iss, "helper@project.iam.gserviceaccount.com");
  const unknown = await ran(["drive", "files", "list", "--account", "nobody"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /no account is saved as `nobody`; saved: robot, helper/u);
});

test("the environment's token answers before the default, mints nothing, and status names what it shadowed", async () => {
  fake.answers["GET /drive/v3/files"] = () => [200, { files: [] }];
  await ran(["drive", "files", "list"], { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS });
  assert.equal(fake.sent("GET", "/drive/v3/files")[0].headers.authorization, `Bearer ${ENV_ACCESS}`);
  assert.deepEqual(fake.sent("POST", "/token"), []);
  const status = JSON.parse((await ran(["auth", "status"], { FORGE_GOOGLE_ACCESS_TOKEN: ENV_ACCESS })).stdout);
  assert.deepEqual(status.answering, { route: "env", variable: "FORGE_GOOGLE_ACCESS_TOKEN", shadowed: "robot" });
});

test("auth status names the account, its client email and key id, its default --as and its scopes", async () => {
  const status = JSON.parse((await ran(["auth", "status"])).stdout);
  assert.equal(status.answering.account, "robot");
  assert.equal(status.answering.clientEmail, "robot@project.iam.gserviceaccount.com");
  assert.match(status.answering.keyId, /^012345…4567/u);
  assert.equal(status.answering.as, "boss@example.com");
  assert.ok(status.answering.scopes.includes("https://www.googleapis.com/auth/calendar"));
});

test("forge doctor's google row names the account, its identity, its default --as, its scopes and the file", async () => {
  const answer = await ranAsync(FORGE, ["doctor"], googleEnv(home), room);
  printed.push(answer.stdout, answer.stderr);
  const row = answer.stdout.split("\n").find((one) => /\] google\s/u.test(one));
  assert.ok(row, answer.stdout);
  assert.match(row, /`robot`: service account robot@project\.iam\.gserviceaccount\.com key 012345…4567/u);
  assert.match(row, /--as boss@example\.com/u);
  assert.match(row, /scopes drive spreadsheets/u);
  assert.ok(row.includes(join(home, "forge", "config.json")));
});

test("with two accounts and none the default, a call naming none is refused with 2 listing both", async () => {
  const held = JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8"));
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify({ ...held, google: { ...held.google, default: null } }));
  const refused = await ran(["drive", "files", "list"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /2 accounts are saved and none is the default: robot, helper/u);
  assert.match(refused.stderr, /forge google auth set --account <name> --default/u);
});

test("removing an account drops its file and record", async () => {
  await ran(["auth", "remove", "--account", "helper"]);
  assert.deepEqual(Object.keys(config().accounts), ["robot"]);
  await ran(["auth", "add", keyFile(fake, tempRoom("google-sa-three-"), "helper@project.iam.gserviceaccount.com"), "--account", "helper"]);
});

test("nothing printed carries a credential, and the home holds only the configuration and the saved keys", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `${secret.slice(0, 12)}… reached a stream`);
  assert.deepEqual(filesUnder(home).sort(), ["forge/config.json", "forge/google/helper.json", "forge/google/robot.json"]);
});

test("a saved account that is not JSON exits 5 naming its file, and quotes none of what it holds", async () => {
  const damaged = googleHome(fake);
  await google(damaged, ["auth", "add", key, "--account", "robot"], { cwd: room });
  const saved = join(damaged, "forge", "google", "robot.json");
  writeFileSync(saved, `{"private_key": "${KEY_LINE}", "private_key_id": "${KEY_ID}",`);
  const answer = await google(damaged, ["drive", "files", "list"], { cwd: room });
  assert.equal(answer.status, 5, answer.stderr);
  assert.ok(answer.stderr.includes(`${saved} is not valid JSON`), answer.stderr);
  assert.match(answer.stderr, /forge google auth remove --account robot/u);
  for (const secret of SENTINELS) assert.ok(!`${answer.stdout}${answer.stderr}`.includes(secret), `${secret.slice(0, 12)}… reached a stream`);
});

test("a saved account this user cannot read exits 5 naming its file and what clears it", { skip: process.getuid?.() === 0 }, async () => {
  const locked = googleHome(fake);
  await google(locked, ["auth", "add", key, "--account", "robot"], { cwd: room });
  const saved = join(locked, "forge", "google", "robot.json");
  chmodSync(saved, 0o000);
  const answer = await google(locked, ["drive", "files", "list"], { cwd: room });
  chmodSync(saved, 0o600);
  assert.equal(answer.status, 5, answer.stderr);
  assert.ok(answer.stderr.includes(`${saved} could not be read (EACCES)`), answer.stderr);
  assert.match(answer.stderr, /make it readable by this user/u);
});
