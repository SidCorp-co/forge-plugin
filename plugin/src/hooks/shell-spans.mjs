// Where a command in a shell text ends, and which directory it could be running in: one reading, span by span.

import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

/* Where a word begins: the only place a `#` is a comment and a `(` a subshell, `$(…)` and `<(…)` opening
   a shell for their body alone. A flag and not a look-behind — the escape branch eats two characters. And
   a `)` closes a frame only where the `(` it matches opened one, so a substitution pops nothing. */
const OPENS = /[\s;&|()]/u;

/** Where each command begins and ends, with the subshells its span opens and closes. A quoted body is
 *  never cut, nor a pipeline split: both hand the next command its arguments. An unclosed quote joins, a
 *  backslash escapes outside single quotes, and a comment is outside every span — its `|` is no pipeline. */
export const spans = (text, { pipes = false } = {}) => {
  const out = [];
  let start = 0;
  let quote = "";
  let said = -1;
  let fresh = true;
  let opens = 0;
  let closes = 0;
  const nested = [];
  const cut = (at) => {
    out.push({ start, end: said < 0 ? at : said, opens, closes });
    said = -1;
    opens = 0;
    closes = 0;
  };
  for (let at = 0; at < text.length; at += 1) {
    const one = text[at];
    /* Read before the quote and escape branches: a comment's apostrophe opens nothing. */
    if (said >= 0) {
      if (one === "\n") {
        cut(at);
        start = at + 1;
      }
      continue;
    }
    if (one === "\\" && quote !== "'") {
      at += 1;
      fresh = false;
      continue;
    }
    if (quote) {
      if (one === quote) quote = "";
      fresh = false;
      continue;
    }
    if (one === '"' || one === "'") {
      quote = one;
      fresh = false;
      continue;
    }
    if (fresh && one === "#") {
      said = at;
      continue;
    }
    if (one === "(") {
      nested.push(fresh);
      if (fresh) opens += 1;
    } else if (one === ")" && (nested.pop() ?? true)) closes += 1;
    fresh = OPENS.test(one);
    const pair = text.slice(at, at + 2);
    /* `|&` is a pipeline, `>&` a descriptor — but a pipeline is where a program owning a flag stops. */
    if (pair === "|&") {
      if (pipes) cut(at);
      at += 1;
      if (pipes) start = at + 1;
      continue;
    }
    if (one === "&" && text[at - 1] === ">") continue;
    if (one === ";" || one === "\n" || one === "&" || pair === "||" || (pipes && one === "|")) {
      cut(at);
      if (pair === "&&" || pair === "||") at += 1;
      start = at + 1;
    }
  }
  cut(text.length);
  return out;
};

/* What may precede a `cd` and still leave the move to this shell: a group, or a keyword whose condition
   or body runs here — never a `!`, which inverts. The destination is one shell word, and it is optional. */
const AHEAD = String.raw`(?:[({]\s*|\b(?:if|elif|while|until|then|else|do)\s+)*`;
const WORD = String.raw`(?:'[^']*'|"[^"]*"|\\.|[^\s;&|()<>])+`;
const MOVES = new RegExp(`^${AHEAD}cd(?=\\s|$)(?:\\s+-[\\w-]+)*(?:\\s+(${WORD}))?`, "u");
/** A destination the text does not carry — `cd -`, a bare `cd`, one still holding a `$`. Guessed it would
 *  answer for a tree nobody named; `movedTo` hands it back rather than the cwd, and `resolve` throws on it. */
export const NOWHERE = Symbol("a tree the command does not name");
/** What each separator says about the move, and what a `then` or `do` after one proves — except after
 *  an `until`, whose body runs where the `cd` failed, so there the doubt is what holds. */
const UNMOVED = /^(?:&(?!&)|\|(?!\|))/u;
const EITHER = /^(?:;|\n|\|\|)/u;
const PROVEN = /^[;&|\s]*(?:then|do)\b/u;
const INVERTED = /^until\b/u;
const STAGE = /(?:^|[^|])\|&?\s*$/u;
const COMMENT = /^#[^\n]*/u;
export const spelled = (one) =>
  one.replace(/['"]/gu, "").replace(/\\(.)/gu, "$1").replace(/^~(?=\/|$)/u, homedir());
const named = (to) => to !== "" && to !== "-" && !to.includes("$");
const onto = (base, to) => {
  if (to === NOWHERE) return NOWHERE;
  if (isAbsolute(to)) return to;
  return base === NOWHERE ? NOWHERE : (base ? resolve(base, to) : to);
};

/** Every directory a command at this point could run in: `null` the caller's own cwd, the first every move applied. */
export const standsIn = (text, before) => {
  const outer = [];
  let could = [null];
  let after = "";
  for (const { start, end, opens, closes } of spans(text, { pipes: true })) {
    if (end > before) break;
    const held = could;
    const one = text.slice(start, end).trim();
    for (let n = opens; n > 0; n -= 1) outer.push(could);
    const move = STAGE.test(after) ? null : MOVES.exec(one);
    const to = move && move[1] !== undefined ? spelled(move[1]) : "";
    const said = move && (named(to) ? to : NOWHERE);
    if (said) could = [...could.map((f) => onto(f, said)), ...(after[0] === "|" ? held : [])];
    const next = text.slice(end).replace(COMMENT, "");
    if (one) after = next.match(/^[;&|\s]+/u)?.[0] ?? "";
    if (closes && outer.length) for (let n = closes; n > 0 && outer.length; n -= 1) could = outer.pop();
    else if (UNMOVED.test(after)) could = held;
    else if (EITHER.test(after) && said && !(PROVEN.test(next) && !INVERTED.test(one))) could = [...could, ...held];
  }
  return [...new Set(/\|\|/u.test(text.slice(0, before)) ? [...could, null] : could)];
};

export const movedTo = (text, before) => {
  const [first] = standsIn(text, before);
  return typeof first === "string" || first === NOWHERE ? first : null;
};
