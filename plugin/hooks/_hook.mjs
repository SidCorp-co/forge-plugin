// What every hook here needs: the event, the files a call wrote, the two ways to answer, and the
// once-per-file-per-session stamp. Why write detection asks the disk, not the shell: docs/HOOKS.md.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

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
export const why = () => `\n\nWhy: \`forge hooks --why ${basename(process.argv[1] ?? "", ".mjs")}\``;

export function block(reason) {
  record("block", reason);
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

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

/** No hook fires for the advisor — a server-side tool is not dispatched locally — but every call
 *  leaves an assistant record carrying an `advisor_tool_result`, and events carry the transcript. */
const blocksOf = (record) => {
  const content = (record?.message ?? {}).content;
  return Array.isArray(content) ? content.filter((one) => one && typeof one === "object") : [];
};

/** Where a heredoc body is a program rather than data. why/learning-gate.md. */
export const EXECUTES_STDIN =
  /(?:^|[\s;&|(])(?:python3?|node|deno|bun|perl|ruby|php|sh|bash|zsh)(?:\s+-\S+)*\s*-?\s*$/u;

/** A redirect is judged by its target: `2>&1` duplicates a descriptor and writes nothing. */
export const REDIRECT = /(?:^|[\s;&|(])\d?>>?\s*(?!&\d)("[^"]*"|'[^']*'|[^\s;&|<>]+)/gu;

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/u;

/** A heredoc body is data, not command, and `onProgram` is where a caller reads a body an
 *  interpreter executes differently from the line that ran it. why/learning-gate.md. */
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

/** The shell verbs are read in command position, a library call anywhere. why/codex-second.md. */
export const WRITES = new RegExp(
  String.raw`(?:^|[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+`
    + String.raw`|\b(?:sudo|command|nohup|time|env|xargs|do|then|else|if|elif|while|until)\s+)`
    + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)|(?:tee|cp|mv|truncate)\b)`
    + String.raw`|open\([^)]*['"]w|\bwrite_(?:text|bytes)\b|\bwriteFileSync\b`
    + String.raw`|\bshutil\.(?:copy|move)|\bos\.(?:replace|rename)\b`,
);

/** Whether a call writes a file: a target for the file tools, a verb or a redirect for the shell.
 *  A redirect under `/dev/` writes nothing. why/codex-second.md. */
export function writing(ev) {
  const ti = ev.tool_input ?? {};
  if (ev.tool_name !== "Bash") return Boolean(ti.file_path ?? ti.notebook_path);
  const command = bodiless(String(ti.command ?? ""));
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

const ASSIGN = /(?:^|[;&|\n]|\bexport\s+)\s*([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]*)/gu;
const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

/** `H=/tmp/d` then `> $H/x` names the directory in no token, so a value is substituted first. */
export const expanded = (command) => {
  const vars = new Map();
  for (const [, name, value] of command.matchAll(ASSIGN)) {
    /* A value that runs a command is not a path: substituting one named a file after the command. */
    if (!/[$`]/u.test(value)) vars.set(name, unquote(value));
  }
  return command.replace(/\$\{?([A-Za-z_]\w*)\}?/gu, (whole, name) => vars.get(name) ?? whole);
};

/** Whether the write is work in `root`. A write verb names no readable target so it answers true —
 *  a wall that stands down on doubt is not a wall. A redirect does: why/codex-second.md. */
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

/** Whether the advisor has spoken since the last prompt. why/codex-second.md. */
export function advisedThisTurn(records) {
  let from = -1;
  for (let at = 0; at < records.length; at += 1) {
    if (records[at]?.type === "user" && typeof records[at].promptSource === "string") from = at;
  }
  return unspentAdvice(records.slice(from + 1));
}

/** Advice is spent by the consult that follows it, not by the user speaking. why/codex-order.md. */
export function unspentAdvice(records, spentAt = 0) {
  return records.some(
    (record) =>
      blocksOf(record).some((one) => one.type === "advisor_tool_result")
      && (spentAt === 0 || Date.parse(record.timestamp) > spentAt),
  );
}

/** Null and not an empty list: a gate that reads "no advice" from a transcript it could not open
 *  would stop the work it exists to order. */
export function transcript(path) {
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}
