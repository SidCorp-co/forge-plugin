/* An assertion that passes whichever way the code went guards nothing, and reads in a green suite
   exactly like one that guards something (ISS-2502). Three shapes are mechanical enough to refuse:
   a disjunction a truthiness assert takes whole, a truthiness assert on a whole command's output,
   and an assert inside a loop over an array that is empty. What an assertion should have said
   instead is a judgement, and the review's. */

import { lineAt } from "../../markdown.mjs";
import { blanked, closesAfter } from "../suite/wall-clock.mjs";
import { argumentsAt, atTopLevel } from "./calls.mjs";

const NAME = String.raw`[A-Za-z_$][\w$]*`;

/* The two spellings of "this is truthy", the only asserts a disjunction or a bare value can pass
   vacuously: `equal` and `match` compare the value against something the case wrote. */
const TRUTHY = /\bassert(?:\.ok)?\s*\(/gu;

/* A command's whole output: what it wrote to a stream, or what a call that runs a child answered
   with. A spawn answers with an object whether the child succeeded or not, and a helper wrapping
   one answers with whatever the child said, so truthiness asks only that something was. */
const STREAM = new RegExp(String.raw`^${NAME}\.(?:stdout|stderr|output)$`, "u");
const BARE = new RegExp(`^${NAME}$`, "u");

/* The calls that start a child, and the harness helper this suite runs a hook through. A function
   the same file declares is a command where its own body makes one of these calls, read to a fixed
   point; an imported helper is out of this reading's reach. */
const SPAWNS = ["spawnSync", "execFileSync", "execSync", "spawn", "execFile", "exec", "fork", "callHook"];

export const SHAPES = {
  disjunction: "a disjunction inside a truthiness assert",
  output: "a bare truthiness assert on a whole command output",
  empty: "an assert inside a loop over an empty array",
};

const INSTEAD = {
  disjunction: "assert the one outcome the contract names, each branch in a case of its own where both are contracts",
  output: "assert the value the contract names: the exit status, and the line the command was meant to print",
  empty: "loop over the values the rule holds, or assert the array's own length where empty is the contract",
};

/** The function a name was last bound to the answer of before `at`: `const name = [await] callee(…)`
 *  with nothing after the call, so a method's answer or a chain's last link is not the callee's. */
const calleeOf = (code, name, at) => {
  const bound = new RegExp(String.raw`\b(?:const|let|var)\s+${name.replace(/\$/gu, "\\$")}\s*=\s*(?:await\s+)?(${NAME})\s*\(`, "gu");
  let found = null;
  for (const one of code.matchAll(bound)) {
    if (one.index >= at) break;
    const { close } = argumentsAt(code, one.index + one[0].length - 1);
    found = /^[ \t]*(?:[;\n]|$)/u.test(code.slice(close + 1)) ? one[1] : null;
  }
  return found;
};

const callsAny = (body, names) =>
  names.some((one) => new RegExp(String.raw`(?:^|[^\w$.])${one.replace(/\$/gu, "\\$")}\s*\(`, "u").test(body));

const FUNCTION = new RegExp(String.raw`\b(?:const|let)\s+(${NAME})\s*=\s*(?:async\s*)?(?:\([^)]*\)|${NAME})\s*=>|\bfunction\s*\*?\s*(${NAME})\s*\(`, "gu");

/** A declared function's body: its braces, or the one expression an arrow returns. */
const bodyOf = (code, from) => {
  const rest = code.slice(from);
  const lead = /^\s*/u.exec(rest)[0].length;
  if (rest[lead] === "{") return code.slice(from + lead, closesAfter(code, from + lead + 1) + 1);
  if (/^[^)]*\)\s*\{/u.test(rest)) {
    const brace = code.indexOf("{", from);
    return code.slice(brace, closesAfter(code, brace + 1) + 1);
  }
  return rest.slice(0, rest.search(/;|\n(?=\S)|$/u));
};

/** The functions this file declares whose body starts a child, directly or through another of them. */
const commandsIn = (code) => {
  const declared = [...code.matchAll(FUNCTION)]
    .map((one) => ({ name: one[1] ?? one[2], body: bodyOf(code, one.index + one[0].length) }));
  const commands = new Set(SPAWNS);
  let grew = true;
  while (grew) {
    grew = false;
    for (const { name, body } of declared) {
      if (commands.has(name) || !callsAny(body, [...commands])) continue;
      commands.add(name);
      grew = true;
    }
  }
  return commands;
};

const wholeOutput = (code, first, commands) => {
  const held = code.slice(first.from, first.to).trim();
  if (STREAM.test(held)) return true;
  return BARE.test(held) && commands.has(calleeOf(code, held, first.from));
};

/** An argument with every pair of parentheses wrapping it whole taken off, so `((a || b))` is read
 *  as `a || b` is. */
const unwrapped = (code, { from, to }) => {
  let span = { from: from + code.slice(from, to).search(/\S/u), to: from + code.slice(from, to).trimEnd().length };
  while (code[span.from] === "(" && argumentsAt(code, span.from).close === span.to - 1) {
    span = { from: span.from + 1, to: span.to - 1 };
  }
  return span;
};

const truthyFindings = (code) => {
  const commands = commandsIn(code);
  const out = [];
  for (const one of code.matchAll(TRUTHY)) {
    if (/[.\w$]$/u.test(code.slice(0, one.index))) continue;
    const { args } = argumentsAt(code, one.index + one[0].length - 1);
    if (args.length === 0) continue;
    const first = unwrapped(code, args[0]);
    if (atTopLevel(code, first.from, first.to, "||")) out.push({ at: one.index, shape: "disjunction" });
    else if (wholeOutput(code, args[0], commands)) out.push({ at: one.index, shape: "output" });
  }
  return out;
};

/* An array is empty for good only where nothing in its file fills it or binds the name again. */
const emptyNames = (code) => {
  const declared = new RegExp(String.raw`\b(?:const|let|var)\s+(${NAME})\s*=\s*\[\s*\]\s*[;\n]`, "gu");
  return [...code.matchAll(declared)].map((one) => ({ name: one[1], at: one.index, end: one.index + one[0].length }))
    .filter(({ name, at, end }) => {
      const rest = code.slice(0, at) + code.slice(end);
      return !new RegExp(String.raw`(?:^|[^\w$.])${name}\s*(?:\.\s*(?:push|unshift|splice|fill)\s*\(|\[[^\]]*\]\s*=[^=]|=[^=>])`, "u").test(rest);
    }).map(({ name }) => name);
};

/** Where the body of a loop whose header closes at `close` ends: its braces, or its one statement. */
const loopBody = (code, close) => {
  const start = close + 1 + /^\s*/u.exec(code.slice(close + 1))[0].length;
  if (code[start] === "{") return code.slice(start, closesAfter(code, start + 1) + 1);
  const end = code.indexOf(";", start);
  return code.slice(start, end < 0 ? code.length : end);
};

const emptyLoopFindings = (code) => {
  const over = [String.raw`\[\s*\]`, ...emptyNames(code)].join("|");
  const asserts = /\bassert\b/u;
  const out = [];
  const header = new RegExp(String.raw`\bfor\s*\(\s*(?:const|let|var)\s+[^;]*?\bof\s+(?:${over})\s*\)`, "gu");
  for (const one of code.matchAll(header)) {
    if (asserts.test(loopBody(code, one.index + one[0].length - 1))) out.push({ at: one.index, shape: "empty" });
  }
  const each = new RegExp(String.raw`(?<![.\w$])(?:${over})\s*\.\s*forEach\s*\(`, "gu");
  for (const one of code.matchAll(each)) {
    const open = one.index + one[0].length - 1;
    if (asserts.test(code.slice(open, argumentsAt(code, open).close))) out.push({ at: one.index, shape: "empty" });
  }
  return out;
};

/** Every vacuous assertion in one test file, each as its line and the shape that fired. */
export const vacuousIn = (text, rel) => {
  const code = blanked(text);
  return [...truthyFindings(code), ...emptyLoopFindings(code)]
    .map(({ at, shape }) => ({ where: rel, line: lineAt(code, at), shape }))
    .sort((a, b) => a.line - b.line);
};

export const vacuousProblems = (found) => found.map(({ where, line, shape }) =>
  `${where}:${line} holds ${SHAPES[shape]}, which passes whether or not the behaviour happened. `
  + `Instead, ${INSTEAD[shape]}.`);
