/* Which account answers, said without saying anything a credential is made of: a service account by
   its client email and a masked key id, a login by its address, the environment by the variable's
   name. `auth status` prints it and `forge doctor` reads the same description. docs/cli/google.md. */
import { SCOPES } from "../surface.mjs";
import { endpoint } from "../wire.mjs";
import { ENV, LOGIN } from "./accounts.mjs";
import { ENV_TOKEN, defaultAccount, environmentToken, savedAccounts } from "./configured.mjs";
import { servicesOf } from "./credential.mjs";

const identityOf = (record) => (record.kind === LOGIN
  ? { address: record.address ?? null }
  : { clientEmail: record.clientEmail, keyId: record.keyId });

const scopesOf = (record) => (record.kind === LOGIN
  ? record.scopes ?? []
  : servicesOf(record).flatMap((service) => SCOPES[service]?.full ?? []));

const described = (name) => {
  const record = savedAccounts()[name];
  return { account: name, kind: record.kind, ...identityOf(record), as: record.as ?? null,
    services: servicesOf(record), scopes: scopesOf(record) };
};

/** The route one call would take with `named` as its `--account`, or null where none would answer. */
export const answering = (named = null) => {
  const saved = savedAccounts();
  if (named && saved[named]) return { route: saved[named].kind, ...described(named) };
  if (environmentToken()) {
    return { route: ENV, variable: ENV_TOKEN, shadowed: defaultAccount() };
  }
  const name = defaultAccount();
  return name ? { route: saved[name].kind, ...described(name) } : null;
};

export const accountsListed = () => Object.keys(savedAccounts()).map(described);

/** One line for `forge doctor`: the account that answers, its default `--as` and its scopes. */
export const doctorSaid = () => {
  const now = answering();
  if (!now) return null;
  if (now.route === ENV) return `${ENV_TOKEN} from the environment${now.shadowed ? `, shadowing the saved \`${now.shadowed}\`` : ""}`;
  const who = now.kind === LOGIN ? `login ${now.address ?? "(no address)"}` : `service account ${now.clientEmail} key ${now.keyId}`;
  const as = now.kind === LOGIN ? "" : `, --as ${now.as ?? "none by default"}`;
  const at = endpoint() ? `, every Google origin replaced by ${endpoint()}` : "";
  return `\`${now.account}\`: ${who}${as}, scopes ${now.scopes.map((one) => one.replace("https://www.googleapis.com/auth/", "")).join(" ")}${at}`;
};
