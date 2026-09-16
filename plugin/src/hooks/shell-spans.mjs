// Reading a shell command: where one ends, which directory it could be running in, and which of its operands a write lands on — one walk, span by span.

import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

/* Where a word begins: the only place a `#` is a comment and a `(` a subshell, `$(…)` and `<(…)` opening
   a shell for their body alone. A flag and not a look-behind — the escape branch eats two characters. And
   a `)` closes a frame only where the `(` it matches opened one, so a substitution pops nothing. */
const OPENS = /[\s;&|()]/u;

/* One walk, two answers: the spans below and the quoting each character stands under. Both are this loop's, because the quote state is the primitive the spans reading already spends, and a second walk of the same text elsewhere is a copy that can drift on one side only. */
const walked = (text, pipes) => {
  const out = [];
  const under = new Array(text.length).fill(" ");
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
      } else under[at] = "#";
      continue;
    }
    if (one === "\\" && quote !== "'") {
      under[at] = "\\";
      if (at + 1 < text.length) under[at + 1] = "\\";
      at += 1;
      fresh = false;
      continue;
    }
    if (quote) {
      under[at] = quote;
      if (one === quote) quote = "";
      fresh = false;
      continue;
    }
    if (one === '"' || one === "'") {
      under[at] = one;
      quote = one;
      fresh = false;
      continue;
    }
    if (fresh && one === "#") {
      said = at;
      under[at] = "#";
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
  return { out, under };
};

/** Where each command begins and ends, with the subshells its span opens and closes. A quoted body is never cut, nor a pipeline split: both hand the next command its arguments. An unclosed quote joins, a backslash escapes outside single quotes, and a comment is outside every span — its `|` is no pipeline. */
export const spans = (text, { pipes = false } = {}) => walked(text, pipes).out;

/** Every character a shell reads, in order: `at` its offset, `one` the character, `under` the quoting it stands inside — a space bare, `'` or `"` that quote and its own delimiters, `#` a comment, `\` a character a backslash made literal. A line continuation is gone, both characters of it, because a shell removes the pair and joins what it separated; nothing else is, so an escaped character goes on separating what it separates and two neighbours here can be two apart in the text.
 *  What a quoting means for a character is the caller's: a shell runs a `$(` under a double quote and reads a `<(` there as text. And one quoting this cannot place, which the caller has to answer for: inside `$'…'` a backslash escapes, so the apostrophe that looks like the closing one may not be. */
export const quoting = (text) => {
  const { under } = walked(text, false);
  const continued = (at) =>
    under[at] === "\\"
    && (text[at] === "\n" || (text[at + 1] === "\n" && under[at + 1] === "\\"));
  /* Split rather than spread: one entry per code unit, so `at` indexes this walk and a caller's own match, where a code point outside the BMP would put every offset after it one out. */
  return text.split("")
    .map((one, at) => ({ at, one, under: under[at] }))
    .filter(({ at }) => !continued(at));
};

/* What may precede a move and still leave it to this shell: a group, or a keyword whose condition or body runs here — never a `!`, which inverts. The destination is one optional shell word, `popd` has none, a `-n` moves the stack and not the shell so it is no move at all, and past a `--` a word beginning with one is the destination. */
const AHEAD = String.raw`(?:[({]\s*|\b(?:if|elif|while|until|then|else|do)\s+)*`;
const WORD = String.raw`(?:'[^']*'|"[^"]*"|\\.|[^\s;&|()<>])+`;
const MOVES = new RegExp(
  `^${AHEAD}(?:popd(?=\\s|$)|(?:cd|pushd)(?=\\s|$))((?:\\s+-(?!-(?![\\w-]))[\\w-]+)*)(?:\\s+--)?(?:\\s+(${WORD}))?`,
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
    const to = move && move[2] !== undefined ? spelled(move[2]) : "";
    const said = move && !STAYS.test(move[1]) && (named(to) ? to : NOWHERE);
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

/* A loop opens where a command does, past a `!` that inverts one or a `time` that measures it. `for` and `select` stand beside the two waits because a `done` cannot tell them apart, and one left off the list has that `done` close the wait around it instead. */
const LOOPS = /^(?:[({]\s*|!\s*|\btime\s+(?:-\S+\s+)*|\b(?:if|elif|then|else|do)\s+)*(while|until|for|select)(?=\s|$)/u;
const WAITS = /^(?:while|until)$/u;
/* A wait's condition is a command list, so a loop written in it takes the next `do` and the keyword is not the body: the newest name has the `do` over any wait still short of one. Read before the keyword below, because one span can open the body above it and name the next — `do for`. */
const BODY = /^do(?=[\s;&|()<>]|$)/u;
/* The other body, which only an arithmetic `for` may take — `for x in a { :; }` is a syntax error — so only an arithmetic name is spendable and elsewhere a bare `{` is ordinary data in a word list. Read past the keyword and where the body opens rather than where it closes: the head's own brace must spend the head's own name, and a name left standing over the body would be taken by the `do` of a wait written inside it. Quoted runs are blanked first, a brace inside a word being a character of that word; a `${…}` carries no word boundary before its brace and a `{a,b}` none after. */
const BRACE = /(?:^|[\s;&|()])\{(?=\s|$)/u;
const QUOTED = /'[^']*'|"(?:\\[\s\S]|[^"\\])*"/gu;
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

/* A word is what a shell hands on as one, so only what ends a word ends a name: the operators, the quotes, a `$` and a backslash. Everything else a filesystem allows stands inside a name, which is why this is written as what a name may not carry rather than as what it may — an allow-list cut a path at the first `+` in it and handed on the tail, which is shorter, relative and still resolves. */
const OPERATOR = /[\s;&|()<>$\\]/u;
/* The quotes, each spelt as its code point, since a lone one in a source file is an unclosed string to everything that reads this repository as text and the checks here do read it that way. These end a word wherever they stand, the delimiters of a span as much as a quote inside one: what arrives here is as often an interpreter's body carrying its own quotes as it is one name, and `open("--trap.md", "w")` spells the file in the inner pair. */
const QUOTE = /[\x27\x22\x60]/u;

/** Every word of a command, as the walk reads it: the text of one, and the offset each of its characters stood at — kept per character rather than as one start, because a word is the characters of it that survive and a name read out of one is still placed where it was written.
 *  A word ends at an operator the shell is spending as shell, which is what `quoting` answers and no regular expression over the raw text can: under a single quote a `(` opens no subshell, a space splits nothing and a `$` expands nothing, so `'a/p (1)/b.md'` is one name rather than a tail that resolves somewhere else entirely. A character under a double quote is read as it always was, because the shell may be running a substitution there and this walk cannot yet say where one begins (ISS-1533). */
const worded = (text) => {
  const out = [];
  let word = null;
  for (const { at, one, under } of quoting(text)) {
    if (QUOTE.test(one) || (under !== "'" && OPERATOR.test(one))) {
      word = null;
      continue;
    }
    if (!word) out.push((word = { text: "", at: [] }));
    word.text += one;
    word.at.push(at);
  }
  return out;
};
/* Where a name may begin inside its word, besides its start. Before it: the option a value may be attached to, which is one letter after a single hyphen and the whole word after two — `curl -onotes.md` writes what `--output=notes.md` does, and past a bare `--` there are no options left, so a file whose own name opens with a hyphen is read as one — and the first `=` or `:`, a key standing in front of the value it names. After it: the last `}`, since what follows the last substitution is the literal tail the program will build, and `f"{root}/skills/x/SKILL.md"` spells a guarded path while naming no `root` this can read. One of each and no more, so one word is read four ways rather than once per character of a 40 000-character operand. And a word standing against a quote is no option at all but a literal a body carries, an interpreter's own body arriving here with its quotes still in it — all three of them, a template's backtick as much as the other two — and `open("--trap.md", "w")` naming a file. */
const OPTION = /^--[\w-]+|^-[A-Za-z0-9]/u;
const KEYED = /[=:]/u;
const QUOTES = /[\x22\x27\x60]/u;
/* And where the word itself is no name: behind a key, which is a word-part carrying no separator with a value spelled from somewhere behind it — the root, a home, this directory or the one above. A `dd` naming its output after an `of=` names the value alone; a directory whose own name carries an `=` names the whole word, and only the first has a key in front of it. */
const KEY = /^[^/=:]*[=:](?:~|\.{0,2})\//u;
/* And a word a shell or an interpreter would rewrite spells a file this text does not hold: what the write lands on is the pattern's match or the substitution's value, which is elsewhere. how/writes.md. */
const PATTERN = String.raw`[^*?[\]{}]`;

/** A name with an extension, as a command spells one, with where each begins: the readings above, so a directory carrying a character a name usually does not is read whole rather than cut at it, while one word may still spell the value behind its option or its key and the tail behind its substitution. `tail` is which extensions a caller wants, one gate judging `.md` alone. The names written from the root come first, those being the ones a reader resolves without the call's own cwd. Spelt here and nowhere else. */
export const namesOf = (text, tail = "[A-Za-z0-9]+", { options = true } = {}) => {
  const ending = new RegExp(`^${PATTERN}+\\.${tail}`, "u");
  const names = [];
  const past = (mark) => (mark < 0 ? [] : [mark + 1]);
  let ended = false;
  for (const word of worded(text)) {
    if (word.text === "--") ended = true;
    const literal = QUOTES.test(text[word.at[0] - 1] ?? " ");
    const option = (options && !ended && !literal && OPTION.exec(word.text)?.[0].length) || 0;
    const starts = [
      ...(option || KEY.test(word.text) ? [] : [0]),
      ...(option && word.text[option] !== "=" ? [option] : []),
      ...past(KEYED.exec(word.text)?.index ?? -1),
      ...past(word.text.lastIndexOf("}")),
    ];
    for (const at of new Set(starts)) {
      const name = ending.exec(word.text.slice(at))?.[0];
      if (name) names.push({ token: name, at: word.at[at] });
    }
  }
  const rooted = (one) => one.token.startsWith("/") || one.token.startsWith("~/");
  return [...names.filter(rooted), ...names.filter((one) => !rooted(one))];
};

export const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

/** Where a command starts. `xargs` keeps its own flags (`xargs -I{} sh` runs a shell), the rest do not: a flag widens what a mention may look like. `^` is last — zero-width, it wins a prefix's position. */
export const STARTS = String.raw`(?:[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+|\bxargs\s+(?:-\S+\s+)*`
  + String.raw`|\b(?:sudo|command|nohup|time|env|do|then|else|if|elif|while|until)\s+|^)`;

/** Verbs count where a command starts, a library call anywhere, and only with a target it names. `curl` and `wget` name theirs in an option, and both read one letter after a single hyphen and take the rest of the word as the value — `curl -output` writes a file called `utput` — so no boundary may follow `-o` or `-O`, and only the long spellings keep one, which is what leaves `--outputting` the unknown option curl refuses rather than a write. how/writes.md. */
export const WRITES = new RegExp(
  STARTS
    + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)`
    + String.raw`|(?:tee|cp|mv|truncate|touch|install|rsync)\b`
    + String.raw`|dd\b[^|;]*\bof=|curl\b[^|;]*\s(?:-o|--output\b)|wget\b[^|;]*\s(?:-O|--output-document\b))`
    + String.raw`|open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
    + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
    + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`,
);

/* Where each of the verbs `WRITES` knows puts the file it writes: the last operand for `cp`, `install` and `rsync`, each of its own for `tee`, `sed -i`, `truncate` and `touch`, both for `mv` and for an `rsync` that unlinks the one it reads, and the `of=` one for `dd`. `curl` and `wget` name none, their target arriving as the value of `-o` or `-O`, which the reading below never strikes out anyway; and `sed` and `dd` name none in the readings — `sed -n`, a `dd` with no `of=` — that write nothing at all. */
const AIMS = { cp: "last", curl: "none", dd: "of", install: "last", mv: "each", rsync: "last", sed: "each", tee: "each", touch: "each", truncate: "each", wget: "none" };
const IN_PLACE = /\s(?:-[a-hj-z]*i(?![\w-])|--in-place)/u;
const UNLINKS = /\s--remove-source-files(?![\w-])/u;

/* A word, kept whole through its quotes; the three classes of word that are not a program's operands — what runs before the verb, a word carrying a redirect, which is `echo x>a` as much as `> a` and is the one reading struck text must not lose, and a flag, whose value a gate has no way to tell from a flag that takes none; and the move whose destination is read for the tree it leaves behind rather than as an operand. Last, where the destination is an option's value, attached to its letter or standing after it: the operand a last-operand verb then aims at is one of the files it reads, and which one is meant went out with every other flag's value. */
const WORDS = /(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*"|\\[\s\S]|[^\s;&|])+/gu;
const BEFORE = /^(?:[A-Za-z_]\w*=|(?:sudo|command|nohup|time|env|exec|do|then|else|elif|if|while|until)$)/u;
const AIMED = /[<>]/u;
const FLAG = /^-/u;
const RELOCATES = /^(?:cd|pushd|popd)$/u;
const HANDED = /\bxargs\b|(?:^|\s)-exec\b|\{\}/u;
const TARGETED = /\s(?:-[A-Za-z]*t[^\s-]*|--target-directory(?:=\S*)?)(?![\w-])/u;

const notAnOperand = (words, at) => {
  const { said } = words[at];
  const before = at > 0 ? words[at - 1].said : "";
  return FLAG.test(said) || FLAG.test(before) || AIMED.test(said) || AIMED.test(before);
};

/** The operands of one command, with the words that are not operands left out, each `{ from, to }` in the text this stage was cut from. It reads each word's own spelling, quotes off, because a shell takes `'--output'` for the option it is and reading the raw word left the destination beside it unguarded. */
const operandsOf = (words) => words.filter((one, at) => !notAnOperand(words, at));

/** A word left out for standing after a flag, which is a value that flag takes or an operand that flag does not — this cannot tell the two apart. Nothing the write lands on, either way, except for the verbs whose destination arrives exactly there, and those are `none` above. A caller that must not invent a target reads it as a word the write does not land on; the default leaves it where it was, since a caller that must not miss one wants every candidate. */
const afterFlagIn = (words) => words.filter(({ said }, at) =>
  at > 0 && FLAG.test(words[at - 1].said) && !FLAG.test(said) && !AIMED.test(said) && !AIMED.test(words[at - 1].said));

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
  const words = [...stage.matchAll(WORDS)]
    .map((m) => ({ text: m[0], said: unquote(m[0]), from: from + m.index, to: from + m.index + m[0].length }));
  let at = 0;
  while (at < words.length && BEFORE.test(words[at].said)) at += 1;
  const program = basename(words[at]?.said ?? "");
  if (RELOCATES.test(program)) return [];
  const rest = words.slice(at + 1);
  const operands = operandsOf(rest);
  const said = ` ${words.map((one) => one.said).join(" ")}`;
  const aims = aimsOf(program, operands, stage, said);
  if (strict && AIMS[program] === "last" && TARGETED.test(said)) return null;
  const spare = strict && AIMS[program] && AIMS[program] !== "none" ? afterFlagIn(rest) : [];
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
