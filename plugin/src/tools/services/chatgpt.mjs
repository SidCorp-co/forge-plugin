/* One ChatGPT turn over the search-master backend's `chatgpt` MCP tool: text, a generated image, an
   attached file, or a chat continued by its id. One attempt per invocation and never a second, and
   a failure names `--resume` instead — docs/cli/chatgpt.md carries why. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { apiBaseOf, clockFor, deadlineOf, deadlineSeconds, parsedOr, ranOut } from "../../wire/request.mjs";
import { sseEvents } from "../../wire/sse.mjs";
import { chatgptSettings, fail } from "../../resolve/settings.mjs";
import { firstLine, flags, pullRepeated, wantsHelp } from "../../resolve/flags.mjs";

const FILE_CAP = 10;
const BODY_CHARS = 400;
const URL_LIKE = /^https?:\/\//u;

/* Built, not a constant: a deadline written into the text goes stale against `waitSeconds`. */
export const usage = () => [
  "Usage: forge chatgpt \"<prompt>\" [--resume id] [--model slug] [--file path|url]... [--save path]",
  "One turn of ChatGPT from the terminal, over the endpoint this machine has saved. Three things it",
  "is for, and what each costs:",
  "",
  "  an answer     what this session cannot settle for itself, put to another provider \u2014 one turn",
  "  a picture     look-and-feel to build toward, never a render of what you built \u2014 one turn",
  "  a follow-up   the id every reply prints, given back \u2014 the next ask is one turn and not two",
  "",
  "One attempt per call and never a second. A call that fails may still have spent a metered turn:",
  "nothing here can tell, and nothing here sends it again.",
  "",
  "  --resume id    continue that conversation instead of starting one",
  "  --model slug   pass a model through; no default is sent, so the upstream runs its account's",
  "  --file p|url   attach a file, up to 10; a local path is uploaded first, a URL is sent as it is",
  "  --save path    write the bytes of the image the reply names",
  "",
  `The wait is ${deadlineSeconds()}s, from waitSeconds in config.json. Which asks earn a turn:`
    + " docs/cli/chatgpt.md.",
].join("\n");

const settingsFor = () => {
  const held = chatgptSettings();
  if (held.missing.length) {
    fail(`chatgpt: no endpoint and key here yet. Set ${held.missing.length === 2 ? "both" : "it"}:\n  `
      + held.missing.map((row) => `forge doctor --${row.flag} <${row.asks}>`).join("\n  "));
  }
  return held;
};

/* An answer to this request, not merely a message about it: the transport may send a request of its
   own on the same stream under an id counter that starts where ours does (consult 4f91a2, F1). */
const isAnswer = (held, id) => held?.id === id && held.method === undefined
  && (held.result !== undefined || held.error !== undefined);

const answerIn = (text, type, id) => {
  if (!type.includes("event-stream")) {
    const held = parsedOr(text);
    return isAnswer(held, id) ? held : null;
  }
  for (const event of sseEvents(text)) {
    const held = parsedOr(event);
    if (isAnswer(held, id)) return held;
  }
  return null;
};

/* A gateway echoing the request's headers into a 4xx puts the configured key in the body this verb
   quotes, so every piece of external text is struck. Truncating is a separate job that only a quoted
   error body wants: a signed URL outruns any cap an error deserves (4f91a2, ea77c3). */
const redactorsFor = (key) => {
  const struck = (text) => (key ? String(text).split(key).join("<the key>") : String(text));
  return { struck, shown: (text) => struck(text).slice(0, BODY_CHARS) };
};

/* The prompt leads the printed command, or the recovery line is one this verb's own parser turns away (review 829fc7, F1). */
const ambiguous = (said, conversation, struck) => {
  const back = conversation
    ? `\n  The turn may already exist: forge chatgpt "<next>" --resume ${struck(conversation)}`
    : "";
  fail(`chatgpt: ${said}\n  This turn may have been spent and is not sent again — the tool cannot say `
    + `whether it ran.${back}`);
};

/* Answers a problem rather than refusing: the uploads of one turn go together, so the first one to come back badly is not the one a caller wants named, and `fail` would end the process before the rest could be read. The whole request is inside the catch — the signal, the send and the read of the body, since a 200 whose body stalls throws at the read. */
const uploaded = async (base, key, { path, bytes }, deadline) => {
  const { shown } = redactorsFor(key);
  const form = new FormData();
  form.set("file", new Blob([bytes]), basename(path));
  let text = "";
  let answer = null;
  try {
    answer = await fetch(`${base}/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: clockFor(deadline),
      redirect: "error",
    });
    text = await answer.text();
  } catch (error) {
    return { problem: `the upload of ${path} did not finish — ${shown(ranOut(error, deadline))}` };
  }
  if (!answer.ok) return { problem: `the upload of ${path} was refused — ${shown(text)}` };
  const held = parsedOr(text);
  if (!held?.url) return { problem: `the upload of ${path} answered no url — ${shown(text)}` };
  return { url: held.url };
};

/* Every attachment is read before the first upload leaves: reading inside the loop spends the first file's request before a missing second one is found, and an upload cannot be taken back. The uploads themselves go together, which is what makes ten files one wait instead of ten; the cost is that every one of them is spent before a refusal among them is reported, and in exchange the message names the earliest file the caller named rather than whichever request answered first. */
const attached = async (given, held, deadline) => {
  if (given.length > FILE_CAP) fail(`chatgpt: ${given.length} files, and the tool takes ${FILE_CAP}`);
  const parts = [];
  for (const one of given) {
    if (URL_LIKE.test(one)) {
      parts.push({ url: one });
      continue;
    }
    try {
      parts.push({ path: one, bytes: readFileSync(one) });
    } catch (error) {
      /* Named apart, or an unreadable file that is plainly there reads as a typo in the path. */
      fail(error.code === "ENOENT"
        ? `chatgpt: no file at ${one}, so nothing was sent`
        : `chatgpt: ${one} could not be read (${error.code ?? error.message}), so nothing was sent`);
    }
  }
  const { base, problem } = parts.some((one) => one.path) ? apiBaseOf(held.url) : {};
  if (problem) fail(`chatgpt: a local file is uploaded to the origin beside the endpoint, and there is ${problem}`);
  const settled = await Promise.all(parts.map((one) =>
    (one.url ? { url: one.url } : uploaded(base, held.key, one, deadline))));
  const refused = settled.find((one) => one.problem);
  if (refused) fail(`chatgpt: ${refused.problem}, so the turn was not sent`);
  return settled.map((one) => one.url);
};

/* The answer is struck like every other backend text: a text part that will not parse becomes the
   answer, exactly where an echoed header arrives, so exempting it held open the path it guarded
   (review 829fc7, F2). The model prints only where the reply carries one, `_meta` having none; the
   account it does carry is the gateway's own rotation, which no caller chooses. And `answers` is the
   empty string on an image turn, so the value decides, not a null test that printed a blank line. */
const printed = (out, struck) => {
  const said = out.answers;
  const body = said === null || said === undefined ? ""
    : (typeof said === "string" ? said : JSON.stringify(said, null, 2));
  if (body) console.log(struck(body));
  if (out.imageUrl) console.log(`${body ? "\n" : ""}image     ${struck(out.imageUrl)}`);
  if (out.model) console.log(`model     ${struck(out.model)}`);
  if (out.conversationId) console.log(`resume    forge chatgpt "<next>" --resume ${struck(out.conversationId)}`);
};

export const chatgpt = async (argv) => {
  const said = usage();
  if (wantsHelp(argv) || argv.length === 0) return console.log(said);
  const [prompt, ...others] = argv;
  /* The prompt is a subject, not a flag's value, so it comes off before the parser, which refuses a
     bare word. A flag standing in its place is two mistakes at once, so the flags are judged first
     — or a mistyped one is never named and reads as a missing prompt. */
  if (prompt.startsWith("--")) {
    flags(pullRepeated(argv, "--file", "chatgpt", { usage: said }).rest, "chatgpt", [], { usage: said });
  }
  if (prompt.startsWith("--") || !prompt.trim()) {
    fail(`chatgpt: the prompt comes first, before any flag.\n${firstLine(said)}`);
  }
  const { values: given, rest } = pullRepeated(others, "--file", "chatgpt", { usage: said });
  const { resume, model, save } = flags(rest, "chatgpt", [], { usage: said });

  const held = settingsFor();
  const { struck, shown } = redactorsFor(held.key);
  const deadline = deadlineOf(null);
  const clock = () => clockFor(deadline);
  const files = await attached(given, held, deadline);
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
      /* A 307 or 308 is followed with method and body intact, so a redirect is a second `tools/call`
         and no retry loop never enforced one turn by itself (consult 4d1f8e, F1). Not on the image
         `GET`, where following one is ordinary and costs no turn. */
      redirect: "error",
    });
    text = await answer.text();
  } catch (error) {
    ambiguous(shown(ranOut(error, deadline)), resume, struck);
  }
  if (!answer.ok) fail(`chatgpt: the backend answered ${answer.status} — ${shown(text)}`);

  const message = answerIn(text, answer.headers.get("content-type") ?? "", id);
  if (!message) ambiguous(`the reply could not be read as this request's answer — ${shown(text)}`, resume, struck);
  const result = message.result ?? {};
  const part = result.content?.find((one) => one.type === "text");
  if (result.isError || message.error) {
    ambiguous(`the tool refused — ${shown(message.error?.message ?? part?.text ?? "no reason given")}`,
      resume ?? result._meta?.conversationId, struck);
  }
  /* Nothing to read is refused rather than printed as an empty answer, and names --resume like any
     other spent turn; text that will not parse is shown as it came (consult 4f91a2, F1). */
  if (typeof part?.text !== "string" || !part.text.trim()) {
    ambiguous(`the reply carried no answer to read — ${shown(text)}`,
      resume ?? result._meta?.conversationId, struck);
  }
  const out = parsedOr(part.text) ?? { answers: part.text };
  printed(out, struck);
  if (save && out.imageUrl) {
    const drawn = await fetch(out.imageUrl, { signal: clock() });
    /* Checked before the write, or a 403's error document lands on the destination under a `saved`
       line and overwrites whatever was there (consult 4f91a2, F3). */
    if (!drawn.ok) {
      fail(`chatgpt: the image at ${struck(out.imageUrl)} answered ${drawn.status}, so ${save} is untouched.`
        + "\n  The turn is not sent again — the answer above is already the one it gave.");
    }
    writeFileSync(save, Buffer.from(await drawn.arrayBuffer()));
    console.log(`saved     ${save}`);
  }
  return undefined;
};

/* Or the CLI answers `-h` off the verb table, and the one attempt, the cap and the deadline in force are all missing from what a caller reads. */
chatgpt.answersHelp = true;
