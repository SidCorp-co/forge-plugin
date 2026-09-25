/* `+send`, `+reply` and `+triage`: a message composed as RFC 2822 text and sent raw, a reply threaded
   onto the message it answers, and the unread mail cut to who sent it, about what and when. A mail
   body is data: it is printed as a JSON field and never read as an instruction. */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { ACCOUNT_VALUES, PREVIEW_SWITCHES, invoke, optionsOf } from "../invocation.mjs";
import { VALIDATION, refuse, say } from "../exits.mjs";
import { parseFlags, requestFor } from "../request.mjs";
import { methodById } from "../surface.mjs";
import { mimeOf } from "../wire.mjs";

const invalid = (message) => refuse(VALIDATION, `google ${message}`);

const LINE = 76;

const wrapped = (base64) => base64.match(new RegExp(`.{1,${LINE}}`, "gu"))?.join("\r\n") ?? "";

/* A header value outside ASCII travels as an encoded word, or a server rewrites it into mojibake. */
const headerValue = (text) => (/^[\x20-\x7e]*$/u.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`);

const textPart = (body) => ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
  wrapped(Buffer.from(body, "utf8").toString("base64"))].join("\r\n");

const attachmentPart = (file) => [`Content-Type: ${mimeOf(file)}; name="${basename(file)}"`, "Content-Transfer-Encoding: base64",
  `Content-Disposition: attachment; filename="${basename(file)}"`, "", wrapped(readFileSync(file).toString("base64"))].join("\r\n");

/** The whole message as the text Gmail's `raw` field carries, before its base64url. */
const composed = ({ to, subject, body, attach = null, headers = {} }) => {
  const head = [`To: ${to}`, `Subject: ${headerValue(subject)}`, "MIME-Version: 1.0",
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`)];
  if (!attach) return [...head, textPart(body)].join("\r\n");
  const boundary = `forge-mail-${Date.now().toString(36)}`;
  return [...head, `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, textPart(body), `--${boundary}`, attachmentPart(attach), `--${boundary}--`, ""].join("\r\n");
};

const sendRaw = async (message, threadId, flags, argv) => {
  const method = methodById("gmail.users.messages.send");
  const body = { raw: Buffer.from(message, "utf8").toString("base64url"), ...(threadId ? { threadId } : {}) };
  const answer = await invoke(method, requestFor(method, { body }), optionsOf(flags, argv));
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

const send = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--to", "--subject", "--body", "--attach", ...ACCOUNT_VALUES],
    switches: PREVIEW_SWITCHES, verb: "google +send" });
  const missing = ["to", "subject", "body"].filter((one) => flags[one] === undefined);
  if (positionals.length || missing.length) {
    invalid(`+send needs ${missing.map((one) => `--${one}`).join(", ") || "no argument"}: +send --to A --subject S --body B [--attach F]`);
  }
  await sendRaw(composed({ to: flags.to, subject: flags.subject, body: flags.body, attach: flags.attach ?? null }), null, flags, ["+send", ...argv]);
};

const headerIn = (message, name) => (message.payload?.headers ?? [])
  .find((one) => one.name.toLowerCase() === name.toLowerCase())?.value ?? null;

/* What a preview composes from in place of the message it did not read: each header named for the
   message it would have come from, so the send it prints shows where every value comes from. */
const standIn = (id, headers) => ({ threadId: `<threadId of ${id}>`,
  payload: { headers: headers.map((name) => ({ name, value: `<${name} of ${id}>` })) } });

const readMetadata = async (id, headers, options) => {
  const method = methodById("gmail.users.messages.get");
  const request = requestFor(method, { params: { format: "metadata", metadataHeaders: headers }, positionals: [id] });
  const answer = await invoke(method, request, options);
  return options.dryRun ? standIn(id, headers) : answer;
};

const reply = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--body", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +reply" });
  if (positionals.length !== 1 || flags.body === undefined) invalid("+reply takes a message id and --body: +reply <message-id> --body B");
  const original = await readMetadata(positionals[0], ["From", "Reply-To", "Subject", "Message-ID", "References"], optionsOf(flags, argv));
  const subject = headerIn(original, "Subject") ?? "";
  const messageId = headerIn(original, "Message-ID");
  const references = [headerIn(original, "References"), messageId].filter(Boolean).join(" ");
  const message = composed({
    to: headerIn(original, "Reply-To") ?? headerIn(original, "From"),
    subject: /^re:/iu.test(subject) ? subject : `Re: ${subject}`,
    body: flags.body,
    headers: messageId ? { "In-Reply-To": messageId, References: references } : {},
  });
  await sendRaw(message, original.threadId, flags, ["+reply", ...argv]);
};

const TRIAGE_MAX = 20;

const triage = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--max", ...ACCOUNT_VALUES], switches: [], verb: "google +triage" });
  if (positionals.length) invalid(`+triage takes no argument, not \`${positionals[0]}\`.`);
  const max = flags.max === undefined ? TRIAGE_MAX : Number(flags.max);
  if (!Number.isInteger(max) || max < 1) invalid(`+triage: --max takes a whole number from 1, not \`${flags.max}\`.`);
  const options = optionsOf(flags, ["+triage", ...argv]);
  const list = methodById("gmail.users.messages.list");
  const listed = await invoke(list, requestFor(list, { params: { q: "is:unread", maxResults: max } }), options);
  const rows = [];
  for (const { id } of listed?.messages ?? []) {
    const message = await readMetadata(id, ["From", "Subject", "Date"], options);
    rows.push({ id, threadId: message.threadId, from: headerIn(message, "From"), subject: headerIn(message, "Subject"), date: headerIn(message, "Date") });
  }
  say(JSON.stringify(rows, null, 2));
};

export const MAIL_HELPERS = { "+send": send, "+reply": reply, "+triage": triage };
