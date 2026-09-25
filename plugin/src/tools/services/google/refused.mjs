/* What clears a 401 or a 403, read off the reason Google's body states rather than off the status: one
   status covers an API the Cloud project never enabled, a token short of the scope a method asks and a
   refusal of the item itself, and a sign-in clears only the second. docs/cli/google.md. */
import { SCOPES } from "./surface.mjs";
import { ENV, LOGIN } from "./auth/accounts.mjs";
import { ENV_TOKEN } from "./auth/configured.mjs";
import { servicesOf } from "./auth/credential.mjs";

const DISABLED = ["accessNotConfigured", "SERVICE_DISABLED"];
const SCOPE_SHORT = ["insufficientPermissions", "ACCESS_TOKEN_SCOPE_INSUFFICIENT"];
const ERROR_INFO = "type.googleapis.com/google.rpc.ErrorInfo";
const HELP = "type.googleapis.com/google.rpc.Help";
const STATUS = "`forge google auth status` shows which account answered and what it was granted";

/* Google states a reason in two places, the v1 `errors` list and the v2 `details`, and an answer may carry either. */
const reasonsOf = (error) => [...(error?.errors ?? []), ...(error?.details ?? [])].map((one) => one?.reason).filter(Boolean);

const loginSignIn = (choice, write) => `forge google auth login --account ${choice.name} --client-secret <client_secret.json>`
  + ` -s ${servicesOf(choice.record).join(",")}${write ? ` --write ${write}` : ""}`;

const firstUrl = (text) => /https?:\/\/\S+/u.exec(text ?? "")?.[0].replace(/[.,;)]+$/u, "") ?? null;

/* The API, its project and its enable page, from the ErrorInfo's metadata where Google sends one and
   from the message's own sentence where only the v1 reason came back. */
const disabled = (method, error) => {
  const info = (error.details ?? []).find((one) => one?.["@type"] === ERROR_INFO)?.metadata ?? {};
  const help = (error.details ?? []).find((one) => one?.["@type"] === HELP)?.links?.find((link) => link?.url)?.url;
  const api = info.serviceTitle ?? /^(.+?) has not been used/u.exec(error.message ?? "")?.[1] ?? info.service ?? `${method.service} API`;
  const project = info.consumer?.replace(/^projects\//u, "") ?? info.containerInfo ?? /\bproject (\d+)/u.exec(error.message ?? "")?.[1];
  const url = info.activationUrl ?? help ?? firstUrl(error.message);
  return `the ${api} is not enabled in ${project ? `Cloud project ${project}` : "the client's Cloud project"}: `
    + `enable it at ${url ?? "the Cloud console's API library"}, wait a minute, retry`;
};

const grantedTo = (record) => record.scopes
  ?? servicesOf(record).flatMap((service) => ((record.write ?? []).includes(service) ? SCOPES[service].full : SCOPES[service].read));

/* The scopes the carried document lists for the method, against what the answering account asked and could ask. */
const scopeShort = (method, choice) => {
  const needed = method.entry.scopes ?? [];
  const named = needed.join(" or ");
  if (choice.route === ENV) return `${method.id} needs ${named}: a token granting it in ${ENV_TOKEN}, or unset it so a saved account answers`;
  const askable = needed.filter((scope) => SCOPES[method.service].full.includes(scope));
  if (!askable.length) return `${method.id} needs ${named}, which no scope \`forge google\` asks for grants, so no sign-in here clears it`;
  if (choice.route === LOGIN && !needed.some((scope) => grantedTo(choice.record).includes(scope))) {
    return `${method.id} needs ${askable.join(" or ")}: sign in again with the write scope: ${loginSignIn(choice, method.service)}`;
  }
  return `${method.id} needs ${named}; ${STATUS}`;
};

/* A 401 is a token nobody accepts, so what clears it is a fresh one by the route that made it. */
const unauthorized = (choice) => {
  if (choice.route === ENV) return `a fresh token in ${ENV_TOKEN}, or unset it so a saved account answers`;
  if (choice.route === LOGIN) return `sign in again: ${loginSignIn(choice, null)}`;
  return `a revoked or rotated key is saved again with: forge google auth add <key.json> --account ${choice.name}`;
};

/** The line under a 401 or 403 that says what clears it, for the method called and the account that answered. */
export const clearedBy = (method, choice, status, said) => {
  if (status === 401) return unauthorized(choice);
  const reasons = reasonsOf(said?.error);
  if (reasons.some((reason) => DISABLED.includes(reason))) return disabled(method, said.error);
  if (reasons.some((reason) => SCOPE_SHORT.includes(reason))) return scopeShort(method, choice);
  return STATUS;
};
