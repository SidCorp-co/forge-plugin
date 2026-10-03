// What a program another language runs hands a shell, and where an interpreter takes its program inline: the readings every write test and the shell guard share, kept out of the hook harness because they are readings and not an entry point. how/learning-gate.md.

import { SHELL_WORD } from "../shell-spans.mjs";
import { INTERPRETER, INTERPRETERS, LANGUAGE_OF } from "./spoken.mjs";

/** A program that can hand a string to a shell, and an interpreter's inline program: literals there are
 *  code — by the name that body's own language has, `spawnSync` running nothing from python. An unnamed runner keeps all. */
const anyOf = (names) => new RegExp(String.raw`\b(?:${names.join("|")})`, "u");
const PYTHON = anyOf([String.raw`subprocess`, String.raw`os\.system`, String.raw`os\.popen`, String.raw`shell\s*=\s*True`]);
const NODE = anyOf([String.raw`child_process`, String.raw`execSync`, String.raw`spawnSync`]);
const SPAWNS = anyOf([PYTHON.source, NODE.source]);
/* perl, ruby and php have no names of their own here, so each keeps every name: one refusal on doubt. */
const ESCAPES = { python: PYTHON, node: NODE };
const spawnsIn = (runner) => ESCAPES[LANGUAGE_OF[runner]] ?? SPAWNS;

/* A literal inside a program an interpreter runs is data — a triple quote and an escape first, since
   read wrong its pairs skew and bare the rest. Unless it reaches a shell: there it is the command. */
export const LITERALS = /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu;

/** One literal's text as it is handed over, and an inline body's with the shell's quoting taken off: this undoes a shell's single and double quoting. */
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

/* Where an interpreter's name can stand: at the head of a shell word, or after a path in one, so a name inside an option's value (`--title=php`) is neither the interpreter nor a word's owner. */
const AT_WORD = String.raw`(?<=(?:^|[\s;&|(){}\x60'"])(?:[^\s;&|(){}\x60'"-]\S*\/)?)`;
/* The options ahead of the inline word, and that word held to the interpreter standing before them, so php's `-e` opens nothing and its `-r` does. Both names stand where `AT_WORD` allows and only options lie between, so the two are one name. */
const OPTIONS = String.raw`\s+(?:-\S+\s+)*`;
const HANDS = Object.entries(INTERPRETERS)
  .map(([name, { inline }]) => String.raw`(?<=${AT_WORD}${name}${OPTIONS})(?:${inline.join("|")})`)
  .join("|");

/** An interpreter's inline program: the interpreter, then the body its own inline word hands it, still in the shell quotes it was written in. */
export const RUNS = new RegExp(String.raw`${AT_WORD}(${INTERPRETER})${OPTIONS}(?:${HANDS})\s+('[^']*'|"(?:[^"\\]|\\[\s\S])*")`, "gu");

/** Where a heredoc body is a program rather than data, and which of those runners take it as commands already — a shell's body names no escape, being the caller's own language. Which word is a shell is `SHELL_WORD`'s, the `-c` reading's own. how/learning-gate.md. */
export const SHELL = new RegExp(`^(?:${SHELL_WORD})$`, "u");
