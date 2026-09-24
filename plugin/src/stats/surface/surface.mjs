/* `forge stats surface` — what the texts an agent is served cost, in tokens counted by the provider
   that bills them, and what repeats across them. Why a count and never an estimate, which texts are
   walked, and what a priced read means: docs/cli/stats-the-surface.md. */
import { GUIDE, pooled, readNodes, surfaceNodes } from "./nodes.mjs";
import { KEY_VARIABLE, counterFor, originOf, unmeasuredWhy } from "./count.mjs";
import { checkoutFrom, profileOf, runsUnder, windowFrom } from "../runs.mjs";
import { classesFor } from "../corpus/classes.mjs";
import { declaredIn } from "../corpus/declared.mjs";
import { rootFor } from "../corpus/corpus.mjs";
import { capped, elided } from "../tables.mjs";
import { flowPinned } from "../../guides/flow.mjs";
import { flags } from "../../resolve/flags.mjs";

export const SURFACE_USAGE = [
  "Usage: forge stats surface [--model <id>] [--since 3d] [--checkout <dir>] [--json]",
  "What the texts this copy serves an agent cost: every name's -h and every guide part it serves",
  "as its own, each read by running it. Tokens are counted by Anthropic's count endpoint, one",
  `request per text under ${KEY_VARIABLE}, and never estimated: a figure it could not count`,
  "reads `not measured` and says what would measure it. Nothing is written.",
  "",
  "  --model <id>   the model whose tokenizer counts, named in the output; no default",
  "  --since 3d     the window the guide-part reads are priced over; the whole corpus otherwise",
  "  --checkout <dir>  the absolute checkout whose transcripts hold those reads; the working",
  "                 directory otherwise",
  "  --json         every text, figure and read, with null for a figure not measured",
].join("\n");

const NOT_MEASURED = "not measured";
const LETTER = /\p{L}/u;
const SERVED = /^(?<part>.*) \((?<flow>[^()]*)\)$/u;

/** Every line printed by more than one text: how many, their printings past the first, and those printings as one text to count. */
export const repetitionOf = (texts) => {
  const lines = new Map();
  texts.forEach((one, index) => {
    for (const raw of String(one.text ?? "").split("\n")) {
      const line = raw.trim();
      if (!LETTER.test(line)) continue;
      const held = lines.get(line) ?? { texts: new Set(), printings: 0 };
      held.texts.add(index);
      held.printings += 1;
      lines.set(line, held);
    }
  });
  const shared = [...lines]
    .filter(([, held]) => held.texts.size > 1)
    .map(([line, held]) => ({ line, texts: held.texts.size, beyond: held.printings - 1 }))
    .sort((left, right) => right.beyond * right.line.length - left.beyond * left.line.length);
  return {
    lines: shared.length,
    beyond: shared.reduce((sum, one) => sum + one.beyond, 0),
    chars: shared.reduce((sum, one) => sum + one.beyond * one.line.length, 0),
    text: shared.flatMap((one) => Array(one.beyond).fill(one.line)).join("\n"),
    shared,
  };
};

/* A read is priced only at the text measured: the flow a part was served under is on the read's own
   key, and a part served under another flow is another text. */
const pricedRead = (byKey, flow) => ([key, one]) => {
  const served = SERVED.exec(key)?.groups;
  const text = served && served.flow === flow ? byKey.get(served.part) : undefined;
  if (!text) return { key, ...one, unpriced: served?.flow === flow ? "no text this copy serves" : "another flow" };
  const perCall = Number.isInteger(text.tokens) ? text.tokens : null;
  return {
    key: served.part, ...one, perCall,
    spent: perCall === null ? null : perCall * one.calls,
    spentAgain: perCall === null ? null : perCall * (one.calls - one.runs),
  };
};

/** The guide parts a window read, priced at the texts measured, and the reads no text here prices. */
export const pricedParts = (guideParts, texts, flow) => {
  const byKey = new Map(texts.filter((one) => one.kind === GUIDE).flatMap((one) => one.keys.map((key) => [key, one])));
  const rows = guideParts.map(pricedRead(byKey, flow));
  const unpriced = rows.filter((one) => one.unpriced);
  return {
    priced: rows.filter((one) => !one.unpriced),
    unpriced: { reads: unpriced.reduce((sum, one) => sum + one.calls, 0), parts: unpriced.map((one) => [one.key, one.calls, one.unpriced]) },
  };
};

const summed = (values) => (values.every(Number.isInteger) ? values.reduce((sum, one) => sum + one, 0) : null);

/** The whole reading off texts already read and counted: rows, totals, repetition, and why a figure is missing. */
const readingOf = ({ texts, repeated, why, model, origin, parts = null }) => {
  const failed = texts.filter((one) => one.unmeasured);
  const totalWhy = why ?? (failed.length
    ? `${failed.length} of ${texts.length} text(s) could not be counted, first ${failed[0].name}: ${failed[0].unmeasured}`
    : null);
  return {
    model: why ? null : model,
    origin: why ? null : origin,
    unmeasured: totalWhy,
    texts: texts.map((one) => ({ name: one.name, kind: one.kind, chars: one.text.length,
      tokens: Number.isInteger(one.tokens) ? one.tokens : null, ...(one.unmeasured ? { unmeasured: one.unmeasured } : {}) })),
    chars: summed(texts.map((one) => (one.unread ? null : one.text.length))),
    tokens: totalWhy ? null : summed(texts.map((one) => one.tokens)),
    repeated: { lines: repeated.lines, beyond: repeated.beyond, chars: repeated.chars,
      tokens: Number.isInteger(repeated.tokens) ? repeated.tokens : null,
      ...(repeated.unmeasured ? { unmeasured: repeated.unmeasured } : {}),
      shared: repeated.shared.map(({ line, texts: many, beyond }) => ({ line, texts: many, beyond })) },
    parts,
  };
};

/* A text the walk could not read is a count not taken, and says so the way a failed count does. */
const counted = async (texts, count) => pooled(texts, async (one) => {
  if (one.unread) return { ...one, unmeasured: `not read: ${one.unread}` };
  return { ...one, ...(await count(one.text)) };
});

const partsFor = (options, texts) => {
  const directory = checkoutFrom(options.checkout, "stats surface");
  const { runs } = runsUnder(rootFor(directory), windowFrom(options.since, "stats surface"), classesFor(declaredIn(directory)));
  const flow = flowPinned().value;
  return { flow, runs: runs.length, ...pricedParts(profileOf(runs, declaredIn(directory)).guideParts, texts, flow) };
};

/** Walk, count and join: everything the CLI prints, with each outside reach passed in so a case can stand in for it. */
export const surfaceReading = async (options, reach = {}) => {
  const env = reach.env ?? process.env;
  const read = await readNodes(await (reach.nodes ?? surfaceNodes)(), process.cwd(), reach.read);
  const why = unmeasuredWhy({ model: options.model, key: env[KEY_VARIABLE] });
  const origin = originOf(env);
  const count = why ? null : counterFor({ model: options.model, key: env[KEY_VARIABLE], origin, fetchImpl: reach.fetch });
  const texts = count ? await counted(read, count) : read;
  const repeated = repetitionOf(texts);
  /* No printing past the first is nought tokens exactly, and the endpoint takes no empty message. */
  const spent = !count ? {} : repeated.text ? await count(repeated.text) : { tokens: 0 };
  const measured = readingOf({ texts, repeated: { ...repeated, ...spent }, why, model: options.model, origin });
  return { ...measured, parts: (reach.parts ?? partsFor)(options, texts) };
};

const figure = (value) => (value === null ? NOT_MEASURED : String(value));
const NAME_WIDTH = 46;

/* Where some texts were counted the model and origin still name those figures, whatever the total. */
const tokenLine = (held) => {
  if (held.model === null) return `tokens      ${NOT_MEASURED}: ${held.unmeasured}`;
  const against = `counted against ${held.model} at ${held.origin}, one request per text`;
  return held.unmeasured
    ? `tokens      ${NOT_MEASURED} in all: ${held.unmeasured}; every other figure ${against}`
    : `tokens      ${held.tokens} in all, ${against}`;
};

const headLines = (held) => [
  `The surface this copy serves an agent: ${held.texts.length} text(s), `
    + `${held.texts.filter((one) => one.kind === GUIDE).length} of them guide parts, ${figure(held.chars)} characters.`,
  tokenLine(held),
  `repeated    ${held.repeated.lines} line(s) printed by more than one text, ${held.repeated.beyond} printing(s) `
    + `past the first, ${held.repeated.chars} characters, ${figure(held.repeated.tokens)} tokens`,
];

const textRow = (one) => `  ${one.name.padEnd(NAME_WIDTH)}${String(one.chars).padStart(7)}${figure(one.tokens).padStart(14)}`;
const sharedRow = (one) => `  ${String(one.texts).padStart(5)}${String(one.beyond).padStart(8)}  ${one.line.slice(0, 96)}`;
const partRow = (one) => `  ${one.key.padEnd(34)}${String(one.calls).padStart(6)}${String(one.runs).padStart(6)}`
  + `${String(one.again).padStart(7)}${figure(one.perCall).padStart(14)}${figure(one.spent).padStart(14)}${figure(one.spentAgain).padStart(14)}`;

const block = (title, rows, line, all) => (rows.length ? ["", title, ...capped(rows, all).map(line), ...elided(rows, all)] : []);

const partLines = (parts, all) => {
  if (!parts.runs) return ["", "guide parts read  no issue-flow run in this window, so no read is priced"];
  return [
    ...block(`guide parts read over ${parts.runs} run(s), priced at this copy's ${parts.flow} text`
      + `\n  ${"part".padEnd(34)}${"calls".padStart(6)}${"runs".padStart(6)}${"again".padStart(7)}`
      + `${"tokens/call".padStart(14)}${"spent".padStart(14)}${"spent again".padStart(14)}`, parts.priced, partRow, all),
    `  ${parts.unpriced.reads} read(s) of ${parts.unpriced.parts.length} part(s) unpriced: served under another flow, `
      + "or not a text this copy serves",
  ];
};

/** The reading as the lines `forge stats surface` prints. */
export const surfaceLines = (held, all = false) => [
  ...headLines(held),
  ...block(`${"text".padEnd(NAME_WIDTH + 2)}${"chars".padStart(7)}${"tokens".padStart(14)}`,
    [...held.texts].sort((left, right) => right.chars - left.chars), textRow, all),
  ...block("lines printed by more than one text   texts  past the first", held.repeated.shared, sharedRow, all),
  ...partLines(held.parts, all),
];

export const printSurface = async (rest, reach = {}) => {
  const options = flags(rest, "stats surface", ["--json"], { usage: SURFACE_USAGE });
  const held = await surfaceReading(options, reach);
  if (options.json) return console.log(JSON.stringify(held, null, 2));
  for (const line of surfaceLines(held)) console.log(line);
  return null;
};
