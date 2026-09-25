/* Which Google methods this verb serves, resolved against the indexes carried beside it. The index
   holds every method of each document; SERVED is the subset a caller may type, so adding one is a line
   here and never a design. A served id the carried index no longer holds is refused by that name
   rather than vanishing. docs/cli/google.md. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { didYouMean } from "../../../suggest.mjs";
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

export const SERVED = [
  "drive.files.list", "drive.files.get", "drive.files.create", "drive.files.update", "drive.files.copy",
  "drive.files.export", "drive.permissions.list", "drive.permissions.create", "drive.permissions.delete",
  "drive.about.get",
  "sheets.spreadsheets.get", "sheets.spreadsheets.values.get", "sheets.spreadsheets.values.update",
  "sheets.spreadsheets.values.append",
  "docs.documents.get", "docs.documents.create", "docs.documents.batchUpdate",
  "gmail.users.messages.list", "gmail.users.messages.get", "gmail.users.messages.send",
  "gmail.users.messages.modify", "gmail.users.messages.trash", "gmail.users.threads.list",
  "gmail.users.threads.get", "gmail.users.labels.list", "gmail.users.drafts.create", "gmail.users.drafts.send",
  "calendar.events.list", "calendar.events.get", "calendar.events.insert", "calendar.events.patch",
  "calendar.events.delete", "calendar.calendarList.list", "calendar.freebusy.query",
  "meet.spaces.create", "meet.spaces.get", "meet.conferenceRecords.list", "meet.conferenceRecords.get",
  "meet.conferenceRecords.participants.list", "meet.conferenceRecords.participants.get",
  "meet.conferenceRecords.recordings.list", "meet.conferenceRecords.recordings.get",
  "meet.conferenceRecords.transcripts.list", "meet.conferenceRecords.transcripts.get",
];

export const SERVED_SERVICES = [...new Set(SERVED.map((id) => id.split(".")[0]))];

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

const methodIds = (service) => Object.keys(carriedIndex(service)?.methods ?? {});

/** One method by id, served or not: the helpers read a method no caller may type. */
export const methodById = (id) => {
  const [service] = id.split(".");
  const index = carriedIndex(service);
  const entry = index?.methods?.[id];
  if (!entry) {
    refuse(DISCOVERY, `google: \`${id}\` is served, and the carried ${service} document no longer holds it.\n`
      + "  a refresh dropped it: `forge google discovery` says what moved, and SERVED in surface.mjs is where it leaves");
  }
  return { id, service, index, entry };
};

const refuseUnserved = (id) => {
  const [service] = id.split(".");
  const served = SERVED.filter((one) => one.startsWith(`${service}.`));
  refuse(DISCOVERY, `google: \`${id}\` is in the carried document and is not served.\n  `
    + (served.length ? `what ${service} serves: ${served.join(", ")}` : `${service} is carried and serves nothing yet; a method is served by adding its id to SERVED in surface.mjs`));
};

/** The id a typed method or a `schema` argument names, refused unless it is served. */
const servedMethod = (id) => {
  if (!SERVED.includes(id)) {
    if (methodIds(id.split(".")[0]).includes(id)) refuseUnserved(id);
    refuse(DISCOVERY, `google: ${didYouMean("method", id, SERVED)}`);
  }
  return methodById(id);
};

/* The longest run of words that names a method, so `values get` inside `spreadsheets` is one id. */
export const resolveTyped = ([service, ...words]) => {
  if (!Object.hasOwn(SERVICES, service ?? "")) {
    refuse(DISCOVERY, `google: ${didYouMean("service", service ?? "", Object.keys(SERVICES))}`);
  }
  const known = new Set([...methodIds(service), ...SERVED.filter((id) => id.startsWith(`${service}.`))]);
  for (let length = words.length; length > 0; length -= 1) {
    const id = [service, ...words.slice(0, length)].join(".");
    if (known.has(id)) return { ...servedMethod(id), rest: words.slice(length) };
  }
  const typed = [service, ...words.filter((one) => !one.startsWith("-"))].join(".");
  return refuse(DISCOVERY, `google: ${didYouMean("method", typed, SERVED.filter((id) => id.startsWith(`${service}.`)))}`);
};
