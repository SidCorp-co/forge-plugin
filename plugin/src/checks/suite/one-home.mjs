/* A case that computes its expectation in this process and spawns its subject under a home of its
   own has two configurations answering one assertion, and it is green only while the two agree.
   What made that visible was coolify's usage row: a constant until ISS-2129 made it a pair of
   functions reading `coolifyRoute` off the machine, after which a box whose owner ran the very
   command a refusal names went red on `forge coolify -h` in every worktree, and the failure read as
   the branch's — a release shipped off a red master and two gates were spent on it (ISS-2195).
   Reached: a file that binds anything of `plugin/src/resolve/visibility.mjs` but the two lists of
   constant names, hands a child an `XDG_CONFIG_HOME` of its own, and pins none for itself. */

import { lineAt } from "../../markdown.mjs";
import { blanked } from "./wall-clock.mjs";

/** The exports of that module whose answer cannot move with a configuration: the verb names, taken
 *  off each row's first cell, and the group headings. Everything else counts as reading the machine,
 *  an export added tomorrow among them. The list that is written out is the constants' and not the
 *  readers', because this module's own history is a constant becoming a function, and a list of
 *  readers would have gone stale in exactly the release that made this rule necessary. */
export const CONSTANT_EXPORTS = ["GROUPS", "VERB_NAMES"];

const MODULE = String.raw`["'][^"']*resolve/visibility\.mjs["']`;

const NAMED = new RegExp(String.raw`import\s*\{([^{}]*)\}\s*from\s*${MODULE}`, "gu");
const NAMED_LATER = new RegExp(String.raw`\{([^{}]*)\}\s*=\s*await\s+import\(\s*${MODULE}\s*\)`, "gu");
const WHOLE = new RegExp(String.raw`import\s*\*\s*as\s+[A-Za-z_$][\w$]*\s*from\s*${MODULE}`, "gu");
const WHOLE_LATER = new RegExp(
  String.raw`(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+import\(\s*${MODULE}\s*\)`, "gu");

/* The specifier is a string, which the mask blanks, so every pattern above is read off the text and
   placed by the mask: a binding a fixture spells inside its own text opens nothing here. */
const inCode = (text, code, at) => code[at] === text[at];

/* `a` and `b as c` both read `b`: what decides is the name the module exports, never the local one. */
const asked = (clause) => clause.split(",")
  .map((one) => one.split(/\s+as\s+/u)[0].trim())
  .filter(Boolean);

/** What this file reads of that module in its own process, as `[line, names]`, a namespace binding
 *  reading every export there is. */
export const readsIn = (text) => {
  const code = blanked(text);
  const found = [];
  for (const [pattern, whole] of [[NAMED, false], [NAMED_LATER, false], [WHOLE, true], [WHOLE_LATER, true]]) {
    for (const hit of text.matchAll(pattern)) {
      if (!inCode(text, code, hit.index)) continue;
      const names = whole ? ["the module whole"] : asked(hit[1]);
      const reading = names.filter((one) => whole || !CONSTANT_EXPORTS.includes(one));
      if (reading.length) found.push([lineAt(code, hit.index), reading]);
    }
  }
  return found.sort((one, next) => one[0] - next[0]);
};

const HANDS_A_CHILD = /(?<![.\w$])XDG_CONFIG_HOME\s*:/u;
const PINS_ITS_OWN = /process\s*\.\s*env\s*\.\s*XDG_CONFIG_HOME\s*=(?!=)/u;

const says = (rel, line, names) =>
  `${rel}:${line} reads ${names.join(", ")} of plugin/src/resolve/visibility.mjs in this process `
  + `while handing a child an XDG_CONFIG_HOME of its own, so one side of an assertion here answers `
  + `out of whoever's machine this is and the other out of a fixture. A row of that table is a `
  + `function where this machine has chosen something, so the two sides agree only while the box `
  + `happens to agree with the fixture, and the suite goes red on a box whose owner ran the command `
  + `a refusal named. Assign process.env.XDG_CONFIG_HOME = the home this file's children are given, `
  + `above the first read, the way plugin/test/tools/services/tool-config.test.mjs does and for the `
  + `reason written there.`;

/** One refusal per binding in this file that reads the machine while a child reads a fixture. */
export const splitIn = (text, rel) => {
  const code = blanked(text);
  if (!HANDS_A_CHILD.test(code) || PINS_ITS_OWN.test(code)) return [];
  return readsIn(text).map(([line, names]) => says(rel, line, names));
};
