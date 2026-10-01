/* What an interpreter's own body would have built before it wrote, for the one caller that asks what a
   command writes. Kept out of the hook harness because it is a reading and not an entry point, and
   beside the call reader because both read a program another language runs, as shell-spans reads the
   shell's. how/writes.md. */
import { fileCalls } from "./call-writes.mjs";
import { SPEAKS, spansOf } from "./spoken.mjs";
import { unquote } from "../shell-spans.mjs";

/* Three global hops reach eight members of one assembly. */
const FOLDS = 3;

const LITERAL = String.raw`"[^"\n]*"|'[^'\n]*'`;
/* Every binding, not only the ones holding a literal: a rebinding to something this cannot read has to unset what came before rather than leave a stale value answering for it. A literal counts only as the *whole* right-hand side, or `root = "a/b" if x else "/tmp"` binds the half it opens with, and only an assignment a statement opens with is one at all — `dict(root="/tmp")` rebinds nothing. */
const ENDS = String.raw`(?=\s*(?:#|//|[);,\]}]|$))`;
const OPENS = String.raw`(?<=^|[;{}\n]\s*|\b(?:const|let|var)\s+)`;
const BINDS = new RegExp(
  OPENS + String.raw`([A-Za-z_]\w*)\s*=(?!=)\s*(?:(${LITERAL})${ENDS}|[^\n;]+)`,
  "gmu",
);
/* Only a string form that interpolates: python's f-string and a JS template literal. An ordinary `"{root}/x"` or `"${root}/x"` is a literal in both languages and stays one. */
const HOLDS = {
  python: {
    spans: /\b(?:rf|fr|f)(['"])((?:[^\\\n]|\\.)*?)\1/giu,
    name: /\{([A-Za-z_]\w*)\}/gu,
    plain: (span) => span,
  },
  node: {
    spans: /`(?:[^`\\]|\\[\s\S])*`/gu,
    name: /(?<!\\)\$\{([A-Za-z_]\w*)\}/gu,
    plain: (span) => (/^`[^`"\n\\$]*`$/u.test(span) ? `"${span.slice(1, -1)}"` : span),
  },
};
const JOINS = new RegExp(
  String.raw`\b(os\.path\.join|posixpath\.join|path\.join|pathlib\.Path|Path)\s*\(([^()]*)\)`,
  "gu",
);
/* Each join keeps its own API's rule: python's discards everything before an absolute member, node's `path.join` does not. `+` is concatenation and discards nothing. */
const RESETS = /^(?:os\.path\.join|posixpath\.join|pathlib\.Path|Path)$/u;
const ONE_NAME = new RegExp(String.raw`^(?:${LITERAL})$`, "u");
const GLUED = new RegExp(String.raw`(${LITERAL})\s*([+/])\s*(${LITERAL})`, "gu");
const under = (left, right, resets) =>
  (resets && right.startsWith("/") ? right : `${left}/${right}`).replace(/\/{2,}/gu, "/");

/* Comments are blanked rather than cut so every offset stays where it was, and this is also what lets a block comment sit between a literal and the end of its statement. */
const bound = (said, lang) => {
  const spans = spansOf(said, lang ?? "python");
  const strings = spans.filter((one) => !one.comment).map((one) => ({ start: one.from, end: one.to }));
  const code = spans.filter((one) => one.comment)
    .reduce((text, one) => `${text.slice(0, one.from)}${" ".repeat(one.to - one.from)}${text.slice(one.to)}`, said);
  const set = [];
  for (const one of code.matchAll(BINDS)) {
    if (strings.some(({ start, end }) => one.index > start && one.index < end)) continue;
    set.push({ at: one.index + one[0].length, name: one[1], value: one[2] === undefined ? null : unquote(one[2]) });
  }
  return (name, at) => set.filter((one) => one.name === name && one.at < at).pop()?.value ?? null;
};

const NAME_THEN = new RegExp(String.raw`\b([A-Za-z_]\w*)\s*([+/])\s*(?=${LITERAL})`, "gu");
const THEN_NAME = new RegExp(String.raw`(${LITERAL})\s*([+/])\s*\b([A-Za-z_]\w*)\b`, "gu");

/* A bare name a file call writes through is the literal it was last bound to, so a name bound to a whole literal and then handed to `open` as its file writes that literal. Replaced from the last one back, so every offset still answers against the text it was measured in. */
const spelt = (said, lang, valueOf) => fileCalls(said, lang).flatMap((one) => one.names)
  .sort((a, b) => b.from - a.from)
  .reduce((text, { from, to }) => {
    const held = valueOf(text.slice(from, to), from);
    if (held === null) return text;
    return `${text.slice(0, from)}${held.includes('"') ? `'${held}'` : `"${held}"`}${text.slice(to)}`;
  }, said);

/* A template inside another's interpolation, which the pattern that finds a template cannot pair, so a body holding one has its templates left as written. */
const nested = (said) => spansOf(said, "node")
  .some((one) => one.holes.some((hole) => said.slice(hole.from, hole.to).includes("\x60")));

/** A binding reaches the text after it and nothing before, one rebound to anything but a whole string literal answers for nothing, a join whose members all read as literals folds to one, and
 *  `+` and pathlib's `/` fold to a fixed point. Each pass reads what the pass before it produced and finds its bindings there, so an offset always answers against the text it was measured in:
 *  order is what a binding is read by, and no pass reorders. Shapes with no model — `.format`, `%`, `"/".join`, a value read at runtime — leave the text alone. how/writes.md. */
export const glued = (body, runner) => {
  const lang = SPEAKS[runner];
  let out = String(body);
  const holds = lang === "node" && nested(out) ? null : HOLDS[lang];
  /* `bound` answers off `out` and `lang` alone, so it is rebuilt only where a pass moved the text. */
  let read = null;
  let bindings = null;
  const pass = (pattern, made) => {
    if (read !== out) {
      bindings = bound(out, lang);
      read = out;
    }
    out = out.replace(pattern, (...args) => made(args, args[args.length - 2], bindings) ?? args[0]);
  };
  const quoted = (valueOf, name, at) => {
    const held = valueOf(name, at);
    return held === null ? null : `"${held}"`;
  };
  /* A constructor cannot fold while its argument is still a concatenation, and a concatenation cannot reach a name no fold has reached yet, so the stages run together until the text stops moving. */
  for (let hop = 0; hop < FOLDS; hop += 1) {
    const before = out;
    if (holds) {
      pass(holds.spans, ([span], at, valueOf) => {
        return holds.plain(span.replace(holds.name, (whole, name) => valueOf(name, at) ?? whole));
      });
    }
    pass(NAME_THEN, ([, name, sign], at, valueOf) => {
      const said = quoted(valueOf, name, at);
      return said === null ? null : `${said} ${sign} `;
    });
    pass(THEN_NAME, ([, said, sign, name], at, valueOf) => {
      const held = quoted(valueOf, name, at);
      return held === null ? null : `${said} ${sign} ${held}`;
    });
    pass(JOINS, ([, verb, args], at, valueOf) => {
      const parts = args.split(",").map((each) => each.trim()).filter(Boolean)
        .map((each) => (ONE_NAME.test(each) ? unquote(each) : valueOf(each, at)));
      if (!parts.length || parts.some((each) => each === null)) return null;
      return `"${parts.reduce((left, right) => under(left, right, RESETS.test(verb)))}"`;
    });
    out = spelt(out, lang, bound(out, lang));
    out = out.replace(GLUED, (all, left, sign, right) =>
      `"${sign === "/" ? under(unquote(left), unquote(right), true) : unquote(left) + unquote(right)}"`);
    if (out === before) break;
  }
  return out;
};

/* Inside double quotes a shell takes the backslash off only before these four and a newline, and keeps it before anything else. An escaped `$` or backtick is a literal and a bare one still
   expands, so each escaped one is held as a character the body does not already hold, which no fold reads, and only those go back escaped. */
const ESCAPED = /\\([\\"$`\n])/gu;
const unheld = (text, from = 0xe000) => {
  let at = from;
  while (text.includes(String.fromCodePoint(at))) at += 1;
  return String.fromCodePoint(at);
};

const doubleQuoted = (inner, runner) => {
  const dollar = unheld(inner);
  const tick = unheld(inner + dollar);
  const held = { $: dollar, "`": tick };
  const body = inner.replace(ESCAPED, (all, one) => (one === "\n" ? "" : held[one] ?? one));
  const folded = glued(body, runner);
  if (folded === body) return null;
  const escapes = new RegExp(String.raw`\\(?=[\\"$\u0060${dollar}${tick}]|$)|"`, "gu");
  return folded.replace(escapes, (one) => `\\${one}`).replaceAll(dollar, "\\$").replaceAll(tick, "\\`");
};

/** The same fold for an inline program, handed over still in the shell quotes it was written in: the quoting comes off for the reading and goes back on after, so a body quoting its own strings with
 *  `\"` is one body, and a single-quoted one needs none back, holding no `'` and gaining none. What the fold resolved nothing in comes back as given, byte for byte. how/writes.md. */
export const gluedQuoted = (quoted, runner) => {
  const inner = quoted.slice(1, -1);
  if (quoted[0] === '"') {
    const back = doubleQuoted(inner, runner);
    return back === null ? quoted : `"${back}"`;
  }
  const folded = glued(inner, runner);
  return folded === inner ? quoted : `'${folded}'`;
};
