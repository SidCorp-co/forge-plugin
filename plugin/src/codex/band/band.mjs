/* `forge codex band`: one typed question to the second model — which of the ladder's five complexities
   the work an issue's body describes claims — proposed on a terminal line and written nowhere, and the
   measurement that says whether the proposal is worth reading. docs/cli/codex-the-band.md. */
import { COMPLEXITY_NAMES, rungFrom } from "../../ladder.mjs";
import { complexityOf } from "../../rank/score.mjs";
import { measuredRuns } from "../../rank/cost.mjs";
import { median } from "../../stats/median.mjs";
import { rootFor } from "../../stats/corpus/corpus.mjs";
import { windowFrom } from "../../stats/runs.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags, partition } from "../../resolve/flags.mjs";
import { gateway, modelBehind } from "../../resolve/machine/stores.mjs";
import { HUMAN_REF, documentIdOf } from "../../tracker/issues.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { askApi } from "../codex-api.mjs";
import { BAND, logConsult } from "../codex-log.mjs";
import { EFFORTS, defaultEffort, rungFor } from "../codex-plan.mjs";

const DATE_MARK = "<date>";
const BAND_MARK = "<band>";

/* The ladder's names and never a list of this module's own, so a band added there is in the schema, the
   role and the redaction with no second edit (BR-09). */
const bandsSaid = () => COMPLEXITY_NAMES.join(", ");

export const BAND_TOOL = {
  name: "band",
  description: "The complexity band the work this issue describes claims, one of this project's own five.",
  input_schema: {
    type: "object",
    properties: {
      band: { type: "string", enum: COMPLEXITY_NAMES, description: "One band, smallest first as the role lists them." },
      confidence: { type: "number", minimum: 0, maximum: 1,
        description: "Your own estimate, 0 to 1, of how likely this band is the one a reader of the code would set." },
      why: { type: "string", description: "One sentence naming what in the body decided it." },
    },
    required: ["band", "why"],
  },
};

/* A span of time is redacted with a date because a literal reader turns "three weeks ago" into the same
   calendar a date is; a bare duration ("12h") is a measurement in the work and stays. A band is redacted
   only where a word names it as one, so a band name standing as a word in prose is left alone. */
const MONTH = "(?:january|february|march|april|may|june|july|august|september|october|november|december"
  + "|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?";
const COUNT = "(?:\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|a few|few|many)";
const DATED = new RegExp([
  String.raw`\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b`,
  String.raw`\b${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b`,
  String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}\s+\d{4}\b`,
  String.raw`\b${COUNT}\s+(?:hour|day|week|month|year)s?\s+(?:ago|old|back|earlier|later)\b`,
].join("|"), "giu");
const banded = () => new RegExp(String.raw`\b(?:complexity|band|size|sized)\s*[:=]?\s*(?:${COMPLEXITY_NAMES.join("|")})\b`, "giu");

export const redact = (text) => String(text ?? "").replace(DATED, DATE_MARK).replace(banded(), BAND_MARK);

/** The state the question is asked over: an allowlist, so a field the tracker grows never travels by
 *  default, with the two texts a person wrote redacted of dates, spans and bands before they go. */
export const stateOf = (row) => ({
  key: String(row?.issueId ?? ""),
  title: redact(row?.title),
  category: String(row?.category ?? ""),
  body: redact(row?.description),
});

export const BAND_ROLE = [
  "You are given one issue from a software project's tracker: its key, title, category and body. Answer by",
  "calling the `band` tool once, and say nothing else.",
  `The bands, smallest first, and the rung each claims in this project's contract: ${
    COMPLEXITY_NAMES.map((one) => `${one} a ${rungFrom(one)}`).join(", ")}.`,
  "Judge the work the body describes — how many files and modules it reaches, whether a test and a document",
  "travel with it, whether it changes a contract other code depends on — and not how urgent it is or how long",
  "it has waited.",
  `Where the text reads ${DATE_MARK}, a date or a span of time stood there and was removed so it would not`,
  `weigh; where it reads ${BAND_MARK}, a band somebody once set stood there and was removed so it would not`,
  "lead. Judge as if neither had been written.",
  "`confidence` is your own estimate between 0 and 1 of how likely the band is the one a reader of the code",
  "would set; `why` is one sentence naming what in the body decided it.",
].join("\n");

/* Typed, never judged: the one place a confidence is looked at asks what it is and not how big. */
const numberOrNull = (value) => (typeof value === "number" ? value : null);

/** The typed answer, or the refusal: the first `band` call's input, its band held to the ladder. A
 *  confidence is carried as given and null where none was — nought is an estimate and its absence is not. */
export const readAnswer = (calls = []) => {
  const call = calls.find((one) => one.name === BAND_TOOL.name);
  if (!call) return { refused: "the model made no `band` call, so there is no proposal to read" };
  const { band: given, confidence, why } = call.input ?? {};
  if (!COMPLEXITY_NAMES.includes(given)) return { refused: `\`${given}\` is no band; they are ${bandsSaid()}` };
  return { band: given, confidence: numberOrNull(confidence), why: String(why ?? "").trim() };
};

/** One question, one log row under its own kind, whatever came back. `ask` and `log` are handed in so
 *  the suite asks a fake and logs to a list; the live pair is the consult's own. */
export const askBand = async (values, model, row, { effort, signal, ask = askApi, log = logConsult } = {}) => {
  const state = stateOf(row);
  const hand = complexityOf(row);
  const started = Date.now();
  const record = { kind: BAND, at: new Date().toISOString(), model, effort: effort ?? null, key: state.key };
  let answer;
  try {
    answer = await ask(values, model, [{ role: "user", content: JSON.stringify(state) }],
      { tools: [BAND_TOOL], choose: BAND_TOOL.name, system: BAND_ROLE, effort, signal });
  } catch (error) {
    log({ ...record, ms: Date.now() - started, ok: false, error: error.message });
    return { key: state.key, hand, refused: error.message };
  }
  const read = readAnswer(answer.calls);
  log({ ...record, ms: Date.now() - started, ok: true, usage: answer.usage, ...read });
  return { key: state.key, hand, ...read };
};

/* Average ranks for ties, so two runs at one band share a rank rather than one of them taking the
   lower by the accident of order. */
const ranked = (values) => {
  const order = values.map((value, at) => [value, at]).sort((left, right) => left[0] - right[0]);
  const out = new Array(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end += 1;
    const rank = (start + end) / 2 + 1;
    for (let at = start; at <= end; at += 1) out[order[at][1]] = rank;
    start = end + 1;
  }
  return out;
};

/** Spearman's coefficient over `[x, y]` pairs; null under two pairs or where either side has no spread,
 *  since a set that cannot be ordered has no order to compare. */
export const spearman = (pairs) => {
  if (pairs.length < 2) return null;
  const left = ranked(pairs.map((one) => one[0]));
  const right = ranked(pairs.map((one) => one[1]));
  const mean = (list) => list.reduce((sum, one) => sum + one, 0) / list.length;
  const midLeft = mean(left);
  const midRight = mean(right);
  let across = 0;
  let squareLeft = 0;
  let squareRight = 0;
  for (let at = 0; at < left.length; at += 1) {
    across += (left[at] - midLeft) * (right[at] - midRight);
    squareLeft += (left[at] - midLeft) ** 2;
    squareRight += (right[at] - midRight) ** 2;
  }
  if (!squareLeft || !squareRight) return null;
  return across / Math.sqrt(squareLeft * squareRight);
};

/* One spelling for a figure that may be absent, the rank's dash for the absence. */
const figureOf = (value) => (value === null ? "—" : value.toFixed(2));
const figure = figureOf;

const perBand = (runs, field) => Object.fromEntries(COMPLEXITY_NAMES.map((one) => {
  const minutes = runs.filter((run) => run[field] === one).map((run) => run.minutes);
  const middle = median(minutes);
  return [one, { n: minutes.length, median: middle === null ? null : Math.round(middle) }];
}));

/* Lowercase `neither` throughout, so one sentence answers whichever way it went. */
const closing = (hand, proposed) => {
  if (hand === null || proposed === null) {
    return "Too few shared runs, or no spread in one arm's bands, for either to have ordered minutes.";
  }
  if (hand <= 0 && proposed <= 0) {
    return `Both at or under nought (hand ${figure(hand)}, proposed ${figure(proposed)}), so neither ordered minutes.`;
  }
  if (hand === proposed) return `Equal at ${figure(hand)}, so neither ordered minutes more closely than the other.`;
  return hand > proposed
    ? `On the shared runs the hand band ordered minutes more closely (${figure(hand)} against ${figure(proposed)}).`
    : `On the shared runs the proposed band ordered minutes more closely (${figure(proposed)} against ${figure(hand)}).`;
};

/** Two orderings of the same runs' minutes, by the band a person set and by the band proposed. Both
 *  coefficients run over one population — the runs whose issue holds a hand band — so the arms are
 *  judged on the same runs; the proposed arm over every run is coverage, printed apart. */
export const agreementOf = (runs) => {
  const shared = runs.filter((one) => COMPLEXITY_NAMES.includes(one.hand));
  const unset = runs.length - shared.length;
  const rho = (set, field) => spearman(set.map((one) => [COMPLEXITY_NAMES.indexOf(one[field]), one.minutes]));
  const arms = {
    hand: { n: shared.length, perBand: perBand(runs, "hand"), rho: rho(shared, "hand") },
    proposed: { n: runs.length, perBand: perBand(runs, "proposed"), rho: rho(shared, "proposed"), rhoAll: rho(runs, "proposed") },
  };
  const said = ["arm       band  runs  median"];
  for (const arm of ["hand", "proposed"]) {
    for (const one of COMPLEXITY_NAMES) {
      const cell = arms[arm].perBand[one];
      said.push(`${arm.padEnd(9)} ${one.padEnd(5)} ${String(cell.n).padStart(4)}  ${cell.median === null ? "—" : `${cell.median}m`}`);
    }
  }
  said.push(`${shared.length} run(s) hold a hand band and rank both arms; ${unset} run(s) whose issue holds no hand band, left out of both.`);
  said.push(`Spearman, band order against minutes, over those ${shared.length}: hand ${figure(arms.hand.rho)}, proposed ${figure(arms.proposed.rho)}.`);
  said.push(`Proposed over every run, the unbanded included: ${figure(arms.proposed.rhoAll)} over ${runs.length}.`);
  said.push(closing(arms.hand.rho, arms.proposed.rho));
  return { shared: shared.length, unset, arms, said };
};

export const BAND_USAGE = [
  "Usage: forge codex band <ISS-nn>... [--effort e] [--json]",
  "       forge codex band --measure [--since 3d] [--checkout <dir>] [--effort e] [--json]",
  "One typed question to the second model per issue — which of the tracker's five complexities the work",
  "its body describes claims — answered through a tool whose only values are those five, and printed as a",
  "proposal beside the band a person set. It writes nothing: a reader who agrees sets the field with",
  "`forge issue ISS-nn --set complexity=<band> --why <w>`. The model's confidence is printed as given and",
  "gates nothing; every date, span of time and band mention in the title and body is redacted before it",
  "travels, so the model reads the work and not the calendar.",
  "",
  "  --measure       ask once per issue with a recorded run, then rank those runs' minutes by the hand band",
  "                  and by the proposed band, Spearman over the same runs for both, and say which ordered",
  "                  minutes more closely — the figure that decides whether a proposal is worth a glance",
  "  --since 3d      only runs that ended inside the window; the whole corpus unless you say otherwise",
  "  --checkout dir  the tree whose past runs are read; the working directory unless you say otherwise",
  "  --effort e      minimal | low | medium | high, for these questions only",
  "  --json          the proposals, or the measurement, as one object",
  "",
  "The gateway and the model are the consult's; absent a gateway this refuses with the same route. A model",
  "of this model's own family is not refused here: that refusal is a review's, where a same-family second",
  "opinion is an echo, and this verb reviews nothing. docs/cli/codex-the-band.md.",
].join("\n");

/** Every dependency the verb reaches, by name, and every one a reader: the suite hands a proxy that
 *  throws on any other name, which is how "writes nothing" is proved rather than promised. */
export const READERS = Object.freeze(["gateway", "model", "rowOf", "ask", "log", "runs"]);

const live = () => ({
  gateway,
  model: (values, effort) => rungFor(effort, modelBehind(values)),
  rowOf: async (key) => scoped("forge_issues", { action: "get", documentId: await documentIdOf(key), fields: [] }),
  ask: askApi,
  log: logConsult,
  runs: (checkout, since) => measuredRuns(rootFor(checkout ?? process.cwd()), since),
});

const WIDTH = 4;

/* Batched, not serial: a corpus of three hundred issues at seconds a question is the difference between
   a coffee and an afternoon, and the gateway's own limit is far above four in flight. */
const eachBatched = async (items, work) => {
  const out = [];
  for (let at = 0; at < items.length; at += WIDTH) {
    out.push(...await Promise.all(items.slice(at, at + WIDTH).map(work)));
  }
  return out;
};

const proposalLine = (one, width) => {
  const key = one.key.padEnd(width);
  if (one.refused) return `${key}  refused: ${one.refused}`;
  return `${key}  proposed ${one.band}  hand ${one.hand}  confidence ${figureOf(one.confidence)}  ${one.why}`;
};

const askAll = async (keys, deps, values, model, effort) => {
  const held = await eachBatched(keys, async (key) => {
    const row = await deps.rowOf(key);
    return askBand(values, model, row, { effort, ask: deps.ask, log: deps.log });
  });
  return new Map(held.map((one) => [one.key, one]));
};

export const band = async (rest, deps = live()) => {
  const VERB = "codex band";
  const row = { verb: VERB, usage: BAND_USAGE };
  const { positionals, flagArgv } = partition(rest, ["--measure", "--json"], row);
  const asked = flags(flagArgv, VERB, ["--measure", "--json"], row);
  if (asked.effort !== undefined && !EFFORTS.includes(asked.effort)) {
    fail(`${VERB}: --effort takes ${EFFORTS.join(" | ")}, not \`${asked.effort}\`.`);
  }
  const keys = positionals.map((one) => one.trim().toUpperCase());
  if (asked.measure && keys.length) fail(`${VERB}: --measure reads the runs already recorded and takes no key. Nothing was sent.`);
  if (!asked.measure && (asked.since || asked.checkout)) {
    fail(`${VERB}: --since and --checkout narrow --measure and mean nothing without it. Nothing was sent.`);
  }
  if (!asked.measure && !keys.length) fail(`${VERB}: name an issue key, or pass --measure.\n${BAND_USAGE}`);
  for (const key of keys) {
    if (!HUMAN_REF.test(key)) fail(`${VERB}: \`${key}\` is not an issue key. They read ISS and digits, as ISS-45. Nothing was sent.`);
  }
  const since = asked.measure ? windowFrom(asked.since, `forge ${VERB}`) : null;
  const { problem, values, path } = deps.gateway();
  if (problem) fail(`codex: the question has no gateway to be sent to — ${problem}.`);
  const effort = asked.effort ?? defaultEffort();
  const model = deps.model(values, effort);
  if (!model) {
    fail(`${VERB}: no \`codex.rungs.${effort}\` and no model slot in ${path} names a model to ask. `
      + "Add a `codex.rungs` entry for that level, or map the slot in the profile.");
  }
  if (!asked.measure) {
    const held = await askAll(keys, deps, values, model, effort);
    const proposals = keys.map((key) => held.get(key));
    if (asked.json) return console.log(JSON.stringify({ model, effort, proposals }, null, 2));
    const width = Math.max(7, ...keys.map((key) => key.length));
    for (const one of proposals) console.log(proposalLine(one, width));
    return null;
  }
  const runs = deps.runs(asked.checkout, since);
  const distinct = [...new Set(runs.map((one) => one.key))];
  const held = await askAll(distinct, deps, values, model, effort);
  const paired = runs.map((one) => {
    const answer = held.get(one.key);
    return { key: one.key, minutes: one.minutes, hand: answer?.hand ?? complexityOf(null), proposed: answer?.band ?? null };
  });
  const measured = paired.filter((one) => one.proposed !== null);
  const dropped = paired.length - measured.length;
  const reading = agreementOf(measured);
  const out = { model, effort, runs: runs.length, issues: distinct.length, dropped, ...reading };
  if (asked.json) return console.log(JSON.stringify(out, null, 2));
  console.log(`${runs.length} run(s) over ${distinct.length} issue(s), asked to ${model} at ${effort} effort`
    + `${dropped ? `; ${dropped} run(s) left out, their question refused` : ""}.`);
  for (const line of reading.said) console.log(line);
  return null;
};
