/* What a 401 or 403 prints under it, judged on the reason Google's body states: each case answers one
   of the bodies below, recorded off Google's own answers and served by the fake, on a login saved into
   the fixture home as `auth login` saves one. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CLIENT_ID, CLIENT_SECRET, REFRESH, SENTINELS, google, googleHome, startFake } from "./fake.mjs";

const AUTH = "https://www.googleapis.com/auth/";
const PROJECT = "123456789012";
const ENABLE = `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=${PROJECT}`;

const SERVICE_DISABLED = { error: { code: 403, status: "PERMISSION_DENIED",
  message: `Google Calendar API has not been used in project ${PROJECT} before or it is disabled. Enable it by visiting ${ENABLE} then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.`,
  errors: [{ message: "Google Calendar API has not been used in project before or it is disabled.", domain: "usageLimits", reason: "accessNotConfigured", extendedHelp: "https://console.developers.google.com" }],
  details: [
    { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SERVICE_DISABLED", domain: "googleapis.com",
      metadata: { consumer: `projects/${PROJECT}`, service: "calendar-json.googleapis.com", serviceTitle: "Google Calendar API", containerInfo: PROJECT, activationUrl: ENABLE } },
    { "@type": "type.googleapis.com/google.rpc.Help", links: [{ description: "Google developers console API activation", url: ENABLE }] },
  ] } };

const GMAIL_ENABLE = `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${PROJECT}`;
const ACCESS_NOT_CONFIGURED = { error: { code: 403,
  message: `Gmail API has not been used in project ${PROJECT} before or it is disabled. Enable it by visiting ${GMAIL_ENABLE} then retry.`,
  errors: [{ domain: "usageLimits", reason: "accessNotConfigured", message: "Access Not Configured." }] } };

const SCOPE_SHORT = { error: { code: 403, status: "PERMISSION_DENIED", message: "Request had insufficient authentication scopes.",
  errors: [{ message: "Insufficient Permission", domain: "global", reason: "insufficientPermissions" }],
  details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT", domain: "googleapis.com",
    metadata: { service: "drive.googleapis.com" } }] } };

const NOT_SHARED = { error: { code: 403, message: "The user does not have sufficient permissions for file F1.",
  errors: [{ message: "The user does not have sufficient permissions for file F1.", domain: "global", reason: "insufficientFilePermissions" }] } };

const INVALID = { error: { code: 401, status: "UNAUTHENTICATED", message: "Request had invalid authentication credentials.",
  errors: [{ message: "Invalid Credentials", domain: "global", reason: "authError", location: "Authorization" }] } };

/* `reader` asked the read scope of drive and calendar; `writer` asked gmail with --write. */
const LOGINS = {
  reader: { services: ["drive", "calendar"], write: [], scopes: ["openid", "email", `${AUTH}drive.readonly`, `${AUTH}calendar.readonly`] },
  writer: { services: ["gmail"], write: ["gmail"], scopes: ["openid", "email", `${AUTH}gmail.modify`] },
};

let fake = null;
let home = null;
const printed = [];

before(async () => {
  fake = await startFake();
  const accounts = Object.fromEntries(Object.entries(LOGINS).map(([name, grant]) => [name,
    { kind: "login", address: `${name}@example.com`, clientId: CLIENT_ID, ...grant }]));
  home = googleHome(fake, { accounts, default: "reader" });
  mkdirSync(join(home, "forge", "google"));
  for (const name of Object.keys(LOGINS)) {
    writeFileSync(join(home, "forge", "google", `${name}.json`), JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      token_uri: `${fake.origin}/token`, refresh_token: REFRESH }), { mode: 0o600 });
  }
});

after(() => fake?.close());

const answered = async (route, status, body, ...argv) => {
  fake.answers[route] = () => [status, body];
  const answer = await google(home, argv);
  printed.push(answer.stdout, answer.stderr);
  return answer;
};

const SIGN_IN = /forge google auth login/u;

test("a SERVICE_DISABLED 403 exits 2 naming the API, the project and the enable page off Google's details, and no sign-in", async () => {
  const answer = await answered("GET /calendar/v3/calendars/primary/events", 403, SERVICE_DISABLED, "calendar", "events", "list");
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.includes(`\n  the Google Calendar API is not enabled in Cloud project ${PROJECT}: enable it at ${ENABLE}, wait a minute, retry`), answer.stderr);
  assert.doesNotMatch(answer.stderr, SIGN_IN);
});

test("an accessNotConfigured 403 with no details reads the API, the project and the page off Google's message", async () => {
  const answer = await answered("GET /gmail/v1/users/me/labels", 403, ACCESS_NOT_CONFIGURED, "gmail", "users", "labels", "list", "--account", "writer");
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.includes(`\n  the Gmail API is not enabled in Cloud project ${PROJECT}: enable it at ${GMAIL_ENABLE}, wait a minute, retry`), answer.stderr);
  assert.doesNotMatch(answer.stderr, SIGN_IN);
});

test("a scope-short 403 on a login that asked the read scope names the method's write scope and the --write sign-in", async () => {
  const answer = await answered("POST /drive/v3/files", 403, SCOPE_SHORT, "drive", "files", "create", "--json", '{"name":"x"}');
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.includes(`\n  drive.files.create needs ${AUTH}drive: sign in again with the write scope: `
    + "forge google auth login --account reader --client-secret <client_secret.json> -s drive,calendar --write drive"), answer.stderr);
});

test("a scope-short 403 on a method past every scope forge google asks names the method's own scope and no --write", async () => {
  const answer = await answered("PUT /gmail/v1/users/me/settings/vacation", 403, SCOPE_SHORT,
    "gmail", "users", "settings", "updateVacation", "--json", '{"enableAutoReply":false}', "--account", "writer", "--yes");
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.includes(`\n  gmail.users.settings.updateVacation needs ${AUTH}gmail.settings.basic, which no scope \`forge google\` asks for grants`), answer.stderr);
  assert.doesNotMatch(answer.stderr, /--write/u);
});

test("a 403 for any other reason prints Google's message and auth status, and neither a sign-in nor a share", async () => {
  const answer = await answered("GET /drive/v3/files/F1", 403, NOT_SHARED, "drive", "files", "get", "F1");
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.includes("answered 403: The user does not have sufficient permissions for file F1.\n"
    + "  `forge google auth status` shows which account answered and what it was granted"), answer.stderr);
  assert.doesNotMatch(answer.stderr, SIGN_IN);
  assert.doesNotMatch(answer.stderr, /share/u);
});

test("a login's 401 prints the sign-in without --write", async () => {
  const answer = await answered("GET /drive/v3/about", 401, INVALID, "drive", "about", "get", "--params", '{"fields":"user"}');
  assert.equal(answer.status, 2, answer.stderr);
  assert.ok(answer.stderr.endsWith("\n  sign in again: forge google auth login --account reader --client-secret <client_secret.json> -s drive,calendar\n"), answer.stderr);
  assert.doesNotMatch(answer.stderr, /--write/u);
});

test("nothing any case above printed carries a credential", () => {
  const all = printed.join("\n");
  for (const secret of SENTINELS) assert.ok(!all.includes(secret), `a credential reached a stream: ${secret.slice(0, 12)}…`);
});
