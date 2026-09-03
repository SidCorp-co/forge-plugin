/* A project whose `.forge.json` names a prose language has every body and prose field rewritten on
   the way out (tools/vi.mjs), and a rewrite renames prose, so a key travels in a form the rewrite
   copies byte for byte: a fenced block, or a code span. Nothing imports here, so both sides can. */

const INFO = "forge-record";
const KEY = /^([a-z][a-z0-9-]*): ?(.*)$/u;
const OPEN = new RegExp(`^(\`{3,})${INFO}\\s*$`, "u");
const TAG = new RegExp(`\`?${INFO}: ([a-z]+) · contract (\\d+)\`?\\s*$`, "u");
const LABELLED = /^- \*\*([^*]+):\*\* (.*)$/u;

export const tagFor = (kind, contract) => `\`${INFO}: ${kind} · contract ${contract}\``;

/* The fence outruns any run inside it; an indented line continues the value above, not a key. */
export const fenceFor = (text) => "`".repeat(Math.max(3, ...[...String(text).matchAll(/`+/gu)].map((one) => one[0].length + 1)));

const linesFor = (key, value) => String(value).split("\n").map((line, at) => (at ? `  ${line}` : `${key}: ${line}`));

export const blockOf = (entries) => {
  const lines = entries.flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).flatMap((one) => linesFor(key, one)));
  const fence = fenceFor(lines.join("\n"));
  return [`${fence}${INFO}`, ...lines, fence].join("\n");
};

export const payloadIn = (body) => {
  const lines = String(body ?? "").split("\n");
  const at = lines.findIndex((line) => OPEN.test(line));
  if (at < 0) return null;
  const fence = OPEN.exec(lines[at])[1];
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim().startsWith(fence)) return out;
    const indented = /^ {2}(.*)$/u.exec(line);
    const key = indented ? null : KEY.exec(line);
    if (key) out.push([key[1], key[2]]);
    else if (out.length) out[out.length - 1][1] += `\n${indented ? indented[1] : line}`;
  }
  return out;
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

const valuesFor = (entries, field) => {
  const held = entries.filter(([key]) => key === field.flag).map(([, value]) => value);
  if (field.many) return held.length ? held : undefined;
  return held.length ? held[0] : undefined;
};

/* A body whose keys resolve to none of the shape's is named rewritten, never read as empty. */
export const readRecord = (body, shapeOf) => {
  const tag = TAG.exec(body ?? "");
  const shape = tag ? shapeOf(tag[1]) : null;
  if (!shape) return null;
  const fenced = payloadIn(body);
  const { entries, rewritten } = fenced ? { entries: fenced, rewritten: false } : labelledIn(body, shape);
  const fields = {};
  for (const field of [...shape.fields, ...(shape.stamp ? [shape.stamp] : [])]) {
    const held = valuesFor(entries, field);
    if (held !== undefined) fields[field.flag] = held;
  }
  return { kind: tag[1], contract: Number(tag[2]), fields, rewritten };
};

/* A number or nothing: a caller keys a map by this, and `NaN` is a key and an unsuppliable item. */
export const criterionNumber = (value) => {
  const found = /^\s*(\d+)/u.exec(String(value ?? ""));
  return found ? Number(found[1]) : null;
};

/* The fence a field comes back in is not part of it, and the mark's note is where the commit is. */
const FENCE = /^⟦(?:END_)?UNTRUSTED_DATA[^⟧]*⟧\s*$/gmu;
export const unwrap = (text) => String(text ?? "").replace(FENCE, "").trim();

const MARK = /^mark_merged\b/u;
const AT_SHA = /\bat ([0-9a-f]{7,40})\b/iu;
const HEAD_SHA = /\breviewed head ([0-9a-f]{7,40})\b/iu;

const lastMark = (comments) => {
  const marks = comments.map((one) => unwrap(one.body)).filter((body) => MARK.test(body));
  return marks.length ? marks.at(-1) : null;
};

export const markedCommit = (comments) => AT_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;
export const reviewedHead = (comments) => HEAD_SHA.exec(lastMark(comments) ?? "")?.[1] ?? null;

/* Machine data inside prose, read by this wording; `look` is optional, since FR-05 names two. */
const DECLARED = { screen: "screen change", schema: "schema coupling", look: "user-facing outcome" };
const lineFor = (name) => new RegExp(`${name}:\\s*(yes|no)\\b`, "iu");

export const planFlags = (plan) =>
  Object.fromEntries(Object.entries(DECLARED).map(([key, name]) =>
    [key, lineFor(name).exec(plan ?? "")?.[1]?.toLowerCase() ?? null]));

/* As far as `lineFor` reaches: one accepted mid-line and left bare is renamed, and declares nothing. */
const MACHINE = {
  plan: new RegExp(`(${Object.values(DECLARED).join("|")}):[ \\t]*(yes|no)\\b`, "gimu"),
};
/* The spans the rewrite keeps, in the shape it reads them: what is inside one is already safe, and
   a second pair of backticks in there would split the span and expose what it holds. */
const SPAN = /(`[^`\n]+`)/u;

export const protectMachine = (field, text) => {
  const pattern = MACHINE[field];
  if (!pattern) return text;
  return String(text)
    .split(new RegExp(SPAN.source, "gu"))
    .map((part, at) => (at % 2 ? part : part.replace(pattern, (_whole, name, value) => `\`${name}: ${value}\``)))
    .join("");
};
