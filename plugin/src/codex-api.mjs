/* The call itself: what GPT-5 Codex is asked, what it may do for itself, and the streamed answer.
   HTTPS POSTs to the gateway named in ~/.claude/claude-proxy.env, which answers with real `tool_use`
   blocks — so the changed files travel with the prompt and anything else the reviewer needs it reads
   through codex-tools.mjs. docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { gitRootOf } from "./codex-tools.mjs";
import { userConfig } from "./resolve/config.mjs";

const PROFILE_PATH = process.env.CLAUDE_PROXY_ENV || join(homedir(), ".claude", "claude-proxy.env");
export const MODEL = userConfig().codex?.model || "fable";
const MAX_TOKENS = Number(userConfig().codex?.maxTokens || 32_000);
/* Accepted by the gateway and not observable from here: the same puzzle answers the same at high and
   at minimal, in the same seconds. Sent because the slot is the account's to configure. */
const EFFORT = userConfig().codex?.effort || "high";

/* A file is sent whole or reported as clipped; a silently halved file is a review of half a file. */
const FILE_CHARS = 80_000;
const TOTAL_CHARS = 320_000;
const ERROR_CHARS = 400;
const HASH_CHARS = 12;

const ROLE = `You are CODEX for this repository: a second model, on a different provider, reviewing work a coding agent has just done.

Reply as a board of four:
- Tech Lead — feasibility, architectural consistency, hidden coupling, what this forces or breaks downstream.
- Business Analyst — missing rules, contradictions, ambiguity, behaviour asserted without a source, untestable criteria.
- End User — whether this serves the person actually doing the job; steps that confuse, cases nobody accounted for.
- UI/UX — screens, flows, empty/error/loading states, information architecture, accessibility. If nothing describes an interface, say so rather than inventing one.

FORM
- Where you were given a list to verify, answer it FIRST — every item, with its verdict — and only then the findings line. A verification list is never skipped, whatever you found.
- Open the findings with exactly one line: \`CODEX: <n> findings (<b> blocker, <m> major, <k> minor)\`, counting what you are about to write. Where you find nothing, that line is \`CODEX: 0 findings\` and you stop there.
- Anchor every finding to \`path:line\` — the path as you were given it, the line as numbered in the text you were given. A finding you cannot place is a finding you cannot ground.

RULES
- You are given the full text of each changed file. Ground every finding in a quotation from what you were given, or in something you read with a tool.
- You have tools over the checkouts under review: \`read_file\`, \`list_dir\`, \`grep\`, \`git_diff\`. Use them whenever a finding depends on something you were not given — the caller, the test, the config, the other end of an interface. Never guess at a file you could read, and never assert what a symbol does without seeing it. A citation you could not check is a finding you do not make. Tools are read-only and confined to those checkouts; a refusal comes back as text and is not worth arguing with.
- You are given the coding agent's intent. Judge the work against that intent as well as against the repository's own rules, and say so plainly where the two disagree.
- Severity: blocker, major, minor. At most 4 findings per angle. An angle with nothing real to add writes "nothing material".
- Earlier consults on this repository are quoted above where there are any. On a file you have seen before, report Resolved / Still open / New, and never repeat an argument you already made.
- The coding agent will push back with context you cannot see. Weigh it honestly: concede when it is right, hold when it is not, and give the better reason either way.
- Where you are given a diff, the diff is what is under review. Context you were given for reading is not the subject.
- Terse. No preamble, no praise, no summary of what the file already says.`;

const ENV_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

const unquoted = (raw) => {
  const value = raw.trim();
  const quote = value[0];
  const paired = (quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1;
  return paired ? value.slice(1, -1) : value;
};

export const profileFrom = (text) => {
  const found = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const matched = ENV_LINE.exec(line);
    if (matched) found[matched[1]] = unquoted(matched[2]);
  }
  return found;
};

export const profile = () => {
  if (!existsSync(PROFILE_PATH)) return { path: PROFILE_PATH, problem: `no gateway profile at ${PROFILE_PATH}` };
  const values = profileFrom(readFileSync(PROFILE_PATH, "utf8"));
  for (const key of ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"]) {
    if (!values[key]) return { path: PROFILE_PATH, problem: `${key} is missing from ${PROFILE_PATH}`, values };
  }
  return { path: PROFILE_PATH, values };
};

/* The slot is what gets asked for; the profile decides which model that is, and that mapping is the
   whole reason this verb is a second opinion rather than an echo. */
export const modelBehind = (values, slot = MODEL) =>
  values?.[`ANTHROPIC_DEFAULT_${slot.toUpperCase()}_MODEL`] ?? null;

export const sameFamily = (model) => Boolean(model) && /claude/i.test(model);

/* Containment is physical, not lexical: `..` is only the traversal you can see, and a symlink
   committed inside the repository resolves to anywhere its author liked. Every path is realpath'd
   and checked against the realpath'd root, and anything that is not a regular file is refused. */
const resolvedInside = (root, path) => {
  let base;
  let real;
  try {
    base = realpathSync(root);
    real = realpathSync(resolve(root, path));
  } catch {
    return null;
  }
  if (real !== base && !real.startsWith(base + sep)) return null;
  try {
    if (!statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  return { rel: relative(base, real).split(sep).join("/"), real };
};

export const inside = (root, path) => resolvedInside(root, path)?.rel ?? null;

/** A file to review, named as this repository sees it or as an absolute path in another checkout —
 *  the account configures one reviewer, so a caller may point it at a sibling project. What the
 *  MODEL may then read for itself is a narrower question: codex-tools.mjs. */
export const locate = (root, given) => {
  const held = resolvedInside(root, given);
  if (held) return held;
  if (!isAbsolute(given)) return null;
  try {
    const real = realpathSync(given);
    return statSync(real).isFile() ? { rel: real, real } : null;
  } catch {
    return null;
  }
};

/* The canonical root, so one checkout reached by two symlinked paths is one key in the state file
   and one history in the log rather than two. */
export const canonical = (root) => {
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
};

export const digest = (text) => createHash("sha256").update(text).digest("hex").slice(0, HASH_CHARS);

/* Clipped is stated, never silent: a reviewer told it has the whole file will reason about an
   ending that was cut off. The hash is what lets an eval know which bytes were judged. */
export const bundle = (root, rels) => {
  const parts = [];
  let budget = TOTAL_CHARS;
  for (const rel of rels) {
    /* Re-validated at read time and read by its canonical path: the check and the read are still
       two operations, so a checkout mutated between them is a race this narrows and does not close. */
    const held = locate(root, rel);
    if (!held) {
      parts.push({ rel, missing: "not a readable file" });
      continue;
    }
    let text;
    try {
      text = readFileSync(held.real, "utf8");
    } catch (error) {
      parts.push({ rel, missing: error.code ?? "unreadable" });
      continue;
    }
    const room = Math.min(FILE_CHARS, budget);
    const clipped = text.length > room;
    budget -= Math.min(text.length, room);
    parts.push({
      rel,
      text: clipped ? text.slice(0, room) : text,
      clipped,
      chars: text.length,
      sha: digest(text),
    });
  }
  return parts;
};

const DIFF_CHARS = 20_000;

/* What changed, so a finding can be anchored to it. Untracked files answer with nothing and are
   labelled new: the whole text is the change. */
const changedIn = (root, rel, base) => {
  /* An outside file is diffed in its own checkout, which is the only one that knows the ref. */
  const own = isAbsolute(rel) ? gitRootOf(rel) : root;
  if (!own) return { untracked: true };
  const asked = isAbsolute(rel) ? relative(own, rel) : rel;
  const diff = spawnSync("git", ["diff", "--no-color", base, "--", asked], { cwd: own, encoding: "utf8" });
  if (diff.status !== 0) return { error: (diff.stderr ?? "").trim().slice(0, 200) || "git diff failed" };
  const text = (diff.stdout ?? "").trim();
  if (text) return { text: text.slice(0, DIFF_CHARS), clipped: text.length > DIFF_CHARS };
  const known = spawnSync("git", ["ls-files", "--error-unmatch", "--", asked], { cwd: own, encoding: "utf8" });
  return known.status === 0 ? { unchanged: true } : { untracked: true };
};

export const withDiffs = (root, parts, base) =>
  parts.map((part) => (part.missing ? part : { ...part, diff: changedIn(root, part.rel, base) }));

const diffBlock = (diff) => {
  if (!diff) return "";
  if (diff.untracked) return "\nNEW FILE — every line of it is this turn's change.\n";
  if (diff.unchanged) return "\nUNCHANGED this turn — context only. Do not review it.\n";
  if (diff.error) return `\n(the diff could not be taken: ${diff.error})\n`;
  const note = diff.clipped ? " — CLIPPED" : "";
  return `\nCHANGED THIS TURN${note}:\n\`\`\`diff\n${diff.text}\n\`\`\`\n`;
};

const fileBlock = (part) => {
  if (part.missing) return `### ${part.rel}\n(could not be read: ${part.missing})`;
  const note = part.clipped ? ` — CLIPPED, ${part.chars} chars in the file, first part only` : "";
  return `### ${part.rel}${note}${diffBlock(part.diff)}\nFULL TEXT, for context:\n\`\`\`\n${part.text}\n\`\`\``;
};

const ANCHORED = `ANCHOR EVERY FINDING TO THIS TURN'S CHANGE.
A file marked CHANGED THIS TURN carries its own diff; a file marked UNCHANGED is context and is not under review. A finding must be about a changed line, or about how unchanged code now breaks BECAUSE of one. Anything true of the code before this turn goes in a single closing section headed PRE-EXISTING, at most three lines, unqualified by severity.`;

const verifyBlock = (risks) =>
  `VERIFY THESE, and lead with them. For each, answer CONFIRMED, REFUTED or CANNOT TELL, and quote the
line that decides it. A risk you cannot decide from what you were given is CANNOT TELL and says what
you would need. Only after all of them, add anything else you found.\n\n${risks.map((one, at) => `${at + 1}. ${one}`).join("\n")}`;

const floorBlock = (only) =>
  `REPORT ONLY ${only.map((one) => one.toUpperCase()).join(" and ")} FINDINGS. A finding below that bar is left out `
  + `entirely rather than downgraded — this run is asking for precision, not coverage.`;

export const promptFor = (intent, parts, history = [], { risks = [], only = [] } = {}) => {
  /* Derived, not passed: a caller that says "anchored" while sending no diffs would be asking the
     reviewer to anchor to nothing. */
  const anchored = parts.some((part) => part.diff);
  const earlier = history.length
    ? [
        "WHAT YOU TOLD ME BEFORE, in this repository, oldest first. Where an intent is quoted it is",
        "the one you were judging then.",
        ...history.map((one) => {
          const scored = one.verdict ? `\n\nWHAT I THEN DID WITH IT: ${one.verdict}` : "";
          return `--- ${one.at} on ${one.files.join(", ")} ---\nMY INTENT THEN: ${one.intent}\n\nYOU SAID:\n${one.reply}${scored}`;
        }),
      ].join("\n\n")
    : null;
  const closing = risks.length
    ? "Answer the verification list first, as the four angles where an angle has something to add."
    : "Review these as the four angles, against my stated intent as well as this repository's own rules.";
  return [
    ...(earlier ? [earlier] : []),
    intent
      ? `WHAT I WAS DOING THIS TURN — my intent and plan, in my own words:\n\n${intent}`
      : "I have not described my intent. Say so if a finding turns on it.",
    ...(risks.length ? [verifyBlock(risks)] : []),
    ...(anchored ? [ANCHORED] : []),
    ...(only.length ? [floorBlock(only)] : []),
    `THE FILES — ${parts.length} of them:\n\n${parts.map(fileBlock).join("\n\n")}`,
    closing,
  ].join("\n\n---\n\n");
};

const frameEvent = (frame) => {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data || data === "[DONE]") return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/* Streamed because a reply is written over a minute and more, and a caller staring at a blank
   terminal cannot tell a slow review from a hung one. The deltas are handed out as they land; the
   whole text is still returned, because the log wants the answer and not the frames. */
const FRAME_END = /\r?\n\r?\n/;

export const consume = async (body, onDelta) => {
  const decoder = new TextDecoder();
  let buffered = "";
  let text = "";
  let usage = null;
  let stop = null;
  let thought = 0;
  const open = new Map();
  const calls = [];
  const absorb = (frame) => {
    const event = frameEvent(frame);
    if (!event) return;
    if (event.type === "error") {
      throw new Error(`gateway streamed an error: ${JSON.stringify(event.error).slice(0, ERROR_CHARS)}`);
    }
    if (event.type === "message_start") usage = event.message?.usage ?? usage;
    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
      open.set(event.index, { id: event.content_block.id, name: event.content_block.name, json: "" });
    }
    if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
      const held = open.get(event.index);
      if (held) held.json += event.delta.partial_json ?? "";
    }
    if (event.type === "content_block_stop" && open.has(event.index)) {
      const held = open.get(event.index);
      open.delete(event.index);
      calls.push({ id: held.id, name: held.name, input: parsedInput(held.json) });
    }
    /* Thinking is counted, not shown: the reviewer's reasoning is not the review, and the terminal
       is where the review goes. The count is what tells a reader where the tokens went. */
    if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta") {
      thought += (event.delta.thinking ?? "").length;
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      text += event.delta.text;
      onDelta(event.delta.text);
    }
    if (event.type === "message_delta") {
      stop = event.delta?.stop_reason ?? stop;
      usage = { ...usage, ...event.usage };
    }
  };
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    const frames = buffered.split(FRAME_END);
    buffered = frames.pop() ?? "";
    for (const frame of frames) absorb(frame);
  }
  /* The decoder is flushed and the tail is absorbed: a stream whose last frame arrives without a
     blank line after it would otherwise be dropped, and it is the frame carrying stop_reason. */
  buffered += decoder.decode();
  for (const frame of buffered.split(FRAME_END)) absorb(frame);
  return { text: text.trim(), usage, stop, calls, thought };
};

/** A tool call whose arguments did not arrive whole is answered as one that asked for nothing, so
 *  the executor refuses it in words rather than the loop throwing. */
const parsedInput = (json) => {
  try {
    return json.trim() ? JSON.parse(json) : {};
  } catch {
    return {};
  }
};

export const askApi = async (values, model, messages, { onDelta = () => {}, signal, tools } = {}) => {
  const answer = await fetch(`${values.ANTHROPIC_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "anthropic-version": "2023-06-01",
      "x-api-key": values.ANTHROPIC_AUTH_TOKEN,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: ROLE,
      stream: true,
      messages,
      reasoning_effort: EFFORT,
      ...(tools?.length ? { tools } : {}),
    }),
    signal,
  });
  if (!answer.ok) {
    const body = await answer.text();
    throw new Error(`gateway answered ${answer.status}: ${body.slice(0, ERROR_CHARS)}`);
  }
  const held = await consume(answer.body, onDelta);
  if (!held.text && !held.calls.length) throw new Error("the gateway streamed no text at all");
  return held;
};
