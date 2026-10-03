// The lexer the shell reading in shell-spans.mjs stands on, kept apart because it reads nothing else there.

/* Where a word begins: the only place a `#` is a comment and a `(` a subshell, `$(…)` and `<(…)` opening
   a shell for their body alone. A flag and not a look-behind — the escape branch eats two characters. And
   a `)` closes a frame only where the `(` it matches opened one, so a substitution pops nothing. */
const OPENS = /[\s;&|()]/u;

/** What a backslash under a double quote escapes, which is where a shell takes it out of the word; before anything else it stays. A newline is the fifth, and a continuation is gone whole already. */
export const ESCAPED_IN_DOUBLE = /[$`"\\]/u;
const BACKTICK = "\x60";

/* One walk, every answer: the spans below, the quoting each character stands under, how many substitutions each stands inside, and the quoted spans a reader rewrites. All of them are this loop's, because the quote state is the primitive the spans reading already spends, and a second walk of the same text elsewhere is a copy that can drift on one side only.
   A `$(…)` or a backtick pair a double quote opened is a frame: inside it the quoting starts again bare, so a quote there opens a context of its own and a bare `(` counts towards the frame's own depth, and the `)` at depth zero — or for a backtick pair the next backtick no backslash took — gives the double quote back. A `$(…)` or a backtick standing bare inside a frame opens one of its own, so a `)` in its body closes nothing outside it. Nothing inside a frame is cut and no comment opens there, so a frame changes where the spans end only where the quoting it reads right was misread before. And a `<<` inside a frame sends the walk back to where the outermost one opened, to read that substitution flat: a here-document's body is prose this walk would read as shell, and the commit message an agent writes through `"$(cat <<'EOF' … EOF\n)"` is the shape every gate reads most.
   Bare, a `$(…)` or a backtick pair is cut at its separators like the rest of the command, and the walk keeps only how deep each character stands, as it does in each one a flat reading passes through, counting the brackets each holds. */
const walker = (text, pipes, quoted) => {
  /* Built only for `quoting` and the readers beside it: no reader of the spans alone reads them, and `spans` runs several times per Bash event. */
  const fill = (value) => (quoted ? new Array(text.length).fill(value) : null);
  const w = {
    text, pipes, quoted, at: 0, out: [],
    under: fill(" "), held: fill(""), depth: fill(0), within: fill(""),
    /* The backslashes a shell takes out of the word: one standing outside every quote with a character behind it, and one under a double quote before a character that quote lets it escape. */
    gone: new Set(),
    /* Each quoted span standing outside every frame, opening quote to closing one, a frame inside it held whole, and whether a substitution in it was read flat. */
    runs: [],
    /* Each backtick that opens a pair: one standing bare, outside every quote and frame, opens one where no bare one is open already and closes it otherwise; one a double quote or a frame opened is the frame's own. */
    ticks: [], ticking: false, frames: [],
    start: 0, quote: "", said: -1, fresh: true, opens: 0, closes: 0, dollar: false, flat: false, opened: -1,
    nested: [], subs: 0, flats: [],
    /* The last `$` a shell spends outside every quote, so a `(` right behind it opens a substitution and one behind an escaped `$` opens nothing. */
    sigil: null,
  };
  return w;
};

const kindOf = (w) => {
  if (w.flats.length) return "flat";
  if (w.frames.length) return "quoted";
  return w.subs || w.ticking ? "bare" : "";
};
const place = (w, at) => {
  if (!w.quoted) return;
  w.depth[at] = w.frames.length + w.subs + (w.ticking ? 1 : 0) + w.flats.length;
  w.within[at] = kindOf(w);
};
const mark = (w, at, as, inside = w.quote) => {
  if (!w.quoted) return;
  w.under[at] = as;
  w.held[at] = inside;
  place(w, at);
};
const cut = (w, at) => {
  w.out.push({ start: w.start, end: w.said < 0 ? at : w.said, opens: w.opens, closes: w.closes });
  w.said = -1;
  w.opens = 0;
  w.closes = 0;
};

/* Read before the quote and escape branches: a comment's apostrophe opens nothing. */
const commented = (w, one) => {
  if (one !== "\n") return mark(w, w.at, "#");
  cut(w, w.at);
  w.start = w.at + 1;
};

const escaped = (w) => {
  const { text, at } = w;
  if (w.quoted && at + 1 < text.length && (!w.quote || ESCAPED_IN_DOUBLE.test(text[at + 1]))) w.gone.add(at);
  mark(w, at, "\\");
  if (at + 1 < text.length) mark(w, at + 1, "\\");
  w.at += 1;
  w.fresh = false;
  w.dollar = false;
};

/* Where a backtick closes a pair: inside one, the next backtick no backslash took closes it, whatever opened since. */
const tickIn = (stack, one) => (one === BACKTICK ? stack.findLastIndex(({ tick }) => tick) : -1);

/* Where a flat reading stands inside a substitution, kept for its depth alone: each opens at a `$(` or a backtick and closes at the bracket that matches it, and the quote closing the reading closes every one of them. How many stay open once this character is marked. */
const flatStep = (w, one) => {
  const top = w.flats.at(-1);
  const tick = tickIn(w.flats, one);
  if (tick >= 0) return tick;
  if ((w.dollar && one === "(") || one === BACKTICK) w.flats.push({ tick: one === BACKTICK, depth: 0 });
  else if (top?.tick === false && one === "(") top.depth += 1;
  else if (top?.tick === false && one === ")") {
    if (top.depth === 0) return w.flats.length - 1;
    top.depth -= 1;
  }
  if (one === w.quote) w.flats = [];
  return w.flats.length;
};

const inQuote = (w, one) => {
  const { at } = w;
  if (w.quote === '"' && !w.flat && ((w.dollar && one === "(") || one === BACKTICK)) {
    w.frames.push({ saved: w.quote, from: at, depth: 0, tick: one === BACKTICK });
    if (one === BACKTICK) w.ticks.push(at);
    w.quote = "";
    mark(w, at, " ");
    w.dollar = false;
    w.fresh = false;
    return;
  }
  const left = w.flat ? flatStep(w, one) : 0;
  mark(w, at, w.quote);
  w.flats.length = left;
  if (one === w.quote) {
    w.quote = "";
    if (!w.frames.length) {
      w.runs.push([w.opened, at + 1, w.flat]);
      w.flat = false;
    }
  }
  w.dollar = w.quote === '"' && one === "$";
  w.fresh = false;
};

const flatten = (w) => {
  const { from, tick } = w.frames[0];
  for (const one of [...w.gone]) if (one >= from) w.gone.delete(one);
  w.ticks = w.ticks.filter((one) => one < from);
  w.frames = [];
  w.quote = '"';
  w.flat = true;
  w.dollar = !tick;
  w.at = from - 1;
};

const inFrame = (w, one, frame) => {
  const { text, at } = w;
  if (one === BACKTICK || (one === "(" && w.sigil === at - 1)) {
    w.frames.push({ saved: "", from: at, depth: 0, tick: one === BACKTICK });
    if (one === BACKTICK) w.ticks.push(at);
    mark(w, at, " ");
    return;
  }
  mark(w, at, " ");
  if (one === "$") w.sigil = at;
  if (!frame.tick && one === "(") frame.depth += 1;
  else if (!frame.tick && one === ")") {
    if (frame.depth > 0) frame.depth -= 1;
    else {
      w.frames.pop();
      w.quote = frame.saved;
    }
  } else if (one === "<" && text[at + 1] === "<" && text[at - 1] !== "<" && text[at + 2] !== "<") flatten(w);
};

/* A bracket outside every quote and frame: a subshell where a word begins, a substitution behind a `$` a shell spends. */
const bracket = (w, one) => {
  if (one === "(") {
    const sub = w.sigil === w.at - 1;
    w.nested.push({ fresh: w.fresh, sub });
    if (w.fresh) w.opens += 1;
    if (sub) {
      w.subs += 1;
      place(w, w.at);
    }
  } else if (one === ")") {
    const shut = w.nested.pop();
    if (shut?.fresh ?? true) w.closes += 1;
    if (shut?.sub) w.subs -= 1;
  } else if (one === "$") w.sigil = w.at;
};

const bare = (w, one) => {
  const { text, at } = w;
  if (one === BACKTICK) {
    if (!w.ticking) w.ticks.push(at);
    w.ticking = !w.ticking;
    if (w.quoted) {
      w.depth[at] = w.subs + 1;
      w.within[at] = "bare";
    }
  }
  if (w.fresh && one === "#") {
    w.said = at;
    mark(w, at, "#");
    return;
  }
  bracket(w, one);
  w.fresh = OPENS.test(one);
  const pair = text.slice(at, at + 2);
  /* `|&` is a pipeline, `>&` a descriptor — but a pipeline is where a program owning a flag stops. */
  if (pair === "|&") {
    if (w.pipes) cut(w, at);
    w.at += 1;
    place(w, w.at);
    if (w.pipes) w.start = w.at + 1;
    return;
  }
  if (one === "&" && text[at - 1] === ">") return;
  if (one === ";" || one === "\n" || one === "&" || pair === "||" || (w.pipes && one === "|")) {
    cut(w, at);
    if (pair === "&&" || pair === "||") place(w, (w.at += 1));
    w.start = w.at + 1;
  }
};

const step = (w) => {
  const one = w.text[w.at];
  const frame = w.frames.at(-1);
  place(w, w.at);
  if (w.said >= 0) return commented(w, one);
  if (one === "\\" && w.quote !== "'") return escaped(w);
  const tick = tickIn(w.frames, one);
  if (tick >= 0) {
    mark(w, w.at, " ", "");
    w.quote = w.frames[tick].saved;
    w.frames.length = tick;
    w.dollar = false;
    return;
  }
  if (w.quote) return inQuote(w, one);
  w.dollar = false;
  if (one === '"' || one === "'") {
    w.quote = one;
    mark(w, w.at, one);
    if (!w.frames.length) w.opened = w.at;
    w.fresh = false;
    return;
  }
  if (frame) return inFrame(w, one, frame);
  bare(w, one);
};

const walked = (text, pipes, quoted = false) => {
  const w = walker(text, pipes, quoted);
  for (w.at = 0; w.at < text.length; w.at += 1) step(w);
  cut(w, text.length);
  if (w.quote || w.frames.length) w.runs.push([w.opened, text.length, w.flat]);
  const { out, under, held, depth, within, gone, runs, ticks } = w;
  return { out, under, held, depth, within, gone, runs, ticks };
};

/** Where each command begins and ends, with the subshells its span opens and closes. A quoted body is never cut, nor a pipeline split: both hand the next command its arguments. An unclosed quote joins, a backslash escapes outside single quotes, and a comment is outside every span — its `|` is no pipeline. */
export const spans = (text, { pipes = false } = {}) => walked(text, pipes).out;

/* The texts walked last, the most recently asked about last: one Bash event hands the same text to several readers, and every one of them reads the walk and none writes it. */
const KEPT = 8;
const WALKS = new Map();
const readOf = (text) => {
  const held = WALKS.get(text);
  if (held) {
    WALKS.delete(text);
    WALKS.set(text, held);
    return held;
  }
  const read = walked(text, false, true);
  if (WALKS.size >= KEPT) WALKS.delete(WALKS.keys().next().value);
  WALKS.set(text, read);
  return read;
};

/** The quoting each code unit of the text stands under, offset for offset, as `quoting` below names it, a line continuation's two characters included and each marked `\\`. For a reader that asks of an offset rather than walking the characters; `withinOf` is the same for the kind of substitution each stands innermost in. */
export const underOf = (text) => readOf(text).under;
export const withinOf = (text) => readOf(text).within;

/** Every character a shell reads, in order: `at` its offset, `one` the character, `under` the quoting it stands inside — a space bare, `'` or `"` that quote and its own delimiters, `#` a comment, `\` a character a backslash made literal, the backslash included — `removed` the backslash a shell takes out of the word, which is one standing outside every quote or one a double quote lets escape what follows it, `depth` how many substitutions it stands inside, a `$(…)` or a backtick pair, bare or quoted, each one's brackets counted inside it, and `within` the kind of the innermost — `bare`, `quoted` for a frame, `flat` for one read flat, empty at depth zero. A line continuation is gone, both characters of it, because a shell removes the pair and joins what it separated; nothing else is, so the character a removed backslash escaped is still placed where the text has it and two neighbours here can be two apart in the text.
 *  A frame's body is marked with the quoting it has inside the frame, its brackets bare, because a shell runs it; one the walk read flat for its here-document is marked as the double quote around it, its depth still counted. What a quoting means for a character is still the caller's — a shell reads a `<(` under a double quote as text — and two quotings this cannot place are the caller's to answer for: inside `$'…'` a backslash escapes, so the apostrophe that looks like the closing one may not be, and a `${…}` holds a word whose quotes nest. */
export const quoting = (text) => {
  const read = readOf(text);
  if (!read.marks) read.marks = marksOf(text, read);
  return read.marks;
};

const marksOf = (text, { under, depth, within, gone }) => {
  const continued = (at) =>
    under[at] === "\\"
    && (text[at] === "\n" || (text[at + 1] === "\n" && under[at + 1] === "\\"));
  /* Split rather than spread: one entry per code unit, so `at` indexes this walk and a caller's own match, where a code point outside the BMP would put every offset after it one out. */
  return text.split("")
    .map((one, at) => ({ at, one, under: under[at], removed: gone.has(at), depth: depth[at], within: within[at] }))
    .filter(({ at }) => !continued(at));
};

const QUOTES = new Set(["'", '"']);

/** What a shell hands on of one word, as `quoting`'s entries: every quote that opens or closes a run gone, every backslash the shell takes out gone, and each character a quote or a backslash made literal kept — a quote inside the other quote's run, a backslash in a single-quoted run, one a double quote does not let escape what follows. Walked apart from the texts kept above, since one word is no text the readers of an event share. */
export const handedOn = (word) =>
  marksOf(word, walked(word, false, true)).filter(({ one, under, removed }) => !removed && !(QUOTES.has(one) && under === one));

/** `over` with each backtick of `text` that opens a pair spelled as the `(` a `$(…)` opens with, so a pattern reading where a command starts finds one there and none behind the backtick that closes the pair. `over` is a reading of `text` offset for offset, standing at `from` in it; which backtick opens is the walk's answer, since only the walk knows which pair a backtick belongs to. */
export const ticksOpened = (text, over = text, from = 0) => {
  const { ticks } = readOf(text);
  if (!ticks.length) return over;
  const out = over.split("");
  for (const at of ticks) if (at >= from && at - from < out.length) out[at - from] = "(";
  return out.join("");
};

/** The text with `fill` over every code unit a quote holds as data, offset for offset: the body of a substitution a double quote opened is left standing, since a shell runs it, and a quote inside that body is data again. With `delimiters` the quote characters themselves stay, so the text still says where each span was. */
export const quotedOver = (text, fill, { delimiters = false } = {}) => {
  const { under, held } = readOf(text);
  return text.split("").map((one, at) =>
    (held[at] && !(delimiters && QUOTES.has(one) && under[at] === one) ? fill : one)).join("");
};

/** Each quoted span of the text, from its opening quote past its closing one, handed to `fill` in order as `replace` hands a match, and what `fill` returns put in its place. A span is the walk's: a quote a comment or a backslash holds opens none, a substitution a double quote opened is inside the span around it, a line continuation in it is handed over as the text holds it, and an unclosed one runs to the end. `fill`'s second argument carries the span's offset as `from`, and says, as `flat`, whether a substitution in the span was read as the double quote around it — a here-document stood inside — so a caller that must not miss what that substitution runs can keep the span whole. */
export const respelled = (text, fill) => {
  let out = "";
  let last = 0;
  for (const [from, to, flat] of readOf(text).runs) {
    out += text.slice(last, from) + fill(text.slice(from, to), { flat, from });
    last = to;
  }
  return out + text.slice(last);
};
