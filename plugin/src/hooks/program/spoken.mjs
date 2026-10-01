// Where a program another language runs keeps its strings, its comments and the fields a string still runs: a binding is discovered in code and nowhere else, and so is a call, so one inside a comment or a string a program prints is neither. how/writes.md.

import { COMMENTS, literalsIn } from "../../checks/source/lexical.mjs";

/** The language each runner speaks, for the readings that tell its code from its strings. A runner none of these name is read as python. */
export const SPEAKS = { python: "python", python3: "python", node: "node", deno: "node", bun: "node" };

/* Python, walked: a string ends at its own quote, a backslash in it escaping the next character raw or not, a brace aside, and an f-string's field is code to the brace closing it, which may hold strings of its own, the f-string's own quote among them (3.12). A doubled brace is a literal one. */
const PREFIX = /(?<![\w])[rRbBuUfF]{1,2}$/u;
const pyCodeTo = (text, at) => {
  let depth = 0;
  for (let end = at; end < text.length;) {
    const span = pySpanAt(text, end);
    if (span) {
      end = span.to;
      continue;
    }
    if ("([{".includes(text[end])) depth += 1;
    else if (text[end] === "}" && depth === 0) return end;
    else if (")]}".includes(text[end])) depth -= 1;
    end += 1;
  }
  return text.length;
};
const pyStringAt = (text, at) => {
  const fString = /f/iu.test(PREFIX.exec(text.slice(Math.max(0, at - 3), at))?.[0] ?? "");
  const quote = text.startsWith(text[at].repeat(3), at) ? text[at].repeat(3) : text[at];
  const holes = [];
  let end = at + quote.length;
  while (end < text.length && !text.startsWith(quote, end) && (quote.length === 3 || text[end] !== "\n")) {
    if (text[end] === "\\" && !(fString && text[end + 1] === "{")) end += 2;
    else if (text[end] === "\\" || (fString && text.startsWith("{{", end))) end += text[end] === "\\" ? 1 : 2;
    else if (fString && text[end] === "{") {
      const close = pyCodeTo(text, end + 1);
      holes.push({ from: end, to: Math.min(close + 1, text.length) });
      end = close + 1;
    } else end += 1;
  }
  const closed = text.startsWith(quote, end);
  return { to: Math.min(closed ? end + quote.length : end, text.length), comment: false, holes };
};
function pySpanAt(text, at) {
  if (text[at] === "#") return { to: text.includes("\n", at) ? text.indexOf("\n", at) : text.length, comment: true, holes: [] };
  return text[at] === "'" || text[at] === '"' ? pyStringAt(text, at) : null;
}
const pythonSpans = (text) => {
  const out = [];
  for (let at = 0; at < text.length;) {
    const span = pySpanAt(text, at);
    if (span) out.push({ from: at, ...span });
    at = span ? Math.max(span.to, at + 1) : at + 1;
  }
  return out;
};

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
