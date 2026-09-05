/* What an interpreter's own body would have built before it wrote, for the one caller that asks what a
   command writes. Kept out of the hook harness because it is a reading and not an entry point, and
   beside shell-spans because it answers the same question about a different language. how/writes.md. */
import { unquote } from "./shell-spans.mjs";

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
  python: { spans: /\b(?:rf|fr|f)(['"])((?:[^\\\n]|\\.)*?)\1/giu, name: /\{([A-Za-z_]\w*)\}/gu },
  node: {
    spans: /`(?:[^`\\]|\\[\s\S])*`/gu,
    name: /(?<!\\)\$\{([A-Za-z_]\w*)\}/gu,
    plain: (span) => (/^`[^`"\n\\$]*`$/u.test(span) ? `"${span.slice(1, -1)}"` : span),
  },
};
const SPEAKS = { python: "python", python3: "python", node: "node", deno: "node", bun: "node" };
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

/* A binding is discovered in code and nowhere else: an assignment inside a comment is not a rebinding, and one inside a string a command is writing is neither. Comments are blanked rather than cut so every offset stays where it was, and this is also what lets a block comment sit between a literal and the end of its statement. */
const SPOKEN_IN = {
  python: /"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*'|(#[^\n]*)/gu,
  node: /`(?:[^`\\]|\\[\s\S])*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/gu,
};

const bound = (said, runner) => {
  const scan = SPOKEN_IN[SPEAKS[runner] ?? ""] ?? SPOKEN_IN.python;
  const strings = [];
  const code = said.replace(scan, (span, comment, at) => {
    if (comment !== undefined) return " ".repeat(span.length);
    strings.push({ start: at, end: at + span.length });
    return span;
  });
  const set = [];
  for (const one of code.matchAll(BINDS)) {
    if (strings.some(({ start, end }) => one.index > start && one.index < end)) continue;
    set.push({ at: one.index + one[0].length, name: one[1], value: one[2] === undefined ? null : unquote(one[2]) });
  }
  return (name, at) => set.filter((one) => one.name === name && one.at < at).pop()?.value ?? null;
};

const NAME_THEN = new RegExp(String.raw`\b([A-Za-z_]\w*)\s*([+/])\s*(?=${LITERAL})`, "gu");
const THEN_NAME = new RegExp(String.raw`(${LITERAL})\s*([+/])\s*\b([A-Za-z_]\w*)\b`, "gu");

/** A binding reaches the text after it and nothing before, one rebound to anything but a whole string literal answers for nothing, a join whose members all read as literals folds to one, and
 *  `+` and pathlib's `/` fold to a fixed point. Each pass reads what the pass before it produced and finds its bindings there, so an offset always answers against the text it was measured in:
 *  order is what a binding is read by, and no pass reorders. Shapes with no model — `.format`, `%`, `"/".join`, a value read at runtime — leave the text alone. how/writes.md. */
export const glued = (body, runner) => {
  const holds = HOLDS[SPEAKS[runner] ?? ""];
  let out = String(body);
  const pass = (pattern, made) => {
    const valueOf = bound(out, runner);
    out = out.replace(pattern, (...args) => made(args, args[args.length - 2], valueOf) ?? args[0]);
  };
  const quoted = (valueOf, name, at) => (valueOf(name, at) === null ? null : `"${valueOf(name, at)}"`);
  /* A constructor cannot fold while its argument is still a concatenation, and a concatenation cannot reach a name no fold has reached yet, so the stages run together until the text stops moving. */
  for (let hop = 0; hop < FOLDS; hop += 1) {
    const before = out;
    if (holds) {
      pass(holds.spans, ([span], at, valueOf) => {
        const made = span.replace(holds.name, (whole, name) => valueOf(name, at) ?? whole);
        return holds.plain ? holds.plain(made) : made;
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
    out = out.replace(GLUED, (all, left, sign, right) =>
      `"${sign === "/" ? under(unquote(left), unquote(right), true) : unquote(left) + unquote(right)}"`);
    if (out === before) break;
  }
  return out;
};
