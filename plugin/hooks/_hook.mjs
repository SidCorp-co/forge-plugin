// What every hook here needs: the event, the files a call wrote, the two ways to answer, and the
// once-per-file-per-session stamp. Why write detection asks the disk, not the shell: docs/HOOKS.md.

import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { logHook, scrubbed } from "../src/hook-log.mjs";
import { hookOff } from "../src/hook-switch.mjs";

const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
const FRESH_MS = 120_000;

let event = {};

export function readEvent() {
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  /* Switched off before anything is decided, in the one place every hook already calls. */
  if (hookOff(basename(process.argv[1] ?? "", ".mjs"))) process.exit(0);
  return event;
}

/* Refusals are the only entries: they are what a false positive looks like from outside. */
const record = (decision, reason) => {
  const ti = event.tool_input ?? {};
  logHook({
    at: new Date().toISOString(),
    hook: basename(process.argv[1] ?? "", ".mjs"),
    decision,
    tool: event.tool_name ?? "",
    session: event.session_id ?? "",
    target: scrubbed(ti.file_path ?? ti.notebook_path ?? ti.command ?? ""),
    reason: scrubbed(String(reason).split("\n")[0]),
  });
};

export function touched(ev, freshMs = FRESH_MS) {
  const ti = ev.tool_input ?? {};
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(ev.tool_name)) {
    const p = ti.file_path ?? ti.notebook_path;
    if (!p) return [];
    try {
      return [realpathSync(p)];
    } catch {
      return [resolve(p)];
    }
  }
  if (ev.tool_name !== "Bash") return [];

  const cwd = ev.cwd || process.cwd();
  const now = Date.now();
  const out = new Set();
  for (const token of String(ti.command ?? "").match(TOKEN) ?? []) {
    for (const cand of [token, join(cwd, token)]) {
      try {
        const st = statSync(cand);
        if (st.isFile() && now - st.mtimeMs <= freshMs) {
          out.add(realpathSync(cand));
          break;
        }
      } catch {
        /* not a file */
      }
    }
  }
  return [...out].sort();
}

/** The paths a call spelled, resolved but not followed: `touched` answers with what a name points at,
 *  and a link is a different question from its target. */
export const named = (ev) => {
  const ti = ev.tool_input ?? {};
  const cwd = ev.cwd || process.cwd();
  const found =
    ev.tool_name === "Bash"
      ? (String(ti.command ?? "").match(TOKEN) ?? [])
      : [ti.file_path ?? ti.notebook_path ?? ""].filter(Boolean);
  return found.map((one) => resolve(cwd, one));
};

export function deny(reason) {
  record("deny", reason);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

/** Where the argument for a rule lives. What a refusal prints costs context on every tool use, so
 *  it carries the shape and the action and ends with this. The name derives from the script. */
export const how = () => `\n\nHow: \`forge hooks --how ${basename(process.argv[1] ?? "", ".mjs")}\``;

export function block(reason) {
  record("block", reason);
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

/** One name for one file, existing or not: two spellings of it stamp twice, once per half of a gate. */
export const settled = (path) => {
  const full = resolve(path);
  try {
    return realpathSync(full);
  } catch {
    /* Not there yet: the directory is as far as a name settles. */
  }
  try {
    return join(realpathSync(dirname(full)), basename(full));
  } catch {
    return full;
  }
};

/** A file edit has no field to hold an acknowledgement, and forcing one into the content would
 *  write this gate's bookkeeping into the file it guards. So the answer is that the question was
 *  put — recorded outside the file, once per session. */
export function askedAlready(ev, path, kind, { set = true } = {}) {
  const key = createHash("sha1")
    .update(`${ev.session_id ?? ""}\0${path}`)
    .digest("hex")
    .slice(0, 16);
  const stamp = join(tmpdir(), `${kind}-${key}`);
  try {
    statSync(stamp);
    return true;
  } catch {
    /* first time */
  }
  if (!set) return false;
  try {
    writeFileSync(stamp, "");
  } catch {
    /* a stamp we cannot write means we ask again; that is the safe direction */
  }
  return false;
}

/** No hook fires for the advisor, but every call leaves an `advisor_tool_result` in the transcript. */
const blocksOf = (record) => {
  const content = (record?.message ?? {}).content;
  return Array.isArray(content) ? content.filter((one) => one && typeof one === "object") : [];
};

/** Where a heredoc body is a program rather than data. how/learning-gate.md. */
export const EXECUTES_STDIN =
  /(?:^|[\s;&|(])(?:python3?|node|deno|bun|perl|ruby|php|sh|bash|zsh)(?:\s+-\S+)*\s*-?\s*$/u;

/** A redirect is judged by its target: `2>&1` writes nothing, and one holding a `$(…)` holds spaces. */
export const REDIRECT = new RegExp(
  String.raw`(?:^|[\s;&|(])\d?>>?\s*(?!&\d)("[^"]*"|'[^']*'|\$\([^)]*\)[^\s;&|<>]*|[^\s;&|<>]+)`,
  "gu",
);

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/u;

/** A heredoc body is data; `onProgram` reads one an interpreter executes. how/learning-gate.md. */
export const bodiless = (text, onProgram = (body) => body) => {
  let out = "";
  let rest = text;
  for (let m = HEREDOC.exec(rest); m; m = HEREDOC.exec(rest)) {
    const after = m.index + m[0].length;
    const nl = rest.indexOf("\n", after);
    if (nl < 0) return `${out}${rest.slice(0, m.index)} ${rest.slice(after)}`;
    const line = rest.slice(0, m.index);
    out += `${line} ${rest.slice(after, nl + 1)}`;
    rest = rest.slice(nl + 1);
    const end = new RegExp(`^[ \\t]*${m[2]}[ \\t]*$`, "mu").exec(rest);
    if (EXECUTES_STDIN.test(line)) out += onProgram(end ? rest.slice(0, end.index) : rest);
    rest = end ? rest.slice(end.index + end[0].length) : "";
  }
  return out + rest;
};

/* Where a command starts. `xargs` keeps its own flags, because `xargs -I{} sh` still runs the shell;
   the others do not, since every flag allowed widens what a quoted mention can look like. */
const STARTS = String.raw`(?:^|[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+|\bxargs\s+(?:-\S+\s+)*`
  + String.raw`|\b(?:sudo|command|nohup|time|env|do|then|else|if|elif|while|until)\s+)`;

/** Verbs count where a command starts, a library call anywhere, and only with a target it names. */
export const WRITES = new RegExp(
  STARTS
    + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)`
    + String.raw`|(?:tee|cp|mv|truncate|touch|install|rsync)\b`
    + String.raw`|dd\b[^|;]*\bof=|curl\b[^|;]*\s(?:-o|--output)\b|wget\b[^|;]*\s(?:-O|--output-document)\b)`
    + String.raw`|open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
    + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
    + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`,
);

/** A shell runs a `-c` body, so a verb in it is in command position, not a quoted argument. Promoting
 *  one leaves a body inside it still quoted, so the promotion runs to a fixed point. */
const WRAPPED = new RegExp(
  STARTS + String.raw`(?:busybox\s+)?(?:sh|bash|zsh|dash|ksh)\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*c\s+("[^"]*"|'[^']*')`,
  "gu",
);
export const unwrapped = (text) => {
  let out = text;
  for (let hop = 0; hop < HOPS; hop += 1) {
    const next = out.replace(WRAPPED, (all, body) => `; ${body.slice(1, -1)} ;`);
    if (next === out) break;
    out = next;
  }
  return out;
};

/** The commands in a line, so a write answers for what it was handed rather than for the whole line.
 *  A quoted body is never cut: a program's own `;` is not a boundary. Nor is a pipe, which hands the
 *  next command its arguments. An unclosed quote runs to the end, joining commands rather than
 *  splitting them, so a line that cannot be read stays one target for every verb in it. */
export const commands = (text) => {
  const out = [];
  let held = "";
  let quote = "";
  for (let at = 0; at < text.length; at += 1) {
    const one = text[at];
    held += one;
    if (quote) {
      if (one === quote) quote = "";
      continue;
    }
    if (one === '"' || one === "'") {
      quote = one;
      continue;
    }
    const pair = text.slice(at, at + 2);
    if (one === ";" || one === "\n" || one === "&" || pair === "||") {
      out.push(held.slice(0, -1));
      held = "";
      if (pair === "&&" || pair === "||") at += 1;
    }
  }
  out.push(held);
  return out.map((one) => one.trim()).filter(Boolean);
};

/** The one text every write test reads: values resolved, a data heredoc dropped, a `-c` body run. */
export const shellText = (command, onProgram) =>
  unwrapped(bodiless(expanded(String(command ?? "")), onProgram));

/** Whether a call writes: a target for the file tools, a verb or a redirect for the shell, and one
 *  under `/dev/` writes nothing. how/writes.md. */
export function writing(ev) {
  const ti = ev.tool_input ?? {};
  if (ev.tool_name !== "Bash") return Boolean(ti.file_path ?? ti.notebook_path);
  const command = shellText(ti.command);
  return (
    WRITES.test(command)
    || [...command.matchAll(REDIRECT)].some((one) => !/^\/dev\//u.test(one[1].replace(/['"]/gu, "")))
  );
}

/** Lexical: the file may not exist yet, and a relative target resolves against the cwd. */
const under = (root, cwd, path) => {
  let base;
  try {
    base = realpathSync(root);
  } catch {
    return true;
  }
  const full = resolve(cwd || root, path.replace(/^~(?=\/|$)/u, homedir()));
  return full === base || full.startsWith(base + sep);
};

const VALUE = String.raw`"[^"]*"|'[^']*'|\$\([^)]*\)|` + "`[^`]*`" + String.raw`|[^\s;&|]*`;
const ASSIGN = new RegExp(
  String.raw`(?<=^|[;&|(){\n]\s*|\b(?:export|env|sudo|command|nohup|time)\s+|=(?:${VALUE})\s+)`
    + String.raw`([A-Za-z_]\w*)=(${VALUE})`,
  "gu",
);
const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

const NAMED = /\$(?:\{([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*))/gu;
const HOPS = 3;

/** `H=/tmp/d` then `> $H/x` names the directory in no token, so a value is substituted first — what
 *  a shell would set only, since a phantom from quoted data answers for a name that is unset. A use
 *  takes the assignment before it, a hop is followed, a modifier dropped, and a `$(…)` carried whole
 *  as text: what it returns is unknown, but a directory it spells out is one the write reaches. */
export const expanded = (command) => {
  const set = [];
  for (const one of command.matchAll(ASSIGN)) {
    set.push({ at: one.index, name: one[1], value: unquote(one[2]) });
  }
  const resolve = (name, at) => set.filter((one) => one.name === name && one.at < at).pop()?.value;
  const substitute = (text, at) =>
    text.replace(NAMED, (whole, braced, bare) => resolve(braced ?? bare, at) ?? whole);
  for (let hop = 0; hop < HOPS; hop += 1) {
    for (const one of set) one.value = substitute(one.value, one.at);
  }
  return command.replace(NAMED, (whole, braced, bare, at) => resolve(braced ?? bare, at) ?? whole);
};

/** Whether the write is work in `root`. A write verb names no readable target so it answers true —
 *  a wall that stands down on doubt is not a wall. A redirect does: how/writes.md. */
export function writesInside(ev, root) {
  if (!root) return true;
  const ti = ev.tool_input ?? {};
  if (ev.tool_name !== "Bash") {
    const path = ti.file_path ?? ti.notebook_path;
    return !path || under(root, ev.cwd, path);
  }
  const command = bodiless(expanded(String(ti.command ?? "")));
  if (WRITES.test(command)) return true;
  const aimed = [...command.matchAll(REDIRECT)]
    .map((one) => one[1].replace(/['"]/gu, ""))
    .filter((path) => !/^\/dev\//u.test(path));
  return aimed.length === 0 || aimed.some((path) => under(root, ev.cwd, path));
}

/** When the advisor last spoke, in epoch ms; 0 if it never has. */
export const adviceAt = (records) =>
  records.reduce(
    (latest, record) =>
      blocksOf(record).some((one) => one.type === "advisor_tool_result")
        ? Math.max(latest, Date.parse(record.timestamp) || 0)
        : latest,
    0,
  );

/** Where this turn begins: only a user record carrying `promptSource` is a prompt somebody typed. */
export const promptIndex = (records) => {
  let from = -1;
  for (let at = 0; at < records.length; at += 1) {
    if (records[at]?.type === "user" && typeof records[at].promptSource === "string") from = at;
  }
  return from;
};

export const turnAt = (records) => records[promptIndex(records)]?.timestamp ?? "";

/** Whether the advisor has spoken since the last prompt. how/codex-second.md. */
export function advisedThisTurn(records) {
  return unspentAdvice(records.slice(promptIndex(records) + 1));
}

/** Advice is spent by the consult that follows it, not by the user speaking. how/codex-order.md. */
export function unspentAdvice(records, spentAt = 0) {
  return records.some(
    (record) =>
      blocksOf(record).some((one) => one.type === "advisor_tool_result")
      && (spentAt === 0 || Date.parse(record.timestamp) > spentAt),
  );
}

const parsed = (text) =>
  text
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const TAIL = 1 << 20;
const TAIL_CAP = 64 << 20;
const PROMPT_KEY = Buffer.from('"promptSource"');
const NEWLINE = 0x0a;

const spanOf = (handle, from, to) => {
  const held = Buffer.alloc(to - from);
  readSync(handle, held, 0, held.length, from);
  return held;
};

/* Where the last prompt is, searched as bytes rather than parsed as records: past the window this is
   what a turn costs, and the alternative was answering "no turn" — once a session, not once a turn. */
const promptAt = (handle, size) => {
  for (let end = size; end > 0; ) {
    const from = Math.max(0, end - TAIL);
    const held = spanOf(handle, from, end);
    const at = held.lastIndexOf(PROMPT_KEY);
    if (at >= 0) return from + held.lastIndexOf(NEWLINE, at) + 1;
    if (from === 0) return -1;
    end = from + PROMPT_KEY.length - 1;
  }
  return -1;
};

/** This turn, without reading the session for it: a transcript reaches hundreds of megabytes and the
 *  last prompt is at the end. Grown rather than fixed, because one turn's records can outrun a
 *  window, and a partial first line is dropped since a read cuts wherever the offset lands. */
export function turnRecords(path, { tail = TAIL, cap = TAIL_CAP } = {}) {
  let size = 0;
  let handle = null;
  try {
    size = statSync(path).size;
    handle = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    for (let span = tail; ; span *= 2) {
      const from = Math.max(0, size - span);
      const text = spanOf(handle, from, size).toString("utf8");
      const records = parsed(from > 0 ? text.slice(text.indexOf("\n") + 1) : text);
      if (promptIndex(records) >= 0 || from === 0) return records;
      if (span >= cap) {
        const at = promptAt(handle, size);
        return at >= 0 ? parsed(spanOf(handle, at, size).toString("utf8")) : records;
      }
    }
  } catch {
    return null;
  } finally {
    closeSync(handle);
  }
}

/** Null and not an empty list: a gate that reads "no advice" from a transcript it could not open
 *  would stop the work it exists to order. */
export function transcript(path) {
  try {
    return parsed(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
