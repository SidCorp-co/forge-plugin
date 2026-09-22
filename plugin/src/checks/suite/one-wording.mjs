/* A module composes a refusal, the test file that imports it pins the wording, and a file reaching
   the same refusal through a verb re-states the whole sentence instead of proving its route. Reading
   the suite by hand found that shape over 379 files and cost seven readers; the rows it verified
   were cut by ISS-2217, ISS-2218 and ISS-2219, and nothing refused the next one (ISS-2122).
   Reached: one assertion pattern, 28 literal characters or more, standing in a test file that
   reaches the composing module through its own imports and in one that does not.

   The import line stands in for the route and is not the route. A file that reaches the module
   neither way and repeats the sentence anyway is a second home for that wording by another route,
   and is reported as one: what this holds is that a sentence has one home, not that every other
   reader spawned. What it does not see is a pair both of whose files spawn — 72 test files import no
   module of this repository at all — and no rule here will find those. */

import { lineAt } from "../../markdown.mjs";
import { spansIn } from "./wall-clock.mjs";

/** The shortest wording this refuses to see pinned twice. Below it a pattern is a status word or a
 *  flag name, which many files share for reasons that are not this one; the census that measured
 *  this class read at the same floor and the pairs it verified are all above it. */
export const FLOOR = 28;

const TEST_FILE = /^plugin\/test\/.*\.test\.mjs$/u;
const SOURCE_FILE = /^(?:plugin\/src|plugin\/hooks|tools)\//u;
const VENDORED = "/vendor/";

const QUOTED = new Set(["string", "template"]);

/* An interpolation and an escaped newline each break a composed sentence into runs that stand in the
   output whole, so a pattern is matched against the runs and never across one. */
const RUNS = /\$\{[^}]*\}|\\n/u;
const ESCAPED = /\\(.)/gu;
const unescaped = (one) => one.replace(ESCAPED, "$1");

/** Every sentence this module composes: the text of each quoted run a `+` chain joins, which is how
 *  a refusal longer than a line is written here, split at what it interpolates. */
export const composedIn = (text) => {
  const quoted = spansIn(text).filter((one) => QUOTED.has(one.kind));
  const joined = [];
  for (const one of quoted) {
    const last = joined.at(-1);
    const between = last ? text.slice(last.to + 1, one.from - 1) : null;
    if (last && /^[\s+]*$/u.test(between)) {
      last.parts.push(one);
      last.to = one.to;
      continue;
    }
    joined.push({ at: one.from, to: one.to, parts: [one] });
  }
  return joined.map((one) => ({
    line: lineAt(text, one.at),
    runs: one.parts.flatMap((part) => text.slice(part.from, part.to).split(RUNS)).map(unescaped),
  }));
};

const META = new Set(["^", "$", ".", "|", "?", "*", "+", "(", ")", "[", "]", "{", "}"]);

/* What a group writes between its own paren and the text inside it. Read as one token, because the
   `:` of `(?:` is syntax and a reader taking it for a character prefixed every run of every grouped
   pattern with it and matched no source (found in review at 0e97d40). */
const OPENS_A_GROUP = /^\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>)/u;

/* The longest run of a pattern that is literal text. A class or a quantifier ends a run and takes
   the character it quantifies with it, so `line\(s\)` reads as `line(s)` and `\d+ file` as ` file`. */
const regexCore = (raw) => {
  const runs = [];
  let run = "";
  for (let at = 0; at < raw.length; at += 1) {
    const one = raw[at];
    if (one === "\\") {
      if (/[A-Za-z0-9]/u.test(raw[at + 1] ?? "")) {
        runs.push(run);
        run = "";
      } else run += raw[at + 1] ?? "";
      at += 1;
    } else if (!META.has(one)) run += one;
    else {
      if (one === "?" || one === "*" || one === "+" || one === "{") run = run.slice(0, -1);
      runs.push(run);
      run = "";
      if (one === "[") at = raw.indexOf("]", at + 1) < 0 ? raw.length : raw.indexOf("]", at + 1);
      if (one === "(") at += (OPENS_A_GROUP.exec(raw.slice(at + 1))?.[0].length ?? 0);
    }
  }
  return [...runs, run].sort((a, b) => b.length - a.length)[0] ?? "";
};

/** The pairs a walk found that a table does not carry, as the refusals a developer reads, and the
 *  entries of that table the walk no longer finds. The two are one property and are split here only
 *  because they ask for different acts: one file to shorten, one record to delete. */
export const against = (found, declared) => ({
  fresh: found.filter((one) => !declared.some((each) => each.sentence === one.sentence
    && each.elsewhere === one.elsewhere)).map((one) => says(one)),
  stale: declared.filter((one) => !found.some((each) => each.sentence === one.sentence
    && each.elsewhere === one.elsewhere)).map((one) => `${one.sentence} · ${one.elsewhere}`),
});

const stringCore = (raw) => raw.split(RUNS).map(unescaped).sort((a, b) => b.length - a.length)[0] ?? "";

/* A refusal proved absent is a different claim from the refusal, so the sentence there is a marker
   and not a second home: `park.test.mjs` asserts `route.mjs`'s wording precisely to say it did not
   fire (ISS-2122). */
const NEGATED = /doesNotMatch|doesNotInclude|notMatch/u;
const ASSERTION = /\bassert(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\(/gu;

const callsIn = (code) => {
  const out = [];
  for (const hit of code.matchAll(ASSERTION)) {
    let depth = 0;
    let at = hit.index + hit[0].length - 1;
    for (; at < code.length; at += 1) {
      if (code[at] === "(") depth += 1;
      else if (code[at] === ")" && (depth -= 1) === 0) break;
    }
    out.push({ from: hit.index, to: at, head: hit[0] });
  }
  return out;
};

/** Every wording an assertion in this file pins: the pattern as it is written, the longest literal
 *  run of it, and the line it stands on. The pattern carries its kind, so a regular expression and a
 *  string spelling the same characters are two patterns and not one — which is what keeps a presence
 *  check with a capture from reading as the wording check beside it (ISS-2218). */
export const pinnedIn = (text) => {
  const spans = spansIn(text);
  const code = spans.reduce((each, one) =>
    `${each.slice(0, one.from)}${" ".repeat(one.to - one.from)}${each.slice(one.to)}`, text);
  const calls = callsIn(code);
  const out = [];
  for (const one of spans) {
    if (one.kind === "comment") continue;
    const call = calls.find((each) => one.from > each.from && one.from < each.to);
    if (!call || NEGATED.test(call.head)) continue;
    const raw = text.slice(one.from, one.to);
    const core = one.kind === "regex" ? regexCore(raw) : stringCore(raw);
    if (core.length >= FLOOR) out.push({ pattern: `${one.kind} ${raw}`, core, line: lineAt(text, one.from) });
  }
  return out;
};

const RELATIVE = /(?:from|import)\s*\(?\s*(["'])(\.[^"']*)\1/gu;
const resolved = (rel, spec) => {
  const at = `${rel.slice(0, rel.lastIndexOf("/"))}/${spec}`.split("/");
  const out = [];
  for (const step of at) {
    if (step === "..") out.pop();
    else if (step !== ".") out.push(step);
  }
  return out.join("/");
};

/** The modules of this repository a test file reaches in its own process, followed through the
 *  helpers it imports: a case reaching its subject through a fixture of its own is that subject's
 *  reader, and a rule counting only the direct line would call it a second home. */
export const reachedBy = (rel, textOf) => {
  const out = new Set();
  const seen = new Set([rel]);
  const queue = [rel];
  while (queue.length) {
    const one = queue.shift();
    for (const hit of (textOf(one) ?? "").matchAll(RELATIVE)) {
      const to = resolved(one, hit[2]);
      if (SOURCE_FILE.test(to)) out.add(to);
      else if (!seen.has(to) && textOf(to) !== undefined) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return out;
};

const WORD = /\s+/u;

/* The shortest leading words of a sentence that no other sentence this repository composes carries,
   which is what a file proving its route has to match and no more. */
const fragmentOf = (core, sentences) => {
  const words = core.split(WORD);
  for (let count = 1; count < words.length; count += 1) {
    const head = words.slice(0, count).join(" ");
    if (head.length >= 12 && sentences.filter((one) => one.includes(head)).length === 1) return head;
  }
  return null;
};

const says = (one) => `${one.elsewhere} pins, at line ${one.at}, the whole of a sentence `
  + `${one.module} composes, and ${one.home} pins the same pattern at line ${one.homeAt}. That file `
  + `imports the module composing it and is the sentence's home. A file reaching the sentence any `
  + `other way proves its route with one fragment of it: ${one.fragment === null
    ? `no fragment of this sentence is its own, so shorten to what this case is about and say why`
    : `shorten the pattern in ${one.elsewhere} to \`${one.fragment}\``}, and keep every assertion `
  + `this case makes about what the call did. The measure is lexical — it reads one sentence pinned `
  + `twice and nothing of a claim restated in other words.`;

/** Every sentence pinned on both sides of the import line, over the whole walked set.
 *
 *  Three readings this cannot settle, each of which reports nothing rather than reporting a file for
 *  something it did not do. A wording more than one module composes has no one home to name, so it
 *  is left alone even where one of them is the sentence meant. A pattern whose literal run falls
 *  below the floor is a status word. And an assertion reached through a helper that wraps `assert`
 *  under another name is one this does not read at all. */
export const pairsOver = (files) => {
  const textOf = (rel) => files.find((one) => one.rel === rel)?.text;
  const tests = files.filter((one) => TEST_FILE.test(one.rel));
  const sources = files.filter((one) => SOURCE_FILE.test(one.rel) && !one.rel.includes(VENDORED));
  const composed = sources.map((one) => ({ rel: one.rel, runs: composedIn(one.text).flatMap((each) => each.runs) }));
  const sentences = composed.flatMap((one) => one.runs);
  const reaches = new Map(tests.map((one) => [one.rel, reachedBy(one.rel, textOf)]));

  const patterns = new Map();
  for (const one of tests) {
    for (const pin of pinnedIn(one.text)) {
      if (!patterns.has(pin.pattern)) patterns.set(pin.pattern, { core: pin.core, where: [] });
      patterns.get(pin.pattern).where.push({ rel: one.rel, line: pin.line });
    }
  }

  const out = [];
  for (const { core, where } of patterns.values()) {
    if (new Set(where.map((one) => one.rel)).size < 2) continue;
    const modules = composed.filter((one) => one.runs.some((run) => run.includes(core)));
    if (modules.length !== 1) continue;
    const module = modules[0].rel;
    const homes = where.filter((one) => reaches.get(one.rel).has(module));
    const elsewhere = where.filter((one) => !reaches.get(one.rel).has(module));
    if (!homes.length || !elsewhere.length) continue;
    const fragment = fragmentOf(core, sentences);
    for (const one of elsewhere) {
      out.push({
        sentence: core,
        module,
        home: homes[0].rel,
        homeAt: homes[0].line,
        elsewhere: one.rel,
        at: one.line,
        fragment,
      });
    }
  }
  return out.sort((one, next) => `${one.elsewhere}${one.at}`.localeCompare(`${next.elsewhere}${next.at}`));
};

export const refusalFor = says;

/* Where the table of what stands is, and why it is not here. A module under `plugin/src` spelling
   those sentences is a module composing them, which is the very thing this reads a source for: the
   table declared beside the rule gave every sentence in it a second composer and the walk went
   silent over all fifteen. It lives in this check's own case instead, where nothing reads it as
   either a composition or an assertion, and the reason is written at both ends. */
