// What every gate here needs: the event, the files a call wrote, the ways to answer, the runner that
// hands one event to every gate of its kind in one process, and the once-per-file-per-session stamp.
// Why write detection asks the disk: docs/HOOKS.md. Which copy this one is: how/copies.md.

import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { logHook } from "../src/hooks/log/hook-log-file.mjs";
import { Refusal, refusing } from "../src/resolve/settings.mjs";
import { boundedBy } from "../src/wire/request.mjs";
import { scrubbed } from "../src/hooks/log/scrub.mjs";
import { NOWHERE, STARTS, WRITES, namesOf, placeable, spans, standsIn, unquote } from "../src/hooks/shell-spans.mjs";
import { glued } from "../src/hooks/assembled.mjs";
import { FILES_IT, WHOLE } from "../src/hooks/appended.mjs";
import { DEADLINES, gateFile, hookOff } from "../src/hooks/hook-switch.mjs";
import { agreedWithHead } from "../src/hooks/git-probe.mjs";
import { isSubagent, calledAt, memo, ownTranscript, sinceTurn, transcriptOf } from "../src/hooks/transcripts.mjs";

export { DEADLINES };
export { askedAlready, askedByAnyone, clearNote, note, noted } from "../src/hooks/stamps.mjs";
export { directoryAt, movedTo, spelled, typed, waitsIn } from "../src/hooks/shell-spans.mjs";
export { NOWHERE, STARTS, WRITES, namesOf, spans, standsIn, unquote };
export { isSubagent, ownTranscript, transcriptOf };
export { callAt, calledAt, lastRecords, promptIndex, sinceTurn, transcript, turnAt, turnRecords }
  from "../src/hooks/transcripts.mjs";

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

/** What resolving the route may spend of an event's clock, and the floor under which it is not tried. Reading the project's key reads the project file, and finding the checkout that owns a linked worktree runs a `git` that a wrapper on PATH can hold open for as long as it likes (ISS-761). A refusal already decided is never traded for the line about where to file it, so the read is a child this process can outlive: killed at the deadline, the refusal goes out as its gate wrote it. */
export const FILING_MS = 400;
/** And the ceiling on the read itself, which is a Node start and one `git` — bounded by what it should cost rather than by what the event has left, so a wrapper that never answers costs a second and not the whole clock. */
const RESOLVE_MS = 1_500;
const FILING_SURFACE = "plugin-filing";
const RESOLVER = new URL("../src/resolve/visibility.mjs", import.meta.url).href;
const ASKS = `import(${JSON.stringify(RESOLVER)}).then((m) => `
  + `process.stdout.write(m.verbForPluginDefect() || ""))`;

/* Nothing at or below zero, since `spawnSync` reads a `timeout` of 0 as no timeout at all and the whole point here is the ceiling; and one word, because the answer is spent inside a line somebody may copy and run. */
const VERB = /^[a-z][a-z-]*$/u;

const verbWithin = (ms) => {
  if (ms <= 0) return "";
  const held = spawnSync(process.execPath, ["-e", ASKS], { encoding: "utf8", timeout: ms });
  const said = held.status === 0 ? String(held.stdout).trim() : "";
  return VERB.test(said) ? said : "";
};

/* The one line in a refusal the gate refusing does not write, off the project's key through the reader `routingBlock` uses so the two cannot disagree about whether there is a route: docs/cli/withholding-a-verb.md. Asked once a session, the ledger read first so a session already told resolves nothing at all, and the answer credited whether or not there was a route, since a project files nowhere for the rest of the run too. A failed read leaves the refusal as it was. */
export const filed = async (reason, ev, left = remaining()) => {
  if (left <= FILING_MS) return reason;
  try {
    const { lastShown, noteShown, sessionKey } = await import("../src/shown/ledger.mjs");
    const session = sessionKey(ev);
    if (session && lastShown(session, FILING_SURFACE)) return reason;
    const verb = verbWithin(Math.min(left - FILING_MS, RESOLVE_MS));
    if (session) noteShown(session, FILING_SURFACE, verb || "nowhere");
    return verb ? `${reason}\n\n${FILES_IT(verb)}` : reason;
  } catch {
    return reason;
  }
};

/* A refusal before a call refuses all of it, so the `git add` ahead of a refused `git commit` never ran, and a caller re-sending only the refused part finds nothing staged (ISS-329). One command, or one pipeline, needs no telling. It is a fact about this call and not the rule's text, so a repeat the shown ledger cut to one line still carries it, on that same line. */
const refusal = (reason, ev) => {
  const command = String(ev?.tool_input?.command ?? "");
  /* A separator at the end opens a span with nothing in it, and `git stash;` is still one command. */
  const whole = ev?.tool_name === "Bash" && spans(command).filter(({ start, end }) => command.slice(start, end).trim()).length > 1;
  if (!whole) return filed(reason, ev);
  return filed(`${reason}${String(reason).includes("\n") ? "\n\n" : " "}${WHOLE}`, ev);
};

/* A gate that could not judge lets the call through and says so on the channel the session reads, never on stderr alone; how/stood-down.md says why. A refusal `fail()` raised already carries its own route; a crash is this plugin's defect, and the same two commands are where either starts. */
const STOOD_DOWN = (name, error) => `forge hooks: ${name} could not judge this call and did not hold it: `
  + `${String(error.message).trim()}\n${error instanceof Refusal ? "" : "That is a defect in this plugin, not in the call. "}`
  + "`forge doctor` checks the endpoint, the token and the project a gate reads, and `forge doctor --token <pat>` "
  + `replaces a token the tracker refused. Why the call went through: \`forge hooks --how stood-down\`.`;

/* Where the session reads a hook's words: a tool event's own context, and a warning on any other. */
const TOOL_EVENTS = { pre: "PreToolUse", post: "PostToolUse" };
const toolEventOf = (kind, ev) => {
  const named = ev?.hook_event_name;
  if (named) return /^(?:Pre|Post)ToolUse$/u.test(named) ? named : null;
  return kind === "stop" ? null : TOOL_EVENTS[kind] ?? TOOL_EVENTS.post;
};

/* A refusal after a gate stood down still carries the stand-down, since the refusal answers for one gate and not for the one that could not judge. */
const toldBeside = (stoodDown) => (stoodDown.length ? { additionalContext: stoodDown.join("\n\n") } : {});

/* Ten processes per call was the whole cost of the hooks, 38 ms of each 50 being Node starting. One
   process per event: the first refusal answers before a call; after one every block and context is kept. */
export const dispatch = async (given, ev = readEvent()) => {
  const names = given.filter((one) => !(one in DEADLINES));
  const kind = given.find((one) => one in DEADLINES);
  if (kind) deadline = DEADLINES[kind];
  boundedBy(remaining, "the hook event's clock, under what hooks.json registers");
  const toolEvent = toolEventOf(kind, ev);
  const blocks = [];
  const contexts = [];
  const stoodDown = [];
  /* A gate that did not run writes exactly what one that allowed writes, so every branch that skips one says so on stderr, where whoever ran this reads it; out of time before a call refuses it instead, a re-send getting a fresh clock, and a kill leaves neither. */
  for (const name of names) {
    if (hookOff(name)) {
      process.stderr.write(`forge hooks: ${name} was skipped: the switch is off\n`);
      continue;
    }
    current = name;
    if (remaining() <= 0) {
      if (kind === "pre") {
        const reason = `The hooks ran out of time before ${name} could decide this call. Re-send it.`;
        logged("deny", reason);
        emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: await refusal(reason, ev), ...toldBeside(stoodDown) } });
        return;
      }
      logged("error", `${name} skipped: the post clock ran out before it`);
      process.stderr.write(`forge hooks: ${name} was skipped: the post clock ran out before it\n`);
      continue;
    }
    try {
      const file = gateFile(name);
      if (!file) throw new Error(`no gates/${name}.mjs in this copy`);
      const gate = await import(pathToFileURL(file).href);
      /* Inside `refusing`, `fail()` throws rather than exiting, so a gate that meets one is caught here like any other and the gates after it still answer. */
      await refusing(() => gate.run(ev));
    } catch (error) {
      if (!(error instanceof Decision)) {
        logged("error", `${name} failed: ${error.message}`);
        process.stderr.write(`forge hooks: ${name} failed and was skipped: ${error.message}\n`);
        stoodDown.push(STOOD_DOWN(name, error));
        continue;
      }
      if (error.kind === "deny") {
        emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: await refusal(error.message, ev), ...toldBeside(stoodDown) } });
        return;
      }
      if (error.kind === "block") blocks.push(error.message);
      if (error.kind === "context") contexts.push(error.message);
    }
  }
  if (!blocks.length && !contexts.length && !stoodDown.length) return;
  const told = toolEvent ? [...contexts, ...stoodDown] : contexts;
  emit({
    ...(blocks.length ? { decision: "block", reason: await filed(blocks.join("\n\n"), ev) } : {}),
    ...(told.length ? { hookSpecificOutput: { hookEventName: toolEvent ?? TOOL_EVENTS.post, additionalContext: told.join("\n\n") } } : {}),
    ...(stoodDown.length && !toolEvent ? { systemMessage: stoodDown.join("\n\n") } : {}),
  });
};

/* The deadline is the event's, under what hooks.json registers, and runs from the process rather than from this import: the entry hops before it, and a fallback would get a fresh budget. Whole milliseconds: the origin is fractional, and a child's timeout throws on anything else (ISS-530). */
const startedAt = performance.timeOrigin;
let deadline = DEADLINES.post;
export const remaining = () => Math.floor(deadline - (Date.now() - startedAt));

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
    ...refusedIn(reason),
  });
};

/* A refusal leads with its route and says what it refused in the paragraph after, so the first line
   alone is the action; the shape is kept beside it, since a false positive is found by its shape. */
const refusedIn = (reason) => {
  const [, next] = String(reason).split("\n\n");
  return next?.trim() ? { refused: scrubbed(next.trim().split("\n")[0]) } : {};
};


const touchedBy = new WeakMap();
export function touched(ev, freshMs = FRESH_MS) {
  return memo(memo(touchedBy, ev, () => new Map()), freshMs, () => touching(ev, freshMs));
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
  const command = String(ti.command ?? "");
  /* Two texts: as written, and with a shell binding and a body's own assembly resolved, so a name the call computed is one to ask the disk about. Beside the raw scan and never instead — the resolved one drops a data heredoc's body. how/writes.md. */
  const resolved = shellWrites(command);
  /* Both readings of each text, the disk being what answers here: a candidate that is not a file costs a lookup, while a word opening with a hyphen that really is one — a redirect's target — costs the write. */
  const tokens = [...new Set([command, resolved]
    .flatMap((one) => [...namesOf(one), ...namesOf(one, undefined, AIMED_AT)])
    .map((one) => one.token))];
  /* The run's own transcript, not the one the event hands over: a delegated run's call names the dispatching session, whose last message is a wave's idle wait away (ISS-1672). */
  const since = tokens.length ? calledAt(ownTranscript(ev)) : 0;
  /* What the text claims answers on the stamp alone: a write putting back HEAD's bytes is one the tree cannot report. The rest are mentions, which a git operation in this same call stamps too. */
  const claims = new Set(tokens.length ? writtenPaths(resolved, cwd).map((one) => one.token) : []);
  const out = new Map();
  for (const token of tokens) {
    for (const cand of [token, join(cwd, token)]) {
      try {
        const st = statSync(cand);
        if (st.isFile() && st.mtimeMs >= since && now - st.mtimeMs <= freshMs) {
          const full = realpathSync(cand);
          out.set(full, out.get(full) || claims.has(token));
          break;
        }
      } catch {
        /* not a file */
      }
    }
  }
  const mentioned = [...out].filter(([, claimed]) => !claimed).map(([path]) => path);
  const restamped = mentioned.length ? agreedWithHead(mentioned, remaining) : new Set();
  return [...out.keys()].filter((one) => !restamped.has(one)).sort();
}

/** The paths a call spelled, resolved but not followed: `touched` answers with what a name points at,
 *  and a link is a different question from its target. */
export const named = (ev) => {
  const ti = ev.tool_input ?? {};
  const cwd = ev.cwd || process.cwd();
  const found =
    ev.tool_name === "Bash"
      ? namesOf(String(ti.command ?? "")).map((one) => one.token)
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

/** A redirect is judged by its target: `2>&1` writes nothing, and one holding a `$(…)` holds spaces. The target is every part of the one word, since a quote closing is not the operand ending: `> 'a(1).md'.txt` writes the `.txt`, and a capture stopping at the quote hands the reader a word it will take for the whole of one. Where the word ends is the walk's answer in `plugin/src/hooks/shell-spans.mjs`, spelt the same here (ISS-1555). */
export const REDIRECT = new RegExp(
  String.raw`(?:^|[\s;&|(])\d?>>?[ \t]*(?!&\d)((?:"[^"]*"|'[^']*'|\$\([^)]*\)|[^ \t\n;&|<>])+)`,
  "gu",
);

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1/u;

export const QUOTED = /'[^']*'|"(?:[^"\\]|\\[\s\S])*"/gu;
const BLANK = /^[ \t\n]+|[ \t\n]+$/gu;

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

/** The one text every write test reads: values resolved, a data heredoc dropped, a `-c` body run — unwrapped before expanded, since the shell that takes a `-c` body is what an `env` prefix reaches. */
export const shellText = (command, onProgram) =>
  expanded(unwrapped(bodiless(String(command ?? ""), onProgram)));

/** The same text for a caller asking what a command *writes*, which is the only question a program body's own bindings answer: folding a body's strings into one path would otherwise reach the callers asking what command this *is* — `committing` reads `"note;git " + "commit"` as a commit once the two are one string. `forge hooks --how writes`. */
export const shellWrites = (command) => shellText(command, (body, at, runner) => glued(body, runner));

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

/* A quoted span is the write's target only where it could be one filename, so a sentence and a payload a command carries are both data — twelve refusals in three days were a write word and a path in one line of prose, and a guarded path spelled as a bare element of a JSON list a command was writing elsewhere is the same defect without the spaces. A `-c` body is code. Narrowing, not a parse: a quote or a bracket is legal in a name no tree this guards uses, and a payload that is exactly one path still reads as a target. */
const NOT_A_NAME = /["'\s[\]]/u;
const spoken = (said) =>
  said
    .replace(RUNS, (all, runner, body) => ` ${body.slice(1, -1)} `)
    .replace(QUOTED, (span) => (NOT_A_NAME.test(span.slice(1, -1)) ? " " : span));

/* A redirect's operand is a filename and never an option, so a target opening with a hyphen is read whole where the same word standing among a command's arguments is not. */
const AIMED_AT = { options: false };

const namesIn = (said, tail, read) =>
  namesOf(said, tail, read).map(({ token, at }) => ({
    token,
    placed: token[0] !== "~" && said[at - 1] !== "$",
  }));

/** Every file a shell command would write, each with the trees the write could land in: a verb counts for the command it starts and a redirect for its own target, and a name the shell would still expand is placed against every tree the command could be standing in, while one it would not — a leading `~`, a `$` the reader above stopped at — answers for what it spells and nothing more. `tail` narrows which extensions a caller wants. `forge hooks --how writes`. */
export const writtenPaths = (text, cwd, tail) => {
  const held = new Map();
  const standing = (at) => {
    if (!held.has(at)) {
      held.set(at, standsIn(text, at).filter((one) => one !== NOWHERE).map((one) => resolve(cwd, one ?? ".")));
    }
    return held.get(at);
  };
  /* Each reading below is one span or one capture, and what decides whether a quoted span there is this command's target or another command's argument is not in the slice. So the whole text answers, once. */
  const placed = placeable(text);
  const named = spans(text).flatMap(({ start, end }) => {
    const said = spoken(text.slice(start, end).replace(BLANK, ""));
    return WRITES.test(said) ? namesIn(said, tail, { whole: placed(start) }).map((one) => ({ ...one, at: start })) : [];
  });
  /* The target as the command wrote it, quotes and all: `namesOf` is where a shell word is read, and taking the pair off first hands it a `(` standing bare that stood inside a quote — which ends the name there and leaves a rooted tail nothing wrote (ISS-1555). */
  const aimed = [...text.matchAll(REDIRECT)]
    .flatMap((one) => namesIn(one[1], tail, { ...AIMED_AT, whole: placed(one.index) })
      .map((each) => ({ ...each, at: one.index })));
  return [...aimed, ...named].map(({ token, placed, at }) => {
    const trees = placed && !token.startsWith("/") ? standing(at) : [];
    return { token, trees, paths: [token, ...trees.map((tree) => join(tree, token))] };
  });
};

/** The files a turn wrote through the file tools: a stop carries no tool input, so what `touched`
 *  answers for a call is answered here for a turn. A shell write has no call to be dated against. */
const WRITES_A_FILE = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

const writtenIn = new WeakMap();

export const turnWrites = (records) => {
  const held = sinceTurn(records);
  return memo(writtenIn, held, () => {
    const out = new Set();
    for (const record of held) {
      if (record?.type !== "assistant" || !Array.isArray(record.message?.content)) continue;
      for (const block of record.message.content) {
        if (block?.type !== "tool_use" || !WRITES_A_FILE.includes(block.name)) continue;
        const path = block.input?.file_path ?? block.input?.notebook_path;
        if (path) out.add(settled(String(path)));
      }
    }
    return [...out];
  });
};
