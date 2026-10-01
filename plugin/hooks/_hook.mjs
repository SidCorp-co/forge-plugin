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
import { NOWHERE, REDIRECT, RUNNER, SHELL_OPTION, SHELL_WORD, STARTS, WRITES, landedIn, namesOf, placeable, quotedOut, quotedOver, redirectsIn, respelled, spans, standsIn, struck, unquote, unseenNames } from "../src/hooks/shell-spans.mjs";
import { glued, gluedQuoted } from "../src/hooks/program/assembled.mjs";
import { fileCalls, spelling } from "../src/hooks/program/call-writes.mjs";
import { bodiesOut, withoutBodies } from "../src/resolve/session/here-doc.mjs";
import { FILES_IT, WHOLE, howPage } from "../src/refusal.mjs";
import { PLUGIN_ROOT } from "../src/tools/plugin-copy.mjs";
import { DEADLINES, gateFile, hookOff } from "../src/hooks/hook-switch.mjs";
import { agreedWithHead } from "../src/hooks/git-probe.mjs";
import { isSubagent, calledAt, memo, ownTranscript, sinceTurn, transcriptOf } from "../src/hooks/transcripts.mjs";

export { DEADLINES };
export { askedAlready, askedByAnyone, clearNote, note, noted } from "../src/hooks/stamps.mjs";
export { directoryAt, spelled, typed, waitsIn } from "../src/hooks/shell-spans.mjs";
export { NOWHERE, REDIRECT, WRITES, namesOf, quotedOut, spans, standsIn, withoutBodies };
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
const RESOLVER = pathToFileURL(join(PLUGIN_ROOT, "src", "resolve", "visibility.mjs")).href;
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
    const { lastShown, noteShown, readerKey } = await import("../src/shown/ledger.mjs");
    const session = readerKey(ev);
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
const TOOL_EVENTS = { pre: "PreToolUse", post: "PostToolUse", ask: "PreToolUse" };
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
      /* A question out of time is the owner's, which is what silence gives it: refusing it would stop a session nothing asked to stop. */
      if (kind === "ask") return;
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
      if (error.kind === "answer") {
        emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: error.message, updatedInput: error.input, ...toldBeside(stoodDown) } });
        return;
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

/** The gate running now: the one the hook log files a decision under and a refusal names. */
const gateName = () => current || basename(process.argv[1] ?? "", ".mjs");

/* Refusals are the only entries — a false positive from outside. `target` is what a caller reading
   the log back matches on, so a gate whose subject is one path inside a longer command names it. */
export const logged = (decision, reason, target = null) => {
  const ti = event.tool_input ?? {};
  logHook({
    at: new Date().toISOString(),
    hook: gateName(),
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
  /* The event's own cwd is the last candidate already, so a tree is one only where a move led away from it. */
  const moved = (trees) => trees.filter((one) => one !== cwd);
  const now = Date.now();
  const command = String(ti.command ?? "");
  /* Two texts: as written, and with a shell binding and a body's own assembly resolved, so a name the call computed is one to ask the disk about. Beside the raw scan and never instead — the resolved one drops a data heredoc's body. how/writes.md. */
  const resolved = shellWrites(command);
  /* Both readings of each text, the disk being what answers here: a candidate that is not a file costs a lookup, while a word opening with a hyphen that really is one — a redirect's target — costs the write. Each occurrence keeps the trees a `cd` before it could have left the shell in, so one name after two moves is two files (ISS-1608). */
  const seen = new Set();
  const names = [command, resolved].flatMap((text) => {
    const standing = standingIn(text, cwd);
    return [...namesOf(text), ...namesOf(text, undefined, AIMED_AT)].flatMap(({ token, at }) => {
      const trees = placedAt(text, token, at) ? moved(standing(at).trees) : [];
      const once = `${token}\0${trees.join("\0")}`;
      if (seen.has(once)) return [];
      seen.add(once);
      return [{ token, trees }];
    });
  });
  /* The run's own transcript, not the one the event hands over: a delegated run's call names the dispatching session, whose last message is a wave's idle wait away (ISS-1672). */
  const since = names.length ? calledAt(ownTranscript(ev)) : 0;
  const lookedUp = (token, trees) => {
    for (const cand of new Set([...trees.map((tree) => join(tree, token)), token, join(cwd, token)])) {
      try {
        const st = statSync(cand);
        if (st.isFile() && st.mtimeMs >= since && now - st.mtimeMs <= freshMs) return realpathSync(cand);
      } catch {
        /* not a file */
      }
    }
    return null;
  };
  /* Once per name and trees: a claim below and the occurrence it claims ask the same question. */
  const found = new Map();
  const fileAt = (token, trees) => memo(found, `${token}\0${trees.join("\0")}`, () => lookedUp(token, trees));
  /* What the text claims answers on the stamp alone: a write putting back HEAD's bytes is one the tree cannot report. The rest are mentions, which a git operation in this same call stamps too. A claim is the file its own occurrence reached, so the same name only read in another tree is still a mention. */
  const claims = new Set(names.length
    ? writtenPaths(resolved, cwd).map(({ token, trees }) => fileAt(token, moved(trees))).filter(Boolean)
    : []);
  const out = new Map();
  for (const { token, trees } of names) {
    const full = fileAt(token, trees);
    if (full) out.set(full, out.get(full) || claims.has(full));
  }
  const mentioned = [...out].filter(([, claimed]) => !claimed).map(([path]) => path);
  const restamped = mentioned.length ? agreedWithHead(mentioned, remaining) : new Set();
  return [...out.keys()].filter((one) => !restamped.has(one)).sort();
}

/** The paths a call spelled, resolved but not followed: `touched` answers with what a name points at,
 *  and a link is a different question from its target. A relative name is placed in every tree a `cd`
 *  before it could have left the shell in, since nothing here asks the disk which one it was, and in
 *  the event's cwd where the text names none of them — the candidate `touched` falls back on too. */
export const named = (ev) => {
  const ti = ev.tool_input ?? {};
  const cwd = ev.cwd || process.cwd();
  if (ev.tool_name !== "Bash") return [ti.file_path ?? ti.notebook_path ?? ""].filter(Boolean).map((one) => resolve(cwd, one));
  const command = String(ti.command ?? "");
  const standing = standingIn(command, cwd);
  return [...new Set(namesOf(command).flatMap(({ token, at }) => {
    const { trees } = placedAt(command, token, at) ? standing(at) : { trees: [] };
    return trees.length ? trees.map((tree) => resolve(tree, token)) : [resolve(cwd, token)];
  }))];
};

export function deny(reason) {
  logged("deny", reason);
  throw new Decision("deny", reason);
}

/** Where the argument for a rule lives. What a refusal prints costs context on every tool use, so
 *  it carries the shape and the action and ends with this. The name is the gate's, or a topic's
 *  where one gate refuses two unrelated things and each argument wants its own page. `cause` is the
 *  gate's name for this one refusal, kept when its wording changes; `refusalCauseIn` is its reader. */
export const how = (topic = null, cause = null) =>
  `\n\nHow: ${howPage(topic || gateName(), cause ? `${gateName()}/${cause}` : null)}`;

export function block(reason) {
  logged("block", reason);
  throw new Decision("block", reason);
}

/** Lets the call through with its input replaced: the one way a gate answers a question for the owner.
 *  Not written to the refusal log, which holds refusals alone; the gate keeps its own record. */
export const answer = (input, reason) => {
  const decision = new Decision("answer", reason);
  decision.input = input;
  throw decision;
};

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

/* A literal inside a program an interpreter runs is data — a triple quote and an escape first, since
   read wrong its pairs skew and bare the rest. Unless it reaches a shell: there it is the command. */
export const LITERALS = /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu;

/** One literal's text as it is handed over, and an inline body's with the shell's quoting taken off: the quoting rule is `WORD`'s below, and this undoes it. */
export const literal = (one) => {
  if (/^('''|""")/u.test(one)) return one.slice(3, -3);
  const inner = one.slice(1, -1);
  return one.startsWith('"') ? inner.replace(/\\\n/gu, "").replace(/\\(["\\$`])/gu, "$1") : inner;
};

/* Literals standing next to each other with nothing but whitespace, a comment or a continuation between are one string to python. */
const ADJACENT = /^(?:\s|#[^\n]*|\\\n)*$/u;

/** The strings a program body hands a shell, each as that shell is given it, or null where it hands none: a shell's own body is its commands already, and a body naming no spawn call its language has hands nothing. how/learning-gate.md. */
export const handedIn = (body, runner) => {
  if (SHELL.test(runner) || !spawnsIn(runner).test(body)) return null;
  const out = [];
  let last = null;
  for (const one of body.matchAll(LITERALS)) {
    const text = literal(one[0]);
    if (last !== null && ADJACENT.test(body.slice(last, one.index))) out[out.length - 1] += text;
    else out.push(text);
    last = one.index + one[0].length;
  }
  return out;
};

export const RUNS = /\b(python3?|node|deno|bun|perl|ruby|php)\s+(?:-\S+\s+)*(?:-c|-e|--eval)\s+('[^']*'|"(?:[^"\\]|\\[\s\S])*")/gu;

/** Where a heredoc body is a program rather than data, and which of those runners take it as commands already — a shell's body names no escape, being the caller's own language. Which word is a shell is `SHELL_WORD`'s, the `-c` reading's own. how/learning-gate.md. */
export const SHELL = new RegExp(`^(?:${SHELL_WORD})$`, "u");
/* An interpreter's options are any dashed words, a shell's are `SHELL_OPTION`'s, the `-c` reading's own; either may end on the `-` that names stdin. */
const EXECUTES_STDIN = new RegExp(
  String.raw`(?:^|[\s;&|(])(?:(python3?|node|deno|bun|perl|ruby|php)(?:\s+-\S+)*|(${SHELL_WORD})(?:\s+${SHELL_OPTION})*)\s*-?\s*$`,
  "u",
);

const BLANK = /^[ \t\n]+|[ \t\n]+$/gu;

/** A heredoc body is data; `onProgram` reads one an interpreter executes, and is told where in the text being returned the interpreter sits — for the `cd` it inherited — and which
 *  interpreter it is. Where a body is, `bodiesOut`'s reader says. how/learning-gate.md. */
export const bodiless = (text, onProgram = (body) => body) => bodiesOut(text, {
  body: (body, at, before) => {
    const runs = EXECUTES_STDIN.exec(before);
    return runs ? onProgram(body, at, runs[1] ?? runs[2]) : "";
  },
});

/** A shell runs a `-c` body and `eval` its argument, so a verb there is in command position. One holds
 *  another, so it runs to a fixed point, keeping the start it matched: that can carry an assignment.
 *  A heredoc inside a body is that shell's, its body read by `bodiless` with the caller's `onProgram`. */
const WRAPPED = new RegExp(`(?<start>${STARTS})(?:${RUNNER})` + String.raw`\s+(?<body>"[^"]*"|'[^']*')`, "gu");
export const unwrapped = (text, onProgram) => {
  let out = text;
  for (let hop = 0; hop < HOPS; hop += 1) {
    const next = out.replace(WRAPPED, (...all) => {
      const { start, body } = all.at(-1);
      return `${start} ; ${bodiless(body.slice(1, -1), onProgram)} ;`;
    });
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

/** Each point a program runs one, from there on, its own quotes off: what a quote holds as data holds no start,
 *  while `echo "$(git stash)"` starts `git stash`, the walk leaving that body standing.
 *  `at` is where it begins, since a rule matched on a bare word cannot walk back to a preceding `cd`.
 *  The data is masked with a character that is neither a blank nor a word's, so a start's own blanks
 *  stop at it rather than running across a quoted program: `'rm' -rf /` is still `rm` (ISS-2933). */
export const startsAt = (text) =>
  spans(text, { pipes: true }).flatMap(({ start, end }) => {
    const raw = text.slice(start, end);
    const one = raw.trim();
    const lead = start + (raw.length - raw.trimStart().length);
    const bare = quotedOver(one, ".");
    return [...bare.matchAll(new RegExp(STARTS, "gu"))].flatMap((m) => {
      const at = m.index + m[0].length;
      return past(one.slice(at)).map((said) => ({ said, at: lead + at }));
    });
  });

/** The one text every write test reads: values resolved, a data heredoc dropped, a `-c` body run — unwrapped before expanded, since the shell that takes a `-c` body is what an `env` prefix reaches. */
export const shellText = (command, onProgram) =>
  expanded(unwrapped(bodiless(String(command ?? ""), onProgram), onProgram));

/* What an inline-program match said before its body: the runner and its flags, for the body put back in its place. */
const runnerOf = (all, body) => all.slice(0, all.length - body.length);

/* Per command, since one event's gates each ask it of the same call and the answer is a string of it alone. */
const writesOf = new Map();

/* Each in a subshell of its own, where the program ran them, since each is its own shell's program: a `cd` in one moves neither the next nor the caller, and one that leaves a quote, a test or an arithmetic open — which its shell refuses — is left out rather than let it read the next one's redirect as data. */
const PROBE = "forge-probe";
const closes = (one) => redirectsIn(`${one}\n>${PROBE}`).some(({ target }) => target === PROBE);
const spawned = (body, runner) => {
  const given = (handedIn(body, runner) ?? []).filter(closes);
  return given.map((one) => `\n(\n${one}\n)\n`).join("");
};

/* A literal holding a `$` is quoted as the shell would still read it, which is how the body's own text was read, and one holding a quote in the other quote. One holding a substitution, or both quotes, names a file no reading here can spell, and is left out. */
const aimedAt = (name) => {
  if (/\$\(|\x60/u.test(name) || (name.includes("'") && name.includes('"'))) return "";
  return !name.includes('"') && /[$\\']/u.test(name) ? `\n: > "${name}"` : `\n: > '${name}'`;
};
/* Every character a shell gives a meaning a program's expression does not: an operator, a redirect, an expansion, an escape, a comment, a test's bracket, and a keyword's `=`. */
const INERT = /[;&|<>$\x60\\#![\]=]/gu;
/* A heredoc body a shell does not run is another language, so none of it is shell words. What stands in its place: a string it hands a shell, which is that shell's command; a redirect to each literal its file calls write, the one write every reading aims; and a call with a target it computes, flattened and with every character a shell reads blanked, where it leaves nothing open — a reading that keeps every candidate reads what it still spells, and one that strikes what it cannot place strikes it. A bracket, a quote, an assignment or a `cd` in the body then reaches no command after it (ISS-3038). */
const called = (body, runner, { computed = true } = {}) => fileCalls(body, runner).map((one) => {
  const aimed = one.targets.map(({ from, to }) => aimedAt(spelling(body.slice(from, to)))).join("");
  const flat = one.text.replace(/\s+/gu, " ").replace(INERT, " ");
  return computed && one.computed && closes(flat) ? `${aimed}\n${flat}` : aimed;
}).join("");
const programmed = (body, runner) => (SHELL.test(runner) ? body : `${spawned(body, runner)}${called(body, runner)}\n`);

/* An inline body the same, where the null command after its strings and its writes takes what followed the body. The body itself stays, its shell quotes holding it shut, so it is already the computed calls a keeping reading reads, and only the literals they write are added. */
const inline = (all, runner, body) => {
  const kept = gluedQuoted(body, runner);
  const given = `${spawned(literal(kept), runner)}${called(literal(kept), runner, { computed: false })}`;
  return `${runnerOf(all, body)}${kept}${given && `${given}\n:`}`;
};

/** The same text for a caller asking what a command *writes*, which is the only question a program body's own bindings answer: folding a body's strings into one path would otherwise reach the callers asking what command this *is* — `committing` reads `"note;git " + "commit"` as a commit once the two are one string. A heredoc body and an inline one are folded alike, or a run held on one spelling learns the other. `forge hooks --how writes`. */
export const shellWrites = (command) => {
  const said = String(command ?? "");
  return memo(writesOf, said, () => shellText(said, (body, at, runner) => programmed(glued(body, runner), runner))
    .replace(RUNS, inline));
};

/** What a call wrote through a name the gates cannot resolve, read off the text its own shell runs: a program body is blanked, since its names are its interpreter's, and reading them as the shell's claimed writes out of a regex literal and a docstring (ISS-450). how/writes.md. */
export const unseenWrites = (command) => unseenNames(
  shellText(command, () => " ").replace(RUNS, (all, runner, body) => `${runnerOf(all, body)}''`),
);

/* git's globals before the verb: a value may be quoted and hold a space; a bare flag eats no token. */
const GIT_VALUE = String.raw`(?:"[^"]*"|'[^']*'|\S+)`;
export const GIT_GLOBALS = String.raw`(?:(?:-[cC]|--(?:git-dir|work-tree|namespace|exec-path|config-env|super-prefix))\s+`
  + GIT_VALUE + String.raw`\s+|-[A-Za-z-]+(?:=` + GIT_VALUE + String.raw`)?\s+)*`;

/** Where a draft stops being one, in command position only: a message quoting the word is not one. */
export const COMMITS = new RegExp(`${STARTS}git\\s+${GIT_GLOBALS}commit(?![\\w-])`, "u");

export const committing = (ev) =>
  ev.tool_name === "Bash" && COMMITS.test(quotedOut(shellText((ev.tool_input ?? {}).command)));

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

/* A quoted span is the write's target only where it could be one filename, so a sentence and a payload a command carries are both data — twelve refusals in three days were a write word and a path in one line of prose, and a guarded path spelled as a bare element of a JSON list a command was writing elsewhere is the same defect without the spaces. A `-c` body is code. Narrowing, not a parse: a quote or a bracket is legal in a name no tree this guards uses, and a payload that is exactly one path still reads as a target. What stands in for a span taken out is an empty quote pair and not a blank, since a start's blanks would run across a blank and read the quoted program's argument as the verb (ISS-2933). */
const NOT_A_NAME = /["'\s[\]]/u;
const spoken = (said) =>
  respelled(said.replace(RUNS, (all, runner, body) => ` ${body.slice(1, -1)} `),
    (span) => (NOT_A_NAME.test(span.slice(1, -1)) ? "''" : span));

/* A redirect's operand is a filename and never an option, so a target opening with a hyphen is read whole where the same word standing among a command's arguments is not. */
const AIMED_AT = { options: false };

/* A name is spelt whole where a shell word opens with it, an opening quote aside, in a command holding nothing the shell still expands or joins. Anything glued before it — a `${…}`, a closed quote pair, a line continued onto it — makes it the tail of a word built rather than written, and which of those a reading of neighbours has missed is not knowable here, so a command carrying any of them spells no name whole. */
const OPENS = /[\s<>;&|(=]/u;
const BUILDS = /[$`\\{}]/u;
const spelled = (said, at) => {
  if (BUILDS.test(said)) return false;
  const from = at > 0 && /["']/u.test(said[at - 1]) ? at - 1 : at;
  return from === 0 || OPENS.test(said[from - 1]);
};

const namesIn = (said, tail, read) =>
  namesOf(said, tail, read).map(({ token, at }) => ({
    token,
    placed: token[0] !== "~" && said[at - 1] !== "$",
    spelt: spelled(said, at),
  }));

/** `standsIn` placed against `cwd`, asked once per offset of one text, `NOWHERE` kept apart as a flag. */
const standingIn = (text, cwd) => {
  const held = new Map();
  return (at) => {
    if (!held.has(at)) {
      const could = standsIn(text, at);
      held.set(at, {
        trees: could.filter((one) => one !== NOWHERE).map((one) => resolve(cwd, one ?? ".")),
        nowhere: could.includes(NOWHERE),
      });
    }
    return held.get(at);
  };
};

/* A name a shell would still expand is placed against the trees it could stand in; one it would not — a leading `~`, a `$` in front of it, a rooted path — answers for what it spells. */
const placedAt = (text, token, at) => token[0] !== "~" && token[0] !== "/" && text[at - 1] !== "$";

/** Every file a shell command would write, each with the trees the write could land in: a verb counts for the command it starts and a redirect for its own target, and a name the shell would still expand is placed against every tree the command could be standing in, while one it would not — a leading `~`, a `$` the reader above stopped at — answers for what it spells and nothing more. `unplaced` is true where one way the shell reached the name is a move whose destination the text does not carry, which `trees` cannot hold. `spelt` is false where what stands before the name is built rather than written. `tail` narrows which extensions a caller wants. `unplaceable` is the `struck` reading a caller wants of the operands, none by default; the names a `-t` directory composes are read off the text as given, since the strike takes away the sources they are built from, and a caller that must not invent a target gets none of them. `forge hooks --how writes`. */
export const writtenPaths = (text, cwd, tail, { unplaceable } = {}) => {
  const read = unplaceable ? struck(text, { unplaceable }) : text;
  const standing = standingIn(read, cwd);
  /* Each reading below is one span or one capture, and what decides whether a quoted span there is this command's target or another command's argument is not in the slice. So the whole text answers, once. */
  const placed = placeable(read);
  const named = spans(read).flatMap(({ start, end }) => {
    const said = spoken(read.slice(start, end).replace(BLANK, ""));
    return WRITES.test(said) ? namesIn(said, tail, { whole: placed(start) }).map((one) => ({ ...one, at: start })) : [];
  });
  /* The target as the command wrote it, quotes and all: `namesOf` is where a shell word is read, and taking the pair off first hands it a `(` standing bare that stood inside a quote — which ends the name there and leaves a rooted tail nothing wrote (ISS-1555). */
  const aimed = redirectsIn(read)
    .flatMap(({ at, target }) => namesIn(target, tail, { ...AIMED_AT, whole: placed(at) })
      .map((each) => ({ ...each, at })));
  const landed = unplaceable === "strike" ? [] : landedIn(text, tail).map(({ token, at, start, end }) => ({
    token,
    placed: token[0] !== "~" && token[0] !== "$",
    spelt: !BUILDS.test(text.slice(start, end)),
    at,
  }));
  return [...aimed, ...named, ...landed].map(({ token, placed, spelt, at }) => {
    const { trees, nowhere } = placed && !token.startsWith("/") ? standing(at) : { trees: [], nowhere: false };
    return { token, trees, unplaced: nowhere, spelt, paths: [token, ...trees.map((tree) => join(tree, token))] };
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
