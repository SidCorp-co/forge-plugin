/* A case that computes its expectation in this process and spawns its subject under a home of its
   own has two configurations answering one assertion, and it is green only while the two agree.
   What made that visible was coolify's usage row: a constant until ISS-2129 made it a pair of
   functions reading `coolifyRoute` off the machine, after which a box whose owner ran the very
   command a refusal names went red on `forge coolify -h` in every worktree, and the failure read as
   the branch's — a release shipped off a red master and two gates were spent on it (ISS-2195).
   Reached: a file that binds anything of `plugin/src/resolve/visibility.mjs` but the two lists of
   constant names, hands a child an `XDG_CONFIG_HOME`, and names none for itself before it reads. */

import { lineAt } from "../../markdown.mjs";
import { blanked } from "./wall-clock.mjs";

/** The exports of that module whose answer cannot move with a configuration: the verb names, taken
 *  off each row's first cell, and the group headings. Everything else counts as reading the machine,
 *  an export added tomorrow among them. The list that is written out is the constants' and not the
 *  readers', because this module's own history is a constant becoming a function, and a list of
 *  readers would have gone stale in exactly the release that made this rule necessary. */
export const CONSTANT_EXPORTS = ["GROUPS", "VERB_NAMES"];

const WHOLE_MODULE = "the module whole";

const MODULE = String.raw`["'][^"']*resolve/visibility\.mjs["']`;
const LOCAL = String.raw`[A-Za-z_$][\w$]*`;

const NAMED = new RegExp(String.raw`import\s*\{([^{}]*)\}\s*from\s*${MODULE}`, "gu");
const NAMED_LATER = new RegExp(String.raw`\{([^{}]*)\}\s*=\s*await\s+import\(\s*${MODULE}\s*\)`, "gu");
const WHOLE = new RegExp(String.raw`import\s*\*\s*as\s+(${LOCAL})\s*from\s*${MODULE}`, "gu");
const WHOLE_LATER = new RegExp(
  String.raw`(?:const|let|var)\s+(${LOCAL})\s*=\s*await\s+import\(\s*${MODULE}\s*\)`, "gu");

/* The specifier is a string, which the mask blanks, so every pattern above is read off the text and
   placed by the mask: a binding a fixture spells inside its own text opens nothing here. */
const inCode = (text, code, at) => code[at] === text[at];

/* `a`, `b as c` and `b: c` all read the export first and name the local second — the middle one is
   an import clause and the last the destructuring an `await import` takes, and a reader knowing only
   the first spelling recorded `usageOf: row` as a local nothing below could spell. What decides
   whether a binding is reached is the name the module exports; what finds its uses is the local. */
const RENAMED = /\s+as\s+|\s*:\s*/u;

const clauseOf = (clause) => clause.split(",")
  .map((one) => {
    const [name, alias] = one.split(RENAMED).map((each) => each.trim());
    return { name, local: alias || name };
  })
  .filter((one) => one.name);

/** Every binding this file takes of that module in its own process, earliest first, each as its
 *  line, the exports it asked for, the locals they arrived under and the span of the binding itself.
 *  A namespace binding reads every export there is and so is never exempt. */
export const readsIn = (text) => {
  const code = blanked(text);
  const found = [];
  const add = (hit, pairs) => found.push({
    line: lineAt(code, hit.index),
    at: hit.index,
    end: hit.index + hit[0].length,
    names: pairs.map((one) => one.name),
    locals: pairs.map((one) => one.local),
  });
  for (const pattern of [NAMED, NAMED_LATER]) {
    for (const hit of text.matchAll(pattern)) {
      if (!inCode(text, code, hit.index)) continue;
      const reading = clauseOf(hit[1]).filter((one) => !CONSTANT_EXPORTS.includes(one.name));
      if (reading.length) add(hit, reading);
    }
  }
  for (const pattern of [WHOLE, WHOLE_LATER]) {
    for (const hit of text.matchAll(pattern)) {
      if (inCode(text, code, hit.index)) add(hit, [{ name: WHOLE_MODULE, local: hit[1] }]);
    }
  }
  return found.sort((one, next) => one.at - next.at);
};

/* The key is read off the text and the punctuation that decides what it is off the mask, so a key
   the mask blanks whole — quoted, or computed from a string or a template — is the key it spells,
   while the same letters inside a comment or a fixture's own text are prose, their colon blanked
   with them. */
const QUOTE = String.raw`["'\x60]`;
const AS_A_CHILD = new RegExp(String.raw`(?:\[\s*)?(${QUOTE})?XDG_CONFIG_HOME\1?(?:\s*\])?\s*:`, "gu");
const AS_A_PIN = new RegExp(
  String.raw`process\s*\.\s*env\s*(?:\.\s*|\[\s*(${QUOTE}))XDG_CONFIG_HOME\1?(?:\s*\])?\s*=(?!=)`, "gu");

/** Where this shape first stands in real code, the mask placing it by the hit's last character —
 *  the `:` or the `=`, which is never inside the quotes — or `null` where it stands nowhere. */
const placed = (text, code, pattern) => {
  for (const hit of text.matchAll(pattern)) {
    const at = hit.index + hit[0].length - 1;
    if (code[at] === text[at]) return hit.index;
  }
  return null;
};

const spelt = (name) => name.replace(/\$/gu, "\\$");

/* The same word standing as a key of something else is not a read of the binding, and a rule that
   counted it would refuse a file for a shape that is right. What it costs is the one place a read is
   followed by a colon — the middle of a ternary — read here as a key and so not as a read. */
const AS_A_KEY = /^\s*:/u;

/** Where a binding's own name is first read, past the binding that made it. */
const firstUse = (code, bindings) => {
  let first = Infinity;
  for (const one of bindings) {
    for (const local of one.locals) {
      const call = new RegExp(String.raw`(?<![.\w$])${spelt(local)}(?![\w$])`, "gu");
      for (const hit of code.matchAll(call)) {
        const after = hit.index + hit[0].length;
        if (bindings.some((each) => hit.index >= each.at && hit.index < each.end)) continue;
        if (AS_A_KEY.test(code.slice(after, after + 8))) continue;
        first = Math.min(first, hit.index);
      }
    }
  }
  return first;
};

const WHY = "A row of that table is a function where this machine has chosen something, so an "
  + "expectation computed here matches what the child printed only while the box happens to agree "
  + "with the fixture, and the suite goes red on a box whose owner ran the command a refusal named.";

const WHICH = "Which home that is belongs to this file: the same one its children are given where an "
  + "expectation is compared against them, a room of its own where they each get one.";

const says = (rel, line, names, late) => `${rel}:${line} reads ${names.join(", ")} of `
  + `plugin/src/resolve/visibility.mjs in this process while handing a child an XDG_CONFIG_HOME of `
  + `its own, so this process is the only thing here still answering out of whoever's machine it is. `
  + `${WHY} `
  + (late
    ? "This file does assign process.env.XDG_CONFIG_HOME, below the first read of that binding, "
      + "which is too late to be the home that was read: userConfig memoises on its first call. "
      + "Move the assignment above it."
    : "Assign process.env.XDG_CONFIG_HOME = the home this process is to read, above the first read, "
      + "the way plugin/test/tools/services/tool-config.test.mjs does and for the reason written "
      + `there. ${WHICH}`);

/** One refusal per binding in this file that reads the machine while its children read fixtures.
 *
 *  What this holds is that the process names a home before it reads, not that it names the child's:
 *  a file whose children each get a room of their own has no single home to share, and demanding one
 *  would refuse it for a shape that is right. Where the two do have to agree, the file says so in a
 *  case of its own — reading a value it planted back out of the home it pinned — because that is a
 *  claim about what was memoised and no reading of this text could settle it.
 *
 *  Four this reading cannot settle, none of which refuses a file for something it did not do — each
 *  asks for a line to move or leaves a file unheld. Position is not execution, so a use above the pin
 *  reached only from a call below it reads as a use above it, and an assignment inside a helper
 *  nobody calls clears the rule while it stands above the first use. A name shadowed in a nested
 *  scope is that name. A child handed its home by a fixture spelling the key elsewhere is out of
 *  reach. And the mask shared with the two rules beside this blanks a template whole, so a read
 *  spelt inside an interpolation is one this does not see: ISS-2212. */
export const splitIn = (text, rel) => {
  const code = blanked(text);
  if (placed(text, code, AS_A_CHILD) === null) return [];
  const bindings = readsIn(text);
  if (bindings.length === 0) return [];
  const pin = placed(text, code, AS_A_PIN);
  if (pin !== null && pin < firstUse(code, bindings)) return [];
  return bindings.map((one) => says(rel, one.line, one.names, pin !== null));
};
