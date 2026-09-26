/* What each position of a JavaScript source is — code, a comment, or the inside of a literal —
   answered by one walk, so a checker spends the answer rather than spelling a walk of its own. Seven
   walks stood before this one, with three rules for a slash that contradicted each other, and every
   hole found in one of them was a route through the lexical reading rather than through the rule
   that read it (ISS-1085). This knows where literals begin and end and nothing about what the code
   between them means: a question about structure is a parser's. */

/** The kinds a position may be besides code. A template's literal halves are `template`, and its
 *  `${…}` holes are code, to any depth. */
export const KINDS = Object.freeze({
  LINE: "line", BLOCK: "block", SINGLE: "single", DOUBLE: "double", TEMPLATE: "template", REGEX: "regex",
});
export const COMMENTS = Object.freeze([KINDS.LINE, KINDS.BLOCK]);
export const LITERALS = Object.freeze([KINDS.SINGLE, KINDS.DOUBLE, KINDS.TEMPLATE, KINDS.REGEX]);

const WORD = /[\w$]/u;
const SPACE = /\s/u;
/* The words after which only an expression can start, so `return /x/` opens a literal as `= /x/`
   does, while `x / 2` divides. */
const STARTS_AN_EXPRESSION = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "throw", "case", "do", "else", "yield", "await"]);
/* The paren closing one of these conditions ends no value: a statement starts after it, and a
   statement may be a regex, `if (ok) /x/.test(y)`. */
const CONTROL = new Set(["if", "while", "for", "with"]);
/* What the last code character was, where it was no character: the end of a literal is a value.
   One character, and neither a word character nor a bracket, so no test below mistakes it for one. */
const VALUE = "\u0000";

/** The word ending at `end`, or none where it is a property name, which no keyword is. */
const wordEndingAt = (text, end) => {
  let start = end;
  while (start > 0 && WORD.test(text[start - 1])) start -= 1;
  return text[start - 1] === "." ? "" : text.slice(start, end + 1);
};

const stringAt = (text, at) => {
  const quote = text[at];
  let to = at + 1;
  while (to < text.length && text[to] !== quote) to += text[to] === "\\" ? 2 : 1;
  to = Math.min(to, text.length);
  return { kind: quote === '"' ? KINDS.DOUBLE : KINDS.SINGLE, start: at, from: at + 1, to,
    end: Math.min(to + 1, text.length) };
};

/* A class is read whole so a `/` inside one ends nothing, and the literal ends at a line break,
   which no regex crosses: a slash misread as one costs the rest of its line and never the file. */
const regexAt = (text, at) => {
  let to = at + 1;
  let inClass = false;
  while (to < text.length && text[to] !== "\n") {
    const one = text[to];
    if (one === "\\") {
      to += 2;
      continue;
    }
    if (one === "[") inClass = true;
    else if (one === "]") inClass = false;
    else if (one === "/" && !inClass) break;
    to += 1;
  }
  to = Math.min(to, text.length);
  return { kind: KINDS.REGEX, start: at, from: at + 1, to, end: text[to] === "/" ? to + 1 : to };
};

const commentAt = (text, at) => {
  const line = text[at + 1] === "/";
  const shut = text.indexOf(line ? "\n" : "*/", at + 2);
  const to = shut === -1 ? text.length : shut;
  return { kind: line ? KINDS.LINE : KINDS.BLOCK, start: at, from: at + 2, to,
    end: line || shut === -1 ? to : to + 2 };
};

/* One literal half, opened by the template's backtick or by the `}` closing a hole, and closed by a
   backtick or by the `${` opening the next hole. `hole` says which of the two closed it. */
const halfAt = (text, at, template) => {
  let to = at + 1;
  while (to < text.length && text[to] !== "`" && !text.startsWith("${", to)) to += text[to] === "\\" ? 2 : 1;
  to = Math.min(to, text.length);
  const hole = text.startsWith("${", to);
  return { kind: KINDS.TEMPLATE, start: at, from: at + 1, to,
    end: Math.min(to + (hole ? 2 : 1), text.length), template, hole };
};

/* The walk: every region in the order the source holds it, a template as its halves. */
const walk = (text) => {
  const found = [];
  const holes = [];
  const parens = [];
  /* The last three code characters, comments skipped, each with where it stood: a slash is decided
     by the token before it, and `a++`, `1.` and `++a` are each told apart by the one before that. */
  const recent = [];
  const saw = (one, at) => {
    recent.push({ one, at });
    if (recent.length > 3) recent.shift();
  };
  let closedControl = false;
  const endsAValue = (token) => Boolean(token) && (token.one === VALUE || token.one === "]" || token.one === ")"
    || (WORD.test(token.one) && !STARTS_AN_EXPRESSION.has(wordEndingAt(text, token.at))));
  const opensARegex = () => {
    const [before, previous, last] = [recent.at(-3), recent.at(-2), recent.at(-1)];
    if (!last) return true;
    if (last.one === VALUE || last.one === "]") return false;
    /* A postfix `++` or `--` ends a value, `count++ / total`; a prefix one, `++/re/.lastIndex`, still
       has its operand to come. */
    const update = (last.one === "+" || last.one === "-") && previous?.one === last.one && previous.at === last.at - 1;
    if (update) return !endsAValue(before);
    /* A number may end in its point, `1. / 2`. */
    if (last.one === "." && previous && previous.at === last.at - 1 && /^\d/u.test(wordEndingAt(text, previous.at))) return false;
    if (last.one === ")") return closedControl;
    if (WORD.test(last.one)) return STARTS_AN_EXPRESSION.has(wordEndingAt(text, last.at));
    return true;
  };
  const took = (region) => {
    found.push(region);
    saw(VALUE, region.end - 1);
    return region.end;
  };
  const half = (at, template) => {
    const region = halfAt(text, at, template);
    found.push(region);
    if (region.hole) holes.push({ depth: 0, template });
    saw(region.hole ? "{" : VALUE, region.end - 1);
    return region.end;
  };
  let at = 0;
  while (at < text.length) {
    const one = text[at];
    const next = text[at + 1];
    if (one === "/" && (next === "/" || next === "*")) {
      const region = commentAt(text, at);
      found.push(region);
      at = region.end;
    } else if (one === '"' || one === "'") at = took(stringAt(text, at));
    else if (one === "`") at = half(at, at);
    else if (one === "/" && opensARegex()) at = took(regexAt(text, at));
    else if (one === "}" && holes.length && holes.at(-1).depth === 0) at = half(at, holes.pop().template);
    else {
      if (one === "{" && holes.length) holes.at(-1).depth += 1;
      if (one === "}" && holes.length) holes.at(-1).depth -= 1;
      const last = recent.at(-1);
      if (one === "(") parens.push(Boolean(last) && WORD.test(last.one) && CONTROL.has(wordEndingAt(text, last.at)));
      if (one === ")") closedControl = parens.pop() ?? false;
      if (!SPACE.test(one)) saw(one, at);
      at += 1;
    }
  }
  return found;
};

const blankInto = (out, from, to) => {
  for (let at = Math.max(from, 0); at < Math.min(to, out.length); at += 1) if (out[at] !== "\n") out[at] = " ";
};

const CHOICES = { quotes: ["keep", "blank"], holes: ["code", "text"] };
const refused = (what, given) =>
  new Error(`${what}: blank takes ${Object.values(KINDS).join(" ")}, quotes ${CHOICES.quotes.join(" or ")}, `
    + `holes ${CHOICES.holes.join(" or ")}; it was given ${JSON.stringify(given)}`);

/* A template read as text runs from its opening backtick to its closing one, holes and all, and
   what its holes held is inside it rather than a region of its own. */
const wholeTemplates = (regions) => {
  const whole = new Map();
  for (const one of regions) {
    if (one.kind !== KINDS.TEMPLATE) continue;
    const held = whole.get(one.template);
    whole.set(one.template, held ? { ...held, to: one.to, end: one.end }
      : { kind: KINDS.TEMPLATE, start: one.start, from: one.from, to: one.to, end: one.end });
  }
  const templates = [...whole.values()];
  const inside = (one) => templates.some((each) => one.start > each.start && one.start < each.end);
  return [...regions.filter((one) => one.kind !== KINDS.TEMPLATE), ...templates]
    .filter((one) => !inside(one))
    .sort((one, next) => one.start - next.start);
};

/** Every comment and literal in the source, in the order it holds them. Each region carries its
 *  whole extent, `start` to `end`, and its content, `from` to `to`, which leaves out a comment's
 *  markers, a string's quotes, a regex's slashes and a template half's delimiters. Under the default
 *  `holes: "code"` a template is its halves, each carrying `template`, the offset of its opening
 *  backtick, so one template's halves can be read together; under `holes: "text"` it is one region,
 *  holes and all. Offsets are code units, the unit `slice` and `indexOf` count in. */
export const literalsIn = (text, { holes = "code" } = {}) => {
  if (!CHOICES.holes.includes(holes)) throw refused("literalsIn", { holes });
  return holes === "text" ? wholeTemplates(walk(text)) : walk(text);
};

/** The source with the kinds a caller names blanked to spaces, every line break kept and every
 *  offset left where it was, so an index found in the mask indexes the source too. A comment goes
 *  whole. `quotes: "keep"` leaves a string's quotes, a regex's slashes and a template's backticks
 *  standing, which is what lets a reader still see that a literal stood there; a hole's own `${` and
 *  `}` go with the template whichever is chosen, so brace depth reads the statement's.
 *  `holes: "text"` blanks a template whole, what its holes spell included. */
export const maskOf = (text, { blank, quotes = "keep", holes = "code" }) => {
  const unknown = [...blank].filter((one) => !Object.values(KINDS).includes(one));
  if (unknown.length || !CHOICES.quotes.includes(quotes) || !CHOICES.holes.includes(holes)) {
    throw refused("maskOf", { blank, quotes, holes });
  }
  const out = text.split("");
  const wanted = new Set(blank);
  const keep = quotes === "keep";
  for (const one of literalsIn(text, { holes })) {
    if (!wanted.has(one.kind)) continue;
    if (!keep || COMMENTS.includes(one.kind)) blankInto(out, one.start, one.end);
    else if (one.kind !== KINDS.TEMPLATE) blankInto(out, one.from, one.to);
    else blankInto(out, text[one.start] === "`" ? one.from : one.start, one.hole ? one.end : one.to);
  }
  return out.join("");
};
