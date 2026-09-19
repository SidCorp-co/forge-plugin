/* A child that allowed writes nothing, and so do one that died, a gate that threw and a gate the clock skipped: four meanings in one emptiness, and a case that turns it into its own sentinel asserts what three failures also produce — 3 of 15 cases of one file passed with the subject dead, and 6 of the same 15 under a gate made to throw (ISS-1909).
   Told apart once, in `answered()` in plugin/test/fixtures.mjs, and nowhere else: the sentinel is what a new case copies from its neighbour, and the copy is not covered by the mutation that proved the original.
   Reached: a conditional in a test tree, on what a child wrote or on its exit status, whose fallback is a literal. The bound is the line, and a fallback that calls something is a retry rather than a sentinel. */

import { lineAt } from "../../markdown.mjs";
import { blanked } from "./wall-clock.mjs";

export const READER = "plugin/test/fixtures.mjs";

const QUOTE = "[\"'\\u0060]";
const LITERAL = "(?:(?:null|undefined|0|false)\\b|\\{\\}|\\[\\]|" + QUOTE + "(?:(?!" + QUOTE + ").)*" + QUOTE + ")";
const ANSWER = "(?:\\.stdout\\b|\\bstatus\\s*[!=]==?\\s*0\\b)";
const SHAPES = [
  new RegExp(ANSWER + "[^?;{}\\n]*\\?[^?:;{}\\n]*:\\s*" + LITERAL, "gu"),
  new RegExp(ANSWER + "[^;{}\\n]*\\|\\|\\s*" + LITERAL, "gu"),
];

export const silencesIn = (text, rel) => {
  if (rel === READER || rel.endsWith(`/${READER}`)) return [];
  const code = blanked(text);
  const out = [];
  for (const shape of SHAPES) {
    shape.lastIndex = 0;
    let hit = shape.exec(code);
    while (hit) {
      out.push(`${rel}:${lineAt(code, hit.index)} turns a child's silence into the value a case reads: `
        + `a child that allowed wrote nothing, and so did one that died and one the runner skipped. `
        + `Assert the child's exit status before reading what it wrote — ${READER} does it once, in answered().`);
      hit = shape.exec(code);
    }
  }
  return out.sort();
};
