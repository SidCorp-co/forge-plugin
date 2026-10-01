// The lexer the shell reading in shell-spans.mjs stands on, kept apart because it reads nothing else there.

/* Where a word begins: the only place a `#` is a comment and a `(` a subshell, `$(…)` and `<(…)` opening
   a shell for their body alone. A flag and not a look-behind — the escape branch eats two characters. And
   a `)` closes a frame only where the `(` it matches opened one, so a substitution pops nothing. */
const OPENS = /[\s;&|()]/u;

/* What a backslash under a double quote escapes, which is where a shell takes it out of the word; before anything else it stays. A newline is the fifth, and a continuation is gone whole already. */
const ESCAPED_IN_DOUBLE = /[$`"\\]/u;
const BACKTICK = "\x60";

/* One walk, every answer: the spans below, the quoting each character stands under, and the quoted spans a reader rewrites. All of them are this loop's, because the quote state is the primitive the spans reading already spends, and a second walk of the same text elsewhere is a copy that can drift on one side only.
   A `$(…)` or a backtick pair a double quote opened is a frame: inside it the quoting starts again bare, so a quote there opens a context of its own and a bare `(` counts towards the frame's own depth, and the `)` at depth zero — or for a backtick pair the next backtick no backslash took — gives the double quote back. A backtick standing bare inside a frame opens one of its own, so a `)` in its body closes nothing outside it. Nothing inside a frame is cut and no comment opens there, so a frame changes where the spans end only where the quoting it reads right was misread before. And a `<<` inside a frame sends the walk back to where the outermost one opened, to read that substitution flat: a here-document's body is prose this walk would read as shell, and the commit message an agent writes through `"$(cat <<'EOF' … EOF\n)"` is the shape every gate reads most. */
const walked = (text, pipes, quoted = false) => {
  const out = [];
  /* Built only for `quoting` and the readers beside it: no reader of the spans alone reads them, and `spans` runs several times per Bash event. */
  const under = quoted ? new Array(text.length).fill(" ") : null;
  const held = quoted ? new Array(text.length).fill("") : null;
  const depth = quoted ? new Array(text.length).fill(0) : null;
  /* The backslashes a shell takes out of the word: one standing outside every quote with a character behind it, and one under a double quote before a character that quote lets it escape. */
  const gone = new Set();
  /* Each quoted span standing outside every frame, opening quote to closing one, a frame inside it held whole, and whether a substitution in it was read flat. */
  const runs = [];
  let frames = [];
  let start = 0;
  let quote = "";
  let said = -1;
  let fresh = true;
  let opens = 0;
  let closes = 0;
  let dollar = false;
  let flat = false;
  let opened = -1;
  const nested = [];
  const mark = quoted
    ? (at, as, inside = quote) => {
      under[at] = as;
      held[at] = inside;
      depth[at] = frames.length;
    }
    : () => {};
  const cut = (at) => {
    out.push({ start, end: said < 0 ? at : said, opens, closes });
    said = -1;
    opens = 0;
    closes = 0;
  };
  for (let at = 0; at < text.length; at += 1) {
    const one = text[at];
    const frame = frames.at(-1);
    /* Read before the quote and escape branches: a comment's apostrophe opens nothing. */
    if (said >= 0) {
      if (one === "\n") {
        cut(at);
        start = at + 1;
      } else mark(at, "#");
      continue;
    }
    if (one === "\\" && quote !== "'") {
      if (quoted && at + 1 < text.length && (!quote || ESCAPED_IN_DOUBLE.test(text[at + 1]))) gone.add(at);
      mark(at, "\\");
      if (at + 1 < text.length) mark(at + 1, "\\");
      at += 1;
      fresh = false;
      dollar = false;
      continue;
    }
    if (frame?.tick && one === BACKTICK) {
      mark(at, " ", "");
      frames.pop();
      quote = frame.saved;
      dollar = false;
      continue;
    }
    if (quote) {
      if (quote === '"' && !flat && ((dollar && one === "(") || one === BACKTICK)) {
        frames.push({ saved: quote, from: at, depth: 0, tick: one === BACKTICK });
        quote = "";
        mark(at, " ");
        dollar = false;
        fresh = false;
        continue;
      }
      mark(at, quote);
      if (one === quote) {
        quote = "";
        if (!frames.length) {
          runs.push([opened, at + 1, flat]);
          flat = false;
        }
      }
      dollar = quote === '"' && one === "$";
      fresh = false;
      continue;
    }
    dollar = false;
    if (one === '"' || one === "'") {
      quote = one;
      mark(at, one);
      if (!frames.length) opened = at;
      fresh = false;
      continue;
    }
    if (frame) {
      if (one === BACKTICK) {
        frames.push({ saved: "", from: at, depth: 0, tick: true });
        mark(at, " ");
        continue;
      }
      mark(at, " ");
      if (!frame.tick && one === "(") frame.depth += 1;
      else if (!frame.tick && one === ")") {
        if (frame.depth === 0) {
          frames.pop();
          quote = frame.saved;
          continue;
        }
        frame.depth -= 1;
      } else if (one === "<" && text[at + 1] === "<" && text[at - 1] !== "<" && text[at + 2] !== "<") {
        const from = frames[0].from;
        for (const one of [...gone]) if (one >= from) gone.delete(one);
        frames = [];
        quote = '"';
        flat = true;
        at = from - 1;
        continue;
      }
      dollar = one === "$";
      continue;
    }
    if (fresh && one === "#") {
      said = at;
      mark(at, "#");
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
  if (quote || frames.length) runs.push([opened, text.length, flat]);
  return { out, under, held, depth, gone, runs };
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

/** The quoting each code unit of the text stands under, offset for offset, as `quoting` below names it, a line continuation's two characters included and each marked `\\`. For a reader that asks of an offset rather than walking the characters. */
export const underOf = (text) => readOf(text).under;

/** Every character a shell reads, in order: `at` its offset, `one` the character, `under` the quoting it stands inside — a space bare, `'` or `"` that quote and its own delimiters, `#` a comment, `\` a character a backslash made literal, the backslash included — `removed` the backslash a shell takes out of the word, which is one standing outside every quote or one a double quote lets escape what follows it, and `depth` how many substitutions a double quote opened it stands inside. A line continuation is gone, both characters of it, because a shell removes the pair and joins what it separated; nothing else is, so the character a removed backslash escaped is still placed where the text has it and two neighbours here can be two apart in the text.
 *  A frame's body is marked with the quoting it has inside the frame, its brackets bare, because a shell runs it; one the walk read flat for its here-document is marked as the double quote around it, at depth zero. What a quoting means for a character is still the caller's — a shell reads a `<(` under a double quote as text — and two quotings this cannot place are the caller's to answer for: inside `$'…'` a backslash escapes, so the apostrophe that looks like the closing one may not be, and a `${…}` holds a word whose quotes nest. */
export const quoting = (text) => {
  const read = readOf(text);
  if (!read.marks) read.marks = marksOf(text, read);
  return read.marks;
};

const marksOf = (text, { under, depth, gone }) => {
  const continued = (at) =>
    under[at] === "\\"
    && (text[at] === "\n" || (text[at + 1] === "\n" && under[at + 1] === "\\"));
  /* Split rather than spread: one entry per code unit, so `at` indexes this walk and a caller's own match, where a code point outside the BMP would put every offset after it one out. */
  return text.split("")
    .map((one, at) => ({ at, one, under: under[at], removed: gone.has(at), depth: depth[at] }))
    .filter(({ at }) => !continued(at));
};

const QUOTES = new Set(["'", '"']);

/** The text with `fill` over every code unit a quote holds as data, offset for offset: the body of a substitution a double quote opened is left standing, since a shell runs it, and a quote inside that body is data again. With `delimiters` the quote characters themselves stay, so the text still says where each span was. */
export const quotedOver = (text, fill, { delimiters = false } = {}) => {
  const { under, held } = readOf(text);
  return text.split("").map((one, at) =>
    (held[at] && !(delimiters && QUOTES.has(one) && under[at] === one) ? fill : one)).join("");
};

/** Each quoted span of the text, from its opening quote past its closing one, handed to `fill` in order as `replace` hands a match, and what `fill` returns put in its place. A span is the walk's: a quote a comment or a backslash holds opens none, a substitution a double quote opened is inside the span around it, a line continuation in it is handed over as the text holds it, and an unclosed one runs to the end. `fill`'s second argument says, as `flat`, whether a substitution in the span was read as the double quote around it — a here-document stood inside — so a caller that must not miss what that substitution runs can keep the span whole. */
export const respelled = (text, fill) => {
  let out = "";
  let last = 0;
  for (const [from, to, flat] of readOf(text).runs) {
    out += text.slice(last, from) + fill(text.slice(from, to), { flat });
    last = to;
  }
  return out + text.slice(last);
};
