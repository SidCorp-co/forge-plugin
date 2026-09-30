/* Where a here-document's body is, for the readers that ask which run a command is and where it stands: a body is the stdin of the command it stands on, so its words are no call, no id
   and no move of this shell's (ISS-1717). What each reader does with the text that is left: docs/cli/the-here-document.md. */
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

/* Whether a bare parenthesis is still open at `at`. Inside `$((…))` or `((…))` a `<<` is a shift and not a redirection, and inside `$(…)` or a subshell the body is one this reader does not
   follow, so an operator standing in any of them is left unread rather than told apart. */
const nestedAt = (text, under, at) => {
  let depth = 0;
  for (let one = 0; one < at; one += 1) {
    if (under[one] !== " ") continue;
    if (text[one] === "(") depth += 1;
    else if (text[one] === ")" && depth > 0) depth -= 1;
  }
  return depth > 0;
};

/* The next operator a shell acts on at or after `from`: both characters bare, and neither half of a `<<<` here-string. `null` for none, and `unread` on one this reader cannot place. */
const operatorFrom = (text, under, from) => {
  for (let at = text.indexOf("<<", from); at >= 0; at = text.indexOf("<<", at + 1)) {
    if (text[at + 2] === "<") {
      at += 2;
      continue;
    }
    if (under[at] !== " " || under[at + 1] !== " " || text[at - 1] === "<") continue;
    if (nestedAt(text, under, at)) return { at, unread: true };
    const tabbed = text[at + 2] === "-";
    let start = at + 2 + (tabbed ? 1 : 0);
    while (text[start] === " " || text[start] === "\t") start += 1;
    const word = wordAt(text, start);
    return word ? { at, end: word.end, delimiter: word.said, quoted: word.quoted, tabbed } : { at, unread: true };
  }
  return null;
};

const liveNewline = (text, under, from) => {
  for (let at = text.indexOf("\n", from); at >= 0; at = text.indexOf("\n", at + 1)) if (under[at] === " ") return at;
  return -1;
};

/* Where the body that opens at `from` ends: past the newline of the line that is its delimiter, `-1` where no line is. */
const closedAt = (text, from, { delimiter, tabbed }) => {
  for (let at = from; at <= text.length;) {
    const nl = text.indexOf("\n", at);
    const line = text.slice(at, nl < 0 ? text.length : nl);
    if ((tabbed ? line.replace(/^\t+/u, "") : line) === delimiter) return nl < 0 ? text.length : nl + 1;
    if (nl < 0) return -1;
    at = nl + 1;
  }
  return -1;
};

/* The operators on one line and the end of their bodies, which follow that line one after another; `null` where any of them this reader cannot delimit or its shell would expand into a command. */
const lineOf = (text, under, first) => {
  const end = first.unread ? -1 : liveNewline(text, under, first.end);
  if (end < 0 || guessed(text, under, end)) return null;
  const operators = [first];
  for (let one = operatorFrom(text, under, first.end); one !== null && one.at < end; one = operatorFrom(text, under, one.end)) {
    if (one.unread) return null;
    operators.push(one);
  }
  let from = end + 1;
  for (const one of operators) {
    const closed = closedAt(text, from, one);
    if (closed < 0 || (!one.quoted && runsInBody(text.slice(from, closed)))) return null;
    from = closed;
  }
  return { operators, end, closed: from };
};

/** The text with each here-document this reader can delimit exactly taken out: its body and delimiter line removed, its operator and word blanked. One it cannot — no delimiter line, a
 *  quoting the walk guesses at, an unquoted body a substitution runs in — is left where it stands, and everything after it with it, so a reader asking of it answers as it did before. */
export const withoutBodies = (command) => {
  let text = String(command ?? "");
  for (let from = 0; ;) {
    const under = underOf(text);
    const first = operatorFrom(text, under, from);
    const line = first ? lineOf(text, under, first) : null;
    if (!line) return text;
    const head = text.slice(0, line.end).split("");
    for (const { at, end } of line.operators) head.fill(" ", at, end);
    text = `${head.join("")}\n${text.slice(line.closed)}`;
    from = line.end + 1;
  }
};
