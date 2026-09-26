/* A case that bounds elapsed real time asserts the share of the box it got, so it goes red when
   another gate shares the machine and green when none does — a gate a run re-runs rather than reads
   (ISS-1274). The escape, `patience()` in plugin/test/patience.mjs, widens a bound with the load and
   is a hang guard only: the load average lags a burst and outlives it, so nothing a case claims may
   rest on that number. Reached here: three clocks, inline or through a local, bounded in one breath. */

import { lineAt } from "../../markdown.mjs";
import { COMMENTS, LITERALS, maskOf } from "../source/lexical.mjs";

const CLOCK = String.raw`(?:Date\.now\(\)|performance\.now\(\)|process\.hrtime(?:\.bigint)?\([^)]*\))`;
const NUMBER = String.raw`\d[\d_]*(?:\.\d+)?`;

/** Comments and every kind of quoted text blanked to spaces, each literal's quotes kept, so line and
 *  column still hold. The suite and shape rules that read this share it, and a template goes whole,
 *  what its holes spell included: a clock or a child spelt inside an interpolation is out of their
 *  reach, and opening the holes to them is ISS-2212's, with a case per rule. */
export const blanked = (text) =>
  maskOf(text, { blank: [...COMMENTS, ...LITERALS], quotes: "keep", holes: "text" });

/* Where a name was last declared before it is read and still inside the braces it was declared in,
   so neither a case reusing the name for a count nor a binding a nested block has left is read as
   an elapsed. The braces are as much scope as text gives: a parameter and a hoisted `var` are not. */
/* Where the block holding a declaration ends, which is where its binding stops answering. */
export const closesAfter = (code, at) => {
  let depth = 0;
  for (let edge = at; edge < code.length; edge += 1) {
    if (code[edge] === "{") depth += 1;
    if (code[edge] === "}") {
      if (depth === 0) return edge;
      depth -= 1;
    }
  }
  return code.length;
};

const declarations = (code) => {
  const found = [];
  const clock = new RegExp(CLOCK, "u");
  const differs = (rhs) => rhs.includes("-") || /process\.hrtime\(\s*[A-Za-z_$]/u.test(rhs);
  for (const one of code.matchAll(new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)`, "gu"))) {
    const rhs = one[2];
    const measured = clock.test(rhs) && differs(rhs) && !/^\s*new Date\(/u.test(rhs);
    found.push({ name: one[1], at: one.index, until: closesAfter(code, one.index), measured });
  }
  return found;
};

const CARRIES_ON = /[\w$.\t +\-*/]/u;

/* One operand, walked out from the operator and stopping at the punctuation that ends an
   expression — so `took` is the operand of `attempts < 4` and never the `took` on the line above. */
const before = (code, at) => {
  let edge = at;
  while (edge > 0) {
    if (code[edge - 1] === ")") {
      let depth = 0;
      do {
        edge -= 1;
        depth += code[edge] === ")" ? 1 : (code[edge] === "(" ? -1 : 0);
      } while (edge > 0 && depth !== 0);
      continue;
    }
    if (!CARRIES_ON.test(code[edge - 1])) break;
    edge -= 1;
  }
  return code.slice(edge, at);
};

const after = (code, at) => {
  let edge = at;
  while (edge < code.length) {
    if (code[edge] === "(") {
      let depth = 0;
      do {
        depth += code[edge] === "(" ? 1 : (code[edge] === ")" ? -1 : 0);
        edge += 1;
      } while (edge < code.length && depth !== 0);
      continue;
    }
    if (!CARRIES_ON.test(code[edge])) break;
    edge += 1;
  }
  return code.slice(at, edge);
};

const says = (rel, line, bound) =>
  `${rel}:${line} bounds elapsed wall-clock time above by ${bound}, which asserts the share of the `
  + `machine this process got and not the tree. Assert what the case was written to catch, or put `
  + `the bound through patience() from plugin/test/patience.mjs, which is a hang guard.`;

const measures = (text, at, decls) => {
  if (new RegExp(CLOCK, "u").test(text)) return true;
  return (text.match(/[A-Za-z_$][\w$]*/gu) ?? [])
    .some((name) => decls.filter((one) => one.name === name && one.at < at && at < one.until).at(-1)?.measured);
};

/** Every ceiling on a measured elapsed in one file, as the refusals a developer reads. */
export const boundsIn = (text, rel) => {
  const code = blanked(text);
  const decls = declarations(code);
  const found = new Map();
  const note = (at, bound) => found.set(lineAt(code, at), bound);

  for (const hit of code.matchAll(new RegExp(String.raw`<=?\s*(${NUMBER})\b`, "gu"))) {
    if (measures(before(code, hit.index), hit.index, decls)) note(hit.index, hit[1]);
  }
  /* The same ceiling with its ends swapped, and the one written as a stamp newer than so long ago. */
  for (const hit of code.matchAll(new RegExp(String.raw`(${NUMBER})\s*(>=?)`, "gu"))) {
    const at = hit.index + hit[0].length;
    if (measures(after(code, at), at, decls)) note(hit.index, hit[1]);
  }
  for (const hit of code.matchAll(new RegExp(String.raw`>=?\s*${CLOCK}\s*-\s*(${NUMBER})\b`, "gu"))) {
    note(hit.index, hit[1]);
  }
  return [...found].sort(([a], [b]) => a - b).map(([line, bound]) => says(rel, line, bound));
};
