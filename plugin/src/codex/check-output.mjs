/* What a check's own output said failed, selected out of it rather than taken off its end. Why TAP
   and not a vocabulary of failure words, and what this does not promise: docs/cli/codex-the-check.md. */
const NOT_OK = /^([ ]*)not ok\b(?:[ ]+\d+)?(?:[ ]*-)?[ ]*(.*)$/u;

// A case TAP says was not expected to pass, which is not a failure.
const DIRECTIVE = /\s#\s*(?:TODO|SKIP)\b/iu;

const FIELD = /^([ ]*)([A-Za-z_]+): ?(.*)$/u;

// Stack, duration and operands left out: every line spent here is one the tail loses.
const KEPT = ["location", "failureType", "error"];

const BLOCK = "|-";
const OPEN = "---";
const CLOSE = "...";
const QUOTED = /^'(.*)'$/su;

export const NAMED = 20;
export const SAID_CHARS = 300;

const said = (value) => {
  const one = value.replace(QUOTED, "$1").replace(/\s+/gu, " ").trim();
  return one.length > SAID_CHARS ? `${one.slice(0, SAID_CHARS - 1)}…` : one;
};

const scalarAt = (lines, from, indent) => {
  const body = [];
  for (let at = from; at < lines.length && lines[at].startsWith(`${indent}  `); at += 1) body.push(lines[at].trim());
  return body.filter(Boolean).join(" ");
};

// Its own indent decides the keys and the end alike: a `...` inside a scalar is that scalar's text.
const fieldsFrom = (lines, from, indent) => {
  const found = [];
  let at = from;
  for (; at < lines.length && lines[at] !== `${indent}${CLOSE}`; at += 1) {
    const field = FIELD.exec(lines[at]);
    if (!field || field[1] !== indent || !KEPT.includes(field[2])) continue;
    const value = field[3] === BLOCK ? scalarAt(lines, at + 1, indent) : field[3];
    found.push([field[2], said(value)]);
  }
  return { found, ended: at };
};

// Each carrying what its diagnostic gave of `KEPT`, nothing more. Empty for output that is not TAP.
export const failuresIn = (text) => {
  const lines = String(text ?? "").split("\n");
  const found = [];
  for (let at = 0; at < lines.length; at += 1) {
    const named = NOT_OK.exec(lines[at]);
    if (!named || DIRECTIVE.test(named[2])) continue;
    const indent = `${named[1]}  `;
    if (lines[at + 1]?.trim() !== OPEN) {
      found.push({ name: said(named[2]), fields: [] });
      continue;
    }
    const { found: fields, ended } = fieldsFrom(lines, at + 2, indent);
    found.push({ name: said(named[2]), fields });
    at = ended;
  }
  return found;
};

const lineFor = ([key, value]) => `    ${key}: ${value}`;

const linesFor = (one) => [`  ${one.name}`, ...one.fields.map(lineFor)];

// Null where the output named no failing case. The count leads: a bound that cut is read first.
export const failuresSaid = (text) => {
  const found = failuresIn(text);
  if (found.length === 0) return null;
  const over = found.length - NAMED;
  const head = over > 0
    ? `${found.length} failing case(s) its output named, the first ${NAMED} of them, ${over} not named:`
    : `${found.length} failing case(s) its output named:`;
  return [head, ...found.slice(0, NAMED).flatMap(linesFor)].join("\n");
};
