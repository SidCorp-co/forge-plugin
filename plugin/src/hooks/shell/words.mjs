// The words of a shell command as the walk reads them, and which quoted spans are one filename.

import { quoting } from "./walk.mjs";
import { BLANKS } from "./word.mjs";
import { SPLITS } from "./wrappers.mjs";

/* A word is what a shell hands on as one, so only what ends a word ends a name: the operators, the quotes, a `$` and a backslash — one the shell keeps, since one it removes makes the character behind it a character of the word, which is `worded`'s to read. Everything else a filesystem allows stands inside a name, which is why this is written as what a name may not carry rather than as what it may — an allow-list cut a path at the first `+` in it and handed on the tail, which is shorter, relative and still resolves. */
const OPERATOR = /[;&|()<>$\\]/u;
/* Whitespace and the quotes end a word wherever they stand, under a quote as much as outside one, but in a span `spacedName` reads as a path. Outside a quote the whitespace is the shell's three blanks, since that is where the shell itself ends a word and a no-break space there is a character of the name the write lands on; under one it is any, the space because a quoted span carrying one is a sentence or a list far more often, and `touch 'a.md b.md'` names two; the quotes because what arrives here is as often an interpreter's body carrying its own quotes as it is one name, and `open("--trap.md", "w")` spells the file in the inner pair. */
const ALWAYS = /[\s'"`]/u;
const BARE = new RegExp(String.raw`${BLANKS}|['"\x60]`, "u");
/** A word that names a shell, at any path, through `busybox` or not: the one answer for a `-c` body, a heredoc on stdin and the caller's own language. Non-capturing, as are the two below, being spliced into readers' patterns. */
export const SHELL_WORD = String.raw`(?:(?:\S*\/)?busybox\s+)?(?:\S*\/)?(?:ba|da|k|z|a)?sh`;

/** One option a shell takes before its program: a bare word only as the value of `-o`, `+o`, `-O` or `+O`, since `bash -x script -c '…'` runs the script and hands it the rest. */
export const SHELL_OPTION = String.raw`(?:[-+][A-Za-z]*[oO]\s+[\w-]+|[-+]\S+)`;

/** A word that runs its next quoted argument as a command, through to where that argument opens: a shell with its options before the `-c`, or `eval`, each behind blanks, or env handed its command as one string to split, which `SPLITS` spells. The separator is the runner's, since env's attached `-S'…'` and `--split-string='…'` have none a reader could append. Where a command starts before it is each reader's own. */
export const RUNNER = String.raw`(?:${SHELL_WORD}\s+(?:${SHELL_OPTION}\s+)*-[A-Za-z]*c[A-Za-z]*|eval)\s+|${SPLITS}`;
/* The quoted span whose spaces are a name's: rooted, ending in an extension, every space inside one path component, and not the body a `RUNNER` runs. A sentence opens with a word, a list puts its space against the next root, `sh -c '/bin/cp a.md b.md'` is code, and what is left is a directory named `sp ace`, whose write was cut to a tail naming another file (ISS-1594). */
const ROOTED = /^~?\//u;
const EXTENDED = /\.[A-Za-z0-9]+$/u;
const INNER = /(?<=[^\s/]) +(?=[^\s/])/gu;
const spacedName = (body) => body.includes(" ") && ROOTED.test(body) && EXTENDED.test(body)
  && !/[\s[\]]/u.test(body.replace(INNER, ""));
const RUN_BODY = new RegExp(String.raw`(?:^|[\s;&|(])(?:${RUNNER})$`, "u");
/* And the two of the operators a single quote takes back, which is where a shell opens no subshell and a path plausibly carries one: the `;`, the `|`, the `<`, the `>`, the `$` and the backslash inside a quoted span say interpreter's body far more often than they say filename, and a reading that must not invent a target leaves them ending words as they always did. */
const BRACKET = /[()]/u;

/** Every word of a command, as the walk reads it: the text of one, and the offset each of its characters stood at — kept per character because a word is the characters of it that survive, and a name read out of one is still placed where it was written. An operator ends a word wherever the shell is spending it as shell, which is what `quoting` answers and no regular expression over the raw text can. Under a single quote it is spending no bracket, so `'a/p(1)/b.md'` is one word and one name rather than a tail that resolves somewhere else entirely.
 *  Both readings of such a span and not one, since nothing in the text says which it is: `'a/p(1)/b.md'` is a path and `'system(q(touch),q(b.md))'` is code, and a caller that must not miss a target is handed the whole word for the first and the brackets still ending words for the second. So nothing a name was read from before this is read from less. `joined` is which words the first reading made, and `namesOf` takes a name from one only where the name is the whole of it: the claim such a word makes is that the span is one filename, and a `'…/(report.md).txt'` whose extension stops short of its end is refuting that claim rather than spelling a file. */
const cuts = (mark) => !mark
  || (mark.under === " " ? BARE : ALWAYS).test(mark.one)
  || ((mark.under !== "'" || !BRACKET.test(mark.one)) && OPERATOR.test(mark.one));
/* Where one operand ends, which is a bare shell metacharacter and not where a word this reads ends: a `$`, a backslash and a quote each end a word here and carry the operand on, so `'a(1).md'$(printf .txt)` and `'a(1).md'.txt` are one operand apiece and neither is the span. Bare, because a metacharacter a quote or a comment holds separates nothing, and the three characters a shell splits on rather than every space this language knows, since `'a(1).md'<U+00A0>.txt` is one operand to a shell and two words to a `\s`. And a `)` on either side of a span is the one this leaves out: in front it closes a substitution the shell joins to that span as often as a subshell around it, and behind it closes a substitution the span was computed *inside* — `> $(printf '%s.txt' 'a(1).md')` writes the `.txt` and the span is an argument of the printf. Behind a span, a `)` closing a substitution has the span inside it, which its depth already declines; one closing a subshell is left ending nothing here, as it always was. */
const OPENED = /[ \t\n;&|<>(]/u;
const CLOSED = /[ \t\n;&|<>]/u;
const parts = (mark, shape) => !mark || (mark.under === " " && shape.test(mark.one));

/* Where a value the text does not spell was first put in, past which the whole reading is not offered: anywhere and not in the same command, because nothing here says how far what it puts in reaches. What does: a `$` opening an expansion other than a command substitution, and a `(` some other character put in front of — a process substitution's, and the pattern openers a shell with `extglob` on reads `x@('a(1).md'|y)` with. Any of them and this stops claiming a span is a whole operand: `${OUT:+ 'a(1).md' }` is a filename or nothing depending on a variable. A `$(…)` or a backtick pair is not counted, bare or quoted: the walk places where each ends, what it puts in joins only the word it stands in, and every span inside one stands deeper than zero, which `wholeSpans` declines. */
const SUBSTITUTES = (marks, n) => marks[n].one === "$" && marks[n + 1]?.one === "(" && marks[n + 1].depth > marks[n].depth;
const openedAt = (marks) => {
  const at = marks.findIndex(({ one, under, depth }, n) => under === " " && !depth
    && ((one === "$" && !SUBSTITUTES(marks, n))
      || (one === "(" && marks[n - 1]?.under === " " && /[<>?*+@!]/u.test(marks[n - 1]?.one ?? ""))));
  return at < 0 ? marks.length : at;
};

/** Whether a name read at an offset of this text may be claimed as the whole of an operand: not past a value the text does not spell, and not inside a substitution standing outside every quote, where it may be an argument of some other command, and not inside a comment, where a redirect is prose and writes nothing. One walk for the text, since the answer is about the whole command and in no slice of it: the spans are cut inside a bare substitution, so a slice holding one of its commands no longer says it stands there, where one inside a quoted substitution holds that substitution whole. */
export const placeable = (text) => {
  const marks = quoting(text);
  const opens = marks[openedAt(marks)]?.at ?? Infinity;
  const said = new Set(marks.filter(({ under }) => under === "#").map(({ at }) => at));
  const inside = new Set();
  let outermost = "";
  for (const { at, depth, within } of marks) {
    outermost = depth ? outermost || within : "";
    if (outermost === "bare") inside.add(at);
  }
  return (at) => at < opens && !said.has(at) && !inside.has(at);
};

/* Which quoted spans are a whole operand and so could be one filename, as mark indices, and whether its spaces are a name's. Closed, holding nothing that still cuts a word, with an operand's end on either side of it, and outside every substitution — each because the whole reading claims the span *is* the file: `'/tmp/m/(r).md;o.txt'` and `'/tmp/m/(r).md'.txt` both write a `.txt`, either would hand a `.md` scan a guarded name nobody wrote, and a span the walk places inside a `$(…)`, quoted or not, is an argument of the command that substitution runs. A double-quoted span is one only where it holds a bracket or `spacedName` reads it as a path, the one place a space is allowed: a `$`, a backtick and a backslash cut a word, so it holds what a shell writes (ISS-3081). */
const wholeSpans = (marks, alike) => {
  const opens = openedAt(marks);
  /* As a shell reads it, a continuation gone, so a body after one is a runner's. */
  const read = marks.map(({ one }) => one).join("");
  const out = [];
  for (let from = 0; from < marks.length;) {
    const quote = marks[from].under;
    if (quote !== "'" && quote !== '"') {
      from += 1;
      continue;
    }
    let to = from + 1;
    while (to < marks.length && marks[to].under === quote) to += 1;
    const body = marks.slice(from + 1, to - 1);
    const shut = to - from >= 2 && marks[from].one === quote && marks[to - 1].one === quote;
    const spaced = spacedName(body.map(({ one }) => one).join("")) && !RUN_BODY.test(read.slice(0, from));
    if (alike && shut && (quote === "'" || spaced || body.some(({ one }) => BRACKET.test(one))) && from < opens && !marks[from].depth && parts(marks[from - 1], OPENED) && parts(marks[to], CLOSED)
      && !body.some(({ one }) => (ALWAYS.test(one) && !(spaced && one === " ")) || (OPERATOR.test(one) && !BRACKET.test(one)))) {
      out.push({ from, to, spaced });
    }
    from = to;
  }
  return out;
};

/** Where each quoted span whose space is a filename's opens: the judgement `worded` and `spoken` read. */
export const spacedSpans = (text, alike = true) => {
  const marks = quoting(text);
  return new Set(wholeSpans(marks, alike).filter(({ spaced }) => spaced).map(({ from }) => marks[from].at));
};

/* One shell word with every quote it opens closed: a single-quoted run, a double-quoted one, an escaped character, or a bare character that is no blank and no quote. */
const CLOSED_WORD = /^(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|[^\s'"\\])+$/u;
/* What a shell still does something with outside every quote: expands, globs, joins, opens a frame, ends the word, or starts a comment. */
const ACTED_ON = /[$`*?[\]{}~()!#;&|<>\s\\'"]/u;
/** The name a shell writes for one word that is known to be a filename — a redirect's operand — where it expands nothing in it: the word with its quotes and the backslashes it removes taken off, each character placed where it was written, and ended at a bare `)`, which closes the frame the redirect stands in. A quote of the other kind, a space, a `$(` or a backtick under a single quote is a character of that name, since a redirect's operand is never an interpreter's body. `null` where the shell would still expand, glob or tilde-expand any of it, where a quote is left open, or where the word stands inside a frame or a comment, so the caller keeps the reading it has for those. */
export const literalWord = (given) => {
  const shut = quoting(given).find(({ one, under }) => under === " " && one === ")");
  const text = shut ? given.slice(0, shut.at) : given;
  if (!CLOSED_WORD.test(text)) return null;
  const word = { text: "", at: [] };
  for (const { at, one, under, removed, depth } of quoting(text)) {
    if (depth || under === "#") return null;
    if (removed || ((under === "'" || under === '"') && one === under)) continue;
    if ((under === '"' && (one === "$" || one === "\x60")) || (under === " " && ACTED_ON.test(one))) return null;
    word.text += one;
    word.at.push(at);
  }
  return word.text ? word : null;
};

/* A parameter expansion: a `$` the shell spends, bare or under a double quote, opening a name, a positional or special parameter, or a `${…}`. A `$(` is a substitution, whose spans their depth declines, and a `$'…'` or `$"…"` spells text. */
const PARAMETER = /[A-Za-z0-9_{@*#?!$-]/u;
const IDENTIFIER = /[A-Za-z0-9_]/u;
const expands = (marks, n) => marks[n].one === "$" && (marks[n].under === " " || marks[n].under === '"')
  && marks[n + 1]?.under === marks[n].under && PARAMETER.test(marks[n + 1].one);
/* Where the word an expansion opens ends: a separator the shell spends, or under a quote what says program text rather than a path — a quote of the other kind, a backtick, an operator other than a bracket — so `perl -e "open(F, '>$d/a.md'); …"` ends it at the `'` and the body's next target is still a word. A quote that opens or closes, an escaped pair and a further expansion carry it on: `"${BASE}"/x.md` is one operand. */
const ends = (marks, n) => {
  const { one, under } = marks[n];
  if ((one === "'" || one === '"') && under === one) return false;
  if (under === "\\") return false;
  if (under === "'") return /[`";&|<>\\]/u.test(one);
  if (one === "$") return !expands(marks, n);
  if (under === " ") return BARE.test(one) || /[;&|<>()\\]/u.test(one);
  return under === '"' ? /[`'";&|<>\\]/u.test(one) : true;
};
/* The expansion itself, from its `$`: through the brace that closes a `${…}`, or the name or the one character a parameter is spelt with. A brace counts only where it stands under the quoting the `$` did, so a quoted or an escaped `}` in a default closes nothing. Every character inside the braces is the expansion's and no pattern's, so it is read as literal and a `}` there is no substitution the name begins behind. */
const parameterEnd = (marks, n, inside) => {
  if (marks[n + 1].one !== "{") {
    let to = n + 2;
    if (IDENTIFIER.test(marks[n + 1].one) && !/[0-9]/u.test(marks[n + 1].one)) while (to < marks.length && IDENTIFIER.test(marks[to].one)) to += 1;
    return to;
  }
  let depth = 0;
  for (let at = n + 1; at < marks.length; at += 1) {
    inside[at] = true;
    if (marks[at].under !== marks[n].under) continue;
    if (marks[at].one === "{") depth += 1;
    if (marks[at].one === "}" && (depth -= 1) === 0) return at + 1;
  }
  return marks.length;
};
/* Which marks stand in a word an expansion opens, as the index of its `$`, and which stand inside its braces. The text behind a `$` does not spell what the shell writes there, so it is never cut off as a name of its own: a target under `/m/` whose directory was a variable and a word behind a space handed on that word alone, which the working directory resolved, while the file the command wrote was somewhere under `/m/` (ISS-3085). */
const expansions = (marks) => {
  const from = new Array(marks.length).fill(-1);
  const inside = new Array(marks.length).fill(false);
  for (let n = 0; n < marks.length;) {
    if (!expands(marks, n)) {
      n += 1;
      continue;
    }
    const start = n;
    while (n < marks.length && (n === start || !ends(marks, n))) {
      const to = expands(marks, n) ? parameterEnd(marks, n, inside) : n + 1;
      for (; n < to; n += 1) from[n] = start;
    }
  }
  return { from, inside };
};

export const worded = (text, alike) => {
  const marks = quoting(text);
  const { from, inside } = expansions(marks);
  const alone = new Array(marks.length).fill(false);
  const spaced = new Array(marks.length).fill(false);
  for (const span of wholeSpans(marks, alike)) {
    for (let at = span.from; at < span.to; at += 1) {
      alone[at] = true;
      spaced[at] = span.spaced;
    }
  }
  const whole = [];
  let word = null;
  for (let n = 0; n < marks.length; n += 1) {
    const { at, one, removed, under } = marks[n];
    const escaped = removed && marks[n + 1]?.at === at + 1;
    if (from[n] === n) whole.push((word = { text: "", at: [], literal: [], built: true }));
    else if (from[n] < 0 && word?.built) word = null;
    if (from[n] >= 0) {
      if ((one === "'" || one === '"') && under === one) continue;
      if (escaped) n += 1;
      word.text += escaped ? marks[n].one : one;
      word.at.push(at);
      word.literal.push(escaped || inside[n]);
      continue;
    }
    if (!escaped && !((spaced[n] && one === " ") || (alone[n] && BRACKET.test(one))) && cuts(marks[n])) {
      word = null;
      continue;
    }
    if (!word) whole.push((word = { text: "", at: [], literal: [], alone: alone[n], spaced: spaced[n] }));
    /* A removed backslash and the character behind it are one character of the word, which is the second of them: the shell has made it literal, so nothing it is ends a word, and it is placed where its spelling begins (ISS-1592). */
    if (escaped) n += 1;
    word.text += escaped ? marks[n].one : one;
    word.at.push(at);
    word.literal.push(escaped);
  }
  /* A bracket an escape made literal is the name's and never code's, so it is no place the second reading cuts. */
  const bare = (one, at) => !one.literal[at] && BRACKET.test(one.text[at]);
  const out = [];
  for (const one of whole) {
    /* A span read as one path is read whole and only whole: its brackets are a path's as its spaces are, and either cut would hand on a tail that resolves to another file. */
    if (one.spaced) {
      out.push({ ...one, joined: true });
      continue;
    }
    /* And a word an expansion opens is read whole, from its `$`: a bracket it holds stood under a quote, and a cut there hands on a tail as the `$` did. */
    if (one.built) {
      out.push(one);
      continue;
    }
    if (!one.text.split("").some((_, at) => bare(one, at))) {
      out.push(one);
      continue;
    }
    if (one.alone) out.push({ ...one, joined: true });
    let part = null;
    for (let at = 0; at < one.text.length; at += 1) {
      if (bare(one, at)) {
        part = null;
        continue;
      }
      if (!part) out.push((part = { text: "", at: [], literal: [] }));
      part.text += one.text[at];
      part.at.push(one.at[at]);
      part.literal.push(one.literal[at]);
    }
  }
  return out;
};
