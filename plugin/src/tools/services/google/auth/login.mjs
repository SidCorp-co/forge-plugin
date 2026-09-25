/* `forge google auth`: save a service account's key, sign in as a Google account, change what a saved
   account defaults to, forget one, and say which answers. Nothing here prints a secret; a login's
   consent page is Google's, reached through a loopback redirect with a PKCE challenge, so the code it
   hands back is useless to anyone who did not start this process. docs/cli/google.md. */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { didYouMean } from "../../../../suggest.mjs";
import { masked } from "../../masked.mjs";
import { SCOPES, SERVED_SERVICES } from "../surface.mjs";
import { AUTH, VALIDATION, holdSecret, note, refuse, say } from "../exits.mjs";
import { endpoint, jsonOf, reach } from "../wire.mjs";
import { parseFlags } from "../request.mjs";
import {
  LOGIN, SERVICE, checkedName, knownAccount, removeAccount, saveAccount, updateAccount,
} from "./accounts.mjs";
import { defaultAccount, savedAccounts } from "./configured.mjs";
import { openAddress } from "./browser.mjs";
import { accountsListed, answering } from "./status.mjs";

export const AUTH_USAGE = [
  "Usage: forge google auth <add|login|set|remove|status> [args]",
  "",
  "  add <key.json> [--account N] [-s services] [--as user@domain] [--default]",
  "        save a service account's key, copied at 0600; --as is the user it acts as by default",
  "  login --client-secret F [--account N] [-s services] [--write services] [--default] [--wait S] [--no-browser]",
  "        sign in as a Google account through your own Desktop app OAuth client; read-only unless --write.",
  "        On a terminal the consent page opens in the browser as well as being printed; --no-browser only prints it",
  "  set --account N [--as user@domain] [-s services] [--default]",
  "        change a saved account's default user (--as '' clears it), its services, or make it the default",
  "  remove --account N   forget a saved account and its file",
  "  status [--account N] which account answers, its identity, default --as and scopes",
  "",
  `  services: ${SERVED_SERVICES.join(",")} (the default)`,
].join("\n");

const invalid = (message) => refuse(VALIDATION, `google auth: ${message}`);

const shortS = (argv) => argv.map((one) => (one === "-s" ? "--services" : one));

const servicesIn = (raw, flag = "-s") => {
  if (raw === undefined) return null;
  const named = raw.split(",").map((one) => one.trim()).filter(Boolean);
  for (const one of named) if (!SERVED_SERVICES.includes(one)) invalid(`${flag} ${didYouMean("service", one, SERVED_SERVICES)}`);
  return named;
};

const readJson = (path, what) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return invalid(`${path} is not a readable ${what}: ${error.message}.`);
  }
};

const KEY_FIELDS = ["client_email", "private_key", "private_key_id", "token_uri"];

const add = (argv) => {
  const { flags, positionals } = parseFlags(shortS(argv), { values: ["--account", "--services", "--as"], switches: ["--default"], verb: "google auth add" });
  if (positionals.length !== 1) invalid(`add takes one key file, the service account's JSON key.\n${AUTH_USAGE}`);
  const key = readJson(positionals[0], "service-account key");
  holdSecret(key.private_key);
  holdSecret(key.private_key_id);
  const missing = KEY_FIELDS.filter((field) => !key[field]);
  if (key.type !== "service_account" || missing.length) {
    invalid(`${positionals[0]} is not a service account's key${missing.length ? `: it has no ${missing.join(", ")}` : ""}.\n`
      + "  make one at console.cloud.google.com → IAM & Admin → Service Accounts → Keys → Add key → JSON");
  }
  const name = checkedName(flags.account ?? key.client_email.split("@")[0]);
  const record = { kind: SERVICE, clientEmail: key.client_email, keyId: masked(key.private_key_id, true), clientId: key.client_id ?? null,
    services: servicesIn(flags.services) ?? SERVED_SERVICES, as: flags.as ?? null };
  const isDefault = saveAccount(name, record, key, { makeDefault: Boolean(flags.default) });
  say(JSON.stringify({ account: name, ...record, default: isDefault }, null, 2));
};

const MAKE_DESKTOP = "  make one at console.cloud.google.com → APIs & Services → Credentials → Create credentials → OAuth client ID"
  + " → Desktop app → Download JSON";

/* A web client takes only the redirect addresses registered for it, port and all, and this login listens
   on whichever loopback port is free: Google would answer redirect_uri_mismatch after the round trip. */
const refuseWeb = (path, web) => {
  holdSecret(web.client_secret);
  invalid(`${path} holds a Web application client${web.client_id ? `, ${web.client_id}` : ""}. Login runs the installed-app`
    + " loopback flow, which needs an OAuth client of type Desktop app.\n" + MAKE_DESKTOP);
};

const refuseKeys = (path, file) => {
  const keys = file && typeof file === "object" && !Array.isArray(file) ? Object.keys(file) : [];
  const found = keys.length ? `its top-level ${keys.length === 1 ? "key is" : "keys are"} ${keys.map((one) => `\`${one}\``).join(", ")}` : "it holds no top-level key";
  const serviceKey = file?.type === "service_account" ? "\n  it is a service account's key, which is saved with: forge google auth add <key.json>" : "";
  invalid(`${path} is not an OAuth client file: ${found}, where a Desktop app client's is \`installed\`.${serviceKey}\n${MAKE_DESKTOP}`);
};

/* `installed` answers whatever else the file holds: it is the one client type the loopback flow can use. */
const clientOf = (path) => {
  const file = readJson(path, "OAuth client file");
  if (!file?.installed && file?.web) refuseWeb(path, file.web);
  if (!file?.installed) refuseKeys(path, file);
  const client = file.installed;
  if (!client.client_id || !client.client_secret || !client.auth_uri || !client.token_uri) {
    invalid(`${path} is not an OAuth client file: it needs installed.client_id, client_secret, auth_uri and token_uri.\n${MAKE_DESKTOP}`);
  }
  holdSecret(client.client_secret);
  return client;
};

const WAIT_SECONDS = 300;

/* The one request the browser sends back, answered and then the server closed: a second visitor gets nothing. */
const redirected = (server, state, seconds) => new Promise((done) => {
  const timer = setTimeout(() => {
    server.close();
    refuse(AUTH, `google auth login: no redirect came back within ${seconds}s. Run it again, or give --wait more seconds.`);
  }, seconds * 1000);
  server.on("request", (request, response) => {
    const query = new URL(request.url, "http://127.0.0.1").searchParams;
    if (!query.has("code") && !query.has("error")) {
      response.writeHead(404).end();
      return;
    }
    const ok = query.get("state") === state && query.has("code");
    response.writeHead(ok ? 200 : 400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(ok ? "Signed in. Return to the terminal.\n" : "Sign-in was not completed. Return to the terminal.\n");
    clearTimeout(timer);
    server.close();
    if (query.has("error")) refuse(AUTH, `google auth login: Google answered ${query.get("error")}; nothing was saved.`);
    if (!ok) refuse(AUTH, "google auth login: the redirect carried another state than this sign-in's; nothing was saved.");
    done(query.get("code"));
  });
});

const listening = (server) => new Promise((done) => server.listen(0, "127.0.0.1", () => done(server.address().port)));

const emailIn = (idToken) => {
  try {
    return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")).email ?? null;
  } catch {
    return null;
  }
};

const scopesAsked = (services, write) => ["openid", "email",
  ...services.flatMap((service) => (write.includes(service) ? SCOPES[service].full : SCOPES[service].read))];

const consented = async (client, scopes, { seconds, browser }) => {
  const server = createServer();
  const redirect = `http://127.0.0.1:${await listening(server)}`;
  const verifier = randomBytes(32).toString("base64url");
  const state = randomBytes(16).toString("hex");
  const url = new URL(client.auth_uri);
  Object.entries({ client_id: client.client_id, redirect_uri: redirect, response_type: "code", scope: scopes.join(" "),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    state, access_type: "offline", prompt: "consent" }).forEach(([key, value]) => url.searchParams.set(key, value));
  note(`Open this address in a browser signed in as the Google account to save:\n  ${url}\nWaiting ${seconds}s for the redirect to ${redirect}`);
  const opener = await openAddress(url.href, { wanted: browser });
  if (opener) note(`Opened it with ${opener}; if no page appeared, open the address above by hand.`);
  const code = await redirected(server, state, seconds);
  const answer = await reach("POST", client.token_uri, {
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: client.client_id,
      client_secret: client.client_secret, redirect_uri: redirect, code_verifier: verifier }).toString(),
  });
  const said = jsonOf(answer);
  holdSecret(said?.access_token);
  holdSecret(said?.refresh_token);
  if (!said?.refresh_token) {
    refuse(AUTH, `google auth login: ${client.token_uri} returned no refresh token (${answer.status} ${said?.error ?? ""}).\n`
      + "  remove this client's access at myaccount.google.com/permissions and sign in again");
  }
  return said;
};

const login = async (argv) => {
  const { flags, positionals } = parseFlags(shortS(argv), { values: ["--client-secret", "--account", "--services", "--write", "--wait"],
    switches: ["--default", "--no-browser"], verb: "google auth login" });
  if (positionals.length) invalid(`login takes no argument, not \`${positionals[0]}\`.`);
  if (!flags["client-secret"]) invalid("login needs --client-secret <client_secret.json>, the OAuth client you made for this.");
  const client = clientOf(flags["client-secret"]);
  const services = servicesIn(flags.services) ?? SERVED_SERVICES;
  const write = servicesIn(flags.write, "--write") ?? [];
  const beyond = write.filter((one) => !services.includes(one));
  if (beyond.length) invalid(`--write names ${beyond.join(", ")}, which -s does not.`);
  const seconds = flags.wait === undefined ? WAIT_SECONDS : Number(flags.wait);
  if (!Number.isInteger(seconds) || seconds < 1) invalid(`--wait takes whole seconds, not \`${flags.wait}\`.`);
  const scopes = scopesAsked(services, write);
  const said = await consented(client, scopes, { seconds, browser: !flags["no-browser"] });
  const address = emailIn(said.id_token);
  const name = checkedName(flags.account ?? address?.split("@")[0] ?? "login");
  const record = { kind: LOGIN, address, services, write, scopes, clientId: client.client_id };
  const isDefault = saveAccount(name, record, { client_id: client.client_id, client_secret: client.client_secret,
    token_uri: client.token_uri, refresh_token: said.refresh_token, scopes }, { makeDefault: Boolean(flags.default) });
  say(JSON.stringify({ account: name, ...record, default: isDefault }, null, 2));
};

const set = (argv) => {
  const { flags } = parseFlags(shortS(argv), { values: ["--account", "--as", "--services"], switches: ["--default"], verb: "google auth set" });
  if (!flags.account) invalid("set needs --account <name>.");
  const name = knownAccount(flags.account);
  const record = savedAccounts()[name];
  if (flags.as === undefined && flags.services === undefined && !flags.default) invalid("set changes --as, -s or --default; none was given.");
  if (record.kind === LOGIN && (flags.as !== undefined || flags.services !== undefined)) {
    invalid(`\`${name}\` is a login: it acts as one person, and its services are what that person consented to.\n`
      + `  sign in again for other services: forge google auth login --account ${name} --client-secret <client_secret.json> -s <services>`);
  }
  updateAccount(name, { ...(flags.as === undefined ? {} : { as: flags.as || null }),
    ...(flags.services === undefined ? {} : { services: servicesIn(flags.services) }) }, { makeDefault: Boolean(flags.default) });
  say(JSON.stringify({ account: name, ...savedAccounts()[name], default: defaultAccount() === name }, null, 2));
};

const remove = (argv) => {
  const { flags } = parseFlags(argv, { values: ["--account"], verb: "google auth remove" });
  if (!flags.account) invalid("remove needs --account <name>.");
  removeAccount(knownAccount(flags.account));
  say(JSON.stringify({ removed: flags.account, default: defaultAccount() }, null, 2));
};

const status = (argv) => {
  const { flags } = parseFlags(argv, { values: ["--account"], verb: "google auth status" });
  if (flags.account) knownAccount(flags.account);
  say(JSON.stringify({ answering: answering(flags.account ?? null), default: defaultAccount(),
    endpoint: endpoint(), accounts: accountsListed() }, null, 2));
};

const SUBS = { add, login, set, remove, status };

export const auth = async ([sub, ...rest]) => {
  if (!Object.hasOwn(SUBS, sub ?? "")) invalid(`${didYouMean("auth command", sub ?? "", Object.keys(SUBS))}\n${AUTH_USAGE}`);
  await SUBS[sub](rest);
};
