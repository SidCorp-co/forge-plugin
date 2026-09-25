/* The Google accounts this machine saved, of two kinds: a service account's key, copied, and a login's
   refresh token. Each is a file beside forge's configuration at 0600, and the `google` key of that
   configuration records what may be shown of it. Both are read where they are used, so a home the
   caller sets is the one that answers. Which account answers a call: docs/cli/google.md. */
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { configDir, saveNested, writeJsonPrivate } from "../../../../resolve/config.mjs";
import { AUTH, INTERNAL, holdSecret, refuse } from "../exits.mjs";
import { ENV_TOKEN, defaultAccount, environmentToken, googleConfig, savedAccounts } from "./configured.mjs";

export const SERVICE = "service";
export const LOGIN = "login";
export const ENV = "env";

const accountsDir = () => join(configDir("forge"), "google");

const fileOf = (name) => join(accountsDir(), `${name}.json`);

const SECRET_FIELDS = ["private_key", "private_key_id", "client_secret", "refresh_token"];

/* A parse error quotes the text it choked on, and that text is a key: the refusal names the file and
   what was wrong with it by kind, never by content. */
const readSaved = (at, name) => {
  let text = null;
  try {
    text = readFileSync(at, "utf8");
  } catch (error) {
    refuse(INTERNAL, `google: the saved account \`${name}\` at ${at} could not be read (${error.code ?? "unreadable"}).\n`
      + "  make it readable by this user, or save the account again");
  }
  try {
    return JSON.parse(text);
  } catch {
    return refuse(INTERNAL, `google: the saved account \`${name}\` at ${at} is not valid JSON.\n`
      + `  save it again: forge google auth remove --account ${name}, then add or log in with --account ${name}`);
  }
};

/** The saved file of one account, every secret in it held for striking before anything prints. */
export const accountFile = (name) => {
  const at = fileOf(name);
  if (!existsSync(at)) {
    refuse(AUTH, `google: the account \`${name}\` is recorded and its file ${at} is gone.\n`
      + `  save it again: forge google auth ${savedAccounts()[name]?.kind === LOGIN ? "login" : "add"} … --account ${name}`);
  }
  const held = readSaved(at, name);
  for (const field of SECRET_FIELDS) holdSecret(held[field]);
  return held;
};

const NAME = /^[A-Za-z0-9][\w.-]{0,63}$/u;

export const checkedName = (name) => {
  if (!NAME.test(name)) refuse(AUTH, `google: \`${name}\` is not an account name: letters, digits, dot, dash and underscore, from a letter or digit.`);
  return name;
};

/** Writes the account's file at 0600 and its record; the first account saved is the default. */
export const saveAccount = (name, record, file, { makeDefault = false } = {}) => {
  mkdirSync(accountsDir(), { recursive: true, mode: 0o700 });
  writeJsonPrivate(fileOf(name), file);
  const accounts = { ...savedAccounts(), [name]: record };
  const current = googleConfig().default;
  const becomes = makeDefault || !current || !Object.hasOwn(accounts, current) ? name : current;
  saveNested("google", { accounts, default: becomes });
  return becomes === name;
};

export const updateAccount = (name, patch, { makeDefault = false } = {}) => {
  const accounts = { ...savedAccounts(), [name]: { ...savedAccounts()[name], ...patch } };
  saveNested("google", { accounts, ...(makeDefault ? { default: name } : {}) });
};

export const removeAccount = (name) => {
  const { [name]: gone, ...rest } = savedAccounts();
  rmSync(fileOf(name), { force: true });
  const current = googleConfig().default;
  saveNested("google", { accounts: rest, default: current === name ? null : current ?? null });
  return gone;
};

const listed = () => Object.keys(savedAccounts()).join(", ") || "none";

export const knownAccount = (name) => {
  if (!Object.hasOwn(savedAccounts(), name)) {
    refuse(AUTH, `google: no account is saved as \`${name}\`; saved: ${listed()}.\n`
      + "  `forge google auth status` lists them, and `forge google auth add|login --account <name>` saves one");
  }
  return name;
};

const NONE_SAVED = `google: no Google account is saved, and ${ENV_TOKEN} is not set.\n`
  + "  a service account: forge google auth add <key.json>\n"
  + "  a Google account:  forge google auth login --client-secret <client_secret.json> -s gmail,calendar\n"
  + `  for CI:            ${ENV_TOKEN}=<access token>`;

/* An explicit name first, the environment token next, then the default: a name typed on the call is
   the plainest statement of intent, and CI sets the environment on purpose. */
export const chooseAccount = (named) => {
  if (named) {
    const name = knownAccount(named);
    return { route: savedAccounts()[name].kind, name, record: savedAccounts()[name] };
  }
  const token = environmentToken();
  if (token) {
    holdSecret(token);
    return { route: ENV, name: null, token, shadowed: defaultAccount() };
  }
  const name = defaultAccount();
  if (name) return { route: savedAccounts()[name].kind, name, record: savedAccounts()[name] };
  if (!Object.keys(savedAccounts()).length) refuse(AUTH, NONE_SAVED);
  return refuse(AUTH, `google: ${Object.keys(savedAccounts()).length} accounts are saved and none is the default: ${listed()}.\n`
    + "  name one on the call with --account <name>, or make one the default: forge google auth set --account <name> --default");
};
