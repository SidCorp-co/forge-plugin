// The lexer the shell reading in shell-spans.mjs stands on, kept apart because it reads nothing else there.

/* Where a word begins: the only place a `#` is a comment and a `(` a subshell, `$(…)` and `<(…)` opening
   a shell for their body alone. A flag and not a look-behind — the escape branch eats two characters. And
   a `)` closes a frame only where the `(` it matches opened one, so a substitution pops nothing. */
const OPENS = /[\s;&|()]/u;

/* One walk, two answers: the spans below and the quoting each character stands under. Both are this loop's, because the quote state is the primitive the spans reading already spends, and a second walk of the same text elsewhere is a copy that can drift on one side only. */
const walked = (text, pipes, quoted = false) => {
  const out = [];
  /* Built only for `quoting`: no reader of the spans alone reads it, and `spans` runs several times per Bash event. */
  const under = quoted ? new Array(text.length).fill(" ") : null;
  const mark = quoted ? (at, as) => { under[at] = as; } : () => {};
  /* The backslashes a shell takes out of the word, which is one standing outside every quote with a character behind it: under a double quote one stays in the word before most characters, and which is ISS-1533's. */
  const gone = new Set();
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
      } else mark(at, "#");
      continue;
    }
    if (one === "\\" && quote !== "'") {
      if (quoted && !quote && at + 1 < text.length) gone.add(at);
      mark(at, "\\");
      if (at + 1 < text.length) mark(at + 1, "\\");
      at += 1;
      fresh = false;
      continue;
    }
    if (quote) {
      mark(at, quote);
      if (one === quote) quote = "";
      fresh = false;
      continue;
    }
    if (one === '"' || one === "'") {
      mark(at, one);
      quote = one;
      fresh = false;
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
  return { out, under, gone };
};

/** Where each command begins and ends, with the subshells its span opens and closes. A quoted body is never cut, nor a pipeline split: both hand the next command its arguments. An unclosed quote joins, a backslash escapes outside single quotes, and a comment is outside every span — its `|` is no pipeline. */
export const spans = (text, { pipes = false } = {}) => walked(text, pipes).out;

/** The quoting each code unit of the text stands under, offset for offset, as `quoting` below names it, a line continuation's two characters included and each marked `\\`. For a reader that asks of an offset rather than walking the characters. */
export const underOf = (text) => walked(text, false, true).under;

/** Every character a shell reads, in order: `at` its offset, `one` the character, `under` the quoting it stands inside — a space bare, `'` or `"` that quote and its own delimiters, `#` a comment, `\` a character a backslash made literal, the backslash included, and `removed` the backslash a shell takes out of the word, which is one standing outside every quote. A line continuation is gone, both characters of it, because a shell removes the pair and joins what it separated; nothing else is, so the character a removed backslash escaped is still placed where the text has it and two neighbours here can be two apart in the text.
 *  What a quoting means for a character is the caller's: a shell runs a `$(` under a double quote and reads a `<(` there as text. And one quoting this cannot place, which the caller has to answer for: inside `$'…'` a backslash escapes, so the apostrophe that looks like the closing one may not be. */
export const quoting = (text) => {
  const { under, gone } = walked(text, false, true);
  const continued = (at) =>
    under[at] === "\\"
    && (text[at] === "\n" || (text[at + 1] === "\n" && under[at + 1] === "\\"));
  /* Split rather than spread: one entry per code unit, so `at` indexes this walk and a caller's own match, where a code point outside the BMP would put every offset after it one out. */
  return text.split("")
    .map((one, at) => ({ at, one, under: under[at], removed: gone.has(at) }))
    .filter(({ at }) => !continued(at));
};
