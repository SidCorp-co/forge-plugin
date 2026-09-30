// Reading a shell command: where one ends, which directory it could be running in, and which of its operands a write lands on — one walk, span by span.

import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

import { quoting, spans } from "./shell/walk.mjs";

export { quoting, spans };

/* What may precede a move and still leave it to this shell: a group, or a keyword whose condition or body runs here — never a `!`, which inverts. The destination is one optional shell word, `popd` has none, a `-n` moves the stack and not the shell so it is no move at all, and past a `--` a word beginning with one is the destination. */
const KEYWORDS = "if|elif|while|until|then|else|do";
/* The words that run the command after them rather than being it: the keywords, and the wrappers that hand the rest of the line to the program it names. Every reading of what stands before a verb is built from this one list, so a word gained here is gained by all of them. */
const PREFIXES = `sudo|command|nohup|time|env|exec|${KEYWORDS}`;
/* A shell word, kept whole through its quotes: a single-quoted run, a double-quoted one inside which a backslash still escapes, an escaped character, or any character but a blank and the `stops` that end a word for this reader. One reading, so a case a shell word gains is gained by every reader that splits one. */
const shellWord = (stops) => String.raw`(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|[^\s${stops}])+`;
const AHEAD = String.raw`(?:[({]\s*|\b(?:${KEYWORDS})\s+)*`;
const MOVES = new RegExp(
  `^${AHEAD}(?:popd(?=\\s|$)|(?:cd|pushd)(?=\\s|$))((?:\\s+-(?!-(?![\\w-]))[\\w-]+)*)(?:\\s+--)?(?:\\s+(${shellWord(";&|()<>")}))?`,
  "u",
);
const STAYS = /(?:^|\s)-[a-zA-Z]*n[a-zA-Z]*(?![\w-])/u;
/** A destination the text does not carry — `cd -`, a bare `cd` or `pushd`, a `popd` whose stack this
 *  declines to model, one holding a `$`. `movedTo` hands it back rather than the cwd, and `resolve` throws. */
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
/** `spelled` run the other way — the word written back into a command a refusal tells a developer to run: bare where a shell hands it on unchanged, quoted where it would split, and since a quoted run has no escape, an apostrophe closes the quote, escapes, reopens. */
const PLAIN = /^[\w./@+][\w./@+-]*$/u;
export const typed = (one) =>
  PLAIN.test(one) ? one : `'${one.replace(/'/gu, String.raw`'\''`)}'`;

/** `typed` for a path, which has a second way of being unreadable: a leading hyphen a CLI's own parser eats as a flag. Both halves are wanted together, so they are one function (ISS-703). */
export const pathed = (one) => typed(one.startsWith("-") ? `./${one}` : one);
const named = (to) => to !== "" && to !== "-" && !to.startsWith("+") && !to.includes("$");
const onto = (base, to) => {
  if (to === NOWHERE) return NOWHERE;
  if (isAbsolute(to)) return to;
  return base === NOWHERE ? NOWHERE : (base ? resolve(base, to) : to);
};

/** Every directory a command at this point could run in: `null` the caller's own cwd, the first every move applied. */
export const standsIn = (text, before) => standingsOf(text)(before);

/* One walk of a text answers every offset of it, so a reader asking at each name of a long command pays for the command once rather than once per name (ISS-1608). The last few texts are kept, a hook asking about one command many times and about a handful in all. */
const WALKED = new Map();
const KEPT = 8;
const standingsOf = (text) => {
  if (!WALKED.has(text)) {
    if (WALKED.size >= KEPT) WALKED.delete(WALKED.keys().next().value);
    WALKED.set(text, walkedStanding(text));
  }
  return WALKED.get(text);
};

/* What each span leaves the shell in, in order, with the furthest end reached by then: a question at an offset is answered by the spans that ended at or before it, the first one ending past it stopping the reading. */
const walkedStanding = (text) => {
  const reached = [];
  const states = [];
  const outer = [];
  let could = [null];
  let after = "";
  let furthest = -1;
  for (const { start, end, opens, closes } of spans(text, { pipes: true })) {
    const held = could;
    const one = text.slice(start, end).trim();
    for (let n = opens; n > 0; n -= 1) outer.push(could);
    const move = STAGE.test(after) ? null : MOVES.exec(one);
    const to = move && move[2] !== undefined ? spelled(move[2]) : "";
    const said = move && !STAYS.test(move[1]) && (named(to) ? to : NOWHERE);
    if (said) could = [...could.map((f) => onto(f, said)), ...(after[0] === "|" ? held : [])];
    const next = text.slice(end).replace(COMMENT, "");
    if (one) after = next.match(/^[;&|\s]+/u)?.[0] ?? "";
    if (closes && outer.length) for (let n = closes; n > 0 && outer.length; n -= 1) could = outer.pop();
    else if (UNMOVED.test(after)) could = held;
    else if (EITHER.test(after) && said && !(PROVEN.test(next) && !INVERTED.test(one))) could = [...could, ...held];
    furthest = Math.max(furthest, end);
    reached.push(furthest);
    states.push(could);
  }
  const either = text.indexOf("||");
  return (before) => {
    let lo = 0;
    let hi = reached.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (reached[mid] > before) hi = mid;
      else lo = mid + 1;
    }
    const could = lo ? states[lo - 1] : [null];
    return [...new Set(either >= 0 && either + 2 <= before ? [...could, null] : could)];
  };
};

export const movedTo = (text, before) => {
  const [first] = standsIn(text, before);
  return typeof first === "string" || first === NOWHERE ? first : null;
};

/** The directory the command at this offset stands in, placed against `base`: `base` itself where nothing moved, `NOWHERE` where the move names no directory the text carries. With no base, what the text spells comes back unplaced — `null` for no move — for a caller that places it later. What `NOWHERE` costs a command is the caller's decision, and stated where it is made. */
export const directoryAt = (text, before, base = null) => {
  const moved = movedTo(text, before);
  if (moved === NOWHERE || base === null) return moved;
  return resolve(base, moved ?? ".");
};

/* A loop opens where a command does, past a `!` that inverts one or a `time` that measures it. `for` and `select` stand beside the two waits because a `done` cannot tell them apart, and one left off the list has that `done` close the wait around it instead. */
const LOOPS = /^(?:[({]\s*|!\s*|\btime\s+(?:-\S+\s+)*|\b(?:if|elif|then|else|do)\s+)*(while|until|for|select)(?=\s|$)/u;
const WAITS = /^(?:while|until)$/u;
/* A wait's condition is a command list, so a loop written in it takes the next `do` and the keyword is not the body: the newest name has the `do` over any wait still short of one. Read before the keyword below, because one span can open the body above it and name the next — `do for`. */
const BODY = /^do(?=[\s;&|()<>]|$)/u;
/* The other body, which only an arithmetic `for` may take — `for x in a { :; }` is a syntax error — so only an arithmetic name is spendable and elsewhere a bare `{` is ordinary data in a word list. Read past the keyword and where the body opens rather than where it closes: the head's own brace must spend the head's own name, and a name left standing over the body would be taken by the `do` of a wait written inside it. Quoted runs are blanked first, a brace inside a word being a character of that word; a `${…}` carries no word boundary before its brace and a `{a,b}` none after. */
const BRACE = /(?:^|[\s;&|()])\{(?=\s|$)/u;
/** A quoted run as the shell reads one: a single-quoted run has no escape, a double-quoted one does. */
export const QUOTED = /'[^']*'|"(?:\\[\s\S]|[^"\\])*"/gu;
const ENDS = /^done(?=[\s;&|)<>]|$)/u;
/* What a `for` or `select` takes next: the variable it walks, or the arithmetic head, which `spans` cuts at its own `;` — so a word opening neither is a continuation of that head, `for ((i=0; for < 3; i++))` puts one there, and naming a loop for it spends a `do` the wait around it was owed. */
const OVER = /^(?:\(\(|[A-Za-z_]\w*)/u;

/** Where each `while`/`until` … `done` runs, as `[from, to)` over the same text — one range per wait, innermost first, a frame nothing closed dropped rather than swallowing the rest of the line.
 *  Every loop body a `done` closes is a frame and only a wait's is a range, so a `done` closes the loop it belongs to; the arithmetic brace body is the one no `done` reaches, and spends its name without becoming a frame. */
export const waitsIn = (text) => {
  const out = [];
  const open = [];
  const named = [];
  for (const { start, end } of spans(text, { pipes: true })) {
    const one = text.slice(start, end).trim();
    if (BODY.test(one)) {
      if (named.length) open.push({ ...named.pop(), body: true });
      else {
        const waiting = open.findLast((frame) => !frame.body);
        if (waiting) waiting.body = true;
      }
    } else if (ENDS.test(one) && open.length) {
      const shut = open.pop();
      if (shut.waits) out.push([shut.start, end]);
    }
    const loop = LOOPS.exec(one);
    const past = one.slice(loop ? loop[0].length : 0);
    if (loop) {
      if (WAITS.test(loop[1])) open.push({ start, waits: true, body: false });
      else {
        const head = past.trimStart();
        if (OVER.test(head)) named.push({ start, waits: false, arith: head.startsWith("((") });
      }
    }
    if (named.at(-1)?.arith && BRACE.test(past.replace(QUOTED, " "))) named.pop();
  }
  return out;
};

/* A word is what a shell hands on as one, so only what ends a word ends a name: the operators, the quotes, a `$` and a backslash — one the shell keeps, since one it removes makes the character behind it a character of the word, which is `worded`'s to read. Everything else a filesystem allows stands inside a name, which is why this is written as what a name may not carry rather than as what it may — an allow-list cut a path at the first `+` in it and handed on the tail, which is shorter, relative and still resolves. */
const OPERATOR = /[;&|()<>$\\]/u;
/* Whitespace and the quotes end a word wherever they stand, under a quote as much as outside one. The space because a quoted span carrying one is a sentence or a payload far more often than a filename, which is the narrowing `spoken` makes in the harness and the split that hands `touch 'a.md b.md'` its two candidates; the quotes because what arrives here is as often an interpreter's body carrying its own quotes as it is one name, and `open("--trap.md", "w")` spells the file in the inner pair. */
const ALWAYS = /[\s'"`]/u;
/* And the two of the operators a single quote takes back, which is where a shell opens no subshell and a path plausibly carries one: the `;`, the `|`, the `<`, the `>`, the `$` and the backslash inside a quoted span say interpreter's body far more often than they say filename, and a reading that must not invent a target leaves them ending words as they always did. */
const BRACKET = /[()]/u;

/** Every word of a command, as the walk reads it: the text of one, and the offset each of its characters stood at — kept per character because a word is the characters of it that survive, and a name read out of one is still placed where it was written. An operator ends a word wherever the shell is spending it as shell, which is what `quoting` answers and no regular expression over the raw text can. Under a single quote it is spending no bracket, so `'a/p(1)/b.md'` is one word and one name rather than a tail that resolves somewhere else entirely.
 *  Both readings of such a span and not one, since nothing in the text says which it is: `'a/p(1)/b.md'` is a path and `'system(q(touch),q(b.md))'` is code, and a caller that must not miss a target is handed the whole word for the first and the brackets still ending words for the second. So nothing a name was read from before this is read from less. `joined` is which words the first reading made, and `namesOf` takes a name from one only where the name is the whole of it: the claim such a word makes is that the span is one filename, and a `'…/(report.md).txt'` whose extension stops short of its end is refuting that claim rather than spelling a file. */
const cuts = (mark) => !mark
  || ALWAYS.test(mark.one)
  || ((mark.under !== "'" || !BRACKET.test(mark.one)) && OPERATOR.test(mark.one));
/* Where one operand ends, which is a bare shell metacharacter and not where a word this reads ends: a `$`, a backslash and a quote each end a word here and carry the operand on, so `'a(1).md'$(printf .txt)` and `'a(1).md'.txt` are one operand apiece and neither is the span. Bare, because a metacharacter a quote or a comment holds separates nothing, and the three characters a shell splits on rather than every space this language knows, since `'a(1).md'<U+00A0>.txt` is one operand to a shell and two words to a `\s`. And a `)` on either side of a span is the one this leaves out: in front it closes a substitution the shell joins to that span as often as a subshell around it, and behind it closes a substitution the span was computed *inside* — `> $(printf '%s.txt' 'a(1).md')` writes the `.txt` and the span is an argument of the printf. Which of the two a `)` is, is what this walk cannot yet say (ISS-1533), and until it can, the span beside one keeps the reading it had. */
const OPENED = /[ \t\n;&|<>(]/u;
const CLOSED = /[ \t\n;&|<>]/u;
const parts = (mark, shape) => !mark || (mark.under === " " && shape.test(mark.one));

/* Whether a substitution was opened anywhere before this point, which is where the whole reading stops being offered: `> $(printf '%s.txt' 'a(1).md')` puts a quoted operand inside one, where it is an argument of that command and not the target of this one, and nothing about the span or its neighbours says so. Anywhere and not in the same command, because what ends a substitution is the `)` this walk cannot place and a separator inside one ends nothing (ISS-1533) — so a text that opened one is a text this declines to place a span in at all, and the span keeps the reading it had. */
/* What may put a value into the command that this text does not spell: a `$` opening an expansion of any kind, a backtick pair, and a `(` some other character put in front of — a process substitution's, and the pattern openers a shell with `extglob` on reads `x@('a(1).md'|y)` with. Any of them and this stops claiming a span is a whole operand — `${OUT:+ 'a(1).md' }` is a filename or nothing at all depending on a variable, and `$(printf …)` is an argument of the printf. Written as the openers rather than as their shapes, because what closes each of them is a bracket this walk cannot place (ISS-1533) and a shape it cannot close is one it cannot leave. */
const openedAt = (marks) => {
  const at = marks.findIndex(({ one, under }, n) => under === " "
    && (one === "$" || one === "\x60"
      || (one === "(" && marks[n - 1]?.under === " " && /[<>?*+@!]/u.test(marks[n - 1]?.one ?? ""))));
  return at < 0 ? marks.length : at;
};

/** Whether a name read at an offset of this text may be claimed as the whole of an operand: not past a substitution, where it may be an argument of some other command, and not inside a comment, where a redirect is prose and writes nothing. One walk for the text, so a caller reading it span by span asks it once — the answer is about the whole command and is not in any slice of it. */
export const placeable = (text) => {
  const marks = quoting(text);
  const opens = marks[openedAt(marks)]?.at ?? Infinity;
  const said = new Set(marks.filter(({ under }) => under === "#").map(({ at }) => at));
  return (at) => at < opens && !said.has(at);
};

const worded = (text, alike) => {
  const marks = quoting(text);
  const opens = openedAt(marks);
  /* Which single-quoted spans are a whole operand and so could be one filename. Closed, holding nothing that still cuts a word, and with an operand's end on either side of it — each of the three because the whole reading claims the span *is* the file: `'/tmp/m/(r).md;o.txt'` and `'/tmp/m/(r).md'.txt` both write a `.txt`, and either would hand a `.md` scan a guarded name nobody wrote. */
  const alone = new Array(marks.length).fill(false);
  for (let from = 0; from < marks.length;) {
    if (marks[from].under !== "'") {
      from += 1;
      continue;
    }
    let to = from + 1;
    while (to < marks.length && marks[to].under === "'") to += 1;
    const body = marks.slice(from + 1, to - 1);
    const shut = to - from >= 2 && marks[to - 1].one === "'";
    if (alike && shut && from < opens && parts(marks[from - 1], OPENED) && parts(marks[to], CLOSED)
      && !body.some(({ one }) => ALWAYS.test(one) || (OPERATOR.test(one) && !BRACKET.test(one)))) {
      for (let at = from; at < to; at += 1) alone[at] = true;
    }
    from = to;
  }
  const whole = [];
  let word = null;
  for (let n = 0; n < marks.length; n += 1) {
    const { at, one, removed } = marks[n];
    const escaped = removed && marks[n + 1]?.at === at + 1;
    if (!escaped && cuts(marks[n])) {
      word = null;
      continue;
    }
    if (!word) whole.push((word = { text: "", at: [], literal: [], alone: alone[n] }));
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
      if (!part) out.push((part = { text: "", at: [] }));
      part.text += one.text[at];
      part.at.push(one.at[at]);
    }
  }
  return out;
};
/* Where a name may begin inside its word, besides its start. Before it: the option a value may be attached to, which is one letter after a single hyphen and the whole word after two — `curl -onotes.md` writes what `--output=notes.md` does, and past a bare `--` there are no options left, so a file whose own name opens with a hyphen is read as one — and the first `=` or `:`, a key standing in front of the value it names. After it: the last `}`, since what follows the last substitution is the literal tail the program will build, and `f"{root}/skills/x/SKILL.md"` spells a guarded path while naming no `root` this can read. One of each and no more, so one word is read four ways rather than once per character of a 40 000-character operand. And a word standing against a quote is no option at all but a literal a body carries, an interpreter's own body arriving here with its quotes still in it — all three of them, a template's backtick as much as the other two — and `open("--trap.md", "w")` naming a file. */
const OPTION = /^--[\w-]+|^-[A-Za-z0-9]/u;
const KEYED = /[=:]/u;
const QUOTES = /["'`]/u;
/* And where the word itself is no name: behind a key, which is a word-part carrying no separator with a value spelled from somewhere behind it — the root, a home, this directory or the one above. A `dd` naming its output after an `of=` names the value alone; a directory whose own name carries an `=` names the whole word, and only the first has a key in front of it. */
const KEY = /^[^/=:]*[=:](?:~|\.{0,2})\//u;
/* And a word a shell or an interpreter would rewrite spells a file this text does not hold: what the write lands on is the pattern's match or the substitution's value, which is elsewhere. how/writes.md. */
const PATTERN = String.raw`[^*?[\]{}]`;

/** A name with an extension, as a command spells one, with where each begins: the readings above, so a directory carrying a character a name usually does not is read whole rather than cut at it, while one word may still spell the value behind its option or its key and the tail behind its substitution. `tail` is which extensions a caller wants, one gate judging `.md` alone. The names written from the root come first, those being the ones a reader resolves without the call's own cwd. Spelt here and nowhere else. */
export const namesOf = (text, tail = "[A-Za-z0-9]+", { options = true, whole = true } = {}) => {
  /* The extension ends the name: `SKILL.md.bak` and `notes.md~` carry none of the ones asked for, and the backup a copy makes beside a guarded file is not that file. */
  const ending = new RegExp(`^${PATTERN}+\\.(?:${tail})(?![\\w~-]|\\.[\\w~-])`, "u");
  const names = [];
  const seen = new Set();
  const past = (mark) => (mark < 0 ? [] : [mark + 1]);
  let ended = false;
  for (const word of worded(text, whole)) {
    if (word.text === "--") ended = true;
    const literal = QUOTES.test(text[word.at[0] - 1] ?? " ");
    const option = (options && !ended && !literal && OPTION.exec(word.text)?.[0].length) || 0;
    /* A joined word is read from its start and nowhere else. The other three readings each say the name begins partway in, which is the opposite of what this word claims — that the span is one filename — and `'cache=/tmp/(r).md'` is a relative name the key reading would turn into a rooted one somewhere else entirely. */
    const starts = word.joined ? [0] : [
      ...(option || KEY.test(word.text) ? [] : [0]),
      ...(option && word.text[option] !== "=" ? [option] : []),
      ...past(KEYED.exec(word.text)?.index ?? -1),
      ...past(word.text.lastIndexOf("}")),
    ];
    for (const at of new Set(starts)) {
      const name = ending.exec(word.text.slice(at))?.[0];
      /* One reading of a word and the other can spell the same name at the same place — `'a.md)'` whole and `'a.md'` past the operator — and one name read twice from one offset is one name. */
      const once = name && `${word.at[at]} ${name}`;
      if (once && !seen.has(once) && !(word.joined && name.length < word.text.length - at)) {
        seen.add(once);
        names.push({ token: name, at: word.at[at] });
      }
    }
  }
  const rooted = (one) => one.token.startsWith("/") || one.token.startsWith("~/");
  return [...names.filter(rooted), ...names.filter((one) => !rooted(one))];
};

export const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

/** Where a command starts. `xargs` keeps its own flags (`xargs -I{} sh` runs a shell), the rest do not: a flag widens what a mention may look like. `^` is last — zero-width, it wins a prefix's position. */
export const STARTS = String.raw`(?:[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+|\bxargs\s+(?:-\S+\s+)*`
  + String.raw`|\b(?:${PREFIXES})\s+|^)`;

/** A word that runs its next quoted argument as shell code: a shell at any path, through `busybox` or not, with its options before the `-c` — a bare word only as the value `-o` or `+o` takes, since `bash -x script -c '…'` runs the script and hands it the rest — or `eval`. The answer the write gates open a body on and the stats corpus counts one as run by, so a runner either knows is known to both; where a command starts before it is each reader's own. Every group is non-capturing, being spliced into a reader's pattern. */
export const RUNNER = String.raw`(?:(?:\S*\/)?busybox\s+)?(?:\S*\/)?(?:ba|da|k|z|a)?sh\s+(?:(?:[-+][A-Za-z]*[oO]\s+[\w-]+|[-+]\S+)\s+)*-[A-Za-z]*c[A-Za-z]*|eval`;

/* The options through which `curl` and `wget` write a file they name, letters and long names, each one seen creating its file (curl 8.18, wget 1.25, a `file://` source) — a log and a header dump are files as much as the document is. One that wrote nothing there, `curl -c` with no cookie to keep or `wget --save-cookies`, joins when a run sees it write, and `wget --warc-file` builds its name rather than spelling it. */
const FETCHES = {
  curl: { letters: "oD", names: ["output", "dump-header", "trace", "trace-ascii", "stderr", "libcurl", "etag-save"] },
  wget: { letters: "Ooa", names: ["output-document", "output-file", "append-output"] },
};
/* Both verbs read one letter after a single hyphen and take the rest of the word as the value — `curl -output` writes a file called `utput` — so no boundary may follow a letter, and only the long spellings keep one, which is what leaves `--outputting` the unknown option curl refuses, and `--output-dir` the directory it names, rather than a write. */
const fetching = (verb) => {
  const { letters, names } = FETCHES[verb];
  return String.raw`${verb}\b[^|;]*\s(?:-[${letters}]|--(?:${names.join("|")})(?![\w-]))`;
};

/** Verbs count where a command starts, a library call anywhere, and only with a target it names. `curl` and `wget` name theirs in an option `FETCHES` declares. how/writes.md. */
export const WRITES = new RegExp(
  STARTS
    + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)`
    + String.raw`|(?:tee|cp|mv|truncate|touch|install|rsync)\b`
    + String.raw`|dd\b[^|;]*\bof=|${fetching("curl")}|${fetching("wget")})`
    + String.raw`|open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
    + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
    + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`,
);

/** A redirect is judged by its target: `2>&1` writes nothing, and one holding a `$(…)` holds spaces, as one holding a backslash holds the character behind it: the newline a continuation joins the next line on with (ISS-2686), or a space the escape made part of the name (ISS-1592). The target is every part of the one word, since a quote closing is not the operand ending: `> 'a(1).md'.txt` writes the `.txt`, and a capture stopping at the quote hands the reader a word it will take for the whole of one. Where the word ends is the walk's answer above, spelt the same here (ISS-1555). */
export const REDIRECT = new RegExp(
  String.raw`(?:^|[\s;&|(])\d?>>?[ \t]*(?!&\d)((?:"[^"]*"|'[^']*'|\$\([^)]*\)|\\[\s\S]|[^ \t\n;&|<>])+)`,
  "gu",
);

/* Where a test opens: a `[[` standing where a word begins, since inside one a `>` compares two strings. */
const TEST_OPENS = /[\s;&|(!]/u;

/* The text with every `>` a shell reads as data spaced out, offset for offset: one under a quote, a comment or a backslash, and one a `[[ … ]]` test or a `(( … ))` arithmetic compares with. Under a double quote a `$(…)` or a backtick pair is still run, so its own `>` keeps its reading. */
const operative = (text) => {
  const out = text.split("");
  let sub = 0;
  let ticked = false;
  let sum = 0;
  let tested = false;
  for (const { at, one, under } of quoting(text)) {
    const next = text[at + 1];
    if (under === " ") {
      sub = 0;
      ticked = false;
    } else if (under !== '"' || (sub === 0 && !ticked)) {
      if (under === '"' && one === "(" && text[at - 1] === "$") {
        sub = 1;
        if (next === "(") sum = 1;
      } else if (under === '"' && one === "\x60") ticked = true;
      else if (one === ">") out[at] = " ";
      continue;
    } else if (one === "\x60" && sub === 0) {
      ticked = false;
      continue;
    } else if (one === "(") sub += 1;
    else if (one === ")") sub -= 1;
    if (sum > 0) {
      if (one === "(") sum += 1;
      else if (one === ")") sum -= 1;
      else if (one === ">") out[at] = " ";
    } else if (one === "(" && next === "(") sum = 1;
    else if (!tested && one === "[" && next === "[" && (at === 0 || TEST_OPENS.test(text[at - 1]))) tested = true;
    else if (tested && one === "]" && next === "]") tested = false;
    else if (tested && one === ">") out[at] = " ";
  }
  return out.join("");
};

/** Each redirect a shell would make, with where it stands and its target as the command wrote it: a `>` that is data opens none, and the target is sliced from the given text so a quoted one keeps its quotes. how/writes.md. */
export const redirectsIn = (text) =>
  [...operative(text).matchAll(REDIRECT)].map((one) => {
    const end = one.index + one[0].length;
    return { at: one.index, target: text.slice(end - one[1].length, end) };
  });

/* Where each of the verbs `WRITES` knows puts the file it writes: the last operand for `cp`, `install` and `rsync`, each of its own for `tee`, `sed -i`, `truncate` and `touch`, both for `mv` and for an `rsync` that unlinks the one it reads, and the `of=` one for `dd`. `curl` and `wget` name none, their target arriving as the value of an option `FETCHES` declares, which the reading below never strikes out anyway; and `sed` and `dd` name none in the readings — `sed -n`, a `dd` with no `of=` — that write nothing at all. */
const AIMS = { cp: "last", curl: "none", dd: "of", install: "last", mv: "each", rsync: "last", sed: "each", tee: "each", touch: "each", truncate: "each", wget: "none" };
const IN_PLACE = /\s(?:-[a-hj-z]*i(?![\w-])|--in-place)/u;
const UNLINKS = /\s--remove-source-files(?![\w-])/u;

/* A word, kept whole through its quotes; the three classes of word that are not a program's operands — what runs before the verb, a word carrying a redirect, which is `echo x>a` as much as `> a` and is the one reading struck text must not lose, and a flag, whose value a gate has no way to tell from a flag that takes none; and the move whose destination is read for the tree it leaves behind rather than as an operand. Last, where the destination is an option's value, attached to its letter or standing after it: the operand a last-operand verb then aims at is one of the files it reads, and which one is meant went out with every other flag's value. */
const WORDS = new RegExp(shellWord(";&|"), "gu");
/** The shell words of one command, each a match carrying its `index`, with a redirect still inside the word it touches. */
export const wordsOf = (text) => [...text.matchAll(WORDS)];
const BEFORE = new RegExp(String.raw`^(?:[A-Za-z_]\w*=|(?:${PREFIXES})$)`, "u");
const AIMED = /[<>]/u;
const FLAG = /^-/u;
const RELOCATES = /^(?:cd|pushd|popd)$/u;
const HANDED = /\bxargs\b|(?:^|\s)-exec\b|\{\}/u;
const TARGETED = /\s(?:-[A-Za-z]*t[^\s-]*|--target-directory(?:=\S*)?)(?![\w-])/u;

/* The flags that take their value in the next word, for a verb whose every other flag takes none: `cp -a` is a flag alone, and the word after it is the file the copy reads. GNU's `cp` and `mv` take one after `-S` and `-t`, the last letter of a cluster being the one that takes it, and BSD's after none. A verb not named here keeps the reading that a word after any flag may be its value. */
const VALUED = /^(?:-[A-Za-z]*[St]|--(?:suffix|target-directory))$/u;
const VALUED_BY = { cp: VALUED, mv: VALUED };
const takesValue = (program, flag) => FLAG.test(flag) && (VALUED_BY[program]?.test(flag) ?? true);

const notAnOperand = (program, words, at) => {
  const { said } = words[at];
  const before = at > 0 ? words[at - 1].said : "";
  return FLAG.test(said) || takesValue(program, before) || AIMED.test(said) || AIMED.test(before);
};

/** The operands of one command, with the words that are not operands left out, each `{ from, to }` in the text this stage was cut from. It reads each word's own spelling, quotes off, because a shell takes `'--output'` for the option it is and reading the raw word left the destination beside it unguarded. */
const operandsOf = (program, words) => words.filter((one, at) => !notAnOperand(program, words, at));

/** A word left out for standing after a flag, which is a value that flag takes or an operand that flag does not — this cannot tell the two apart. Nothing the write lands on, either way, except for the verbs whose destination arrives exactly there, and those are `none` above. A caller that must not invent a target reads it as a word the write does not land on; the default leaves it where it was, since a caller that must not miss one wants every candidate. */
const afterFlagIn = (program, words) => words.filter(({ said }, at) =>
  at > 0 && takesValue(program, words[at - 1].said) && !FLAG.test(said) && !AIMED.test(said) && !AIMED.test(words[at - 1].said));

/** Which of one command's operands its write lands on, `null` where this cannot say — a verb whose operands are somewhere else, or a write made by a language's own call, which names no position here. `said` is the same command with every word's quotes off, which is how a shell reads a flag; `stage` is what it wrote, since unquoting it would promote a verb quoted inside an argument. */
const aimsOf = (program, operands, stage, said) => {
  const aim = AIMS[program];
  if (!aim) return WRITES.test(stage) ? null : [];
  if (aim === "none" || (program === "sed" && !IN_PLACE.test(said))) return [];
  if (aim === "of") return operands.filter((one) => one.said.startsWith("of="));
  return aim === "last" && !UNLINKS.test(said) ? operands.slice(-1) : operands;
};

/** Every operand of one command that its write does not land on, or `null` to leave the whole span alone. Each word is unquoted once here and carried as `said`, since every reading below wants the shell's spelling; `text` stays because the offsets a strike works in are the raw word's. */
const readsIn = (stage, from, strict) => {
  const words = wordsOf(stage)
    .map((m) => ({ text: m[0], said: unquote(m[0]), from: from + m.index, to: from + m.index + m[0].length }));
  let at = 0;
  while (at < words.length && BEFORE.test(words[at].said)) at += 1;
  const program = basename(words[at]?.said ?? "");
  if (RELOCATES.test(program)) return [];
  const rest = words.slice(at + 1);
  const operands = operandsOf(program, rest);
  const said = ` ${words.map((one) => one.said).join(" ")}`;
  const aims = aimsOf(program, operands, stage, said);
  if (strict && AIMS[program] === "last" && TARGETED.test(said)) return null;
  const spare = strict && AIMS[program] && AIMS[program] !== "none" ? afterFlagIn(program, rest) : [];
  return aims && [...spare, ...operands.filter((one) => !aims.includes(one))];
};

/** The command text with every operand a write does not land on struck out, space for space so a relative name still resolves against the trees it did.
 *  `writtenPaths` answers with every name standing beside a write shape, which is the breadth a gate asking what a call may have touched wants and the wrong one here: a `grep` of a skill piped into `tee` was held as a write to the skill, and the refusal cost the unrelated appends beside it (ISS-81). A guarded path a caller holds has to be the write's own target. `HANDED` is where the file a write lands on is not in the command at all — `xargs` and `-exec` hand it over from another and `{}` stands in for one. `unplaceable` is what such a span answers with: `keep` leaves it whole, so every operand stands as a candidate, which is the only answer a gate that must not miss a target can take; `strike` empties it, which a gate that must not invent one takes instead. */
export const struck = (text, { unplaceable = "keep" } = {}) => {
  const strict = unplaceable === "strike";
  let out = text;
  const blank = (from, to) => {
    out = `${out.slice(0, from)}${" ".repeat(to - from)}${out.slice(to)}`;
  };
  for (const { start, end } of spans(text)) {
    const span = text.slice(start, end);
    if (!WRITES.test(span)) continue;
    if (HANDED.test(span)) {
      if (strict) blank(start, end);
      continue;
    }
    const reads = spans(span, { pipes: true })
      .map((stage) => readsIn(span.slice(stage.start, stage.end), start + stage.start, strict))
      .reduce((all, one) => all && one && [...all, ...one], []);
    if (reads === null && strict) blank(start, end);
    for (const { from, to } of reads ?? []) blank(from, to);
  }
  return out;
};

/* What a shell still builds a name from, read where it expands: a binding, a positional, a substitution, and, bare only, a pattern or a brace list. Sticky, so each is asked at one offset. */
const EXPANDS = /\$(?:\{?[A-Za-z_]|[0-9@*$]|\()|`/uy;
const PATTERNS = /[*?[]|\{[^{}\s]*(?:,|\.\.)[^{}\s]*\}/uy;
const DEVICE = /^\/dev\//u;
/* Where `curl` and `wget` take the file they write, which is an option's value and never an operand: the word after the option, or the rest of its own word behind the letter or the `=`. */
const OUTPUTS = Object.fromEntries(Object.entries(FETCHES).map(([verb, { letters, names }]) => {
  const long = names.join("|");
  return [verb, [new RegExp(`^(?:-[${letters}]|--(?:${long}))$`, "u"), new RegExp(`^(?:-[${letters}]|--(?:${long})=)(?=.)`, "u")]];
}));
/* A `sed` reads its first operand as the script, unless an option handed it one. */
const SCRIPTED = /\s(?:-[A-Za-z]*[ef]|--expression|--file)(?![\w-])/u;

const outputsOf = (program, words) => {
  const [alone, joined] = OUTPUTS[program];
  return words.flatMap((one, at) => {
    if (alone.test(one.said)) return words.slice(at + 1, at + 2);
    const lead = joined.exec(one.said)?.[0].length;
    return lead ? [{ ...one, from: one.from + lead }] : [];
  });
};

/* One stage's words past what runs before its verb, each placed in the whole text, and the verb. */
const argumentsOf = (text, stage) => {
  const words = wordsOf(text.slice(stage.start, stage.end))
    .map((m) => ({ said: m[0], from: stage.start + m.index, to: stage.start + m.index + m[0].length }));
  let at = 0;
  while (at < words.length && BEFORE.test(words[at].said)) at += 1;
  return { program: basename(unquote(words[at]?.said ?? "")), rest: words.slice(at + 1) };
};

/* The targets one write stage aims at: a verb's own, with the files it reads, its flags' values and a `sed` script struck, or the value of a fetch's output option. */
const aimedIn = (text, stage, kept, bare) => {
  const { program, rest: left } = argumentsOf(kept, stage);
  const rest = left.filter((one) => !AIMED.test(bare.slice(one.from, one.to)));
  if (OUTPUTS[program]) return outputsOf(program, rest);
  const operands = rest.filter((one) => !FLAG.test(one.said));
  if (program !== "sed" || SCRIPTED.test(bare.slice(stage.start, stage.end))) return operands;
  const script = argumentsOf(text, stage).rest.find((one) => !FLAG.test(one.said));
  return operands.filter((one) => one.from !== script?.from);
};

/** The spellings a shell-level text writes through that no spelling in it produces: a redirect's target, a write verb's own target, and a stage whose names `xargs`, `-exec` or `{}` hand over. A character counts only where the shell expands it, which is the quoting walk's to say: a `$` under a single quote or a backslash is text, a pattern under either quote is text, and a `>` under one is no redirect. A program body is the caller's to have taken out, being its interpreter's text and not the shell's. how/writes.md. */
export const unseenNames = (text) => {
  const under = new Array(text.length).fill("\\");
  for (const one of quoting(text)) under[one.at] = one.under;
  const bare = text.split("").map((one, at) => (under[at] === " " ? one : "_")).join("");
  const asked = (pattern, at) => {
    pattern.lastIndex = at;
    return pattern.test(text);
  };
  const built = (from, to) => {
    for (let at = from; at < to; at += 1) {
      if ((under[at] === " " || under[at] === '"') && asked(EXPANDS, at)) return true;
      if (under[at] === " " && asked(PATTERNS, at)) return true;
    }
    return false;
  };
  const found = [];
  const say = (from, to) => {
    if (!DEVICE.test(text.slice(from, to)) && built(from, to)) found.push(text.slice(from, to));
  };
  for (const one of bare.matchAll(REDIRECT)) say(one.index + one[0].length - one[1].length, one.index + one[0].length);
  const kept = struck(text, { unplaceable: "strike" });
  for (const stage of spans(text, { pipes: true })) {
    const plain = bare.slice(stage.start, stage.end);
    if (!WRITES.test(plain)) continue;
    const handed = HANDED.exec(plain);
    if (handed) found.push(handed[0].trim());
    else for (const one of aimedIn(text, stage, kept, bare)) say(one.from, one.to);
  }
  return [...new Set(found)];
};
