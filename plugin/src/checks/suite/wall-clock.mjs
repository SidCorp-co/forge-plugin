/* A case that bounds elapsed real time asserts the share of the box it got, so it goes red when
   another gate shares the machine and green when none does — a gate a run re-runs rather than reads
   (ISS-1274). The escape, `patience()` in plugin/test/patience.mjs, widens a bound with the load and
   is a hang guard only: the load average lags a burst and outlives it, so nothing a case claims may
   rest on that number. Reached here: three clocks, inline or through a local, bounded in one breath. */

import { lineAt } from "../../markdown.mjs";

const CLOCK = String.raw`(?:Date\.now\(\)|performance\.now\(\)|process\.hrtime(?:\.bigint)?\([^)]*\))`;
const NUMBER = String.raw`\d[\d_]*(?:\.\d+)?`;

/* The words a `/` may follow and still open a regular expression, held as a list because the window
   below is sized off the longest of them and a word added here has to move that window with it. */
const OPENS_A_REGEX_WORDS = ["return", "typeof", "case", "in", "of", "do", "else", "yield", "await"];

const OPENS_A_REGEX = new RegExp(
  String.raw`(?:[([{,;:=!&|?+\-*%<>~^]|\b(?:${OPENS_A_REGEX_WORDS.join("|")}))\s*$`, "u");

/* The most text that decision can rest on. The pattern is anchored at its end, so it reads the
   longest word and one character further back — what `\b` needs to know the word is not the tail of
   an identifier, `footypeof /x/` being a division. */
const LOOKBEHIND = Math.max(...OPENS_A_REGEX_WORDS.map((word) => word.length)) + 1;
const WHITESPACE = /\s/u;

/* Whether the `/` at `at` opens a regular expression, decided from that window rather than from
   `text.slice(0, at)`, which copied the file's whole prefix once per candidate `/` and made the scan
   quadratic in file length (ISS-1941). The whitespace run is walked by index and stands back in as
   one space, which `\s*$` reads the same; two candidates cannot walk the same run, a `/` being
   itself the non-whitespace a walk stops at, so the walking is linear over the file. */
const opensARegex = (text, at) => {
  let back = at;
  while (back > 0 && WHITESPACE.test(text[back - 1])) back -= 1;
  const head = text.slice(Math.max(0, back - LOOKBEHIND), back);
  return OPENS_A_REGEX.test(back < at ? `${head} ` : head);
};

/** Comments and every kind of quoted text, blanked to spaces so line and column still hold. */
export const blanked = (text) => {
  const out = Array.from(text);
  const hide = (from, to) => {
    for (let at = from; at < to && at < out.length; at += 1) if (out[at] !== "\n") out[at] = " ";
  };
  let at = 0;
  while (at < text.length) {
    const two = text.slice(at, at + 2);
    if (two === "//") {
      const end = text.indexOf("\n", at);
      hide(at, end === -1 ? text.length : end);
      at = end === -1 ? text.length : end;
    } else if (two === "/*") {
      const end = text.indexOf("*/", at + 2);
      hide(at, end === -1 ? text.length : end + 2);
      at = end === -1 ? text.length : end + 2;
    } else if (text[at] === "'" || text[at] === '"' || text[at] === "`") {
      const quote = text[at];
      let end = at + 1;
      while (end < text.length && text[end] !== quote) end += text[end] === "\\" ? 2 : 1;
      hide(at + 1, end);
      at = end + 1;
    } else if (text[at] === "/" && opensARegex(text, at)) {
      let end = at + 1;
      let inClass = false;
      while (end < text.length && (inClass || text[end] !== "/")) {
        if (text[end] === "\\") end += 1;
        else if (text[end] === "[") inClass = true;
        else if (text[end] === "]") inClass = false;
        else if (text[end] === "\n") break;
        end += 1;
      }
      hide(at + 1, end);
      at = end + 1;
    } else {
      at += 1;
    }
  }
  return out.join("");
};

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
