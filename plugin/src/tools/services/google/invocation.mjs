/* One call, typed or made by a helper, in the one order every call runs: which account answers, whose
   data it acts on, whether it owes `--yes`, then the preview, or the token and the send. A helper that
   took a second route would be a second place consent and masking have to be right. */
import { readFileSync, writeFileSync } from "node:fs";

import { chooseAccount } from "./auth/accounts.mjs";
import { accessToken, previewedCredential, subjectFor } from "./auth/credential.mjs";
import { API, AUTH, INTERNAL, VALIDATION, refuse, say, struck } from "./exits.mjs";
import { READS_THE_EVENT, consentOwed } from "./consent.mjs";
import { clearedBy } from "./refused.mjs";
import { expanded } from "./request.mjs";
import { methodById } from "./surface.mjs";
import { endpointed, jsonOf, mimeOf, multipart, reach, withQuery } from "./wire.mjs";

const shellWord = (word) => (/^[\w@%+=:,./-]+$/u.test(word) ? word : `'${word.replace(/'/gu, "'\\''")}'`);

const retyped = (argv, extra) => `forge google ${[...argv.filter((one) => one !== "--dry-run"), extra].map(shellWord).join(" ")}`;

const refuseWithoutConsent = (method, reason, argv) => refuse(VALIDATION, `google: ${method.id} ${reason}, which --yes has to be given for.\n`
  + `  carry it out: ${retyped(argv, "--yes")}\n`
  + `  see it first: ${retyped(argv, "--dry-run")}`);

const originOf = (index) => endpointed(index.rootUrl).replace(/\/+$/u, "");

const addressOf = (method, request, pageToken) => {
  const { index, entry } = method;
  const base = request.upload
    ? `${originOf(index)}${expanded(entry.upload, request.params)}`
    : `${originOf(index)}/${index.servicePath}${request.path}`;
  const query = { ...request.query,
    ...(request.upload ? { uploadType: "multipart" } : {}),
    ...(request.output && entry.returns ? { alt: "media" } : {}),
    ...(pageToken ? { pageToken } : {}) };
  return withQuery(base, query);
};

const payloadOf = (request) => {
  if (request.upload) {
    const bytes = readFileSync(request.upload);
    return { ...multipart(request.body, bytes, mimeOf(request.upload)), shown: `${JSON.stringify(request.body ?? {}, null, 2)}\n<${bytes.length} bytes of ${request.upload}, ${mimeOf(request.upload)}>` };
  }
  if (request.body === null) return { contentType: null, body: null, shown: null };
  const text = JSON.stringify(request.body);
  return { contentType: "application/json", body: text, shown: JSON.stringify(request.body, null, 2) };
};

const preview = (method, url, credential, payload) => {
  say(`${method.entry.http} ${url}`);
  say(`Credential: ${credential.account}`);
  say(`Authorization: Bearer ${credential.bearer}`);
  if (payload.contentType) say(`Content-Type: ${payload.contentType}`);
  if (payload.shown) say(payload.shown);
};

const NEXT = {
  400: (method) => `\`forge google schema ${method.id}\` lists what it takes`,
  404: () => "check the id, and that the account answering can see it",
  409: () => "it already exists or changed underneath the call; read it again",
  429: () => "the quota ran out; wait and send it again",
};

const failed = (method, answer, choice) => {
  const said = jsonOf(answer);
  const message = said?.error?.message ?? said?.error_description ?? (typeof said === "string" ? said.slice(0, 600) : JSON.stringify(said));
  if (answer.status === 401 || answer.status === 403) {
    return refuse(AUTH, `google: ${method.id} answered ${answer.status}: ${struck(message)}\n  ${struck(clearedBy(method, choice, answer.status, said))}`);
  }
  const next = NEXT[answer.status]?.(method) ?? (answer.status >= 500 ? "Google's side failed; send it again later" : "read the message above");
  return refuse(API, `google: ${method.id} answered ${answer.status}: ${struck(message)}\n  ${next}`);
};

const written = (request, answer) => {
  try {
    writeFileSync(request.output, answer.bytes);
  } catch (error) {
    refuse(INTERNAL, `google: could not write ${request.output}: ${error.message}.\n`
      + "  create its directory, or choose a writable one with --output");
  }
  return { output: request.output, bytes: answer.bytes.length, mimeType: answer.headers.get("content-type") ?? null };
};

const pause = (millis) => new Promise((done) => setTimeout(done, millis));

const sent = async (method, request, token, choice, pageToken = null) => {
  const payload = payloadOf(request);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json",
    ...(payload.contentType ? { "Content-Type": payload.contentType } : {}) };
  const answer = await reach(method.entry.http, addressOf(method, request, pageToken), { headers, body: payload.body });
  if (!answer.ok) failed(method, answer, choice);
  return answer;
};

const paged = async (method, request, token, choice) => {
  let pageToken = null;
  for (let page = 0; page < request.paging.limit; page += 1) {
    if (page > 0) await pause(request.paging.delay);
    const answer = jsonOf(await sent(method, request, token, choice, pageToken));
    say(JSON.stringify(answer));
    pageToken = answer?.nextPageToken ?? null;
    if (!pageToken) return;
  }
};

/* A patch or a move reaches invitees only if the event has some, which only the event itself can say,
   read at the event's own path rather than at the path of the call that changes it. */
const eventOf = async (method, request, token, choice) => {
  const at = expanded(methodById("calendar.events.get").entry.path, request.params);
  const url = withQuery(`${originOf(method.index)}/${method.index.servicePath}${at}`, { fields: "attendees" });
  const answer = await reach("GET", url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!answer.ok) failed(method, answer, choice);
  return jsonOf(answer);
};

/**
 * Runs one request: `options` carries `account`, `as`, `yes`, `dryRun` and the `argv` a consent
 * refusal repeats. Answers the parsed JSON, or null where it printed pages, wrote a file or previewed.
 */
export const invoke = async (method, request, options) => {
  const choice = chooseAccount(options.account);
  const subject = subjectFor(choice, method.service, options.as);
  const owed = !options.yes && !options.dryRun;
  const reason = owed ? consentOwed(method, request) : null;
  if (reason) refuseWithoutConsent(method, reason, options.argv);
  if (options.dryRun) {
    preview(method, addressOf(method, request, null), previewedCredential(choice, method.service, subject), payloadOf(request));
    return null;
  }
  const token = await accessToken(choice, method.service, subject);
  if (owed && READS_THE_EVENT.includes(method.id)) {
    const late = consentOwed(method, request, await eventOf(method, request, token, choice));
    if (late) refuseWithoutConsent(method, late, options.argv);
  }
  if (request.paging) return paged(method, request, token, choice).then(() => null);
  const answer = await sent(method, request, token, choice);
  if (request.output) {
    say(JSON.stringify(written(request, answer)));
    return null;
  }
  return jsonOf(answer);
};

/* Every helper takes these beside its own, so choosing the account and previewing mean one thing everywhere. */
export const ACCOUNT_VALUES = ["--account", "--as"];
export const PREVIEW_SWITCHES = ["--dry-run", "--yes"];

export const optionsOf = (flags, argv) => ({ account: flags.account, as: flags.as, yes: Boolean(flags.yes),
  dryRun: Boolean(flags["dry-run"]), argv });
