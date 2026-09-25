/* A path in a `RegExp` source is read as a pattern, so the one string it cannot match is the path
   it was built from: `iss-1477+1447` means "one or more 7", `.` matches anything, `(` throws
   (ISS-1442). A batch id joins its keys with `+` and names the run's scratch root, so 40 cases in
   16 files went red for the directory they were handed. `escaped()` in plugin/test/fixtures.mjs is
   the way out where the pattern needs operators around the path, `includes` where it does not.
   Reached: the first argument of every RegExp call, built or spelt, in either test tree. */

import { lineAt } from "../../markdown.mjs";
import { calleeOf, pairsOf, shapeOf } from "./regex-shape.mjs";
import { blanked, closesAfter } from "./wall-clock.mjs";

/** Where a path comes from: the node routes that make one, and the environment that hands one over. */
const MAKERS = "tmpdir|mkdtempSync|realpathSync|join|resolve|dirname|fileURLToPath|homedir";
const PATH_SOURCE = new RegExp(
  String.raw`(?<![.\w])(?:${MAKERS})\s*\(|\bpath\.(?:${MAKERS})\s*\(`
  + String.raw`|\.pathname\b|\bprocess\.env\.(?:TMPDIR|HOME|XDG_CONFIG_HOME)\b`,
  "u",
);

/** The escape a refusal names, which is the whole of what makes an interpolated path safe here. */
const ESCAPED = /\bescaped\s*\(/u;

/* Taint through every read of a tainted name reached `name` and `verb` here and said nothing, so
   it stops at a build: a template interpolating a path, or a concatenation with a literal. */
const JOINED = /`[^`]*\$\{|["']\s*\+|\+\s*["']/u;

const DECLARED = /\b(?:const|let|var)\s+(?:([A-Za-z_$][\w$]*)|[{[]([^}\]]*)[}\]])\s*=\s*/gu;

/** Comments out, templates left standing: where a name got its value is read through them. */
const uncommented = (text) => {
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
    } else if (text[at] === "'" || text[at] === '"') {
      let end = at + 1;
      while (end < text.length && text[end] !== text[at]) end += text[end] === "\\" ? 2 : 1;
      at = end + 1;
    } else {
      at += 1;
    }
  }
  return out.join("");
};

const rightOf = (code, from) => {
  let depth = 0;
  for (let at = from; at < code.length; at += 1) {
    const one = code[at];
    if (one === "(" || one === "[" || one === "{") depth += 1;
    else if (one === ")" || one === "]" || one === "}") {
      if (depth === 0) return code.slice(from, at);
      depth -= 1;
    } else if (depth === 0 && (one === ";" || one === "\n")) return code.slice(from, at);
  }
  return code.slice(from);
};

const words = (text) => text.match(/[A-Za-z_$][\w$]*/gu) ?? [];

/* Whether an expression answers with a path: it makes one, calls what makes one, or joins one.
   `calls` is the narrower of the two readings, since a name that is a path is never called. */
const makesAPath = (source, reads, calls = reads) =>
  PATH_SOURCE.test(source)
  || words(source).some((word) => calls(word) && new RegExp(String.raw`(?<![.\w])${word}\s*\(`, "u").test(source))
  || (JOINED.test(source) && words(source).some((word) => reads(word)));

const siteAt = (code, one) => {
  const read = one[1] || !one[0].includes("{") ? null : pairsOf(one[2]);
  const pairs = one[1] ? [{ key: null, name: one[1] }] : read ?? words(one[2]).map((name) => ({ key: null, name }));
  const at = one.index + one[0].length;
  const to = at + rightOf(code, at).length;
  return { one: Boolean(one[1]), object: Boolean(read), pairs, at, to, values: new Set(), calls: new Set() };
};

/* A binding answers for a name between its declaration and the brace closing the block it stands
   in, so one test's `work` from join() and another's `work` from a count are two bindings. A name
   destructured is a path when its own property is one (ISS-2539); where what it came from cannot be
   read, it is a path as a value and not a maker of one, a sibling saying nothing of what it returns. */
const declarations = (text, borrowed) => {
  const code = uncommented(text);
  const braces = blanked(text);
  const sites = [...code.matchAll(DECLARED)].map((one) => ({ ...siteAt(code, one), until: closesAfter(braces, one.index) }));
  for (const site of sites) site.shape = site.one ? shapeOf(code, site.at, site.to) : null;
  const bound = (set) => (name, at) =>
    borrowed.has(name) || sites.some((one) => one[set].has(name) && one.at < at && at < one.until);
  const reads = bound("values");
  const calls = bound("calls");
  const pathKeys = (entries) => new Set(entries.filter((one) => {
    const value = one.value.trim();
    const here = (name) => reads(name, one.at);
    return /^[A-Za-z_$][\w$]*$/u.test(value) ? here(value) : makesAPath(value, here, (name) => calls(name, one.at));
  }).map((one) => one.key));
  const shapeFor = (site) => {
    if (!site.object) return null;
    if (code.slice(site.at, site.to).trim().startsWith("{")) {
      const entries = shapeOf(code, site.at, site.to);
      return entries && pathKeys(entries);
    }
    const callee = calleeOf(code, site.at, site.to);
    const local = callee && sites.findLast((one) => one.one && one.pairs[0].name === callee && one.at < site.at && site.at < one.until);
    if (local) return local.shape && pathKeys(local.shape);
    return callee && borrowed.has(callee) ? borrowed.get(callee) ?? null : null;
  };
  let moved = true;
  while (moved) {
    moved = false;
    for (const site of sites) {
      const before = site.values.size + site.calls.size;
      const rhs = code.slice(site.at, site.to);
      const keys = shapeFor(site);
      for (const { key, name } of site.pairs) {
        if (keys ? (key === null ? keys.size > 0 : keys.has(key)) : makesAPath(rhs, (word) => reads(word, site.at), (word) => calls(word, site.at))) {
          site.values.add(name);
          if (keys || site.one) site.calls.add(name);
        }
      }
      moved ||= site.values.size + site.calls.size !== before;
    }
  }
  const named = new Map(sites.filter((one) => one.one && one.values.size)
    .map((one) => [one.pairs[0].name, one.shape && pathKeys(one.shape)]));
  return { reads, calls, named };
};

/* Whether a name in this file carries a path where it is read, the names it borrows carried in.
   `known` maps each borrowed name to the properties its answer holds a path in, or to null. */
const helpersIn = (text, known = new Map()) => {
  const taken = [...uncommented(text).matchAll(/\bimport\s+\{([^}]*)\}\s+from/gu)].flatMap((one) => words(one[1]));
  const shapes = new Map([...known].map((one) => (Array.isArray(one) ? one : [one, null])));
  return declarations(text, new Map([...shapes].filter(([name]) => taken.includes(name))));
};

/** The names a file exports that carry a path, each with the properties of its answer that hold one. */
export const exportsIn = (text) => {
  const { named } = declarations(text, new Map());
  return new Map([...uncommented(text).matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)/gu)]
    .map((one) => one[1]).filter((name) => named.has(name)).map((name) => [name, named.get(name)]));
};

/* The escape and everything it was given, blanked where they stand so every offset still holds:
   what is escaped is out of the reading, and an operand beside it is not. */
const scrubbed = (text) => {
  const out = Array.from(text);
  for (const hit of text.matchAll(new RegExp(ESCAPED.source, "gu"))) {
    let depth = 0;
    let quote = "";
    let at = text.indexOf("(", hit.index);
    do {
      const one = text[at];
      if (one === "\\") at += 1;
      else if (quote) { if (one === quote) quote = ""; }
      else if (one === "'" || one === '"' || one === "`") quote = one;
      else if (one === "(") depth += 1;
      else if (one === ")") depth -= 1;
      at += 1;
    } while (at < text.length && depth !== 0);
    for (let edge = hit.index; edge < at; edge += 1) if (out[edge] !== "\n") out[edge] = " ";
  }
  return out.join("");
};

/* Every interpolation of every template in a `RegExp`'s first argument, and what is left of that
   argument once its spelt-out text is gone — so `"^" + work + "$"` is read and `"in \\S+"` is not.
   Depth counts outside quotes only: a raw template's `\(` is a character and not a bracket. */
const partsAt = (text, from) => {
  const parts = [];
  let residue = "";
  let depth = 0;
  let quote = "";
  let at = from;
  while (at < text.length) {
    const one = text[at];
    if (one === "\\") { at += 2; continue; }
    if (quote) {
      if (one === quote) quote = "";
      else if (quote === "`" && one === "$" && text[at + 1] === "{") {
        let held = 1;
        let shut = at + 2;
        while (shut < text.length && held > 0) {
          if (text[shut] === "{") held += 1;
          else if (text[shut] === "}") held -= 1;
          if (held > 0) shut += 1;
        }
        parts.push({ at: at + 2, to: shut });
        at = shut;
      }
    } else if (one === "'" || one === '"' || one === "`") quote = one;
    else if (one === "(" || one === "[" || one === "{") { depth += 1; residue += one; }
    else if (one === ")" || one === "]" || one === "}") {
      if (depth === 0) break;
      depth -= 1;
      residue += one;
    } else if (one === "," && depth === 0) break;
    else residue += one;
    at += 1;
  }
  /* The residue is read as the residue: the spelt-out text of a template beside it is characters,
     so a word in it that happens to name a path in this file is not that path (ISS-2287). */
  return words(residue).length ? [...parts, { at: from, to: at, residue }] : parts;
};

const says = (rel, line, source) =>
  `${rel}:${line} puts the path \`${source}\` into a RegExp source, where + . ( and [ are operators `
  + `and not characters — so the one string this pattern cannot match is the path it was built from, `
  + `and a run whose scratch root carries one of them reads a gate red for a tree it did not change. `
  + `Assert the substring with includes(), or put the path through escaped() from `
  + `plugin/test/fixtures.mjs where the pattern needs operators of its own.`;

/** One refusal per path this file lets into a pattern, each at the line that let it. */
export const pathsIn = (text, rel, known = new Map()) => {
  const { reads, calls } = helpersIn(text, known);
  const read = scrubbed(text);
  const found = [];
  /* Blanked whole, so a fixture spelling the refused shape inside a template is the case's data. */
  for (const hit of blanked(text).matchAll(/\bRegExp\s*\(/gu)) {
    for (const part of partsAt(read, hit.index + hit[0].length)) {
      const source = part.residue ?? read.slice(part.at, part.to);
      const here = (name) => reads(name, part.at);
      if (makesAPath(source, here, (name) => calls(name, part.at)) || words(source).some(here)) {
        found.push(says(rel, lineAt(text, part.at), text.slice(part.at, part.to).trim()));
      }
    }
  }
  return found;
};
