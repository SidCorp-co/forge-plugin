/* What a check's own output said failed, selected out of it rather than taken off its end. Why TAP
   and not a vocabulary of failure words, and what this does not promise: docs/cli/codex-the-check.md. */
const POINT = /^([ ]*)(not )?ok\b(?:[ ]+\d+)?(?:[ ]*-)?[ ]*(.*)$/u;

const OPENED = /^([ ]+)---[ ]*$/u;

// A case TAP says was not expected to pass, which is not a failure.
const DIRECTIVE = /\s#\s*(?:TODO|SKIP)\b/iu;

const FIELD = /^([ ]*)([A-Za-z_]+): ?(.*)$/u;

// Stack, duration and operands left out: every line spent here is one the tail loses.
const KEPT = ["location", "failureType", "error"];

const BLOCK = "|-";
const CLOSE = "...";
const QUOTED = /^'(.*)'$/su;

export const NAMED = 20;
export const SAID_CHARS = 300;

// Never more than the tail it sits above, whatever a producer repeats or how long a name runs.
export const FAILED_CHARS = 6_000;
const HEAD_CHARS = 200;

const said = (value) => {
  const one = value.replace(QUOTED, "$1").replace(/\s+/gu, " ").trim();
  return one.length > SAID_CHARS ? `${one.slice(0, SAID_CHARS - 1)}…` : one;
};

const scalarAt = (lines, from, indent) => {
  const body = [];
  for (let at = from; at < lines.length && lines[at].startsWith(`${indent} `); at += 1) body.push(lines[at].trim());
  return body.filter(Boolean).join(" ");
};

/* Both ends read off the stream: the keys and the closing `...` at the indent the `---` declared, and
   a line no deeper than the test point's outside it — or one unterminated block eats the rest. */
const fieldsFrom = (lines, from, indent, pad) => {
  const found = [];
  let at = from;
  for (; at < lines.length && lines[at] !== `${indent}${CLOSE}`; at += 1) {
    if (lines[at].trim() !== "" && !lines[at].startsWith(`${pad} `)) return { found, ended: at - 1 };
    const field = FIELD.exec(lines[at]);
    if (!field || field[1] !== indent || !KEPT.includes(field[2])) continue;
    if (found.some(([key]) => key === field[2])) continue;
    const value = field[3] === BLOCK ? scalarAt(lines, at + 1, indent) : field[3];
    found.push([field[2], said(value)]);
  }
  return { found, ended: at };
};

/* Every test point's diagnostic is consumed, the passing and the excused included: what is left to
   the scan is read as test points, so an assertion quoting `not ok` becomes a case nothing ran. */
export const failuresIn = (text) => {
  const lines = String(text ?? "").split(/\r?\n/u);
  const found = [];
  for (let at = 0; at < lines.length; at += 1) {
    const point = POINT.exec(lines[at]);
    if (!point) continue;
    const opened = OPENED.exec(lines[at + 1] ?? "");
    const block = opened && opened[1].length > point[1].length
      ? fieldsFrom(lines, at + 2, opened[1], point[1])
      : { found: [], ended: at };
    at = block.ended;
    if (point[2] && !DIRECTIVE.test(point[3])) found.push({ name: said(point[3]), fields: block.found });
  }
  return found;
};

const lineFor = ([key, value]) => `    ${key}: ${value}`;

const linesFor = (one) => [`  ${one.name}`, ...one.fields.map(lineFor)];

const within = (found) => {
  const kept = [];
  let room = FAILED_CHARS - HEAD_CHARS;
  for (const one of found.slice(0, NAMED)) {
    const lines = linesFor(one);
    room -= lines.join("\n").length + 1;
    if (room < 0) break;
    kept.push(lines);
  }
  return kept;
};

// Null where the output named no failing case. The count leads: a bound that cut is read first.
export const failuresSaid = (text) => {
  const found = failuresIn(text);
  if (found.length === 0) return null;
  const kept = within(found);
  const over = found.length - kept.length;
  const head = over > 0
    ? `${found.length} failing case(s) its output named, the first ${kept.length} of them, ${over} not named:`
    : `${found.length} failing case(s) its output named:`;
  return [head, ...kept.flat()].join("\n");
};
