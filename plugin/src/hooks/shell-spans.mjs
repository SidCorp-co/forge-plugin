// Reading a shell command: where one ends, which directory it could be running in, and which of its operands a write lands on — one walk, span by span.

import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

import { WRITE_CALLS } from "./program/call-writes.mjs";
import { NAMED, known, optionsIn, targets, writes, writingOption } from "./shell/options.mjs";
import { ESCAPED_IN_DOUBLE, quotedOver, quoting, respelled, spans, underOf } from "./shell/walk.mjs";
import { optionsAfter, wraps } from "./shell/wrappers.mjs";
import { RUNNER, SHELL_OPTION, SHELL_WORD, placeable, spacedSpans, worded } from "./shell/words.mjs";

export { ESCAPED_IN_DOUBLE, RUNNER, SHELL_OPTION, SHELL_WORD, placeable, quotedOver, quoting, respelled, spacedSpans, spans, underOf };

/* What may precede a move and still leave it to this shell: a group, or a keyword whose condition or body runs here — never a `!`, which inverts. The destination is one optional shell word, `popd` has none, a `-n` moves the stack and not the shell so it is no move at all, and past a `--` a word beginning with one is the destination. */
const KEYWORDS = "if|elif|while|until|then|else|do";
/* The words that run the command after them rather than being it: the keywords, and the wrappers that hand the rest of the line to the program it names. Every reading of what stands before a verb is built from these two lists, so a word gained here is gained by all of them. `exec` is kept off the wrappers: as the argument of `docker`, `podman` or `kubectl` it names a subcommand whose command runs inside a container, so it counts only where a start stands before it (ISS-2877). */
const WRAPPING = ["sudo", "command", "nohup", "time", "env"];
const PREFIXES = `${WRAPPING.join("|")}|${KEYWORDS}|exec`;
/* A shell word, kept whole through its quotes: a single-quoted run, a double-quoted one inside which a backslash still escapes, an escaped character, or any character but a blank and the `stops` that end a word for this reader — a quote or a backslash among those only where nothing closes or follows it. One reading, so a case a shell word gains is gained by every reader that splits one. Each character opens exactly one of the arms, since a pattern spliced in front of something that can fail — a wrapper option's value before a verb that is no write — tries every way of cutting the word it could, and `'a'` read as a run or as three characters doubled the ways with each quoted part. */
const DOUBLED = String.raw`(?:[^"\\]|\\[\s\S])*`;
const shellWord = (stops) =>
  String.raw`(?:'[^']*'|'(?![^']*')|"${DOUBLED}"|"(?!${DOUBLED}")|\\[\s\S]|\\$|[^\s'"\\${stops}])+`;
/* A wrapper's word with the options it may carry before its command, by its row of the wrappers' table; the value one of them takes is a shell word. */
const OPTION_VALUE = shellWord(";&|()<>");
const wrapped = (name) => `${name}${optionsAfter(name, OPTION_VALUE)}`;
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
/** `spelled` run the other way — the word written back into a command a reader pastes, a refusal's way out or a next page's call: bare where a shell hands it on unchanged, quoted where it would split, and since a quoted run has no escape, an apostrophe closes the quote, escapes, reopens.
 *  Bare is Python's `shlex.quote` set, which no POSIX shell splits or expands, less a leading `=`, which zsh expands to a command's path. A leading `-` stays bare: a quote reaches the program as the same flag, and `pathed` is the answer for a path (ISS-303). */
const PLAIN = /^[\w@%+:,./-][\w@%+=:,./-]*$/u;
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
    if (named.at(-1)?.arith && BRACE.test(respelled(past, () => " "))) named.pop();
  }
  return out;
};

/* Where a name may begin inside its word, besides its start. Before it: the option a value may be attached to, which is one letter after a single hyphen and the whole word after two — `curl -onotes.md` writes what `--output=notes.md` does, and past a bare `--` there are no options left, so a file whose own name opens with a hyphen is read as one — and the first `=` or `:`, a key standing in front of the value it names. After it: the last `}`, since what follows the last substitution is the literal tail the program will build, and `f"{root}/skills/x/SKILL.md"` spells a guarded path while naming no `root` this can read. One of each and no more, so one word is read four ways rather than once per character of a 40 000-character operand. And a word standing against a quote is no option at all but a literal a body carries, an interpreter's own body arriving here with its quotes still in it — all three of them, a template's backtick as much as the other two — and `open("--trap.md", "w")` naming a file. */
const OPTION = /^--[\w-]+|^-[A-Za-z0-9]/u;
/* Where a value attached inside a cluster of short options begins, by the offset of the word holding it, for a verb the option table names: the value `curl -sSo` has joined to it is the file written, and one letter after the hyphen would read the `So` in front of it as part of the name. A word spelt under a quote keeps the reading above, its offsets being the quoted spelling's. */
const valueLeads = (text) => {
  const out = new Map();
  if (!NAMED.test(text)) return out;
  for (const stage of spans(text, { pipes: true })) {
    const { program, rest } = commandOf(text.slice(stage.start, stage.end), stage.start);
    for (const { at, next, value } of optionsIn(program, rest) ?? []) {
      const word = rest[at];
      if (!next && !word.said.startsWith("--") && word.text === word.said) out.set(word.from, value.from - word.from);
    }
  }
  return out;
};
const KEYED = /[=:]/u;
const QUOTES = /["'`]/u;
/* And where the word itself is no name: behind a key, which is a word-part carrying no separator with a value spelled from somewhere behind it — the root, a home, this directory or the one above. A `dd` naming its output after an `of=` names the value alone; a directory whose own name carries an `=` names the whole word, and only the first has a key in front of it. */
const KEY = /^[^/=:]*[=:](?:~|\.{0,2})\//u;
/* And a word a shell or an interpreter would rewrite spells a file this text does not hold: what the write lands on is the pattern's match or the substitution's value, which is elsewhere. how/writes.md. */
const PATTERN = String.raw`[^*?[\]{}]`;
/* A glob character a backslash made literal is one the shell never expands, so it is a character of the name, and a `}` among them closes no substitution: each is read through a stand-in `PATTERN` admits as a name's own character, which is the walk's literal flag and no second scan of the text (ISS-2867). */
const GLOB = /[*?[\]{}]/u;
const spelt = (word) => word.text.split("").map((one, at) => (word.literal[at] && GLOB.test(one) ? "_" : one)).join("");

/* The extension ends the name: `SKILL.md.bak` and `notes.md~` carry none of the ones asked for, and the backup a copy makes beside a guarded file is not that file. */
const endingIn = (tail) => new RegExp(`^${PATTERN}+\\.(?:${tail})(?![\\w~-]|\\.[\\w~-])`, "u");

/** A name with an extension, as a command spells one, with where each begins: the readings above, so a directory carrying a character a name usually does not is read whole rather than cut at it, while one word may still spell the value behind its option or its key and the tail behind its substitution. `tail` is which extensions a caller wants, one gate judging `.md` alone. The names written from the root come first, those being the ones a reader resolves without the call's own cwd. Spelt here and nowhere else. */
export const namesOf = (text, tail = "[A-Za-z0-9]+", { options = true, whole = true } = {}) => {
  const ending = endingIn(tail);
  const leads = options ? valueLeads(text) : new Map();
  const names = [];
  const seen = new Set();
  const past = (mark) => (mark < 0 ? [] : [mark + 1]);
  let ended = false;
  for (const word of worded(text, whole)) {
    if (word.text === "--") ended = true;
    const literal = QUOTES.test(text[word.at[0] - 1] ?? " ");
    const option = (options && !ended && !literal && (leads.get(word.at[0]) ?? OPTION.exec(word.text)?.[0].length)) || 0;
    /* A joined word is read from its start and nowhere else, as is a word an expansion opens, whose name is the whole of it too — `${OUT:+ 'a.md' }` writes that file or nothing — and which is `built` on what it hands on so no reader places it against a tree. The other three readings each say the name begins partway in, which is the opposite of what this word claims — that the span is one filename — and `'cache=/tmp/(r).md'` is a relative name the key reading would turn into a rooted one somewhere else entirely. */
    const read = spelt(word);
    const starts = word.joined || word.built ? [0] : [
      ...(option || KEY.test(word.text) ? [] : [0]),
      ...(option && word.text[option] !== "=" ? [option] : []),
      ...past(KEYED.exec(word.text)?.index ?? -1),
      ...past(read.lastIndexOf("}")),
    ];
    for (const at of new Set(starts)) {
      const length = ending.exec(read.slice(at))?.[0].length;
      const name = length && word.text.slice(at, at + length);
      /* One reading of a word and the other can spell the same name at the same place — `'a.md)'` whole and `'a.md'` past the operator — and one name read twice from one offset is one name. */
      const once = name && `${word.at[at]} ${name}`;
      if (once && !seen.has(once) && !((word.joined || word.built) && name.length < word.text.length - at)) {
        seen.add(once);
        names.push({ token: name, at: word.at[at], ...(word.built ? { built: true } : {}) });
      }
    }
  }
  const rooted = (one) => one.token.startsWith("/") || one.token.startsWith("~/");
  return [...names.filter(rooted), ...names.filter((one) => !rooted(one))];
};

export const unquote = (value) => value.replace(/^(["'])([\s\S]*)\1$/u, "$2");

/** Where a command starts. `xargs` keeps its own flags (`xargs -I{} sh` runs a shell), and every other wrapper the options its row of the wrappers' table reads, a value-taking one with its value: `sudo -u root touch` runs `touch`, and `sudo -u touch cp a b` runs `cp`. A wrapper spelled inside a quoted argument is kept from reading as a start by the reader in front of this, which takes a quoted span out before testing it. `^` is last, so a prefix standing at the head wins its position, and it takes the blanks after it: a span cut behind a `;`, a `&&` or a `|` opens with the one the operator left, and it is the same command it would be at the head of the text (ISS-2933). An `exec` counts only behind one of these, so the one another program takes as its argument starts nothing. */
export const STARTS = String.raw`(?:(?:[\n;&|(]\s*|-exec\s+|\b[A-Za-z_]\w*=\S*\s+|\bxargs\s+(?:-\S+\s+)*`
  + String.raw`|\b(?:${[...WRAPPING.map(wrapped), KEYWORDS].join("|")})\s+|^\s*)(?:${wrapped("exec")}\s+)?)`;

const fetching = (verb) => String.raw`${verb}\b[^|;]*\s${writingOption(verb)}`;
/* The two halves of a write: a verb, which counts where a command starts, and a library call, which counts anywhere — each only with a target it names. `curl` and `wget` name theirs in an option their row of the option table says writes. how/writes.md. */
const WRITE_VERBS = STARTS
  + String.raw`(?:sed\b[^|;]*\s(?:-[a-hj-z]*i(?![\w-])|--in-place)`
  + String.raw`|(?:tee|cp|mv|truncate|touch|install|rsync)\b`
  + String.raw`|dd\b[^|;]*\bof=|${fetching("curl")}|${fetching("wget")})`;
/** Either half, over a text whose quoted arguments the caller has already judged. */
export const WRITES = new RegExp(`${WRITE_VERBS}|${WRITE_CALLS}`);

/* A quoted argument is data, so its `;`, `&&` or newline opens no command: its inside becomes one inert word, quotes and length kept, so an offset here is one in the text given and a quoted `-C` value is still that option's value. Inside a double quote a shell still runs a `$(…)` or a backtick pair, and the walk says where one ends, so its body stays standing and a commit in it is still a commit. One the walk read flat, a here-document inside it, is kept whole rather than guessed at, which is what a gate that must not miss a commit needs. */
export const quotedOut = (text) =>
  respelled(text, (span, { flat }) => (flat ? span : quotedOver(span, "_", { delimiters: true })));

/* `WRITES` for a reader holding a command's own text, quotes and all: a verb only where it starts a command outside a quoted argument, so `echo "sudo touch a.md" > b.md` is the redirect it makes and not a command no reading can place; and a library call anywhere, its quotes being the call's own. */
const VERB_WRITES = new RegExp(WRITE_VERBS, "u");
const CALL_WRITES = new RegExp(WRITE_CALLS, "u");
const writing = (text) => CALL_WRITES.test(text) || VERB_WRITES.test(quotedOut(text));

/** A redirect is judged by its target: `2>&1` writes nothing, and one holding a `$(…)` holds spaces, as one holding a backslash holds the character behind it: the newline a continuation joins the next line on with (ISS-2686), or a space the escape made part of the name (ISS-1592). The target is every part of the one word, since a quote closing is not the operand ending: `> 'a(1).md'.txt` writes the `.txt`, and a capture stopping at the quote hands the reader a word it will take for the whole of one. Where the word ends is the walk's answer above, spelt the same here (ISS-1555). */
export const REDIRECT = new RegExp(
  String.raw`(?:^|[\s;&|(])\d?>>?[ \t]*(?!&\d)((?:"[^"]*"|'[^']*'|\$\([^)]*\)|\\[\s\S]|[^ \t\n;&|<>])+)`,
  "gu",
);

/* Where a test opens: a `[[` standing where a word begins, since inside one a `>` compares two strings. */
const TEST_OPENS = /[\s;&|(!]/u;

/* The text with every `>` a shell reads as data spaced out, offset for offset: one under a quote, a comment or a backslash, and one a `[[ … ]]` test or a `(( … ))` arithmetic compares with. Under a double quote a `$(…)` or a backtick pair is still run, so its own `>` keeps its reading: the walk marks the body of one it placed bare, and the counting below is for one it read flat, a here-document standing inside. */
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

/** Each redirect a shell would make, with where it stands, where its target starts and ends, and that target as the command wrote it: a `>` that is data opens none, and the target is sliced from the given text so a quoted one keeps its quotes. how/writes.md. */
export const redirectsIn = (text) =>
  [...operative(text).matchAll(REDIRECT)].map((one) => {
    const to = one.index + one[0].length;
    const from = to - one[1].length;
    return { at: one.index, from, to, target: text.slice(from, to) };
  });

/* Where each of the verbs `WRITES` knows puts the file it writes: the last operand for `cp`, `install` and `rsync`, each of its own for `tee`, `sed -i`, `truncate` and `touch`, both for `mv` and for an `rsync` that unlinks the one it reads, and the `of=` one for `dd`. `curl` and `wget` name none, their target being an option's value, which the reading below never strikes out anyway; and `sed` and `dd` name none in the readings — `sed -n`, a `dd` with no `of=` — that write nothing at all. */
const AIMS = { cp: "last", curl: "none", dd: "of", install: "last", mv: "each", rsync: "last", sed: "each", tee: "each", touch: "each", truncate: "each", wget: "none" };
const IN_PLACE = /\s(?:-[a-hj-z]*i(?![\w-])|--in-place)/u;
const UNLINKS = /\s--remove-source-files(?![\w-])/u;

/* A word, kept whole through its quotes; the four classes of word that are not a program's operands — what runs before the verb, a subshell's opening among it, a word carrying a redirect, which is `echo x>a` as much as `> a` and is the one reading struck text must not lose, a flag, whose value a gate has no way to tell from a flag that takes none, and the `)` closing a subshell the command stands in, which a last-operand verb would otherwise aim at; and the move whose destination is read for the tree it leaves behind rather than as an operand. Last, where the destination is an option's value, attached to its letter or standing after it: the operand a last-operand verb then aims at is one of the files it reads, and which one is meant went out with every other flag's value. */
const WORDS = new RegExp(shellWord(";&|"), "gu");
/** The shell words of one command, each a match carrying its `index`, with a redirect still inside the word it touches. */
export const wordsOf = (text) => [...text.matchAll(WORDS)];
const BEFORE = new RegExp(String.raw`^(?:[A-Za-z_]\w*=|\(+$|(?:${PREFIXES})$)`, "u");
const AIMED = /[<>]/u;
const CLOSES = /^\)+$/u;
const FLAG = /^-/u;
const RELOCATES = /^(?:cd|pushd|popd)$/u;
const HANDED = /\bxargs\b|(?:^|\s)-exec\b|\{\}/u;

/* The words of one command that are some option's value, by index. A verb the option table names has its own options read; one it does not keeps the reading that a word after any flag may be that flag's value, since which of its flags take one is not known here. */
const valuesIn = (program, words) => {
  const read = optionsIn(program, words);
  if (!read) return new Set(words.flatMap((one, at) => (at > 0 && FLAG.test(words[at - 1].said) ? [at] : [])));
  return new Set(read.filter((one) => one.next && one.value).map((one) => one.at + 1));
};

/* The directory a GNU `-t` hands a verb taking `--target-directory`, with the offset of the word naming it: every operand is then a source, and each lands in it under its own last name. The last one given is the one the verb uses. */
const targetOf = (program, words) => {
  const given = (optionsIn(program, words) ?? []).filter((one) => targets(program, one.name) && one.value).at(-1);
  return given ? { dir: given.value.said, at: given.value.from } : null;
};

const notAnOperand = (words, at, values) => {
  const { said, text } = words[at];
  const before = at > 0 ? words[at - 1].said : "";
  return FLAG.test(said) || CLOSES.test(text) || values.has(at) || AIMED.test(said) || AIMED.test(before);
};

/** The operands of one command, with the words that are not operands left out, each `{ from, to }` in the text this stage was cut from. It reads each word's own spelling, quotes off, because a shell takes `'--output'` for the option it is and reading the raw word left the destination beside it unguarded. */
const operandsOf = (program, words) => {
  const values = valuesIn(program, words);
  return words.filter((one, at) => !notAnOperand(words, at, values));
};

/** A word left out for standing after a flag, which is a value that flag takes or an operand that flag does not — this cannot tell the two apart for a verb the option table does not name. Nothing the write lands on, either way, except for the verbs whose destination arrives exactly there, and those are `none` above; in a stage that writes nothing, such as a `git diff --stat` or a `python3 -c` body piped into `tee`, it is only ever read (ISS-2427). A caller that must not invent a target reads it as a word the write does not land on; the default leaves it where it was, since a caller that must not miss one wants every candidate. */
const afterFlagIn = (program, words) => {
  const values = valuesIn(program, words);
  return words.filter(({ said }, at) => values.has(at) && !FLAG.test(said) && !AIMED.test(said) && !AIMED.test(words[at - 1].said));
};

/** Which of one command's operands its write lands on, `null` where this cannot say — a verb whose operands are somewhere else, or a write made by a language's own call, which names no position here. `said` is the same command with every word's quotes off, which is how a shell reads a flag; `stage` is what it wrote, since unquoting it would promote a verb quoted inside an argument. */
const aimsOf = (program, operands, stage, said, target) => {
  const aim = AIMS[program];
  if (!aim) return writing(stage) ? null : [];
  if (aim === "none" || (program === "sed" && !IN_PLACE.test(said))) return [];
  if (aim === "of") return operands.filter((one) => one.said.startsWith("of="));
  /* Into a target directory a copy writes none of its operands, every one being a file it reads; a move still writes each, by taking it away. */
  if (target && aim === "last") return [];
  return aim === "last" && !UNLINKS.test(said) ? operands.slice(-1) : operands;
};

/* Behind each prefix word the wrappers' table names, the options that wrapper carries, read by the pattern `STARTS` is built from. */
const OPTIONED = new Map(PREFIXES.split("|").filter(wraps)
  .map((name) => [name, new RegExp(`^${optionsAfter(name, OPTION_VALUE)}`, "u")]));

/* The index of a stage's verb among its words as written: past what runs before it, and past the whole words a wrapper's options cover. */
const verbAt = (raw) => {
  let at = 0;
  while (at < raw.length && BEFORE.test(unquote(raw[at]))) {
    const options = OPTIONED.get(unquote(raw[at]));
    at += 1;
    const spent = options ? options.exec(` ${raw.slice(at).join(" ")}`)[0].length : 0;
    for (let length = 0; at < raw.length && length + raw[at].length + 1 <= spent; at += 1) length += raw[at].length + 1;
  }
  return at;
};

/* A command as a shell reads its words, quotes off, with the raw word kept for the offsets a strike works in: the verb, and what follows it. */
const commandOf = (stage, from) => {
  const words = wordsOf(stage)
    .map((m) => ({ text: m[0], said: unquote(m[0]), from: from + m.index, to: from + m.index + m[0].length }));
  const at = verbAt(words.map((one) => one.text));
  return { words, program: basename(words[at]?.said ?? ""), rest: words.slice(at + 1) };
};

/** Every operand of one command that its write does not land on, or `null` to leave the whole span alone. Every reading below wants the shell's spelling, which is each word's `said`. */
const readsIn = (stage, from, strict) => {
  const { words, program, rest } = commandOf(stage, from);
  if (RELOCATES.test(program)) return [];
  const operands = operandsOf(program, rest);
  const said = ` ${words.map((one) => one.said).join(" ")}`;
  const aims = aimsOf(program, operands, stage, said, targetOf(program, rest));
  if (strict && AIMS[program] === "last" && optionsIn(program, rest)?.some((one) => targets(program, one.name))) return null;
  const spare = strict && AIMS[program] !== "none" ? afterFlagIn(program, rest) : [];
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
    if (!writing(span)) continue;
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

/** The files a copy, a move or an install into a `-t` directory lands on, a name the command never spells: the directory joined with each source's last name, with the offset of the word naming the directory and the command span it stands in. Only a name carrying one of the extensions `tail` asks for. A span whose sources another command hands over names none, which is `struck`'s to answer. The text is the command as written, since a struck one has already lost the sources. */
export const landedIn = (text, tail = "[A-Za-z0-9]+") => {
  /* Every spelling of an option holds a hyphen, so a text without one names no target directory. */
  if (!text.includes("-")) return [];
  const ending = endingIn(tail);
  const out = [];
  for (const { start, end } of spans(text)) {
    const span = text.slice(start, end);
    if (!span.includes("-") || HANDED.test(span)) continue;
    for (const stage of spans(span, { pipes: true })) {
      const { program, rest } = commandOf(span.slice(stage.start, stage.end), start + stage.start);
      const target = targetOf(program, rest);
      for (const { said } of target ? operandsOf(program, rest) : []) {
        const name = basename(said);
        if (ending.exec(name)?.[0] === name) out.push({ token: `${target.dir.replace(/\/+$/u, "")}/${name}`, at: target.at, start, end });
      }
    }
  }
  return out;
};

/* What a shell still builds a name from, read where it expands: a binding, a positional, a substitution, and, bare only, a pattern or a brace list. Sticky, so each is asked at one offset. */
const EXPANDS = /\$(?:\{?[A-Za-z_]|[0-9@*$]|\()|`/uy;
const PATTERNS = /[*?[]|\{[^{}\s]*(?:,|\.\.)[^{}\s]*\}/uy;
const DEVICE = /^\/dev\//u;
/* A `sed` reads its first operand as the script, unless an option handed it one. */
const SCRIPTED = /\s(?:-[A-Za-z]*[ef]|--expression|--file)(?![\w-])/u;

/* Where `curl` and `wget` take the file they write, which is an option's value and never an operand: the word after the option, or the rest of its own word behind the letter or the `=`. */
const outputsOf = (program, words) =>
  optionsIn(program, words).filter((one) => writes(program, one.name) && one.value).map((one) => one.value);

/* One stage's words past what runs before its verb, each placed in the whole text, and the verb. */
const argumentsOf = (text, stage) => {
  const words = wordsOf(text.slice(stage.start, stage.end))
    .map((m) => ({ said: m[0], from: stage.start + m.index, to: stage.start + m.index + m[0].length }));
  const at = verbAt(words.map((one) => one.said));
  return { program: basename(unquote(words[at]?.said ?? "")), rest: words.slice(at + 1) };
};

/* The targets one write stage aims at: a verb's own, with the files it reads, its flags' values and a `sed` script struck, or the value of a fetch's output option. */
const aimedIn = (text, stage, kept, bare) => {
  const { program, rest: left } = argumentsOf(kept, stage);
  const rest = left.filter((one) => !AIMED.test(bare.slice(one.from, one.to)));
  if (AIMS[program] === "none" && known(program)) return outputsOf(program, rest);
  const operands = rest.filter((one) => !FLAG.test(one.said));
  if (program !== "sed" || SCRIPTED.test(bare.slice(stage.start, stage.end))) return operands;
  const script = argumentsOf(text, stage).rest.find((one) => !FLAG.test(one.said));
  return operands.filter((one) => one.from !== script?.from);
};

/** The spellings a shell-level text writes through that no spelling in it produces: a redirect's target, a write verb's own target, and a stage whose names `xargs`, `-exec` or `{}` hand over. A character counts only where the shell expands it, which is the quoting walk's to say: a `$` under a single quote or a backslash is text, a pattern under either quote is text, and a redirect is one only where `redirectsIn` finds it. A program body is the caller's to have taken out, being its interpreter's text and not the shell's. how/writes.md. */
export const unseenNames = (text) => {
  const under = underOf(text);
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
  for (const { from, to } of redirectsIn(text)) say(from, to);
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
