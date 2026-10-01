/* Where a here-document's body is, for every reader that asks: the readers of which run a command is and where it stands, the write gates and the stats corpus. A body is the stdin of the
   command it stands on, so its words are no call, no id and no move of this shell's (ISS-1717). One reader places the bodies and each consumer keeps its own policy over what it cannot vouch
   for (ISS-2865). What each does with the text that is left: docs/cli/the-here-document.md. */
import { underOf } from "../../hooks/shell-spans.mjs";

const BACKTICK = "\x60";
const WORD_ENDS = /[\s;&|()<>]/u;

/* Where the quoting walk is a guess, as `granted-id.mjs` says of the same three spellings: after a live `$'` any apostrophe could be the one a backslash kept, a `$[` body is read for no shell,
   and a `${…}` holding a quote nests one the flat walk closes early. A `${…}` holding none is placed exactly, which is why this reads to its brace rather than stopping at its opener. */
const GUESSED = /\$['[]|\$\{[^}]*['"]/gu;
const guessed = (text, under, end) =>
  [...text.slice(0, end).matchAll(GUESSED)].some(({ index }) => !["'", "#", "\\"].includes(under[index]));

/* Inside an unquoted body a quote is data and never stops an expansion, a backslash-newline is removed and joins what it split, and a backslash makes only `$`, a backtick or a backslash
   literal, so the scan reads the body as the shell does before it expands and not by the walk a shell line is read by. */
const LITERAL_AFTER = new Set(["$", BACKTICK, "\\"]);
const RUNS = /\$\(|\$\{[\s|]|\x60/u;

const runsInBody = (body) => {
  let read = "";
  for (let at = 0; at < body.length; at += 1) {
    if (body[at] === "\\" && body[at + 1] === "\n") at += 1;
    else if (body[at] === "\\" && LITERAL_AFTER.has(body[at + 1])) {
      read += "\0";
      at += 1;
    } else read += body[at];
  }
  return RUNS.test(read);
};

/* The delimiter word as a shell reads it: up to an unquoted blank or operator, its quotes and backslashes removed, and quoted — the body taken literally — where it carried any. A `#` where
   the word would begin opens a comment, which leaves the operator no word at all. */
const wordAt = (text, from) => {
  if (text[from] === "#") return null;
  let at = from;
  let said = "";
  let quoted = false;
  while (at < text.length && !WORD_ENDS.test(text[at])) {
    const one = text[at];
    if (one === "'" || one === '"') {
      const close = text.indexOf(one, at + 1);
      if (close < 0) return null;
      said += text.slice(at + 1, close);
      quoted = true;
      at = close + 1;
    } else if (one === "\\") {
      said += text[at + 1] ?? "";
      quoted = true;
      at += 2;
    } else {
      said += one;
      at += 1;
    }
  }
  return said ? { said, quoted, end: at } : null;
};

/* What an operator at `at` stands inside: `shift` within `((…))` or `$((…))`, where a `<<` is arithmetic and no operator; `nested` within `(…)` or `$(…)`; `bare` within neither; and
   `data` under a quote, a comment or a backslash. Under a double quote a `$(…)` still opens a shell, so a `<<` there is that shell's operator: `git commit -m "$(cat <<'EOF'` is the
   commonest here-document an agent sends. The walk reads a substitution holding a `<<` as the double quote around it, so a quote of that shell's own is read as the outer one, which is the guess left standing. */
const contextAt = (text, under, at) => {
  const open = [];
  const push = (one, quoted) => {
    const shift = text[one + 1] === "(";
    open.push({ shift, quoted });
    return shift ? one + 1 : one;
  };
  for (let one = 0; one < at; one += 1) {
    const mark = under[one];
    const inside = open.at(-1)?.quoted === true;
    if (mark === " ") {
      while (open.at(-1)?.quoted) open.pop();
      if (text[one] === "(") one = push(one, false);
      else if (text[one] === ")" && open.length > 0 && open.pop().shift && text[one + 1] === ")") one += 1;
    } else if (mark === '"' && text[one] === "(" && (inside || text[one - 1] === "$")) one = push(one, true);
    else if (mark === '"' && text[one] === ")" && inside && open.pop().shift && text[one + 1] === ")") one += 1;
  }
  const quoted = under[at] === '"' && open.at(-1)?.quoted === true;
  if (under[at] !== " " && !quoted) return "data";
  if (!quoted) while (open.at(-1)?.quoted) open.pop();
  if (open.some(({ shift }) => shift)) return "shift";
  return open.length > 0 ? "nested" : "bare";
};

/* The next operator a shell acts on at or after `from`: both characters under one quoting, neither half of a `<<<` here-string, and not a shift. `null` for none, and `unread` on one with
   no word this reader can place. */
const operatorFrom = (text, under, from) => {
  for (let at = text.indexOf("<<", from); at >= 0; at = text.indexOf("<<", at + 1)) {
    if (text[at + 2] === "<") {
      at += 2;
      continue;
    }
    if (under[at] !== under[at + 1] || text[at - 1] === "<") continue;
    const context = contextAt(text, under, at);
    if (context === "data" || context === "shift") continue;
    const tabbed = text[at + 2] === "-";
    let start = at + 2 + (tabbed ? 1 : 0);
    while (text[start] === " " || text[start] === "\t") start += 1;
    const word = wordAt(text, start);
    const nested = context === "nested";
    return word ? { at, end: word.end, delimiter: word.said, quoted: word.quoted, tabbed, nested } : { at, unread: true };
  }
  return null;
};

/* The newline ending the operator's line: the first one standing under the quoting the operator does, a double quote for one inside a `$(…)` that quote opened. */
const lineEnd = (text, under, { at, end }) => {
  for (let one = text.indexOf("\n", end); one >= 0; one = text.indexOf("\n", one + 1)) if (under[one] === under[at]) return one;
  return -1;
};

/* Where the body that opens at `from` ends: `{ to, closed }`, the start of the line that is its delimiter and past that line's newline, or `null` where no line is. */
const closedAt = (text, from, { delimiter, tabbed }) => {
  for (let at = from; at <= text.length;) {
    const nl = text.indexOf("\n", at);
    const line = text.slice(at, nl < 0 ? text.length : nl);
    if ((tabbed ? line.replace(/^\t+/u, "") : line) === delimiter) return { to: at, closed: nl < 0 ? text.length : nl + 1 };
    if (nl < 0) return null;
    at = nl + 1;
  }
  return null;
};

/* The operators on one line, each with the body that follows that line in its turn. A body with no delimiter line runs to the end of the text, as the shell reads it, and so does a line
   ending the text with no newline after it, its bodies empty. */
const lineOf = (text, under, first) => {
  const nl = lineEnd(text, under, first);
  const line = nl < 0 ? text.length : nl;
  const guess = guessed(text, under, line);
  const docs = [first];
  for (let one = operatorFrom(text, under, first.end); one !== null && one.at < line; one = operatorFrom(text, under, one.end)) {
    if (one.unread) return [{ at: first.at, unread: true }];
    docs.push(one);
  }
  let from = Math.min(line + 1, text.length);
  for (const doc of docs) {
    const ends = closedAt(text, from, doc);
    const [to, closed] = ends ? [ends.to, ends.closed] : [text.length, text.length];
    Object.assign(doc, { line, from, to, closed, guessed: guess, unclosed: nl < 0 || !ends });
    doc.substitutes = !doc.quoted && runsInBody(text.slice(from, to));
    from = closed;
  }
  return docs;
};

/* A text whose span holds nothing a walk reads, offset for offset: the bodies placed so far, so a quote inside one cannot move the reading of what follows it. */
const blanked = (text, from, to) => text.slice(0, from) + text.slice(from, to).replace(/[^\n]/gu, " ") + text.slice(to);

/** Every here-document a shell would open in the text, in order, each `{ at, end, line, from, to, closed, delimiter, quoted, tabbed, nested, guessed, unclosed, substitutes }`: its operator's
 *  span, the newline ending its line, its body's span and where its delimiter line ends, and what about it no reader can vouch for — inside a `$(…)` or a subshell, read under a quoting the walk
 *  guesses at, with no delimiter line, or unquoted with a substitution in its body. Last, where one is, `{ at, unread: true }`: an operator with no word this reader can place, past which
 *  nothing is said. Operators sharing a line share `line`. */
const hereDocs = (command) => {
  let text = String(command ?? "");
  const out = [];
  /* No operator, no body, and no walk: `operatorFrom` finds nothing else. */
  if (!text.includes("<<")) return out;
  for (let from = 0; ;) {
    const under = underOf(text);
    const first = operatorFrom(text, under, from);
    if (first === null) return out;
    const docs = first.unread ? [first] : lineOf(text, under, first);
    out.push(...docs);
    if (docs[0].unread) return out;
    const last = docs.at(-1);
    /* Blanking leaves the text past `last.closed` as it was, so no `<<` there is no operator after it either. */
    if (last.closed >= text.length || !text.includes("<<", last.closed)) return out;
    text = blanked(text, docs[0].from, last.closed);
    from = last.closed;
  }
};

/* Operators sharing a line, whose bodies follow it one after another, as one group. */
const lines = (docs) => docs.reduce((out, doc) => {
  if (out.at(-1)?.[0].line === doc.line && !doc.unread) out.at(-1).push(doc);
  else out.push([doc]);
  return out;
}, []);

const vouched = (doc) => !(doc.unread || doc.nested || doc.guessed || doc.unclosed || doc.substitutes);

/** The text with each here-document this reader can vouch for taken out: its body and delimiter line removed, its operator and word blanked. From the first line holding one `hereDocs` flags,
 *  the text is left as it stands, so a reader asking of it answers as it did before. */
export const withoutBodies = (command) => {
  const text = String(command ?? "");
  let out = "";
  let pos = 0;
  for (const group of lines(hereDocs(text))) {
    if (!group.every(vouched)) break;
    const head = text.slice(pos, group[0].line).split("");
    for (const { at, end } of group) head.fill(" ", at - pos, end - pos);
    out += `${head.join("")}\n`;
    pos = group.at(-1).closed;
  }
  return out + text.slice(pos);
};

/** The text with every body this reader places cut out, whatever it could not vouch for: each operator and its word become `operator`, one blank by default, the rest of its line stays,
 *  and the body with its delimiter line becomes what `body(text, at, before)` answers — empty by default — told where in the text being returned it stands and what the text said between the
 *  last cut and its operator, which is where the command reading it is named. From an operator it cannot place the text is left as it stands. */
export const bodiesOut = (command, { body = () => "", operator = " " } = {}) => {
  const text = String(command ?? "");
  let out = "";
  let pos = 0;
  for (const group of lines(hereDocs(text))) {
    if (group[0].unread) break;
    const before = [];
    for (const { at, end } of group) {
      before.push(text.slice(pos, at));
      out += `${text.slice(pos, at)}${operator}`;
      pos = end;
    }
    out += text.slice(pos, group[0].line + 1);
    group.forEach((doc, one) => {
      out += body(text.slice(doc.from, doc.to), out.length, before[one]);
    });
    pos = Math.max(group.at(-1).closed, group[0].line + 1);
  }
  return out + text.slice(pos);
};
