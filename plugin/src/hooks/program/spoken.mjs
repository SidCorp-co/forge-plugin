// Where a program another language runs keeps its strings, its comments and the fields a string still runs: a binding is discovered in code and nowhere else, and so is a call, so one inside a comment or a string a program prints is neither. how/writes.md.

import { COMMENTS, literalsIn } from "../../checks/source/lexical.mjs";

/** Every interpreter whose program the readings look into: the language it speaks, and the words that hand it a program inline, which are each interpreter's own — php's `-e` is a debugging
 *  switch whose next word is a script argument, and deno's is the `eval` subcommand. The one statement of both, so an interpreter added here is one the inline and heredoc patterns open and
 *  every reading keyed by language below and beside this file answers for. A shell is none of these, its body being commands, and `SHELL_WORD` states the shells. */
export const INTERPRETERS = {
  python: { speaks: "python", inline: ["-c"] },
  python3: { speaks: "python", inline: ["-c"] },
  node: { speaks: "node", inline: ["-e", "--eval", "-p", "--print"] },
  deno: { speaks: "node", inline: ["eval"] },
  bun: { speaks: "node", inline: ["-e", "--eval", "-p", "--print"] },
  perl: { speaks: "perl", inline: ["-e", "-E"] },
  ruby: { speaks: "ruby", inline: ["-e"] },
  php: { speaks: "php", inline: ["-r", "-B", "-R", "-E"] },
};
/** Each interpreter by the language it speaks. */
export const LANGUAGE_OF = Object.fromEntries(Object.entries(INTERPRETERS).map(([name, one]) => [name, one.speaks]));
/** The interpreters `LANGUAGE_OF` names, as a pattern's alternation, a longer name first so none stops on a shorter one it begins with. */
export const INTERPRETER = Object.keys(LANGUAGE_OF).sort((a, b) => b.length - a.length).join("|");

/* Python, walked: a string ends at its own quote, a backslash in it escaping the next character raw or not, a brace aside, and an f-string's field is code to the brace closing it, which may hold strings of its own, the f-string's own quote among them (3.12). A doubled brace is a literal one. Each string and comment a field holds is kept on the field, found by the walk that steps over it, so no reading walks a field twice. */
const PREFIX = /(?<![\w])[rRbBuUfF]{1,2}$/u;
const pyCodeTo = (text, at, spans) => {
  let depth = 0;
  for (let end = at; end < text.length;) {
    const span = pySpanAt(text, end);
    if (span) {
      spans.push(span);
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
      const spans = [];
      const close = pyCodeTo(text, end + 1, spans);
      holes.push({ from: end, to: Math.min(close + 1, text.length), spans });
      end = close + 1;
    } else end += 1;
  }
  const closed = text.startsWith(quote, end);
  return { from: at, to: Math.min(closed ? end + quote.length : end, text.length), comment: false, holes, interpolates: fString };
};
function pySpanAt(text, at) {
  if (text[at] === "#") return { from: at, to: text.includes("\n", at) ? text.indexOf("\n", at) : text.length, comment: true, holes: [] };
  return text[at] === "'" || text[at] === '"' ? pyStringAt(text, at) : null;
}
const pythonSpans = (text) => {
  const out = [];
  for (let at = 0; at < text.length;) {
    const span = pySpanAt(text, at);
    if (span) out.push(span);
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

/* Which walk reads each language's comments and strings. perl's and ruby's are a `#` comment and a quoted string, which python's walk reads; php's are `//`, a block comment and a quoted
   string, which the JS walk reads. Neither claims more of those three: an interpolation, a `q()` or a heredoc of their own is read as the walk's language would read it. */
const WALKS = { python: pythonSpans, node: jsSpans, perl: pythonSpans, ruby: pythonSpans, php: jsSpans };

/** Each string and comment in `text`, `{ from, to, comment, holes }`, `holes` being the fields a python f-string runs, each `{ from, to, spans }` in `text` with the strings and comments inside it, and `interpolates` saying the string is one whose fields run; a JS template comes as the halves around its fields, which are code. */
export const spansOf = (text, lang) => WALKS[lang](text);

/* The stretches of a text a program does not run, `[from, to)`: each string and comment, its opening quote aside so a literal a call stands on is not inside itself (the `}` a template resumes on is no quote, and goes with the `${` it closes), less each field the string runs, whose own strings are read the same way again. */
const unrun = (spans) => spans.flatMap((one) => {
  const pieces = [];
  let from = one.from + (one.opens ?? 1);
  for (const hole of one.holes) {
    pieces.push({ from, to: hole.from });
    from = hole.to;
  }
  pieces.push({ from, to: one.to });
  return [...pieces, ...one.holes.flatMap((hole) => unrun(hole.spans))].filter((piece) => piece.to > piece.from);
});

/** `text` with each `{ from, to }` stretch turned to spaces, offset for offset. */
export const blanked = (text, stretches) => {
  const out = text.split("");
  for (const { from, to } of stretches) out.fill(" ", from, to);
  return out.join("");
};

/* Each comment among `spans`, those in a field a string runs among them, which a python 3.12 f-string spread over lines may hold. */
const commentsIn = (spans) => spans.flatMap((one) => (one.comment
  ? [{ from: one.from, to: one.to }]
  : one.holes.flatMap((hole) => commentsIn(hole.spans))));

/** One walk of a program's text, and what every reading of it takes from that walk: `spans`, each string and comment as `spansOf` gives them; `code`, the text with its comments blanked, offset for offset, so a comment between a call's arguments splits and closes nothing; `bare`, the same with its strings blanked too, for a walk that splits arguments; and whether an offset stands where the program runs nothing. */
export const spokenIn = (given, runner) => {
  const spans = spansOf(given, LANGUAGE_OF[runner]);
  const code = blanked(given, commentsIn(spans));
  const pieces = unrun(spans);
  return { spans, code, bare: blanked(code, pieces), inside: (at) => pieces.some((one) => at >= one.from && at < one.to) };
};
