/* The shape a record takes inside a comment body, and its reading back: the fenced block, the tag
   under it, and the two degraded forms a host or a prose rewrite leaves. Apart from the shape table
   in `machine.mjs`, which says what each kind holds, because this is only how any kind is carried. */
import { fenceMarked } from "../../prose.mjs";

const INFO = "forge-record";
const KEY = /^([a-z][a-z0-9-]*): ?(.*)$/u;
const OPEN = new RegExp(`^(\`{3,})${INFO}\\s*$`, "u");
const CLOSE = /^`{3,}[ \t]*$/u;
const CLOSES = /^ {0,3}`{3,}[ \t]*$/u;
/* What the first record in a body stamped, which is the one a write printed, matched over the whole line because a sentence ending in those words quotes a record rather than making one: docs/cli/the-rung-in-text.md. */
const FIRST_TAG = new RegExp(`^\`?${INFO}: ([a-z]+) · contract \\d+\`?[ \t]*$`, "mu");
const TAG = new RegExp(`\`?${INFO}: ([a-z]+) · contract (\\d+)\`?\\s*$`, "u");
const LABELLED = /^- \*\*([^*]+):\*\* (.*)$/u;

export const tagFor = (kind, contract) => `\`${INFO}: ${kind} · contract ${contract}\``;

/* The fence outruns any run inside it; an indented line continues the value above, not a key. */
const fenceFor = (text) => "`".repeat(Math.max(3, ...[...String(text).matchAll(/`+/gu)].map((one) => one[0].length + 1)));

const linesFor = (key, value) => String(value).split("\n").map((line, at) => (at ? `  ${line}` : `${key}: ${line}`));

export const blockOf = (entries) => {
  const lines = entries.flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).flatMap((one) => linesFor(key, one)));
  const fence = fenceFor(lines.join("\n"));
  return [`${fence}${INFO}`, ...lines, fence].join("\n");
};

const keyedIn = (lines, closes) => {
  const out = [];
  for (const line of lines) {
    if (closes(line)) return out;
    const indented = /^ {2}(.*)$/u.exec(line);
    const key = indented ? null : KEY.exec(line);
    if (key) out.push([key[1], key[2]]);
    else if (out.length) out[out.length - 1][1] += `\n${indented ? indented[1] : line}`;
  }
  return out;
};

const payloadIn = (body) => {
  const lines = String(body ?? "").split("\n");
  const at = lines.findIndex((line) => OPEN.test(line));
  if (at < 0) return null;
  const fence = OPEN.exec(lines[at])[1];
  return keyedIn(lines.slice(at + 1), (line) => line.trim().startsWith(fence));
};

/* The same payload with its head off: a host truncates a long tool result from the top, so a record
   this CLI printed can arrive without its opening fence. What stands in for the one it lost is the
   trailer `render` writes — a fence where `blockOf` puts one, the tag alone beneath, and nothing below that markdown would have closed the first on, which it would three spaces in. */
const headlessIn = (body) => {
  const lines = fenceMarked(body);
  const at = lines.findIndex((one) => one.fenced);
  if (at < 0 || !CLOSE.test(lines[at].line)) return null;
  const under = lines.slice(at + 1);
  if (under.some((one) => CLOSES.test(one.line))) return null;
  const said = under.find((one) => one.line.trim());
  if (!said || !FIRST_TAG.test(said.line)) return null;
  const out = keyedIn(lines.slice(0, at).map((one) => one.line), () => false);
  return out.length ? out : null;
};

/* The label is the key in this form alone: resolved once, here, and nowhere further in. It also
   joins a repeating field's values, so this form alone splits them; a fenced line may hold that pair. */
const labelledIn = (body, shape) => {
  const held = [...shape.fields, ...(shape.stamp ? [shape.stamp] : [])];
  const map = new Map(held.map((one) => [one.label, one]));
  const out = [];
  let seen = 0;
  for (const line of String(body ?? "").split("\n")) {
    const found = LABELLED.exec(line.trim());
    if (!found) continue;
    seen += 1;
    const field = map.get(found[1]);
    if (field) for (const one of field.many ? found[2].split("; ") : [found[2]]) out.push([field.flag, one]);
  }
  return { entries: out, rewritten: seen > 0 && out.length === 0 };
};

/* One reading of a body, so no two callers can come to disagree over what a record said. */
export const entriesIn = (body, shape) => {
  const keyed = payloadIn(body) ?? headlessIn(body);
  if (keyed) return { entries: keyed, rewritten: false };
  return shape ? labelledIn(body, shape) : { entries: [], rewritten: false };
};

const valuesFor = (entries, field) => {
  const held = entries.filter(([key]) => key === field.flag).map(([, value]) => value);
  if (field.many) return held.length ? held : undefined;
  return held.length ? held[0] : undefined;
};

/* A `per` key opens a block; what stands before the first is every block's (ISS-289), and a block's own value of a flag taking one replaces the shared one, so that occurrence comes out for exactly the flags the block names while a repeatable flag adds to the shared values and keeps them ahead of its own (ISS-307) — the rule `blocksIn` gives the writer's argv, read here off the payload because a record is also written by hand. A payload opening no block shares nothing, so a key repeated in one is handed on as it was read. */
const groupsIn = (entries, per, single = []) => {
  const opens = per ? entries.findIndex(([key]) => key === per) : -1;
  if (opens < 0) return [entries];
  const shared = entries.slice(0, opens);
  const groups = [];
  for (const entry of entries.slice(opens)) {
    if (entry[0] === per) groups.push([]);
    groups.at(-1).push(entry);
  }
  return groups.map((own) => {
    const replaced = new Set(own.map(([key]) => key).filter((key) => single.includes(key)));
    return [...shared.filter(([key]) => !replaced.has(key)), ...own];
  });
};

/* Keys resolving to none of the shape's is rewritten, not empty; and no body sources a derived one — so a fact a check has to read back is `stamped`, which the write fills and this reads, never `derived`, which is a copy for a person and reaches no checker. */
export const readRecords = (body, shapeOf) => {
  const tag = TAG.exec(body ?? "");
  const shape = tag ? shapeOf(tag[1], Number(tag[2])) : null;
  if (!shape) return [];
  const { entries, rewritten } = entriesIn(body, shape);
  const read = [...shape.fields.filter((one) => !one.derived), ...(shape.stamp ? [shape.stamp] : [])];
  const single = read.filter((one) => !one.many).map((one) => one.flag);
  return groupsIn(entries, shape.per, single).map((group) => {
    const fields = {};
    for (const field of read) {
      const held = valuesFor(group, field);
      if (held !== undefined) fields[field.flag] = held;
    }
    return { kind: tag[1], contract: Number(tag[2]), fields, rewritten };
  });
};

/** The kind the first record in a body stamped, or null where it stamps none. */
export const firstKindIn = (body) => FIRST_TAG.exec(body ?? "")?.[1] ?? null;
