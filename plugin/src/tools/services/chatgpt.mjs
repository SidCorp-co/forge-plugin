/* One ChatGPT turn over the search-master backend's `chatgpt` MCP tool: text, a generated image, an
   attached file, or a chat continued by its id. One attempt per invocation and never a second, and
   a failure names `--resume` instead. Past a wait no caller could hold, the turn is handed to a
   detached copy of this CLI and collected later — chatgpt-turns.mjs holds that half, and
   docs/cli/chatgpt.md carries why both are shaped this way. */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { apiBaseOf, clockFor, deadlineOf, deadlineSeconds, MAX_WAIT_SECONDS, parsedOr, ranOut } from "../../wire/request.mjs";
import { sseEvents } from "../../wire/sse.mjs";
import { CHATGPT_PREFIX, chatgptSettings, fail, refusing } from "../../resolve/settings.mjs";
import { firstLine, flags, helpAskedOf, pullRepeated, wantsHelp } from "../../resolve/flags.mjs";
import { didYouMean } from "../../suggest.mjs";
import {
  acknowledged,
  agedFor,
  detachedTurn,
  isSettled,
  markDropped,
  newTurnId,
  promptShown,
  readTurn,
  stateOf,
  sweepTurns,
  turnsWaiting,
  turnAsked,
  waitedFor,
  wasDropped,
  watchForDrop,
  writeTurn,
} from "./chatgpt-turns.mjs";

const FILE_CAP = 10;
const MIN_WAIT_SECONDS = 0.001;
const BODY_CHARS = 400;
const URL_LIKE = /^https?:\/\//u;

/* The shell tool's ten-minute cap, which `forge hooks --how polling` and bash-guard already name as
   the longest a call of its own may wait: past it a caller is asking its own turn to die first. */
const DETACH_ABOVE_SECONDS = 600;

/** One sentence, so a turn given up and a turn that ran out say the same thing about the meter. */
const SPENT = "This turn may have been spent and is not sent again — the tool cannot say whether it ran.";

/** The other half of that honesty: a picture that did not arrive does not make the answer go away. */
const KEPT = "\n  The turn is not sent again — the answer above is already the one it gave.";

export const USAGE = [
  "Usage: forge chatgpt <ask|image|collect|pending> [args]",
  "One turn of ChatGPT from the terminal, over the endpoint this machine has saved. Each action's",
  "own flags: `forge chatgpt <action> -h`.",
  "",
  "  ask       send one turn; past a wait no caller could hold it detaches and hands back an id",
  "  image     one picture, at a shape you state and under the framing this machine saved",
  "  collect   the answer a detached turn came back with, by that id",
  "  pending   the detached turns nobody has read yet, and the flag that gives one up",
].join("\n");

/* Built, not a constant: a deadline written into the text goes stale against `waitSeconds`. */
const askUsage = () => [
  "Usage: forge chatgpt ask \"<prompt>\" [--resume id] [--model slug] [--file path|url]...",
  "                                    [--save path] [--wait s]",
  "Three things one turn is for, and what each costs:",
  "",
  "  an answer     what this session cannot settle for itself, put to another provider — one turn",
  "  a picture     look-and-feel to build toward, never a render of what you built — one turn",
  "  a follow-up   the id every reply prints, given back — the next ask is one turn and not two",
  "",
  "One attempt per call and never a second. A call that fails may still have spent a metered turn:",
  "nothing here can tell, and nothing here sends it again.",
  "",
  "  --resume id    continue that conversation instead of starting one",
  "  --model slug   pass a model through; no default is sent, so the upstream runs its account's",
  "  --file p|url   attach a file, up to 10; a local path is uploaded first, a URL is sent as it is",
  "  --save path    write the bytes of the image the reply names",
  "  --wait s       seconds to hold this one call open, in place of the configured wait",
  "",
  `The wait is ${deadlineSeconds()}s, from waitSeconds in config.json; --wait sets this call's alone.`,
  `Past ${DETACH_ABOVE_SECONDS}s the turn runs without you, and \`forge chatgpt collect\` reads it back.`,
].join("\n");

/* Its own screen rather than five more rows on `ask`: what an image ask requires of a caller is what
   this action exists to state, and `ask -h` is at the cap ISS-1268 set. The flag that saves the
   framing is in backticks, or the parser reads it off this text as a flag of this action. */
const imageUsage = () => [
  `Usage: forge chatgpt image "<prompt>" --ratio w:h [--resume id] [--model slug]`,
  "                                      [--save path] [--wait s]",
  "One picture, one turn: look-and-feel to build toward, never a render of what you built.",
  "",
  "Write the prompt short — the subject and the feeling, then stop. The model elaborates a short",
  "prompt and transcribes a long one, so four hundred words buy a reading of the words themselves.",
  "",
  "The framing every picture is drawn under is saved once and never typed into a prompt:",
  `  \`forge doctor --${CHATGPT_PREFIX.flag} "<${CHATGPT_PREFIX.asks}>"\`, and \`forge doctor\` prints what resolved`,
  "",
  "One attempt per call and never a second. A call that fails may still have spent a metered turn:",
  "nothing here can tell, and nothing here sends it again.",
  "",
  "  --ratio w:h    required; it travels as an instruction of its own, not a clause of the prompt",
  "  --resume id    draw into that conversation, so this picture and the last are one set",
  "  --model slug   pass a model through; no default is sent",
  "  --save path    write the bytes of the image the reply names",
  "  --wait s       seconds to hold this one call open, in place of the configured wait",
  "",
  `The wait is ${deadlineSeconds()}s, from waitSeconds in config.json; --wait sets this call's alone.`,
  `Past ${DETACH_ABOVE_SECONDS}s the turn runs without you, and \`forge chatgpt collect\` reads it back.`,
].join("\n");

const COLLECT_USAGE = [
  "Usage: forge chatgpt collect <id> [--wait s]",
  "The answer a detached turn came back with, read off this machine and costing no turn.",
  "",
  "  --wait s       seconds to wait here for a turn still running, in one call that exits on it",
].join("\n");

const PENDING_USAGE = [
  "Usage: forge chatgpt pending [--drop id]",
  "Every detached turn nobody has read yet, oldest first, with its state and its age.",
  "",
  "  --drop id      give that turn up: its process stops itself and the answer is not collected",
].join("\n");

const RATIO = /^([1-9]\d*):([1-9]\d*)$/u;

/** What continues a turn, per action, printed by the reply's resume line and by a spent turn's recovery line: a second picture of a set wants the ratio the first was drawn at, and a follow-up question wants none. */
const RESUMES_ASK = (id) => `forge chatgpt ask "<next>" --resume ${id}`;
const resumesImage = (ratio) => (id) => `forge chatgpt image "<next>" --ratio ${ratio} --resume ${id}`;

/* Last and alone on its line: a ratio inside the prose is the instruction a generation model most often reads past, which is the thing this action exists to fix. Which spelling lands is not diffable, so docs/cli/chatgpt-image.md carries what was run rather than an argument. */
const ratioSaid = (ratio) => `Aspect ratio: ${ratio}. Render the image at exactly ${ratio} and at no `
  + "other shape — do not crop or pad it to a different one.";

/** The framing first, the caller's words in the middle, the shape last. */
const imageAsk = (prefix, prompt, ratio) => `${prefix}\n\n${prompt}\n\n${ratioSaid(ratio)}`;

/* Both are named whichever of them is missing: a caller told about one, who fixes it and then meets the other, has spent two rounds learning one shape. Neither is defaulted — a default ratio is the square picture nobody asked for, arriving with no sign that a choice was made for them. */
const stating = (prefix, ratio) => {
  if (prefix && ratio) return;
  const lacks = !prefix && !ratio ? "neither" : (prefix ? "no ratio" : "no framing");
  fail(`chatgpt image: a picture is asked for under a framing and at a shape, and this call states ${lacks}.`
    + `\n  framing   ${prefix ? "saved, and every picture is drawn under it"
      : `none saved — \`forge doctor --${CHATGPT_PREFIX.flag} <${CHATGPT_PREFIX.asks}>\`, once, for every picture after it`}`
    + `\n  ratio     ${ratio ? `${ratio}, as this call asked` : "--ratio w:h, and nothing defaults one"}`
    + "\n  Nothing was sent.");
};

const ratioFrom = (given) => {
  if (!RATIO.test(given)) {
    fail(`chatgpt image: --ratio takes two whole numbers above nought with a colon between them, and \`${given}\` is not one.`
      + "\n  Nothing was sent. Ask again with the shape you want: --ratio 16:9, --ratio 9:16, --ratio 1:1.");
  }
  return given;
};

const settingsFor = () => {
  const held = chatgptSettings();
  if (held.missing.length) {
    fail(`chatgpt: no endpoint and key here yet. Set ${held.missing.length === 2 ? "both" : "it"}:\n  `
      + held.missing.map((row) => `forge doctor --${row.flag} <${row.asks}>`).join("\n  "));
  }
  return held;
};

/* Judged on the seconds typed, not on what they round to: the clock counts whole milliseconds, so a wait under one of them is a deadline of nought whose turn is spent before an answer can arrive. */
const waitFrom = (raw, verb, does) => {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < MIN_WAIT_SECONDS) {
    fail(`${verb}: --wait takes a number of seconds, ${MIN_WAIT_SECONDS} at the least, and \`${raw}\` is not one.`
      + `\n  Nothing was sent. Ask again with the seconds ${does}.`);
  }
  return value;
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
const ambiguous = (said, continues = null) => {
  const back = continues ? `\n  The turn may already exist: ${continues}` : "";
  fail(`chatgpt: ${said}\n  ${SPENT}${back}`);
};

/* Answers a problem rather than refusing: the uploads of one turn go together, so the first one to come back badly is not the one a caller wants named, and `fail` would end the process before the rest could be read. The whole request is inside the catch — the signal, the send and the read of the body, since a 200 whose body stalls throws at the read. */
const uploaded = async (base, key, { path, bytes }, deadline, signal) => {
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
      signal: clockFor(deadline, signal),
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

/* Every attachment is read before the first upload leaves: reading inside the loop spends the first file's request before a missing second one is found, and an upload cannot be taken back. Split from the uploading so a detaching call can refuse a path that is not there before any process is spawned. */
const partsOf = (given) => {
  if (given.length > FILE_CAP) fail(`chatgpt: ${given.length} files, and the tool takes ${FILE_CAP}`);
  return given.map((one) => {
    if (URL_LIKE.test(one)) return { url: one };
    try {
      return { path: one, bytes: readFileSync(one) };
    } catch (error) {
      /* Named apart, or an unreadable file that is plainly there reads as a typo in the path. */
      return fail(error.code === "ENOENT"
        ? `chatgpt: no file at ${one}, so nothing was sent`
        : `chatgpt: ${one} could not be read (${error.code ?? error.message}), so nothing was sent`);
    }
  });
};

/* The uploads go together, which is what makes ten files one wait instead of ten; the cost is that every one of them is spent before a refusal among them is reported, and in exchange the message names the earliest file the caller named rather than whichever request answered first. */
const attached = async (parts, held, deadline, signal) => {
  const { base, problem } = parts.some((one) => one.path) ? apiBaseOf(held.url) : {};
  if (problem) fail(`chatgpt: a local file is uploaded to the origin beside the endpoint, and there is ${problem}`);
  const settled = await Promise.all(parts.map((one) =>
    (one.url ? { url: one.url } : uploaded(base, held.key, one, deadline, signal))));
  const refused = settled.find((one) => one.problem);
  if (refused) fail(`chatgpt: ${refused.problem}, so the turn was not sent`);
  return settled.map((one) => one.url);
};

/* The answer is struck like every other backend text: a text part that will not parse becomes the
   answer, exactly where an echoed header arrives, so exempting it held open the path it guarded
   (review 829fc7, F2). The model prints only where the reply carries one, `_meta` having none; the
   account it does carry is the gateway's own rotation, which no caller chooses. And `answers` is the
   empty string on an image turn, so the value decides, not a null test that printed a blank line. */
const reportOf = (out, struck, resumeAs) => {
  const said = out.answers;
  const body = said === null || said === undefined ? ""
    : (typeof said === "string" ? said : JSON.stringify(said, null, 2));
  const lines = body ? [struck(body)] : [];
  if (out.imageUrl) lines.push(`${body ? "\n" : ""}image     ${struck(out.imageUrl)}`);
  if (out.model) lines.push(`model     ${struck(out.model)}`);
  if (out.conversationId) lines.push(`resume    ${resumeAs(struck(out.conversationId))}`);
  return lines;
};

const sent = async ({ prompt, model, resume, parts, save, held, deadline, signal, resumeAs }) => {
  const { struck, shown } = redactorsFor(held.key);
  const continues = (id) => (id ? resumeAs(struck(id)) : null);
  const clock = () => clockFor(deadline, signal);
  const files = await attached(parts, held, deadline, signal);
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

  console.error(`chatgpt: one turn, waiting up to ${deadline.value}s.`);
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
    ambiguous(shown(ranOut(error, deadline)), continues(resume));
  }
  if (!answer.ok) fail(`chatgpt: the backend answered ${answer.status} — ${shown(text)}`);

  const message = answerIn(text, answer.headers.get("content-type") ?? "", id);
  if (!message) ambiguous(`the reply could not be read as this request's answer — ${shown(text)}`, continues(resume));
  const result = message.result ?? {};
  const part = result.content?.find((one) => one.type === "text");
  if (result.isError || message.error) {
    ambiguous(`the tool refused — ${shown(message.error?.message ?? part?.text ?? "no reason given")}`,
      continues(resume ?? result._meta?.conversationId));
  }
  /* Nothing to read is refused rather than printed as an empty answer, and names --resume like any
     other spent turn; text that will not parse is shown as it came (consult 4f91a2, F1). */
  if (typeof part?.text !== "string" || !part.text.trim()) {
    ambiguous(`the reply carried no answer to read — ${shown(text)}`,
      continues(resume ?? result._meta?.conversationId));
  }
  const out = parsedOr(part.text) ?? { answers: part.text };
  const lines = reportOf(out, struck, resumeAs);
  const report = { report: lines.join("\n"), resumeLine: continues(out.conversationId) };
  if (!save || !out.imageUrl) return report;
  /* The status is checked before the write, or a 403's error document lands on the destination under
     a `saved` line and overwrites whatever was there (consult 4f91a2, F3). Every other way this can
     end — a connection that drops, a body that stalls to the deadline, a destination that cannot be
     written — is caught beside it, because the answer is already in hand and the turn that produced
     it is spent whichever of them happens. It is handed back beside the problem rather than thrown
     away with it, and the recovery id is in those very lines (review a9f0, then 4bc7). */
  try {
    const drawn = await fetch(out.imageUrl, { signal: clock() });
    if (!drawn.ok) {
      return { ...report, said: `chatgpt: the image at ${struck(out.imageUrl)} answered ${drawn.status}, `
        + `so ${save} is untouched.${KEPT}` };
    }
    writeFileSync(save, Buffer.from(await drawn.arrayBuffer()));
  } catch (error) {
    return { ...report, said: `chatgpt: the image named by this turn did not reach ${save} — `
      + `${shown(ranOut(error, deadline))}.${KEPT}` };
  }
  return { ...report, report: [...lines, `saved     ${save}`].join("\n") };
};

const printed = (done) => {
  if (done.report) console.log(done.report);
  return done.said ? fail(done.said) : undefined;
};

const ranOutOf = (before, error) => (Date.now() >= before.deadlineAt
  ? `chatgpt: ran out after ${before.waitSeconds}s, which is the wait this turn was submitted under.`
    + `\n  ${SPENT}`
  : error.message);

/* Everything the child does is inside the boundary where `fail` throws: preparing outside it exits on
   a refusal and leaves a record saying `running` that nothing will ever settle (review a9f0, F2). The
   whole of it runs under one signal too, since each request builds its own timer from the same
   seconds and three in a row outlive the deadline the record names (a9f0, F1). The watch on that
   signal is the whole of this turn's stoppability: no pid is ever signalled, here or anywhere. */
const heldFor = async (id, prepare) => {
  const before = writeTurn({ ...readTurn(id), id, pid: process.pid });
  const settle = (fields) => writeTurn({ ...before, ...fields, settledAt: Date.now() });
  const stop = new AbortController();
  const unwatch = watchForDrop(id, () => stop.abort());
  const ends = setTimeout(() => stop.abort(), Math.max(1, before.deadlineAt - Date.now()));
  try {
    const done = await refusing(() => {
      /* The composition too, and not only the send: what the child reads off the configuration may
         have moved since the parent read it, and a refusal outside this boundary is the record left
         running that the paragraph above is about. */
      const asked = prepare();
      return sent({ ...asked, held: settingsFor(), parts: partsOf(asked.given),
        deadline: deadlineOf(asked.asked), signal: stop.signal });
    });
    if (!wasDropped(id)) settle({ ...done, state: done.said ? "failed" : "answered" });
  } catch (error) {
    if (!wasDropped(id)) settle({ state: "failed", said: ranOutOf(before, error) });
  } finally {
    clearTimeout(ends);
    unwatch();
    if (wasDropped(id)) settle({ state: "dropped" });
  }
};

const detaching = (action, rest, shown, deadline) => {
  sweepTurns();
  const id = newTurnId();
  const now = Date.now();
  writeTurn({
    id,
    prompt: promptShown(shown),
    submittedAt: now,
    waitSeconds: deadline.value,
    deadlineAt: now + deadline.millis,
    pid: null,
    state: "running",
  });
  detachedTurn(action, rest, id);
  console.error(`chatgpt: ${deadline.value}s is longer than one call may hold, so this turn runs without you.`);
  console.log(`turn      ${id}`);
  console.log(`collect   forge chatgpt collect ${id}`);
};

/* The half of an action that is not its own parsing: whether this process is the detached child,
   whether the wait in force detaches, and the one send. Two actions reach it because they differ in
   what they ask of a caller and in what reaches the model, never in how a turn is spent. */
const turned = async (action, argv, prepare) => {
  const turn = turnAsked();
  if (turn) return await heldFor(turn, prepare);

  const asked = prepare();
  const held = settingsFor();
  const deadline = deadlineOf(asked.asked);
  /* Before the uploads, which already run under it: a caller told after them has spent the clamped deadline once without ever learning the number it asked for was not the one in force. */
  if (asked.asked !== null && asked.asked > MAX_WAIT_SECONDS) {
    console.error(`chatgpt: ${asked.asked}s is past the longest a timer here holds, so this turn waits ${deadline.value}s.`);
  }
  const parts = partsOf(asked.given);
  /* The wait in force and not the one typed: a machine whose configured wait is an hour holds a run
     open for an hour, which is the very thing this closes, and it never typed a flag to do it. */
  if (deadline.value > DETACH_ABOVE_SECONDS) return detaching(action, argv, asked.shown, deadline);
  return printed(await sent({ ...asked, parts, held, deadline, signal: null }));
};

/* The prompt is a subject, not a flag's value, so it comes off before the parser, which refuses a
   bare word. A flag standing in its place is two mistakes at once, so the flags are judged first —
   or a mistyped one is never named and reads as a missing prompt. */
const promptIn = (argv, verb, usage, judged) => {
  const [prompt] = argv;
  if (prompt.startsWith("--")) judged();
  if (prompt.startsWith("--") || !prompt.trim()) {
    fail(`chatgpt: the prompt comes first, before any flag.\n${firstLine(usage)}`);
  }
  return prompt;
};

const ask = async (argv) => {
  const said = askUsage();
  if (wantsHelp(argv) || argv.length === 0) return console.log(said);
  const row = { usage: said, modes: otherCalls("ask") };
  const prompt = promptIn(argv, "chatgpt ask", said, () =>
    flags(pullRepeated(argv, "--file", "chatgpt ask", row).rest, "chatgpt ask", [], row));
  const { values: given, rest } = pullRepeated(argv.slice(1), "--file", "chatgpt ask", row);
  const { resume, model, save, wait } = flags(rest, "chatgpt ask", [], row);
  const asked = waitFrom(wait, "chatgpt ask", "this one turn may hold the connection open for");
  return await turned("ask", argv, () => ({ prompt, shown: prompt, model, resume, given, save, asked,
    resumeAs: RESUMES_ASK }));
};

/* Refused before the endpoint is even read: what this action asks of a caller is the caller's own to
   fix, and a turn is never spent learning it. */
const image = async (argv) => {
  const said = imageUsage();
  if (wantsHelp(argv) || argv.length === 0) return console.log(said);
  const row = { usage: said, modes: otherCalls("image") };
  const prompt = promptIn(argv, "chatgpt image", said, () => flags(argv, "chatgpt image", [], row));
  const { ratio, resume, model, save, wait } = flags(argv.slice(1), "chatgpt image", [], row);
  const asked = waitFrom(wait, "chatgpt image", "this one turn may hold the connection open for");
  return await turned("image", argv, () => {
    const { prefix } = chatgptSettings();
    stating(prefix, ratio);
    const shape = ratioFrom(ratio);
    return { prompt: imageAsk(prefix, prompt, shape), shown: prompt, model, resume, given: [], save,
      asked, resumeAs: resumesImage(shape) };
  });
};

const collected = (id, record, state) => {
  /* Rendered where the action was known and kept in the record, because a picture given up hours
     later is continued by another picture and not by a question. A record outlives the release that
     wrote it, so one carrying the bare id instead is read as what only `ask` could have written. */
  const continues = record.resumeLine
    ?? (record.conversationId ? RESUMES_ASK(record.conversationId) : null);
  if (state === "dropped") {
    ambiguous(`turn ${id} was given up before it answered`, continues);
  }
  if (state === "abandoned") {
    writeTurn({ ...record, state: "failed", said: `chatgpt: turn ${id} stopped without answering`,
      collectedAt: Date.now() });
    ambiguous(`turn ${id} stopped without answering — its process is gone and its wait has passed`, continues);
  }
  writeTurn({ ...record, collectedAt: Date.now() });
  if (record.report) console.log(record.report);
  /* Nobody watched this one fail, so the meter line is owed even where the blocking path had a
     status code to show instead: a collected failure establishes exactly what a blocking one does. */
  if (state === "failed") fail(record.said.includes(SPENT) ? record.said : `${record.said}\n  ${SPENT}`);
  return undefined;
};

const collect = async (argv) => {
  if (wantsHelp(argv) || argv.length === 0) return console.log(COLLECT_USAGE);
  const [id, ...rest] = argv;
  if (id.startsWith("--")) fail(`chatgpt collect: the turn's id comes first.\n${firstLine(COLLECT_USAGE)}`);
  const { wait } = flags(rest, "chatgpt collect", [], { usage: COLLECT_USAGE, modes: otherCalls("collect") });
  const asked = waitFrom(wait, "chatgpt collect", "this call may wait here for a turn still running");
  const found = readTurn(id);
  if (!found?.id) {
    fail(`chatgpt: no turn here called ${id}. What is waiting: forge chatgpt pending`);
  }
  const record = (asked !== null && !isSettled(stateOf(found, id)) ? await waitedFor(id, asked) : found) ?? found;
  const state = stateOf(record, id);
  if (state === "running") {
    fail(`chatgpt: turn ${id} is still running, ${agedFor(Date.now() - record.submittedAt)} in, and has nothing to read yet.`
      + `\n  Wait here for it in one call: forge chatgpt collect ${id} --wait <s>`);
  }
  return collected(id, record, state);
};

const dropping = async (id) => {
  const record = readTurn(id);
  if (!record?.id) fail(`chatgpt: no turn here called ${id}. What is waiting: forge chatgpt pending`);
  if (wasDropped(id)) fail(`chatgpt: turn ${id} was already given up.`);
  const state = stateOf(record, id);
  markDropped(id);
  if (state !== "running") {
    return console.log(`chatgpt: turn ${id} is given up; it was ${state} and no process was left to tell.\n  ${SPENT}`);
  }
  const heard = await acknowledged(id);
  return console.log(heard
    ? `chatgpt: turn ${id} is given up and its own process has stopped.\n  ${SPENT}`
    : `chatgpt: turn ${id} is given up, and its process has not said so within the time this waits.`
      + `\n  Nothing here signals one, so it stops itself or it was already gone.\n  ${SPENT}`);
};

const pending = async (argv) => {
  if (wantsHelp(argv)) return console.log(PENDING_USAGE);
  const { drop } = flags(argv, "chatgpt pending", [], { usage: PENDING_USAGE, modes: otherCalls("pending") });
  sweepTurns();
  if (drop) return await dropping(drop);
  const waiting = turnsWaiting();
  if (!waiting.length) return console.log("no detached turn is waiting");
  const now = Date.now();
  for (const one of waiting) {
    console.log(`${one.id}  ${one.state.padEnd(9)} ${agedFor(now - one.submittedAt).padStart(5)}  ${one.prompt}`);
  }
  return undefined;
};

const otherCalls = (action) => Object.entries(SAYS).filter(([name]) => name !== action).map(([, text]) => text);

const SUBS = { ask, image, collect, pending };

export const SAYS = {
  get ask() {
    return askUsage();
  },
  get image() {
    return imageUsage();
  },
  collect: COLLECT_USAGE,
  pending: PENDING_USAGE,
};

export const chatgpt = async ([sub, ...rest]) => {
  const help = helpAskedOf([sub, ...rest], Object.keys(SUBS));
  if (help) {
    console.log(help.subject ? SAYS[help.subject] : USAGE);
    process.exit(0);
  }
  if (!sub || !Object.hasOwn(SUBS, sub)) {
    if (sub) console.error(didYouMean("chatgpt action", sub, Object.keys(SUBS)));
    console.error(USAGE);
    process.exit(1);
  }
  await SUBS[sub](rest);
};

/* Or the CLI answers `-h` off the verb table, and the one attempt, the cap and the deadline in force are all missing from what a caller reads. */
chatgpt.answersHelp = true;
