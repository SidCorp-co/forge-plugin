/* One ChatGPT turn over the search-master backend's `chatgpt` MCP tool: text, a generated image, an
   attached file, or a chat continued by its id. docs/cli/chatgpt.md.

   One attempt per invocation and never a second. The tool answers a failure during polling with the
   same `isError` shape it answers a refusal with, and salvages onto it the account and conversation
   id that served the turn — so a failed call may have spent a real metered turn, no idempotence key
   is on offer, and a replay can open a second conversation (ISS-791). A failure names `--resume`
   instead, where an id came back. */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { apiBaseOf, clockFor, deadlineOf, deadlineSeconds } from "../request.mjs";
import { userConfig } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { firstLine, flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";

const FILE_CAP = 10;
const BODY_CHARS = 400;
const URL_LIKE = /^https?:\/\//u;

export const USAGE = [
  "Usage: forge chatgpt \"<prompt>\" [--resume id] [--model slug] [--file path|url]... [--save path]",
  "Ask ChatGPT once and print what came back. A prompt describing an image gets one; the same",
  "endpoint answers both. The turn is sent once and never again: a failure that may have spent it",
  "says so and names --resume rather than asking twice.",
  "",
  "  --resume id    continue that conversation instead of starting one",
  "  --model slug   pass a model through; omitted, the upstream runs its account default",
  "  --file p|url   attach a file, up to 10; a local path is uploaded first, a URL is sent as it is",
  "  --save path    write the bytes of the image the reply names",
].join("\n");

const settingsFor = () => {
  const held = userConfig().chatgpt ?? {};
  const missing = [];
  if (!held.url) missing.push("--set chatgpt.url=<endpoint>");
  if (!held.key) missing.push("--set chatgpt.key=<key>");
  if (missing.length) {
    fail(`chatgpt: no endpoint and key here yet. Set ${missing.length === 2 ? "both" : "it"}:\n  `
      + missing.map((one) => `forge doctor ${one}`).join("\n  "));
  }
  return held;
};

/* Event-aware and deliberately not `sseData`, whose own comment says a consumer needing the wire
   format's dispatch wants a different function: it concatenates every `data:` value in the body, so
   a progress notification arriving before the result yields two adjacent JSON documents and the
   parse fails (consult ab0c46, F1). */
const eventsIn = (text) => text
  .split(/\r?\n\r?\n/u)
  .map((block) => block
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join(""))
  .filter(Boolean);

const parsedOr = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/* An answer to this request, not merely a message about it: the id alone is not enough, since the
   transport may send a server-to-client *request* on the same stream under an id counter of its own
   that starts where ours does (consult 4f91a2, F1). A reply has no method and one of two envelopes. */
const isAnswer = (held, id) => held?.id === id && held.method === undefined
  && (held.result !== undefined || held.error !== undefined);

/* The reply is JSON or an event stream, and both are held to the same test — the single-document
   case is not exempt from it just because there is nowhere else for the answer to be. */
const answerIn = (text, type, id) => {
  if (!type.includes("event-stream")) {
    const held = parsedOr(text);
    return isAnswer(held, id) ? held : null;
  }
  for (const event of eventsIn(text)) {
    const held = parsedOr(event);
    if (isAnswer(held, id)) return held;
  }
  return null;
};

/* Every diagnostic here quotes a body the far side wrote, and a gateway that echoes the request's
   headers into a 4xx puts the configured key in it — so the key is struck out of external text
   before it is printed, rather than trusted not to appear (consult 4f91a2, F2). */
const shownVia = (key) => (text) =>
  (key ? String(text).split(key).join("<the key>") : String(text)).slice(0, BODY_CHARS);

const ambiguous = (said, conversation) => {
  const back = conversation ? `\n  The turn may already exist: forge chatgpt --resume ${conversation} "<next>"` : "";
  fail(`chatgpt: ${said}\n  This turn may have been spent and is not sent again — the tool cannot say `
    + `whether it ran.${back}`);
};

const uploaded = async (base, key, path, clock) => {
  try {
    statSync(path);
  } catch {
    fail(`chatgpt: no file at ${path}, so nothing was sent`);
  }
  const shown = shownVia(key);
  const form = new FormData();
  form.set("file", new Blob([readFileSync(path)]), basename(path));
  const answer = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
    signal: clock(),
  });
  const text = await answer.text();
  if (!answer.ok) fail(`chatgpt: the upload of ${path} was refused — ${shown(text)}`);
  const held = parsedOr(text);
  if (!held?.url) fail(`chatgpt: the upload of ${path} answered no url — ${shown(text)}`);
  return held.url;
};

const attached = async (given, held, clock) => {
  if (given.length > FILE_CAP) fail(`chatgpt: ${given.length} files, and the tool takes ${FILE_CAP}`);
  const urls = [];
  for (const one of given) {
    if (URL_LIKE.test(one)) {
      urls.push(one);
      continue;
    }
    const { base, problem } = apiBaseOf(held.url);
    if (problem) fail(`chatgpt: a local file is uploaded to the origin beside the endpoint, and there is ${problem}`);
    urls.push(await uploaded(base, held.key, one, clock));
  }
  return urls;
};

const printed = (out, meta) => {
  const said = out.answers ?? null;
  if (said !== null) console.log(typeof said === "string" ? said : JSON.stringify(said, null, 2));
  if (out.imageUrl) console.log(`\nimage     ${out.imageUrl}`);
  if (meta?.account) console.log(`account   ${meta.account}`);
  /* Only where the reply carries one: `_meta` has no model, and printing the slug asked for would
     name a model that may never have run. */
  if (out.model) console.log(`model     ${out.model}`);
  if (out.conversationId) console.log(`resume    forge chatgpt --resume ${out.conversationId} "<next>"`);
};

export const chatgpt = async (argv) => {
  if (wantsHelp(argv) || argv.length === 0) return console.log(USAGE);
  const [prompt, ...others] = argv;
  /* The prompt is a subject rather than a flag's value, so it comes off before the parser: `flags`
     refuses a bare word, which is what tells a caller that everything after it is named. */
  if (prompt.startsWith("--") || !prompt.trim()) {
    fail(`chatgpt: the prompt comes first, before any flag.\n${firstLine(USAGE)}`);
  }
  const { values: given, rest } = pullRepeated(others, "--file", "chatgpt", { usage: USAGE });
  const { resume, model, save } = flags(rest, "chatgpt", [], { usage: USAGE });

  const held = settingsFor();
  const shown = shownVia(held.key);
  const deadline = deadlineOf(null);
  const clock = () => clockFor(deadline);
  const files = await attached(given, held, clock);
  const id = 1;
  const body = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: "chatgpt",
      arguments: {
        prompt,
        ...(model ? { model } : {}),
        ...(resume ? { conversationId: resume } : {}),
        ...(files.length ? { files } : {}),
      },
    },
  };

  console.error(`chatgpt: one turn, waiting up to ${deadlineSeconds()}s.`);
  let answer = null;
  let text = "";
  try {
    answer = await fetch(held.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${held.key}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal: clock(),
    });
    text = await answer.text();
  } catch (error) {
    ambiguous(error.name === "TimeoutError" ? `ran out after ${deadline.value}s` : shown(error.message), resume);
  }
  if (!answer.ok) fail(`chatgpt: the backend answered ${answer.status} — ${shown(text)}`);

  const message = answerIn(text, answer.headers.get("content-type") ?? "", id);
  if (!message) ambiguous(`the reply could not be read as this request's answer — ${shown(text)}`, resume);
  const result = message.result ?? {};
  const part = result.content?.find((one) => one.type === "text");
  if (result.isError || message.error) {
    ambiguous(`the tool refused — ${shown(message.error?.message ?? part?.text ?? "no reason given")}`,
      resume ?? result._meta?.conversationId);
  }
  /* Nothing to read is refused rather than printed as an empty answer, and names --resume like any
     other spent turn; text that will not parse is shown as it came (consult 4f91a2, F1). */
  if (typeof part?.text !== "string" || !part.text.trim()) {
    ambiguous(`the reply carried no answer to read — ${shown(text)}`, resume ?? result._meta?.conversationId);
  }
  const out = parsedOr(part.text) ?? { answers: part.text };
  printed(out, result._meta);
  if (save && out.imageUrl) {
    const drawn = await fetch(out.imageUrl, { signal: clock() });
    /* Checked before the write, or a 403's error document lands on the destination under a `saved`
       line and overwrites whatever was there (consult 4f91a2, F3). */
    if (!drawn.ok) {
      fail(`chatgpt: the image at ${out.imageUrl} answered ${drawn.status}, so ${save} is untouched.`
        + "\n  The turn is not sent again — the answer above is already the one it gave.");
    }
    writeFileSync(save, Buffer.from(await drawn.arrayBuffer()));
    console.log(`saved     ${save}`);
  }
  return undefined;
};
