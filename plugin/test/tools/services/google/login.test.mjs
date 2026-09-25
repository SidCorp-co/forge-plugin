/* A Google-account login driven the way a browser drives it: the verb prints the consent address,
   this case plays the browser by calling the loopback redirect with the code, and the fake's token
   endpoint accepts the code only with the verifier whose challenge the address carried. A later
   invocation then answers on the saved refresh token alone. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../fixtures.mjs";
import { ACCESS, FORGE_BIN, LOGIN_EMAIL, SENTINELS, clientFile, filesUnder, google, googleEnv, googleHome, startFake } from "./fake.mjs";

let fake = null;
let home = null;
let room = null;
let asked = null;
const printed = [];

before(async () => {
  fake = await startFake();
  home = googleHome(fake);
  room = tempRoom("google-login-");
});

after(() => fake?.close());

/* Plays the browser: reads the address off stderr, hands the fake its challenge, follows the redirect. */
const signIn = (argv) => new Promise((done) => {
  const child = spawn(FORGE_BIN, ["google", "auth", "login", ...argv], { env: googleEnv(home), cwd: room });
  let stdout = "";
  let stderr = "";
  let followed = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", async (chunk) => {
    stderr += chunk;
    const found = stderr.match(/^ {2}(http:\/\/127\.0\.0\.1:\d+\/auth\?\S+)$/mu);
    if (!found || followed) return;
    followed = true;
    asked = new URL(found[1]);
    fake.challenge = asked.searchParams.get("code_challenge");
    const back = new URL(asked.searchParams.get("redirect_uri"));
    back.searchParams.set("code", "fake-code");
    back.searchParams.set("state", asked.searchParams.get("state"));
    await fetch(back);
  });
  child.on("close", (status) => {
    printed.push(stdout, stderr);
    done({ status, stdout, stderr });
  });
});

test("login completes on the loopback redirect with a PKCE challenge, against the client file's endpoints", async () => {
  const answer = await signIn(["--client-secret", clientFile(fake, room), "-s", "gmail,calendar", "--write", "gmail", "--wait", "60"]);
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(asked.origin + asked.pathname, `${fake.origin}/auth`);
  assert.equal(asked.searchParams.get("code_challenge_method"), "S256");
  assert.match(asked.searchParams.get("redirect_uri"), /^http:\/\/127\.0\.0\.1:\d+$/u);
  assert.equal(fake.sent("POST", "/token").length, 1);
});

test("the login saves its refresh token beside the keys at 0600 and records the account's address", () => {
  const saved = join(home, "forge", "google", "owner.json");
  assert.equal(statSync(saved).mode & 0o777, 0o600);
  const record = JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8")).google.accounts.owner;
  assert.equal(record.kind, "login");
  assert.equal(record.address, LOGIN_EMAIL);
});

test("a login asks each named service's read-only scope, and the write scope only where --write names it", () => {
  const scopes = asked.searchParams.get("scope").split(" ");
  assert.ok(scopes.includes("https://www.googleapis.com/auth/gmail.modify"));
  assert.ok(!scopes.includes("https://www.googleapis.com/auth/gmail.readonly"));
  assert.ok(scopes.includes("https://www.googleapis.com/auth/calendar.readonly"));
  assert.ok(!scopes.includes("https://www.googleapis.com/auth/calendar"));
  assert.ok(!scopes.some((one) => one.includes("drive")));
});

test("a later invocation exchanges the saved refresh token and bears the access token it returns", async () => {
  fake.requests.length = 0;
  fake.answers["GET /gmail/v1/users/me/labels"] = () => [200, { labels: [] }];
  const answer = await google(home, ["gmail", "users", "labels", "list"], { cwd: room });
  printed.push(answer.stdout, answer.stderr);
  assert.equal(answer.status, 0, answer.stderr);
  const [exchange] = fake.sent("POST", "/token");
  assert.equal(new URLSearchParams(exchange.body.toString("utf8")).get("grant_type"), "refresh_token");
  assert.equal(fake.sent("GET", "/gmail/v1/users/me/labels")[0].headers.authorization, `Bearer ${ACCESS}`);
});

test("--as on a call through a login is refused with 3, saying a login is one person", async () => {
  const answer = await google(home, ["gmail", "users", "labels", "list", "--as", "someone@example.com"], { cwd: room });
  printed.push(answer.stdout, answer.stderr);
  assert.equal(answer.status, 3);
  assert.match(answer.stderr, /a login acts as the one person who signed in/u);
});

test("nothing printed carries the client secret, the refresh token or an access token", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `${secret.slice(0, 12)}… reached a stream`);
  assert.deepEqual(filesUnder(home).sort(), ["forge/config.json", "forge/google/owner.json"]);
});
