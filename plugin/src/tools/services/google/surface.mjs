/* Which Google services this verb serves, and the indexes carried beside it. Every method of a served
   service's document answers, so a method Google adds is served the day its document is refreshed and
   judged by the consent table rather than by a list somebody keeps; serving another service is a
   line here and its scopes. docs/cli/google.md. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DISCOVERY, refuse } from "./exits.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CARRIED = join(HERE, "discovery");

const LISTED = (api, version) => `https://www.googleapis.com/discovery/v1/apis/${api}/${version}/rest`;
const OWN = (api, version) => `https://${api}.googleapis.com/$discovery/rest?version=${version}`;

/* Where each document is read. The shared directory answers for all but Meet, which only its own host
   serves; one directory also keeps every document's path distinct once `google.endpoint` replaces the host. */
export const SERVICES = {
  drive: { discovery: LISTED("drive", "v3") },
  sheets: { discovery: LISTED("sheets", "v4") },
  docs: { discovery: LISTED("docs", "v1") },
  gmail: { discovery: LISTED("gmail", "v1") },
  calendar: { discovery: LISTED("calendar", "v3") },
  meet: { discovery: OWN("meet", "v2") },
  chat: { discovery: LISTED("chat", "v1") },
  admin: { discovery: LISTED("admin", "directory_v1") },
};

/* Chat and Admin are carried so `schema` can read them, and answer no call: neither has its scopes here. */
export const SERVED_SERVICES = ["drive", "sheets", "docs", "gmail", "calendar", "meet"];

const AUTH = "https://www.googleapis.com/auth/";

/* `full` is what a service account asks, the admin granting a delegation by scope; `read` is a
   login's default, a person consenting to less unless `--write` names the service. */
export const SCOPES = {
  drive: { full: [`${AUTH}drive`], read: [`${AUTH}drive.readonly`] },
  sheets: { full: [`${AUTH}spreadsheets`], read: [`${AUTH}spreadsheets.readonly`] },
  docs: { full: [`${AUTH}documents`], read: [`${AUTH}documents.readonly`] },
  gmail: { full: [`${AUTH}gmail.modify`], read: [`${AUTH}gmail.readonly`] },
  calendar: { full: [`${AUTH}calendar`], read: [`${AUTH}calendar.readonly`] },
  meet: { full: [`${AUTH}meetings.space.created`, `${AUTH}meetings.space.readonly`],
    read: [`${AUTH}meetings.space.readonly`] },
};

/* The service answers for a user's own data under these values, so a call leaving them out means them. */
export const PATH_DEFAULTS = { gmail: { userId: "me" }, calendar: { calendarId: "primary" } };

/* The document-wide parameters a caller may pass. `access_token`, `key` and `oauth_token` would put a
   credential in a URL, and `alt` and `uploadType` are what `--output` and `--upload` set. */
export const COMMON = ["fields", "quotaUser", "prettyPrint"];

const loaded = new Map();

export const carriedIndex = (service, from = CARRIED) => {
  const key = `${from}/${service}`;
  if (!loaded.has(key)) {
    const at = join(from, `${service}.json`);
    loaded.set(key, existsSync(at) ? JSON.parse(readFileSync(at, "utf8")) : null);
  }
  return loaded.get(key);
};

/** One method by id off its carried index, served or not: the route the tree and every helper take to one. */
export const methodById = (id) => {
  const [service] = id.split(".");
  const index = carriedIndex(service);
  const entry = index?.methods?.[id];
  if (!entry) {
    refuse(DISCOVERY, `google: \`${id}\` is called by a helper, and the carried ${service} document no longer holds it.\n`
      + "  a refresh dropped it: `forge google discovery` says what moved, and the helper calling it changes with it");
  }
  return { id, service, index, entry };
};
