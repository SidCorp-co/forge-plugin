// What every hook here needs: the event, the files a call wrote, the two ways to answer, and
// the once-per-file-per-session stamp. Why the write detection asks the disk instead of parsing
// the shell: docs/HOOKS.md.

import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
const FRESH_MS = 120_000;
const SETTLE_MS = Number(process.env.FORGE_HOOK_SETTLE_MS ?? 1000);
const STEP_MS = 100;

export function readEvent() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
}

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

export function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

/** A file edit has no field to hold an acknowledgement, and forcing one into the content would
 *  write this gate's bookkeeping into the file it guards. So the answer is that the question was
 *  put — recorded outside the file, once per session. */
export function askedAlready(ev, path, kind) {
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

/** Where a heredoc body is a program rather than data. docs/HOOKS.md. */
export const EXECUTES_STDIN =
  /(?:^|[\s;&|(])(?:python3?|node|deno|bun|perl|ruby|php|sh|bash|zsh)(?:\s+-\S+)*\s*-?\s*$/u;

/** A redirect is judged by its target: `2>&1` duplicates a descriptor and writes nothing. */
export const REDIRECT = /(?:^|[\s;&|(])\d?>>?\s*(?!&\d)("[^"]*"|'[^']*'|[^\s;&|<>]+)/gu;

export const WRITES =
  /\bsed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)|\btee\b|\bcp\b|\bmv\b|\btruncate\b|open\([^)]*['"]w|\bwrite_(?:text|bytes)\b|\bwriteFileSync\b|\bshutil\.(?:copy|move)|\bos\.(?:replace|rename)\b/;

/** Whether the advisor has spoken since the last prompt. docs/HOOKS.md. */
export function advisedThisTurn(records) {
  let from = -1;
  for (let at = 0; at < records.length; at += 1) {
    if (records[at]?.type === "user" && typeof records[at].promptSource === "string") from = at;
  }
  return unspentAdvice(records.slice(from + 1));
}

/** Advice is spent by the consult that follows it, not by the user speaking. docs/HOOKS.md. */
export function unspentAdvice(records, spentAt = 0) {
  return records.some(
    (record) =>
      blocksOf(record).some((one) => one.type === "advisor_tool_result")
      && (spentAt === 0 || Date.parse(record.timestamp) > spentAt),
  );
}

/** Null and not an empty list: a gate that reads "no advice" from a transcript it could not open
 *  would stop the work it exists to order. */
/* A refusal waits, because a record reaches disk as its message ends: docs/HOOKS.md. */
export function settle(path, judge, capMs = SETTLE_MS) {
  const until = Date.now() + capMs;
  for (;;) {
    const records = transcript(path);
    if (!records || judge(records)) return true;
    if (Date.now() >= until) return false;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, STEP_MS);
  }
}

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
