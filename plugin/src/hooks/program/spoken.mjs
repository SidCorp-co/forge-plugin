// Where a program another language runs keeps its strings, its comments and the fields a string still runs: a binding is discovered in code and nowhere else, and so is a call, so one inside a comment or a string a program prints is neither. how/writes.md.

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

/* JS, walked rather than matched, since a template's `${…}` is code that may hold a template of its own. A regular expression opens where a value may, which a division never does, and closes on its own line; a `}` may end a block or a value, and an arithmetic operator may be a postfix `++` ending one, so a slash after either is read as the division that loses nothing. */
const VALUE_BEFORE = /(?:^|[(,=:[!&|?{;]|\breturn|\btypeof)\s*$/u;
const quotedTo = (text, at) => {
  let end = at + 1;
  while (end < text.length && text[end] !== text[at] && text[end] !== "\n") end += text[end] === "\\" ? 2 : 1;
  return Math.min(end + 1, text.length);
};
const regexTo = (text, at) => {
  let end = at + 1;
  let inClass = false;
  while (end < text.length && text[end] !== "\n" && (inClass || text[end] !== "/")) {
    if (text[end] === "[") inClass = true;
    else if (text[end] === "]") inClass = false;
    end += text[end] === "\\" ? 2 : 1;
  }
  if (text[end] !== "/") return null;
  end += 1;
  while (/[a-z]/u.test(text[end] ?? "")) end += 1;
  return end;
};
/* One string, comment or expression starting at `at`, or null where code stands there. */
const spanAt = (text, at) => {
  const one = text[at];
  if (one === "'" || one === '"') return { to: quotedTo(text, at), comment: false, holes: [] };
  if (one === "\x60") return templateAt(text, at);
  if (one !== "/") return null;
  if (text[at + 1] === "/") return { to: text.includes("\n", at) ? text.indexOf("\n", at) : text.length, comment: true, holes: [] };
  if (text[at + 1] === "*") return { to: text.includes("*/", at + 2) ? text.indexOf("*/", at + 2) + 2 : text.length, comment: true, holes: [] };
  const to = VALUE_BEFORE.test(text.slice(Math.max(0, at - 12), at)) && regexTo(text, at);
  return to ? { to, comment: false, holes: [] } : null;
};
/* Code from `at` to the `}` closing it, every span inside it stepped over whole. */
const codeTo = (text, at) => {
  let depth = 0;
  for (let end = at; end < text.length;) {
    const span = spanAt(text, end);
    if (span) {
      end = span.to;
      continue;
    }
    if (text[end] === "{") depth += 1;
    else if (text[end] === "}" && depth === 0) return end;
    else if (text[end] === "}") depth -= 1;
    end += 1;
  }
  return text.length;
};
function templateAt(text, at) {
  const holes = [];
  let end = at + 1;
  while (end < text.length && text[end] !== "\x60") {
    if (text[end] === "\\") end += 2;
    else if (text.startsWith("${", end)) {
      const close = codeTo(text, end + 2);
      holes.push({ from: end, to: Math.min(close + 1, text.length) });
      end = close + 1;
    } else end += 1;
  }
  return { to: Math.min(end + 1, text.length), comment: false, holes };
}
const jsSpans = (text) => {
  const out = [];
  for (let at = 0; at < text.length;) {
    const span = spanAt(text, at);
    if (span) out.push({ from: at, ...span });
    at = span ? Math.max(span.to, at + 1) : at + 1;
  }
  return out;
};

/** Each string and comment in `text`, `{ from, to, comment, holes }`, `holes` being the fields a string runs, each `{ from, to }` in `text`. */
export const spansOf = (text, lang) => (lang === "node" ? jsSpans(text) : pythonSpans(text));

/* The stretches of `text` a program does not run, `[from, to)`: each string and comment, its opening quote aside so a literal a call stands on is not inside itself, less each field the string runs, whose own strings are read the same way again. */
const unrun = (text, lang, base = 0) => spansOf(text, lang).flatMap((one) => {
  const pieces = [];
  let from = one.from + 1;
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
