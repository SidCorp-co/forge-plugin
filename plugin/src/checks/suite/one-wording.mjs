/* A module composes a refusal, one test file pins its wording, and every other file reaching the
   same refusal proves its own case with one fragment of it. Reading the suite by hand found the
   opposite shape over 379 files and cost seven readers; ISS-2217, ISS-2218, ISS-2219 and ISS-2264
   cut the rows that reading and this check verified, and nothing refused the next one (ISS-2122).
   Reached: two test files pinning one wording of 28 literal characters or more, where at least one
   of the files holding it reaches the composing module through its own imports.

   The import line picks the home and does not decide the debt: a sentence two importing files both
   pin whole is a second home as much as one a spawning file repeats (ISS-2269). What this names
   nothing for is a sentence none of whose files reaches the module — every reader spawns, or
   imports a neighbour of it — since the rule below has no reader there to name as the home. The
   lexical reading sees those as plainly as the rest, and ISS-2282 owns the rule that names them. */

import { lineAt } from "../../markdown.mjs";
import { spansIn } from "./wall-clock.mjs";

/** The shortest wording this refuses to see pinned twice. Below it a pattern is a status word or a
 *  flag name, which many files share for reasons that are not this one; the census that measured
 *  this class read at the same floor and the pairs it verified are all above it. */
export const FLOOR = 28;

/* Both test trees: the plugin's own, and the tests of this repository's scripts, which sit under
   tools/test so the plugin travels alone and are therefore no source of tools/ (ISS-2537). */
const TEST_FILE = /^(?:plugin|tools)\/test\/.*\.test\.mjs$/u;
const SOURCE_FILE = /^(?:plugin\/src\/|plugin\/hooks\/|tools\/(?!test\/))/u;
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
    runs: one.parts.map((part) => text.slice(part.from, part.to)).join("").split(RUNS).map(unescaped),
  }));
};

const META = new Set(["^", "$", ".", "|", "?", "*", "+", "(", ")", "[", "]", "{", "}"]);

/* The escapes that name one character rather than a class of them, read whole: a reader consuming
   only the `\\x` of `\\x61` left `61` standing as text, and the run it headed matched no source. */
const NAMES_A_CHARACTER = /^(?:x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4}))/u;

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
      const named = NAMES_A_CHARACTER.exec(raw.slice(at + 1));
      if (named) {
        run += String.fromCodePoint(Number.parseInt(named[1] ?? named[2] ?? named[3], 16));
        at += named[0].length;
      } else if (/[A-Za-z0-9]/u.test(raw[at + 1] ?? "")) {
        runs.push(run);
        run = "";
        at += 1;
      } else {
        run += raw[at + 1] ?? "";
        at += 1;
      }
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

/* How many arguments an assertion spends on what it is comparing, after which anything left is the
   message it prints. Two everywhere but the three that judge one value — `throws` spends two as much
   as `equal` does, its second being the error it expects, and a reader taking that for a message
   unpinned every refusal `assert.throws` is how this suite proves. A verb named nowhere here is read
   as spending two, which pins a sentence rather than passing over one. */
const JUDGES_ONE_VALUE = /^assert\s*\($|\.\s*(?:ok|fail)\s*\($/u;

/* Where each top-level argument of a call begins, the call's own text masked so a comma inside a
   nested call, an array or a string is not an argument boundary here. */
const argumentsIn = (code, from, to) => {
  const out = [from + 1];
  let depth = 0;
  for (let at = from + 1; at < to; at += 1) {
    if ("([{".includes(code[at])) depth += 1;
    else if (")]}".includes(code[at])) depth -= 1;
    else if (code[at] === "," && depth === 0) out.push(at + 1);
  }
  return out;
};

const callsIn = (code) => {
  const out = [];
  for (const hit of code.matchAll(ASSERTION)) {
    let depth = 0;
    let at = hit.index + hit[0].length - 1;
    const opens = at;
    for (; at < code.length; at += 1) {
      if (code[at] === "(") depth += 1;
      else if (code[at] === ")" && (depth -= 1) === 0) break;
    }
    const args = argumentsIn(code, opens, at);
    out.push({ from: hit.index, to: at, head: hit[0], message: args[JUDGES_ONE_VALUE.test(hit[0]) ? 1 : 2] ?? at });
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
    if (!call || NEGATED.test(call.head) || one.from >= call.message) continue;
    const raw = text.slice(one.from, one.to);
    const core = one.kind === "regex" ? regexCore(raw) : stringCore(raw);
    if (core.length >= FLOOR) out.push({ pattern: `${one.kind} ${raw}`, core, line: lineAt(text, one.from) });
  }
  return out;
};

const RELATIVE = /(?:from|import)\s*\(?\s*(["'])(\.[^"']*)\1/gu;
const REEXPORT = /export\s+(?:\*|\{[^{}]*\})\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from\s*(["'])(\.[^"']*)\1/gu;
const resolved = (rel, spec) => {
  const at = `${rel.slice(0, rel.lastIndexOf("/"))}/${spec}`.split("/");
  const out = [];
  for (const step of at) {
    if (step === "..") out.pop();
    else if (step !== ".") out.push(step);
  }
  return out.join("/");
};

/* Every module a module hands on whole: a binding re-exported is that module's own, so a file
   importing the door reaches what stands behind it and is that sentence's reader too. An ordinary
   import is not a door — a module using another does not make its wording the importer's subject. */
const doorsOf = (rel, textOf, seen = new Set()) => {
  if (seen.has(rel)) return seen;
  seen.add(rel);
  for (const hit of (textOf(rel) ?? "").matchAll(REEXPORT)) {
    const to = resolved(rel, hit[2]);
    if (SOURCE_FILE.test(to)) doorsOf(to, textOf, seen);
  }
  return seen;
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
      if (SOURCE_FILE.test(to)) {
        out.add(to);
        for (const door of doorsOf(to, textOf)) out.add(door);
      } else if (!seen.has(to) && textOf(to) !== undefined) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return out;
};

const WORD = /\s+/u;

/* The shortest leading words of a sentence that no other sentence this repository composes carries,
   which is what a file proving its route has to match and no more — and no longer than half of the
   home's pin, since a fragment above that is the same wording again and the refusal would name the
   file a second time. */
const fragmentOf = (core, sentences, most) => {
  const words = core.split(WORD);
  for (let count = 1; count < words.length; count += 1) {
    const head = words.slice(0, count).join(" ");
    if (head.length > most) return null;
    if (head.length >= 12 && sentences.filter((one) => one.includes(head)).length === 1) return head;
  }
  return null;
};

const says = (one) => `${one.elsewhere} pins, at line ${one.at}, a sentence ${one.module} composes, `
  + `and ${one.home} pins the same wording at line ${one.homeAt}, a pin carrying more than `
  + `half of another being that wording whichever pattern spells it. That file reaches the module `
  + `composing it and is the sentence's home — of the files that do, the one named for the module, then `
  + `the one pinning most of what it composes. Any other file proves its route with one fragment of it: `
  + `${one.fragment === null
    ? `no fragment of this sentence is its own, so shorten to what this case is about and say why`
    : `shorten the pattern in ${one.elsewhere} to \`${one.fragment}\``}, or, where the assertion `
  + `compares an exact value, compare it against a constant the module exports; and keep every `
  + `assertion this case makes about what the call did. The measure is lexical — it reads one `
  + `sentence pinned twice and nothing of a claim restated in other words.`;

/** How much of one pin another has to carry to be the same wording. A fragment is what is left once
 *  most of a sentence is cut away, and every fragment the cuts of ISS-2217 and ISS-2264 kept sits
 *  under half of the pin it was cut from; a pin carrying more than half of another is that sentence
 *  restated, and equality is the case where the two lengths are one. */
const MOST = 0.5;

const oneWording = (a, b) => {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length > long.length * MOST && long.includes(short);
};

/* Pins joined into one sentence through that relation, so a string, a regex and a longer line
   carrying either meet, which a key on the pattern would hold apart. */
const groupsOf = (pins) => {
  const cores = [...new Set(pins.map((one) => one.core))].sort((a, b) => a.length - b.length);
  const root = new Map(cores.map((one) => [one, one]));
  const find = (one) => (root.get(one) === one ? one : find(root.get(one)));
  for (let at = 0; at < cores.length; at += 1) {
    for (let next = at + 1; next < cores.length && cores[next].length * MOST < cores[at].length; next += 1) {
      if (cores[next].includes(cores[at])) root.set(find(cores[next]), find(cores[at]));
    }
  }
  const out = new Map();
  for (const one of pins) out.set(find(one.core), [...(out.get(find(one.core)) ?? []), one]);
  return [...out.values()];
};

const BARE = /^plugin\/(?:src|test)\/|^plugin\/|^tools\//u;
const bare = (rel) => rel.replace(BARE, "").replace(/(?:\.test)?\.mjs$/u, "").split("/");

/* How far a test file is named for a module: its own name the module's, then a directory on its path
   carrying that name, which is how this suite mirrors the source it proves. */
const namedFor = (test, module) => {
  const steps = bare(test);
  const name = bare(module).at(-1);
  return steps.at(-1) === name ? 2 : Number(steps.slice(0, -1).includes(name));
};

/** Every sentence pinned whole in more than one test file, over the whole walked set, and each site
 *  that restates what the sentence's home pins.
 *
 *  A site is named where its pin and one of the home's are one wording, and never through a third
 *  pin between them: a fragment under half of the home's pin stays a fragment whatever else another
 *  file pins. What is left once the home and the sites naming it are set aside is read again as
 *  sentences of its own.
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
  const joined = composed.map((one) => ({ rel: one.rel, text: one.runs.join("\u0000") }));
  const composers = new Map();
  const composerOf = (core) => {
    if (!composers.has(core)) composers.set(core, joined.filter((one) => one.text.includes(core)).map((one) => one.rel));
    return composers.get(core);
  };
  const reaches = new Map(tests.map((one) => [one.rel, reachedBy(one.rel, textOf)]));
  const pins = tests.flatMap((one) => pinnedIn(one.text).map((pin) => ({ ...pin, rel: one.rel })))
    .filter((one) => composerOf(one.core).length < 2);
  const homeOf = (rels, module) => rels.filter((rel) => reaches.get(rel).has(module))
    .map((rel) => ({ rel, named: namedFor(rel, module), weight: new Set(pins.filter((one) => one.rel === rel
      && composerOf(one.core).includes(module)).map((one) => one.core)).size }))
    .sort((a, b) => b.named - a.named || b.weight - a.weight || a.rel.localeCompare(b.rel))[0]?.rel;

  const out = [];
  const settle = (among) => {
    for (const group of groupsOf(among)) {
      const modules = new Set(group.flatMap((one) => composerOf(one.core)));
      const rels = [...new Set(group.map((one) => one.rel))];
      const home = modules.size === 1 && rels.length > 1 ? homeOf(rels, [...modules][0]) : undefined;
      if (!home) continue;
      const held = group.filter((one) => one.rel === home);
      const sentence = group.filter((one) => composerOf(one.core).length)
        .sort((a, b) => b.core.length - a.core.length)[0].core;
      const named = [];
      for (const one of group.filter((each) => each.rel !== home)) {
        const against = held.find((each) => oneWording(one.core, each.core));
        if (!against) continue;
        named.push(one);
        out.push({ sentence, module: [...modules][0], home, homeAt: against.line, elsewhere: one.rel,
          at: one.line, fragment: fragmentOf(sentence, sentences, against.core.length * MOST) });
      }
      settle(group.filter((one) => one.rel !== home && !named.includes(one)));
    }
  };
  settle(pins);
  return out.sort((one, next) => `${one.elsewhere}${one.at}`.localeCompare(`${next.elsewhere}${next.at}`));
};

export const refusalFor = says;

/* Where the table of what stands is, and why it is not here. A module under `plugin/src` spelling
   those sentences is a module composing them, which is the very thing this reads a source for: the
   table declared beside the rule gave every sentence in it a second composer and the walk went
   silent over all fifteen. It lives in this check's own case instead, where nothing reads it as
   either a composition or an assertion, and the reason is written at both ends. */
