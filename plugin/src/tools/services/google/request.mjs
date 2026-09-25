/* Every flag, positional and `--params` key a Google call is given is either consumed by the resolved
   method or refused here, before anything is sent: a key Google does not know would otherwise come
   back as a 400 naming nothing of ours. The consent a destructive write owes is decided here too. */
import { existsSync, statSync } from "node:fs";

import { didYouMean } from "../../../suggest.mjs";
import { COMMON, PATH_DEFAULTS } from "./surface.mjs";
import { VALIDATION, refuse } from "./exits.mjs";

export const CALL_VALUES = ["--params", "--json", "--upload", "--output", "--page-limit", "--page-delay", "--account", "--as"];
export const CALL_SWITCHES = ["--page-all", "--dry-run", "--yes"];

const invalid = (message) => refuse(VALIDATION, `google: ${message}`);

/** Flags off argv against the set a command declares; what is not a flag is a positional. */
export const parseFlags = (argv, { values = [], switches = [], verb = "google" }) => {
  const flags = {};
  const positionals = [];
  for (let at = 0; at < argv.length; at += 1) {
    const token = argv[at];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const known = [...values, ...switches];
    if (!known.includes(token)) invalid(`${verb}: ${didYouMean("flag", token, known)}`);
    const name = token.slice(2);
    if (Object.hasOwn(flags, name)) invalid(`${verb}: ${token} is given twice, and one call takes one.`);
    if (switches.includes(token)) {
      flags[name] = true;
      continue;
    }
    if (at + 1 >= argv.length) invalid(`${verb}: ${token} needs a value.`);
    flags[name] = argv[(at += 1)];
  }
  return { flags, positionals };
};

const parsedJson = (flag, raw, { object = true } = {}) => {
  let value = null;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    invalid(`--${flag} is not JSON: ${error.message}. Quote it whole: --${flag} '{"key": "value"}'`);
  }
  if (object && (!value || typeof value !== "object" || Array.isArray(value))) {
    invalid(`--${flag} takes a JSON object, not ${JSON.stringify(value)}.`);
  }
  return value;
};

const counted = (flag, raw, floor) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < floor) invalid(`--${flag} takes a whole number from ${floor}, not \`${raw}\`.`);
  return value;
};

/* `{+name}` keeps its slashes: Meet names a record `conferenceRecords/c1`, and one encoded slash is a 404. */
export const expanded = (path, values) => path.replace(/\{(\+?)([^}]+)\}/gu, (whole, reserved, name) => {
  const encoded = encodeURIComponent(String(values[name]));
  return reserved ? encoded.replace(/%2F/gu, "/") : encoded;
});

const pathNames = (entry) => Object.entries(entry.params ?? {}).filter(([, one]) => one.in === "path").map(([name]) => name);

const placed = (method, params, positionals) => {
  const { entry, service } = method;
  const defaulted = Object.keys(PATH_DEFAULTS[service] ?? {});
  const every = (entry.order ?? pathNames(entry)).filter((name) => entry.params?.[name]?.in === "path" && !(name in params));
  /* Fewer positionals than slots: the ones with a default are the ones left out, so `messages get <id>` is the id. */
  const open = positionals.length < every.length ? every.filter((name) => !defaulted.includes(name)) : every;
  if (positionals.length > open.length) {
    invalid(`${method.id}: unexpected argument \`${positionals[open.length]}\`; its path takes ${open.map((one) => `<${one}>`).join(" ") || "nothing"}.`);
  }
  open.forEach((name, at) => {
    if (at < positionals.length) params[name] = positionals[at];
  });
  for (const [name, value] of Object.entries(PATH_DEFAULTS[service] ?? {})) {
    if (entry.params?.[name] && !(name in params)) params[name] = value;
  }
  const missing = Object.entries(entry.params ?? {}).filter(([name, one]) => one.required && !(name in params)).map(([name]) => name);
  if (missing.length) {
    invalid(`${method.id} needs ${missing.join(", ")}: pass it in --params '{"${missing[0]}": "…"}'`
      + `${missing.every((one) => pathNames(entry).includes(one)) ? " or as a positional" : ""}.`);
  }
};

const checkedKeys = (method, params) => {
  const declared = [...Object.keys(method.entry.params ?? {}), ...COMMON];
  for (const key of Object.keys(params)) {
    if (!declared.includes(key)) invalid(`${method.id}: ${didYouMean("--params key", key, declared, `\`forge google schema ${method.id}\` lists them.`)}`);
  }
};

/* A flag the method has no use for is refused rather than dropped: dropped, it reads as done. */
const usable = (method, flags) => {
  const { entry, id } = method;
  if (flags.upload !== undefined && !entry.upload) invalid(`${id} takes no upload, so --upload is refused.`);
  if (flags.json !== undefined && !entry.body) invalid(`${id} takes no request body, so --json is refused.`);
  if (flags.output !== undefined && !entry.download) invalid(`${id} neither downloads nor exports, so --output is refused.`);
  if (entry.download && !entry.returns && flags.output === undefined) {
    invalid(`${id} answers with the file's bytes rather than JSON: name where they go with --output <file>.`);
  }
  if (flags["page-all"] && !entry.params?.pageToken) invalid(`${id} does not page, so --page-all is refused.`);
  for (const flag of ["page-limit", "page-delay"]) {
    if (flags[flag] !== undefined && !flags["page-all"]) invalid(`--${flag} shapes --page-all, which this call does not ask for.`);
  }
  if (flags.upload !== undefined && (!existsSync(flags.upload) || !statSync(flags.upload).isFile())) {
    invalid(`--upload names ${flags.upload}, which is not a file here.`);
  }
};

const PAGE_LIMIT = 10;
const PAGE_DELAY = 100;

const queryOf = (entry, params) => Object.fromEntries(Object.entries(params)
  .filter(([name]) => entry.params?.[name]?.in !== "path"));

/** The request a helper composes, its parameters already this module's own and so not re-judged. */
export const requestFor = (method, { params = {}, positionals = [], body = null, upload = null, output = null, paging = null } = {}) => {
  const all = { ...params };
  placed(method, all, positionals);
  return { params: all, path: expanded(method.entry.path, all), query: queryOf(method.entry, all), body, upload, output, paging };
};

/** Paging off the three flags that shape it, or null where `--page-all` was not asked for. */
export const pagingOf = (flags) => (flags["page-all"] ? {
  limit: flags["page-limit"] === undefined ? PAGE_LIMIT : counted("page-limit", flags["page-limit"], 1),
  delay: flags["page-delay"] === undefined ? PAGE_DELAY : counted("page-delay", flags["page-delay"], 0),
} : null);

/** The request one typed call sends, or a refusal naming the input it could not use. */
export const requestOf = (method, flags, positionals) => {
  usable(method, flags);
  const params = flags.params === undefined ? {} : parsedJson("params", flags.params);
  checkedKeys(method, params);
  return requestFor(method, {
    params,
    positionals,
    body: flags.json === undefined ? null : parsedJson("json", flags.json, { object: false }),
    upload: flags.upload ?? null,
    output: flags.output ?? null,
    paging: pagingOf(flags),
  });
};

const SENDS = ["gmail.users.messages.send", "gmail.users.drafts.send"];
const OVERWRITES = ["docs.documents.batchUpdate"];
const INVITES = ["calendar.events.insert", "calendar.events.patch"];

const invites = (event) => Array.isArray(event?.attendees) && event.attendees.length > 0;

/** Why this request is refused without `--yes`, or null. `event` is the event a patch changes, read first. */
export const consentOwed = (method, request, event = null) => {
  const { entry, id } = method;
  const [, resource] = id.split(".");
  if (entry.http === "DELETE") return "deletes";
  if (id.endsWith(".trash") || request.body?.trashed === true) return "trashes";
  if (resource === "permissions" && entry.http !== "GET") return "changes a permission";
  if (entry.http === "PUT" || OVERWRITES.includes(id)) return "overwrites content";
  if (request.upload && entry.http === "PATCH") return "overwrites a file's content";
  if (SENDS.includes(id)) return "sends mail";
  if (INVITES.includes(id) && (invites(request.body) || invites(event))) return "invites to an event";
  return null;
};

export const PATCHES_AN_EVENT = "calendar.events.patch";
