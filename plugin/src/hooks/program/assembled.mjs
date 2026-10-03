/* What an interpreter's own body would have built before it wrote, for the one caller that asks what a
   command writes. Kept out of the hook harness because it is a reading and not an entry point, and
   beside the call reader because both read a program another language runs, as shell-spans reads the
   shell's. how/writes.md. */
import { STRING, fileCalls, spelling } from "./call-writes.mjs";
import { KINDS, literalsIn } from "../../checks/source/lexical.mjs";
import { LANGUAGE_OF, spokenIn } from "./spoken.mjs";
import { ESCAPED_IN_DOUBLE } from "../shell-spans.mjs";

/* Three global hops reach eight members of one assembly. */
const FOLDS = 3;
/* The languages whose bindings and `+` read as python's, the only grammar this fold has: a perl or php name carries a sigil and joins with a dot, and a shell's `x/"p.md"` is the directory `x`. */
const ASSEMBLES = new Set(["python", "node", "ruby"]);

/* Every binding, not only the ones holding a literal: a rebinding to something this cannot read has to unset what came before rather than leave a stale value answering for it. A literal counts only as the *whole* right-hand side, or `root = "a/b" if x else "/tmp"` binds the half it opens with, and only an assignment a statement opens with is one at all — `dict(root="/tmp")` rebinds nothing. */
const ENDS = String.raw`(?=\s*(?:#|//|[);,\]}]|$))`;
const OPENS = String.raw`(?<=^|[;{}\n]\s*|\b(?:const|let|var)\s+)`;
const BINDS = new RegExp(
  OPENS + String.raw`([A-Za-z_]\w*)\s*=(?!=)\s*(?:(${STRING})${ENDS}|[^\n;]+)`,
  "gmu",
);
/* Only a string form that interpolates: python's f-string, whose fields the walk finds, and a JS template literal. An ordinary `"{root}/x"` or `"${root}/x"` is a literal in both languages and stays one. A field folds only where it is a bare name. */
const FIELD = /^\{([A-Za-z_]\w*)\}$/u;
const TEMPLATE_NAME = /(?<!\\)\$\{([A-Za-z_]\w*)\}/gu;
const plainTemplate = (span) => (/^`[^`"\n\\$]*`$/u.test(span) ? `"${span.slice(1, -1)}"` : span);
/* What a fold writes back where a literal stood: a quote the value does not hold, so `spelling` reads it back whole. */
const literal = (value) => {
  if (!value.includes('"')) return `"${value}"`;
  return value.includes("'") ? `"""${value}"""` : `'${value}'`;
};
const JOINS = new RegExp(
  String.raw`\b(os\.path\.join|posixpath\.join|path\.join|pathlib\.Path|Path)\s*\(([^()]*)\)`,
  "gu",
);
/* Each join keeps its own API's rule: python's discards everything before an absolute member, node's `path.join` does not. `+` is concatenation and discards nothing. */
const RESETS = /^(?:os\.path\.join|posixpath\.join|pathlib\.Path|Path)$/u;
const GLUED = new RegExp(String.raw`(${STRING})\s*([+/])\s*(${STRING})`, "gu");
const under = (left, right, resets) =>
  (resets && right.startsWith("/") ? right : `${left}/${right}`).replace(/\/{2,}/gu, "/");

/* Read off the reading `spokenIn` made of the text, whose comments are blanked rather than cut so every offset stays where it was, and this is also what lets a block comment sit between a literal and the end of its statement. */
const bound = ({ spans, code }) => {
  const strings = spans.filter((one) => !one.comment);
  const set = [];
  for (const one of code.matchAll(BINDS)) {
    if (strings.some(({ from, to }) => one.index > from && one.index < to)) continue;
    set.push({ at: one.index + one[0].length, name: one[1], value: one[2] === undefined ? null : spelling(one[2]) });
  }
  return (name, at) => set.filter((one) => one.name === name && one.at < at).pop()?.value ?? null;
};

const NAME_THEN = new RegExp(String.raw`\b([A-Za-z_]\w*)\s*([+/])\s*(?=${STRING})`, "gu");
const THEN_NAME = new RegExp(String.raw`(${STRING})\s*([+/])\s*\b([A-Za-z_]\w*)\b`, "gu");

/* A bare name a file call writes through is the literal it was last bound to, so a name bound to a whole literal and then handed to `open` as its file writes that literal. Replaced from the last one back, so every offset still answers against the text it was measured in. */
const spelt = (said, calls, valueOf) => calls.flatMap((one) => one.names)
  .sort((a, b) => b.from - a.from)
  .reduce((text, { from, to }) => {
    const held = valueOf(text.slice(from, to), from);
    return held === null ? text : `${text.slice(0, from)}${literal(held)}${text.slice(to)}`;
  }, said);

/* A python f-string's fields, as the walk found them, each bare name among them folded to the literal it is bound to. Last back, as every fold here goes. */
const fielded = (said, { reading, valueOf }) => reading.spans.filter((one) => one.interpolates).reverse()
  .reduce((text, one) => [...one.holes].reverse().reduce((inner, hole) => {
    const name = FIELD.exec(said.slice(hole.from, hole.to))?.[1];
    const held = name ? valueOf(name, one.from) : null;
    return held === null ? inner : `${inner.slice(0, hole.from)}${held}${inner.slice(hole.to)}`;
  }, text), said);

/* Each JS template the plugin's one JS walk finds, folded where it stands, from the last back so every offset still answers; one holding a template in its interpolation is left as written, its parts being no one string. */
const templated = (said, valueOf) => literalsIn(said, { holes: "text" })
  .filter((one) => one.kind === KINDS.TEMPLATE && !said.slice(one.start + 1, one.end - 1).includes("\x60"))
  .reverse()
  .reduce((text, one) => {
    const span = text.slice(one.start, one.end).replace(TEMPLATE_NAME, (whole, name) => valueOf(name, one.start) ?? whole);
    return `${text.slice(0, one.start)}${plainTemplate(span)}${text.slice(one.end)}`;
  }, said);

/* A literal standing in a fold, as what it spells, or `null` where `spelling` places none — which leaves the fold's text as it stands. */
const glue = (left, right, join) => {
  const parts = [spelling(left), spelling(right)];
  return parts.includes(null) ? null : literal(join(...parts));
};

/* The fold, with the file calls of the text it ends at: one `spokenIn` reading per text serves its bindings, its f-strings and its file calls, and is made again only where a pass moved the text. */
const fold = (body, runner) => {
  const lang = LANGUAGE_OF[runner];
  let out = String(body);
  let read = null;
  let state = null;
  const fresh = () => {
    if (read !== out) {
      const reading = spokenIn(out, runner);
      state = { reading, valueOf: bound(reading), calls: null };
      read = out;
    }
    return state;
  };
  const callsOf = () => {
    const now = fresh();
    now.calls ??= fileCalls(out, runner, now.reading);
    return now.calls;
  };
  if (!ASSEMBLES.has(lang)) return { text: out, callsOf };
  const pass = (pattern, made) => {
    const { valueOf } = fresh();
    out = out.replace(pattern, (...args) => made(args, args[args.length - 2], valueOf) ?? args[0]);
  };
  const quoted = (valueOf, name, at) => {
    const held = valueOf(name, at);
    return held === null ? null : literal(held);
  };
  /* A constructor cannot fold while its argument is still a concatenation, and a concatenation cannot reach a name no fold has reached yet, so the stages run together until the text stops moving. */
  for (let hop = 0; hop < FOLDS; hop += 1) {
    const before = out;
    if (lang === "node") out = templated(out, fresh().valueOf);
    else if (lang === "python") out = fielded(out, fresh());
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
        .map((each) => spelling(each) ?? valueOf(each, at));
      if (!parts.length || parts.some((each) => each === null)) return null;
      return literal(parts.reduce((left, right) => under(left, right, RESETS.test(verb))));
    });
    out = spelt(out, callsOf(), fresh().valueOf);
    out = out.replace(GLUED, (all, left, sign, right) =>
      glue(left, right, (one, two) => (sign === "/" ? under(one, two, true) : one + two)) ?? all);
    if (out === before) break;
  }
  return { text: out, callsOf };
};

/** A binding reaches the text after it and nothing before, one rebound to anything but a whole string literal answers for nothing, a join whose members all read as literals folds to one, and
 *  `+` and pathlib's `/` fold to a fixed point. Each pass reads what the pass before it produced and finds its bindings there, so an offset always answers against the text it was measured in:
 *  order is what a binding is read by, and no pass reorders. Every literal a pass reads is read by `STRING` and `spelling`, the grammar a file call's own target is read by. Shapes with no model —
 *  `.format`, `%`, `"/".join`, a value read at runtime — leave the text alone. how/writes.md. */
export const glued = (body, runner) => fold(body, runner).text;

/** `glued`'s text with the file calls `fileCalls` reads in it, which the fold's last pass has already read where the text stopped moving there. */
export const folded = (body, runner) => {
  const { text, callsOf } = fold(body, runner);
  return { text, calls: callsOf() };
};

/* The program's own argument, whole: the command's word handed in, which the gates read off the command. Built from one with anything else, it is computed. */
const ARGUMENT = /^(?:sys|process)\.argv\s*\[\s*\d+\s*\]$/u;
/** What a body's file calls write through that none of its literals or bindings produces once `glued` has folded them, each as the body spells it: an argument, or the path a method is called on. how/writes.md. */
export const unplacedIn = (body, runner) => {
  const { text, calls } = folded(body, runner);
  return calls.flatMap((one) => one.through)
    .map(({ from, to }) => text.slice(from, to).replace(/\s+/gu, " "))
    .filter((said) => !ARGUMENT.test(said));
};

/* The escapes a double quote lets a backslash make, read off the walk's own set. An escaped `$` or backtick is a literal and a bare one still expands, so each escaped one is held as a
   character the body does not already hold, which no fold reads, and only those go back escaped. */
const ESCAPED = new RegExp(String.raw`\\(\n|${ESCAPED_IN_DOUBLE.source})`, "gu");
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
  const out = glued(body, runner);
  if (out === body) return null;
  const escapes = new RegExp(String.raw`\\(?=[\\"$\u0060${dollar}${tick}]|$)|"`, "gu");
  return out.replace(escapes, (one) => `\\${one}`).replaceAll(dollar, "\\$").replaceAll(tick, "\\`");
};

/** The same fold for an inline program, handed over still in the shell quotes it was written in: the quoting comes off for the reading and goes back on after, so a body quoting its own strings with
 *  `\"` is one body, and a single-quoted one needs none back, holding no `'` and gaining none. What the fold resolved nothing in comes back as given, byte for byte. how/writes.md. */
export const gluedQuoted = (quoted, runner) => {
  const inner = quoted.slice(1, -1);
  if (quoted[0] === '"') {
    const back = doubleQuoted(inner, runner);
    return back === null ? quoted : `"${back}"`;
  }
  const out = glued(inner, runner);
  return out === inner ? quoted : `'${out}'`;
};
