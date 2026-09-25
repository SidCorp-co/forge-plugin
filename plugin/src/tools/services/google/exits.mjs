/* The five classes a `forge google` failure exits with, so a caller branches on the number rather than
   parsing the sentence. Every other verb exits 1 through `fail()`; why this one types its failures:
   docs/cli/google.md. */

export const API = 1;
export const AUTH = 2;
export const VALIDATION = 3;
export const DISCOVERY = 4;
export const INTERNAL = 5;

const struckFrom = [];

/** A value no line this verb prints may carry: a credential, once it is read. */
export const holdSecret = (value) => {
  if (typeof value !== "string" || value.length < 8) return;
  /* The escaped spelling too: an answer quoting a value back inside JSON writes its newlines as `\n`. */
  for (const spelling of [value, JSON.stringify(value).slice(1, -1)]) {
    if (!struckFrom.includes(spelling)) struckFrom.push(spelling);
  }
};

const MASK = "<redacted>";

/** A line with every held credential struck out, whatever route put it in the line. */
export const struck = (text) => struckFrom.reduce((line, secret) => line.split(secret).join(MASK), String(text));

export const say = (text) => console.log(struck(text));

export const note = (text) => console.error(struck(text));

export const refuse = (code, message) => {
  note(message);
  process.exit(code);
};
