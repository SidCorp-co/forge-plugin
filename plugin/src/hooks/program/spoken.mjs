// Where a program another language runs keeps its strings, its comments and the fields a string still runs: a binding is discovered in code and nowhere else, and so is a call, so one inside a comment or a string a program prints is neither. how/writes.md.

import { COMMENTS, literalsIn } from "../../checks/source/lexical.mjs";

/** The language each runner speaks, for the readings that tell its code from its strings. A runner none of these name is read as python. */
export const SPEAKS = { python: "python", python3: "python", node: "node", deno: "node", bun: "node" };

const PYTHON = /"""(?:[^\\]|\\[\s\S])*?"""|'''(?:[^\\]|\\[\s\S])*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(#[^\n]*)/gu;

/* An f-string's field, from its brace to the one closing it, braces nested in it counted and a doubled one a literal brace; python escapes no brace with a backslash. */
const fieldsOf = (text) => {
  const out = [];
  for (let at = text.indexOf("{"); at >= 0; at = text.indexOf("{", at + 1)) {
    if (text[at + 1] === "{") {
      at += 1;
      continue;
    }
    let depth = 0;
    let quote = null;
    let end = at;
    for (; end < text.length; end += 1) {
      const one = text[end];
      if (quote) quote = one === quote ? null : quote;
      else if (one === "'" || one === '"') quote = one;
      else if (one === "{") depth += 1;
      else if (one === "}") depth -= 1;
      if (depth === 0 && !quote) break;
    }
    out.push({ from: at, to: Math.min(end + 1, text.length) });
    at = end;
  }
  return out;
};

const F_PREFIX = /(?:^|[^\w])(?:[fF][rR]?|[rR][fF])$/u;
const pythonSpans = (text) => [...text.matchAll(PYTHON)].map((one) => {
  const fString = F_PREFIX.test(text.slice(Math.max(0, one.index - 3), one.index));
  const holes = fString ? fieldsOf(one[0]).map((hole) => ({ from: one.index + hole.from, to: one.index + hole.to })) : [];
  return { from: one.index, to: one.index + one[0].length, comment: one[1] !== undefined, holes };
});

/* JS is read by the one walk this plugin keeps for it, where a template's `${…}` is code to any depth and a slash is a division or an expression by the rule every checker spends. */
const jsSpans = (text) => literalsIn(text).map((one) => ({
  from: one.start,
  to: one.end,
  comment: COMMENTS.includes(one.kind),
  holes: [],
  opens: text[one.start] === "}" ? 0 : 1,
}));

/** Each string and comment in `text`, `{ from, to, comment, holes }`, `holes` being the fields a python f-string runs, each `{ from, to }` in `text`; a JS template comes as the halves around its fields, which are code. */
export const spansOf = (text, lang) => (lang === "node" ? jsSpans(text) : pythonSpans(text));

/* The stretches of `text` a program does not run, `[from, to)`: each string and comment, its opening quote aside so a literal a call stands on is not inside itself (the `}` a template resumes on is no quote, and goes with the `${` it closes), less each field the string runs, whose own strings are read the same way again. */
const unrun = (text, lang, base = 0) => spansOf(text, lang).flatMap((one) => {
  const pieces = [];
  let from = one.from + (one.opens ?? 1);
  for (const hole of one.holes) {
    pieces.push({ from: base + from, to: base + hole.from });
    from = hole.to;
  }
  pieces.push({ from: base + from, to: base + one.to });
  const within = one.holes.flatMap((hole) => unrun(text.slice(hole.from, hole.to), lang, base + hole.from));
  return [...pieces, ...within].filter((piece) => piece.to > piece.from);
});

const blanked = (text, stretches) =>
  stretches.reduce((out, one) => `${out.slice(0, one.from)}${" ".repeat(one.to - one.from)}${out.slice(one.to)}`, text);

/** A program's text with its comments blanked, offset for offset, so a comment between a call's arguments splits and closes nothing; `bare`, the same with its strings blanked too, for a walk that splits arguments; and whether an offset stands where the program runs nothing. */
export const spokenIn = (given, runner) => {
  const lang = SPEAKS[runner] ?? "python";
  const code = blanked(given, spansOf(given, lang).filter((one) => one.comment));
  const pieces = unrun(given, lang);
  return { code, bare: blanked(code, pieces), inside: (at) => pieces.some((one) => at >= one.from && at < one.to) };
};
