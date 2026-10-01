// The words of a shell command as the walk reads them, and which quoted spans are one filename.

import { quoting } from "./walk.mjs";

/* A word is what a shell hands on as one, so only what ends a word ends a name: the operators, the quotes, a `$` and a backslash — one the shell keeps, since one it removes makes the character behind it a character of the word, which is `worded`'s to read. Everything else a filesystem allows stands inside a name, which is why this is written as what a name may not carry rather than as what it may — an allow-list cut a path at the first `+` in it and handed on the tail, which is shorter, relative and still resolves. */
const OPERATOR = /[;&|()<>$\\]/u;
/* Whitespace and the quotes end a word wherever they stand, under a quote as much as outside one, but in a span `spacedName` reads as a path. The space because a quoted span carrying one is a sentence or a list far more often, and `touch 'a.md b.md'` names two; the quotes because what arrives here is as often an interpreter's body carrying its own quotes as it is one name, and `open("--trap.md", "w")` spells the file in the inner pair. */
const ALWAYS = /[\s'"`]/u;
/** A word that names a shell, at any path, through `busybox` or not: the one answer for a `-c` body, a heredoc on stdin and the caller's own language. Non-capturing, as are the two below, being spliced into readers' patterns. */
export const SHELL_WORD = String.raw`(?:(?:\S*\/)?busybox\s+)?(?:\S*\/)?(?:ba|da|k|z|a)?sh`;

/** One option a shell takes before its program: a bare word only as the value of `-o`, `+o`, `-O` or `+O`, since `bash -x script -c '…'` runs the script and hands it the rest. */
export const SHELL_OPTION = String.raw`(?:[-+][A-Za-z]*[oO]\s+[\w-]+|[-+]\S+)`;

/** A word that runs its next quoted argument as shell code: a shell with its options before the `-c`, or `eval`. Where a command starts before it is each reader's own. */
export const RUNNER = String.raw`${SHELL_WORD}\s+(?:${SHELL_OPTION}\s+)*-[A-Za-z]*c[A-Za-z]*|eval`;
/* The quoted span whose spaces are a name's: rooted, ending in an extension, every space inside one path component, and not the body a `RUNNER` runs. A sentence opens with a word, a list puts its space against the next root, `sh -c '/bin/cp a.md b.md'` is code, and what is left is a directory named `sp ace`, whose write was cut to a tail naming another file (ISS-1594). */
const ROOTED = /^~?\//u;
const EXTENDED = /\.[A-Za-z0-9]+$/u;
const INNER = /(?<=[^\s/]) +(?=[^\s/])/gu;
const spacedName = (body) => body.includes(" ") && ROOTED.test(body) && EXTENDED.test(body)
  && !/[\s[\]]/u.test(body.replace(INNER, ""));
const RUN_BODY = new RegExp(String.raw`(?:^|[\s;&|(])(?:${RUNNER})\s+$`, "u");
/* And the two of the operators a single quote takes back, which is where a shell opens no subshell and a path plausibly carries one: the `;`, the `|`, the `<`, the `>`, the `$` and the backslash inside a quoted span say interpreter's body far more often than they say filename, and a reading that must not invent a target leaves them ending words as they always did. */
const BRACKET = /[()]/u;

/** Every word of a command, as the walk reads it: the text of one, and the offset each of its characters stood at — kept per character because a word is the characters of it that survive, and a name read out of one is still placed where it was written. An operator ends a word wherever the shell is spending it as shell, which is what `quoting` answers and no regular expression over the raw text can. Under a single quote it is spending no bracket, so `'a/p(1)/b.md'` is one word and one name rather than a tail that resolves somewhere else entirely.
 *  Both readings of such a span and not one, since nothing in the text says which it is: `'a/p(1)/b.md'` is a path and `'system(q(touch),q(b.md))'` is code, and a caller that must not miss a target is handed the whole word for the first and the brackets still ending words for the second. So nothing a name was read from before this is read from less. `joined` is which words the first reading made, and `namesOf` takes a name from one only where the name is the whole of it: the claim such a word makes is that the span is one filename, and a `'…/(report.md).txt'` whose extension stops short of its end is refuting that claim rather than spelling a file. */
const cuts = (mark) => !mark
  || ALWAYS.test(mark.one)
  || ((mark.under !== "'" || !BRACKET.test(mark.one)) && OPERATOR.test(mark.one));
/* Where one operand ends, which is a bare shell metacharacter and not where a word this reads ends: a `$`, a backslash and a quote each end a word here and carry the operand on, so `'a(1).md'$(printf .txt)` and `'a(1).md'.txt` are one operand apiece and neither is the span. Bare, because a metacharacter a quote or a comment holds separates nothing, and the three characters a shell splits on rather than every space this language knows, since `'a(1).md'<U+00A0>.txt` is one operand to a shell and two words to a `\s`. And a `)` on either side of a span is the one this leaves out: in front it closes a substitution the shell joins to that span as often as a subshell around it, and behind it closes a substitution the span was computed *inside* — `> $(printf '%s.txt' 'a(1).md')` writes the `.txt` and the span is an argument of the printf. Which of the two a `)` is, this reader does not ask the walk — the walk places a substitution only where a double quote opened it — so the span beside one keeps the reading it had. */
const OPENED = /[ \t\n;&|<>(]/u;
const CLOSED = /[ \t\n;&|<>]/u;
const parts = (mark, shape) => !mark || (mark.under === " " && shape.test(mark.one));

/* Where a substitution was first opened, past which the whole reading is not offered: anywhere and not in the same command, because what ends a bare one is a `)` the walk does not place. What may put a value into the command that this text does not spell: a `$` opening an expansion of any kind, a backtick pair, and a `(` some other character put in front of — a process substitution's, and the pattern openers a shell with `extglob` on reads `x@('a(1).md'|y)` with. Any of them and this stops claiming a span is a whole operand: `${OUT:+ 'a(1).md' }` is a filename or nothing depending on a variable. An opener inside a substitution the walk did place is not counted: what it puts in stays inside that substitution, whose spans `worded` already declines. */
const openedAt = (marks) => {
  const at = marks.findIndex(({ one, under, depth }, n) => under === " " && !depth
    && (one === "$" || one === "\x60"
      || (one === "(" && marks[n - 1]?.under === " " && /[<>?*+@!]/u.test(marks[n - 1]?.one ?? ""))));
  return at < 0 ? marks.length : at;
};

/** Whether a name read at an offset of this text may be claimed as the whole of an operand: not past a substitution, where it may be an argument of some other command, and not inside a comment, where a redirect is prose and writes nothing. One walk for the text, since the answer is about the whole command and in no slice of it. */
export const placeable = (text) => {
  const marks = quoting(text);
  const opens = marks[openedAt(marks)]?.at ?? Infinity;
  const said = new Set(marks.filter(({ under }) => under === "#").map(({ at }) => at));
  return (at) => at < opens && !said.has(at);
};

/* Which single-quoted spans are a whole operand and so could be one filename, as mark indices, and whether its spaces are a name's. Closed, holding nothing that still cuts a word, with an operand's end on either side of it, and outside every substitution a double quote opened — each because the whole reading claims the span *is* the file: `'/tmp/m/(r).md;o.txt'` and `'/tmp/m/(r).md'.txt` both write a `.txt`, either would hand a `.md` scan a guarded name nobody wrote, and a span the walk places inside `"$(…)"` is an argument of the command that substitution runs. A space is allowed only where `spacedName` reads the span as a path. */
const wholeSpans = (text, marks, alike) => {
  const opens = openedAt(marks);
  const out = [];
  for (let from = 0; from < marks.length;) {
    if (marks[from].under !== "'") {
      from += 1;
      continue;
    }
    let to = from + 1;
    while (to < marks.length && marks[to].under === "'") to += 1;
    const body = marks.slice(from + 1, to - 1);
    const shut = to - from >= 2 && marks[to - 1].one === "'";
    const spaced = spacedName(body.map(({ one }) => one).join("")) && !RUN_BODY.test(text.slice(0, marks[from].at));
    if (alike && shut && from < opens && !marks[from].depth && parts(marks[from - 1], OPENED) && parts(marks[to], CLOSED)
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
  return new Set(wholeSpans(text, marks, alike).filter(({ spaced }) => spaced).map(({ from }) => marks[from].at));
};

export const worded = (text, alike) => {
  const marks = quoting(text);
  const alone = new Array(marks.length).fill(false);
  const spaced = new Array(marks.length).fill(false);
  for (const span of wholeSpans(text, marks, alike)) {
    for (let at = span.from; at < span.to; at += 1) {
      alone[at] = true;
      spaced[at] = span.spaced;
    }
  }
  const whole = [];
  let word = null;
  for (let n = 0; n < marks.length; n += 1) {
    const { at, one, removed } = marks[n];
    const escaped = removed && marks[n + 1]?.at === at + 1;
    if (!escaped && !(spaced[n] && one === " ") && cuts(marks[n])) {
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
