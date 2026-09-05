// What every gate here needs: the event, the files a call wrote, the ways to answer, the runner that
// hands one event to every gate of its kind in one process, and the once-per-file-per-session stamp.
// Why write detection asks the disk: docs/HOOKS.md. Which copy this one is: how/copies.md.

import { closeSync, openSync, readFileSync, readSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { jsonLines as parsed, logHook } from "../src/hooks/hook-log-file.mjs";
import { scrubbed } from "../src/hooks/hook-log.mjs";
import { NOWHERE, spans, standsIn } from "../src/hooks/shell-spans.mjs";
import { gateFile, hookOff } from "../src/hooks/hook-switch.mjs";

export { askedAlready, askedByAnyone } from "../src/hooks/stamps.mjs";
export { movedTo, spelled, typed, waitsIn } from "../src/hooks/shell-spans.mjs";
export { NOWHERE, spans, standsIn };

const TOKEN = /[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+/g;
/** How long after a call a file's mtime still answers for it. */
export const FRESH_MS = 120_000;

let event = {};
/* Which gate is deciding: the runner sets it, so a refusal and its log line name the gate, not the file. */
let current = "";

export function readEvent() {
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  return event;
}

/* A gate answers by throwing one of these; the runner turns it into the protocol. `done` is silence. */
class Decision extends Error {
  constructor(kind, reason) {
    super(reason);
    this.kind = kind;
  }
}
export const done = () => {
  throw new Decision("none", "");
};

const emit = (out) => process.stdout.write(JSON.stringify(out));

/* Ten processes per call was the whole cost of the hooks, 38 ms of each 50 being Node starting. One
   process per event: the first refusal answers before a call; after one every block and context is kept. */
export const dispatch = async (given, ev = readEvent()) => {
  const names = given.filter((one) => !(one in DEADLINES));
  const kind = given.find((one) => one in DEADLINES);
  if (kind) deadline = DEADLINES[kind];
  const blocks = [];
  const contexts = [];
  for (const name of names) {
    if (hookOff(name)) continue;
    current = name;
    /* Out of time refuses a call (a re-send gets a fresh clock) and logs after one; a kill leaves neither. */
    if (remaining() <= 0) {
      if (kind === "pre") {
        const reason = `The hooks ran out of time before ${name} could decide this call. Re-send it.`;
        logged("deny", reason);
        emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
        return;
      }
      logged("error", `${name} skipped: the post clock ran out before it`);
      continue;
    }
    try {
      const file = gateFile(name);
      if (!file) throw new Error(`no gates/${name}.mjs in this copy`);
      const gate = await import(pathToFileURL(file).href);
      await gate.run(ev);
    } catch (error) {
      if (!(error instanceof Decision)) {
        logged("error", `${name} failed: ${error.message}`);
        process.stderr.write(`forge hooks: ${name} failed and was skipped: ${error.message}\n`);
        continue;
      }
      if (error.kind === "deny") {
        emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: error.message } });
        return;
      }
      if (error.kind === "block") blocks.push(error.message);
      if (error.kind === "context") contexts.push(error.message);
    }
  }
  if (!blocks.length && !contexts.length) return;
  emit({
    ...(blocks.length ? { decision: "block", reason: blocks.join("\n\n") } : {}),
    ...(contexts.length ? { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: contexts.join("\n\n") } } : {}),
  });
};

/* The deadline is the event's, under what hooks.json registers, and runs from the process rather
   than from this import: the entry hops before it, and a fallback would get a fresh budget. */
const startedAt = performance.timeOrigin;
export const DEADLINES = { pre: 8_000, post: 85_000, stop: 25_000 };
let deadline = DEADLINES.post;
export const remaining = () => deadline - (Date.now() - startedAt);

/** One gate on its own, as the suite and a hand-run call it. */
export const alone = (name) => dispatch([name]);

/* Refusals are the only entries — a false positive from outside. `target` is what a caller reading
   the log back matches on, so a gate whose subject is one path inside a longer command names it. */
export const logged = (decision, reason, target = null) => {
  const ti = event.tool_input ?? {};
  logHook({
    at: new Date().toISOString(),
    hook: current || basename(process.argv[1] ?? "", ".mjs"),
    decision,
    tool: event.tool_name ?? "",
    session: event.session_id ?? "",
    target: scrubbed(target ?? ti.file_path ?? ti.notebook_path ?? ti.command ?? ""),
    reason: scrubbed(String(reason).split("\n")[0]),
  });
};

const touchedBy = new WeakMap();
export function touched(ev, freshMs = FRESH_MS) {
  const seen = touchedBy.get(ev)?.[freshMs];
  if (seen) return seen;
  const found = touching(ev, freshMs);
  touchedBy.set(ev, { ...(touchedBy.get(ev) ?? {}), [freshMs]: found });
  return found;
}

function touching(ev, freshMs) {
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
  const tokens = String(ti.command ?? "").match(TOKEN) ?? [];
  const since = tokens.length ? callAt(turnRecords(ev.transcript_path ?? "")) : 0;
  const out = new Set();
  for (const token of tokens) {
    for (const cand of [token, join(cwd, token)]) {
      try {
        const st = statSync(cand);
        if (st.isFile() && st.mtimeMs >= since && now - st.mtimeMs <= freshMs) {
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
  logged("deny", reason);
  throw new Decision("deny", reason);
}

/** Where the argument for a rule lives. What a refusal prints costs context on every tool use, so
 *  it carries the shape and the action and ends with this. The name is the gate's, or a topic's
 *  where one gate refuses two unrelated things and each argument wants its own page. */
export const how = (topic = null) =>
  `\n\nHow: \`forge hooks --how ${topic || current || basename(process.argv[1] ?? "", ".mjs")}\``;

export function block(reason) {
  logged("block", reason);
  throw new Decision("block", reason);
}

/** Said to the model after the call, refusing nothing. */
export const context = (text) => {
  throw new Decision("context", text);
};

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

/** A program that can hand a string to a shell, and an interpreter's inline program: literals there are
 *  code — by the name that body's own language has, `spawnSync` running nothing from python. An unnamed runner keeps all. */
const anyOf = (names) => new RegExp(String.raw`\b(?:${names.join("|")})`, "u");
const PYTHON = anyOf([String.raw`subprocess`, String.raw`os\.system`, String.raw`os\.popen`, String.raw`shell\s*=\s*True`]);
const NODE = anyOf([String.raw`child_process`, String.raw`execSync`, String.raw`spawnSync`]);
const SPAWNS = anyOf([PYTHON.source, NODE.source]);
const ESCAPES = { python: PYTHON, python3: PYTHON, node: NODE, deno: NODE, bun: NODE };
export const spawnsIn = (runner) => ESCAPES[runner] ?? SPAWNS;
export const RUNS = /\b(python3?|node|deno|bun|perl|ruby|php)\s+(?:-\S+\s+)*(?:-c|-e|--eval)\s+('[^']*'|"(?:[^"\\]|\\[\s\S])*")/gu;

/** Where a heredoc body is a program rather than data, and which of those runners take it as commands already — a shell's body names no escape, being the caller's own language. how/learning-gate.md. */
const NAMED_SHELLS = String.raw`sh|bash|zsh`;
export const SHELL = new RegExp(`^(?:${NAMED_SHELLS})$`, "u");
const EXECUTES_STDIN = new RegExp(
  String.raw`(?:^|[\s;&|(])(python3?|node|deno|bun|perl|ruby|php|${NAMED_SHELLS})(?:\s+-\S+)*\s*-?\s*$`,
  "u",
);

/** A redirect is judged by its target: `2>&1` writes nothing, and one holding a `$(…)` holds spaces. */
export const REDIRECT = new RegExp(
  String.raw`(?:^|[\s;&|(])\d?>>?\s*(?!&\d)("[^"]*"|'[^']*'|\$\([^)]*\)[^\s;&|<>]*|[^\s;&|<>]+)`,
  "gu",
);

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/u;

export const QUOTED = /'[^']*'|"(?:[^"\\]|\\[\s\S])*"/gu;

/** A heredoc body is data; `onProgram` reads one an interpreter executes, and is told where in the text being returned the interpreter sits — for the `cd` it inherited — and which
 *  interpreter it is. how/learning-gate.md. */
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
    const runs = EXECUTES_STDIN.exec(line);
    if (runs) out += onProgram(end ? rest.slice(0, end.index) : rest, out.length, runs[1]);
    rest = end ? rest.slice(end.index + end[0].length) : "";
  }
  return out + rest;
};

/* Where a command starts. `xargs` keeps its own flags (`xargs -I{} sh` runs a shell), the rest do not:
   a flag widens what a mention may look like. `^` is last — zero-width, it wins a prefix's position. */
export const STARTS = String.raw`(?:[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+|\bxargs\s+(?:-\S+\s+)*`
  + String.raw`|\b(?:sudo|command|nohup|time|env|do|then|else|if|elif|while|until)\s+|^)`;

/** Verbs count where a command starts, a library call anywhere, and only with a target it names. how/writes.md. */
export const WRITES = new RegExp(
  STARTS
    + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)`
    + String.raw`|(?:tee|cp|mv|truncate|touch|install|rsync)\b`
    + String.raw`|dd\b[^|;]*\bof=|curl\b[^|;]*\s(?:-o|--output)\b|wget\b[^|;]*\s(?:-O|--output-document)\b)`
    + String.raw`|open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
    + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
    + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`,
);

/** A shell runs a `-c` body and `eval` its argument, so a verb there is in command position. One holds
 *  another, so it runs to a fixed point, keeping the start it matched: that can carry an assignment. */
const WRAPPED = new RegExp(
  `(${STARTS})`
    + String.raw`(?:(?:busybox\s+)?(?:sh|bash|zsh|dash|ksh)\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*c|eval)`
    + String.raw`\s+("[^"]*"|'[^']*')`,
  "gu",
);
export const unwrapped = (text) => {
  let out = text;
  for (let hop = 0; hop < HOPS; hop += 1) {
    const next = out.replace(WRAPPED, (all, start, body) => `${start} ; ${body.slice(1, -1)} ;`);
    if (next === out) break;
    out = next;
  }
  return out;
};

export const commands = (text) =>
  spans(text).map(({ start, end }) => text.slice(start, end).trim()).filter(Boolean);

/* A runner's options precede the verb; whether one took an argument is unknowable, so both readings go. */
const WORD = /(?:'[^']*'|"(?:[^"\\]|\\.)*"|\S)+/gu;
const SAID = /['"]/gu;
const past = (text) => {
  const out = [];
  const tokens = text.match(WORD) ?? [];
  for (let at = 0; at < tokens.length; at += 1) {
    out.push([tokens[at].replace(SAID, ""), ...tokens.slice(at + 1)].join(" "));
    const one = tokens[at];
    const held = /^["']?\{\}["']?$/u.test(one);
    if (!(one.startsWith("-") || held || (at > 0 && tokens[at - 1].startsWith("-")))) break;
  }
  return out;
};

/** Each point a program runs one, from there on, its own quotes off: a quoted span holds no start.
 *  `at` is where it begins, since a rule matched on a bare word cannot walk back to a preceding `cd`. */
export const startsAt = (text) =>
  spans(text, { pipes: true }).flatMap(({ start, end }) => {
    const raw = text.slice(start, end);
    const one = raw.trim();
    const lead = start + (raw.length - raw.trimStart().length);
    const bare = one.replace(QUOTED, (q) => " ".repeat(q.length));
    return [...bare.matchAll(new RegExp(STARTS, "gu"))].flatMap((m) => {
      const at = m.index + m[0].length;
      return past(one.slice(at)).map((said) => ({ said, at: lead + at }));
    });
  });

export const starts = (text) => startsAt(text).map((one) => one.said);

/** The one text every write test reads: values resolved, a data heredoc dropped, a `-c` body run. */
/* Unwrapped before expanded: the shell that takes a `-c` body is what an `env` prefix reaches. */
export const shellText = (command, onProgram) =>
  expanded(unwrapped(bodiless(String(command ?? ""), onProgram)));

/* git's globals before the verb: a value may be quoted and hold a space; a bare flag eats no token. */
const GIT_VALUE = String.raw`(?:"[^"]*"|'[^']*'|\S+)`;
export const GIT_GLOBALS = String.raw`(?:(?:-[cC]|--(?:git-dir|work-tree|namespace|exec-path|config-env|super-prefix))\s+`
  + GIT_VALUE + String.raw`\s+|-[A-Za-z-]+(?:=` + GIT_VALUE + String.raw`)?\s+)*`;

/** Where a draft stops being one, in command position only: a message quoting the word is not one. */
export const COMMITS = new RegExp(`${STARTS}git\\s+${GIT_GLOBALS}commit(?![\\w-])`, "u");

export const committing = (ev) =>
  ev.tool_name === "Bash" && COMMITS.test(shellText((ev.tool_input ?? {}).command));

/** The work tree a git command names: `--work-tree` outranks `-C` outranks what `--git-dir` implies.
 *  A repeated `-C` is a chain git composes and `--work-tree` is read from where it left; what a `--git-dir` implies answers only where neither named a tree, because git takes the current directory as the top of the working tree and `-C` is what sets that. A relative answer stays relative for the caller to place against its own event's cwd. */
const AIMS = /(?:^|\s)(-C|--work-tree|--git-dir)(?:\s+|=)("[^"]*"|'[^']*'|\S+)/gu;
export const gitTreeOf = (text) => {
  const said = {};
  let at = null;
  for (const [, option, value] of String(text ?? "").matchAll(AIMS)) {
    const one = value.replace(/['"]/gu, "").replace(/(?!^)\/+$/u, "");
    if (option !== "-C") said[option] = one;
    else at = at && !isAbsolute(one) ? join(at, one) : one;
  }
  const from = (one) => (at && !isAbsolute(one) ? join(at, one) : one);
  if (said["--work-tree"]) return from(said["--work-tree"]);
  if (at) return at;
  const dir = said["--git-dir"];
  if (!dir) return null;
  return basename(dir) === ".git" ? dirname(dir) : dir;
};

const VALUE = String.raw`"[^"]*"|'[^']*'|\$\([^)]*\)|` + "`[^`]*`" + String.raw`|[^\s;&|]*`;
const ASSIGN = new RegExp(
  String.raw`(?<=^|[;&|(){\n]\s*|\b(?:export|env|sudo|command|nohup|time)\s+|=(?:${VALUE})\s+)`
    + String.raw`([A-Za-z_]\w*)=(${VALUE})`,
  "gu",
);
export const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

const NAMED = /\$(?:\{([A-Za-z_]\w*)[^}]*\}|([A-Za-z_]\w*))/gu;
const HOPS = 3;

/** `H=/tmp/d` then `> $H/x` names the directory in no token, so a value is substituted first — what a shell would set only, since a phantom from quoted data answers for a name that
 *  is unset. A hop is followed, a modifier dropped, a `$(…)` carried whole as text. An assignment reaches the commands *after* its own: `env M=/d cp a $M/x` expands `$M` before
 *  `env` sets it. Measured. */
export const expanded = (command) => {
  const ends = spans(command);
  const endOf = (at) => ends.find((one) => at >= one.start && at <= one.end)?.end ?? at;
  const set = [];
  for (const one of command.matchAll(ASSIGN)) {
    set.push({ after: endOf(one.index), name: one[1], value: unquote(one[2]) });
  }
  const resolve = (name, at) => set.filter((one) => one.name === name && one.after < at).pop()?.value;
  const substitute = (text, at) =>
    text.replace(NAMED, (whole, braced, bare) => resolve(braced ?? bare, at) ?? whole);
  for (let hop = 0; hop < HOPS; hop += 1) {
    for (const one of set) one.value = substitute(one.value, one.after);
  }
  return command.replace(NAMED, (whole, braced, bare, at) => resolve(braced ?? bare, at) ?? whole);
};

/** Every file a shell command would write, each with the trees the write could land in: a verb counts for the command it starts and a redirect for its own target, and a name the shell would still expand is placed against every tree the command could be standing in, while one it would not — a leading `~`, a `$` the class below dropped — answers for what it spells and nothing more. `pattern` narrows which names a caller wants. `forge hooks --how writes`. */
const WRITTEN = /[A-Za-z0-9_./@~-]+\.[A-Za-z0-9]+/g;
/* Twelve refusals in three days were a sentence inside a string — a write word and a path in one line of prose. A path and a mode hold no space, so a span with one is prose; a `-c` body is code. */
const spoken = (said) =>
  said
    .replace(RUNS, (all, runner, body) => ` ${body.slice(1, -1)} `)
    .replace(QUOTED, (span) => (/\s/u.test(span) ? " " : span));

const namesIn = (said, pattern) =>
  [...said.matchAll(pattern)].map((one) => ({
    token: one[0],
    placed: one[0][0] !== "~" && said[one.index - 1] !== "$",
  }));

export const writtenPaths = (text, cwd, pattern = WRITTEN) => {
  const held = new Map();
  const standing = (at) => {
    if (!held.has(at)) {
      held.set(at, standsIn(text, at).filter((one) => one !== NOWHERE).map((one) => resolve(cwd, one ?? ".")));
    }
    return held.get(at);
  };
  const named = spans(text).flatMap(({ start, end }) => {
    const said = spoken(text.slice(start, end).trim());
    return WRITES.test(said) ? namesIn(said, pattern).map((one) => ({ ...one, at: start })) : [];
  });
  const aimed = [...text.matchAll(REDIRECT)]
    .flatMap((one) => namesIn(unquote(one[1]), pattern).map((each) => ({ ...each, at: one.index })));
  return [...aimed, ...named].map(({ token, placed, at }) => {
    const trees = placed && !token.startsWith("/") ? standing(at) : [];
    return { token, trees, paths: [token, ...trees.map((tree) => join(tree, token))] };
  });
};

/** Where this turn begins: only a user record carrying `promptSource` is a prompt somebody typed. */
export const promptIndex = (records) => {
  let from = -1;
  for (let at = 0; at < records.length; at += 1) {
    if (records[at]?.type === "user" && typeof records[at].promptSource === "string") from = at;
  }
  return from;
};

export const turnAt = (records) => records[promptIndex(records)]?.timestamp ?? "";

/** From this turn's prompt on: `turnRecords` hands back the whole tail it read. */
export const sinceTurn = (records) => (records ?? []).slice(Math.max(0, promptIndex(records ?? [])));

/** The files a turn wrote through the file tools: a stop carries no tool input, so what `touched`
 *  answers for a call is answered here for a turn. A shell write has no call to be dated against. */
const WRITES_A_FILE = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

export const turnWrites = (records) => {
  const out = new Set();
  for (const record of sinceTurn(records)) {
    if (record?.type !== "assistant" || !Array.isArray(record.message?.content)) continue;
    for (const block of record.message.content) {
      if (block?.type !== "tool_use" || !WRITES_A_FILE.includes(block.name)) continue;
      const path = block.input?.file_path ?? block.input?.notebook_path;
      if (path) out.add(settled(String(path)));
    }
  }
  return [...out];
};

/** When this call began, in epoch ms, and 0 where the transcript cannot say: the last assistant record asks for this tool and lands before the tool runs, so a stamp older than it is the checkout's and not the call's. `forge hooks --how writes`. */
export const callAt = (records) => {
  for (let at = (records ?? []).length - 1; at >= 0; at -= 1) {
    if (records[at]?.type === "assistant") return Date.parse(records[at].timestamp) || 0;
  }
  return 0;
};

const TAIL = 1 << 20;
const TAIL_CAP = 64 << 20;
const PROMPT_KEY = Buffer.from('"promptSource"');
const NEWLINE = 0x0a;

const spanOf = (handle, from, to) => {
  const held = Buffer.alloc(to - from);
  readSync(handle, held, 0, held.length, from);
  return held;
};

/* The key is in quoted content too — a record about a record, this session's own transcript included —
   so a hit is read as a line and has to parse as the prompt. Bounded: past the cap it is one read. */
const isPrompt = (handle, start, size) => {
  const room = Math.min(TAIL, size - start);
  const line = spanOf(handle, start, start + room);
  const end = line.indexOf(NEWLINE);
  try {
    return typeof JSON.parse(line.subarray(0, end < 0 ? room : end).toString("utf8")).promptSource === "string";
  } catch {
    return false;
  }
};

/* Where the last prompt is, searched as bytes rather than parsed as records: past the window this is
   what a turn costs, and the alternative was answering "no turn" — once a session, not once a turn. */
const promptAt = (handle, size) => {
  for (let end = size; end > 0; ) {
    const from = Math.max(0, end - TAIL);
    const held = spanOf(handle, from, end);
    for (let at = held.lastIndexOf(PROMPT_KEY); at >= 0; at = held.lastIndexOf(PROMPT_KEY, at - 1)) {
      const start = from + held.lastIndexOf(NEWLINE, at) + 1;
      if (isPrompt(handle, start, size)) return start;
    }
    if (from === 0) return -1;
    end = from + PROMPT_KEY.length - 1;
  }
  return -1;
};

/** This turn, without reading the session for it: a transcript reaches hundreds of megabytes and the
 *  last prompt is at the end. Grown rather than fixed, because one turn's records can outrun a
 *  window, and a partial first line is dropped since a read cuts wherever the offset lands. */
const turns = new Map();
export function turnRecords(path, { tail = TAIL, cap = TAIL_CAP } = {}) {
  const key = `${path}\0${tail}\0${cap}`;
  if (!turns.has(key)) turns.set(key, readTurn(path, tail, cap));
  return turns.get(key);
}

function readTurn(path, tail, cap) {
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
