/* An access token for one call, from whichever account answers it: a JWT a service account's key
   signs (its subject the `--as` user under domain-wide delegation), a login's refresh token exchanged,
   or the environment's token as it stands. Each token is held for striking the moment it exists.
   docs/cli/google.md. */
import { createSign } from "node:crypto";

import { SCOPES, SERVED_SERVICES } from "../surface.mjs";
import { AUTH, VALIDATION, holdSecret, refuse } from "../exits.mjs";
import { jsonOf, reach } from "../wire.mjs";
import { ENV, LOGIN, SERVICE, accountFile } from "./accounts.mjs";
import { ENV_TOKEN } from "./configured.mjs";

/* Mail, calendars and meetings are a user's; a service account reaches them only as that user. */
const PERSONAL = ["gmail", "calendar", "meet"];
const LIFETIME_SECONDS = 3600;
const JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const DELEGATION_PAGE = "admin.google.com → Security → Access and data control → API controls → Manage Domain Wide Delegation";

export const servicesOf = (record) => record?.services ?? SERVED_SERVICES;

const addsService = (choice, service) => {
  const wanted = [...servicesOf(choice.record), service].join(",");
  return choice.route === LOGIN
    ? `forge google auth login --account ${choice.name} --client-secret <client_secret.json> -s ${wanted}`
    : `forge google auth set --account ${choice.name} -s ${wanted}`;
};

/** Whose data the call acts on: the `--as` user, the account's default one, or nobody but the account. */
export const subjectFor = (choice, service, as) => {
  if (choice.route === LOGIN && as) {
    refuse(VALIDATION, `google: --as is refused on \`${choice.name}\`, a login: a login acts as the one person who signed in.\n`
      + "  drop --as, or name a service account with --account");
  }
  if (choice.route === ENV && as) {
    refuse(VALIDATION, `google: --as is refused while ${ENV_TOKEN} answers: that token is already one person's.\n`
      + "  drop --as, or name a service account with --account");
  }
  if (choice.route !== SERVICE) return null;
  if (!servicesOf(choice.record).includes(service)) {
    refuse(AUTH, `google: \`${choice.name}\` is not configured for ${service}.\n  add it: ${addsService(choice, service)}`);
  }
  const subject = as ?? choice.record.as ?? null;
  if (!subject && PERSONAL.includes(service)) {
    refuse(VALIDATION, `google: ${service} acts on a user's data, and \`${choice.name}\` is a service account: name the user with --as user@domain.\n`
      + `  or record a default: forge google auth set --account ${choice.name} --as user@domain`);
  }
  return subject;
};

const base64url = (value) => Buffer.from(value).toString("base64url");

/* RS256 over `header.claims`, as RFC 7523 has it; the key never leaves this process. */
const signedJwt = (key, scopes, subject) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: key.private_key_id };
  const claims = { iss: key.client_email, scope: scopes.join(" "), aud: key.token_uri, iat: now,
    exp: now + LIFETIME_SECONDS, ...(subject ? { sub: subject } : {}) };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key);
  return `${unsigned}.${signature.toString("base64url")}`;
};

const exchanged = async (tokenUri, form) => {
  const answer = await reach("POST", tokenUri, {
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });
  const said = jsonOf(answer);
  if (answer.ok && said?.access_token) holdSecret(said.access_token);
  return { answer, said };
};

const refusedDelegation = (key, scopes) => refuse(AUTH, `google: the token endpoint answered unauthorized_client for ${key.client_email}.\n`
  + "  the key is good; the delegation is not granted. A Workspace admin grants it for\n"
  + `  client id ${key.client_id} with the scopes ${scopes.join(",")}\n`
  + `  at ${DELEGATION_PAGE}`);

const serviceToken = async (choice, service, subject) => {
  const key = accountFile(choice.name);
  const scopes = SCOPES[service].full;
  const { answer, said } = await exchanged(key.token_uri, { grant_type: JWT_BEARER, assertion: signedJwt(key, scopes, subject) });
  if (said?.access_token) return said.access_token;
  if (said?.error === "unauthorized_client") return refusedDelegation(key, scopes);
  return refuse(AUTH, `google: ${key.token_uri} refused the key of \`${choice.name}\` (${answer.status}): `
    + `${said?.error ?? ""} ${said?.error_description ?? ""}`.trimEnd()
    + `\n  a revoked or rotated key is saved again with: forge google auth add <key.json> --account ${choice.name}`);
};

const loginToken = async (choice) => {
  const saved = accountFile(choice.name);
  const { answer, said } = await exchanged(saved.token_uri, {
    grant_type: "refresh_token", refresh_token: saved.refresh_token, client_id: saved.client_id, client_secret: saved.client_secret,
  });
  if (said?.access_token) return said.access_token;
  return refuse(AUTH, `google: ${saved.token_uri} refused the saved login \`${choice.name}\` (${answer.status}): `
    + `${said?.error ?? ""} ${said?.error_description ?? ""}`.trimEnd()
    + `\n  sign in again: forge google auth login --account ${choice.name} --client-secret <client_secret.json>`
    + ` -s ${servicesOf(choice.record).join(",")}`);
};

const minted = new Map();

/** The bearer for one call, minted once a process for each account, service and subject. */
export const accessToken = async (choice, service, subject) => {
  if (choice.route === ENV) return choice.token;
  if (choice.route === LOGIN && !servicesOf(choice.record).includes(service)) {
    refuse(AUTH, `google: the login \`${choice.name}\` did not ask for ${service}.\n  add it: ${addsService(choice, service)}`);
  }
  const key = `${choice.name}|${choice.route === SERVICE ? service : "login"}|${subject ?? ""}`;
  if (!minted.has(key)) minted.set(key, choice.route === SERVICE ? await serviceToken(choice, service, subject) : await loginToken(choice));
  return minted.get(key);
};

/** What a 401 or 403 is cleared by, for the account that got it. */
export const clearedBy = (choice, service) => {
  if (choice.route === ENV) return `a fresh token in ${ENV_TOKEN}, or unset it so a saved account answers`;
  if (choice.route === LOGIN) {
    return `sign in again with the write scope: forge google auth login --account ${choice.name}`
      + ` --client-secret <client_secret.json> -s ${servicesOf(choice.record).join(",")} --write ${service}`;
  }
  return `share the item with ${choice.record.clientEmail}, or act as a user who can see it with --as;`
    + " `forge google auth status` shows what answers";
};
