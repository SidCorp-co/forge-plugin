/* `forge codex complexity`: one typed question to the second model — which of the ladder's five
   complexities the work an issue's body describes claims — proposed on a terminal line and written
   nowhere, and the measurement that says whether the proposal is worth reading. The rank and the
   transcript corpus are loaded where the verb runs and never at import, because every codex hook
   loads the verb table this sits in. docs/cli/codex-the-complexity.md. */
import { COMPLEXITY_NAMES, rungFrom } from "../../ladder.mjs";
import { median } from "../../stats/median.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags, partition } from "../../resolve/flags.mjs";
import { userConfig } from "../../resolve/config.mjs";
import { gateway, modelBehind } from "../../resolve/machine/stores.mjs";
import { HUMAN_REF, documentIdOf } from "../../tracker/issues.mjs";
import { scoped } from "../../tracker/rest.mjs";
import { askApi } from "../codex-api.mjs";
import { PROPOSAL, logConsult } from "../codex-log.mjs";
import { EFFORTS, defaultEffort, rungFor } from "../codex-plan.mjs";

const DATE_MARK = "<date>";
const COMPLEXITY_MARK = "<complexity>";

/* The ladder's names and never a list of this module's own, so a complexity added there is in the
   schema, the role and the redaction with no second edit (BR-09). */
const namesSaid = () => COMPLEXITY_NAMES.join(", ");

export const COMPLEXITY_TOOL = {
  name: "complexity",
  description: "The complexity the work this issue describes claims, one of this project's own five.",
  input_schema: {
    type: "object",
    properties: {
      complexity: { type: "string", enum: COMPLEXITY_NAMES, description: "One of the five, smallest first as the role lists them." },
      confidence: { type: "number", minimum: 0, maximum: 1,
        description: "Your own estimate, 0 to 1, of how likely this is the one a reader of the code would set." },
      why: { type: "string", description: "One sentence naming what in the body decided it." },
    },
    required: ["complexity", "why"],
  },
};

/* A span of time is redacted with a date because a literal reader turns "three weeks ago" into the same
   calendar a date is, and a written date with no year is still a date; a bare duration ("12h") is a
   measurement in the work and stays. A complexity is
   redacted only where a word names it as one — the field's own name, or the retired spellings a body
   written before docs/cli/the-kinds.md may still carry, kept in a pattern and never in a string a
   reader is handed — so a name standing as a word in prose is left alone. */
const MONTH = "(?:january|february|march|april|may|june|july|august|september|october|november|december"
  + "|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?";
const COUNT = "(?:\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|a few|few|many)";
const DATED = new RegExp([
  String.raw`\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b`,
  String.raw`\b${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?\b(?:,?\s+\d{4}\b)?`,
  String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}(?:\s+\d{4})?\b`,
  String.raw`\b${COUNT}\s+(?:hour|day|week|month|year)s?\s+(?:ago|old|back|earlier|later)\b`,
].join("|"), "giu");
const NAMED_AS_ONE = /\b(?:complexity|band|size|sized)\s*[:=]?\s*[`"']?/u;
const named = () => new RegExp(`${NAMED_AS_ONE.source}(?:${COMPLEXITY_NAMES.join("|")})\\b[\`"']?`, "giu");

export const redact = (text) => String(text ?? "").replace(DATED, DATE_MARK).replace(named(), COMPLEXITY_MARK);

/** The state the question is asked over: an allowlist, so a field the tracker grows never travels by
 *  default, with the two texts a person wrote redacted of dates, spans and complexities before they go. */
export const stateOf = (row) => ({
  key: String(row?.issueId ?? ""),
  title: redact(row?.title),
  category: String(row?.category ?? ""),
  body: redact(row?.description),
});

export const COMPLEXITY_ROLE = [
  "You are given one issue from a software project's tracker: its key, title, category and body. Answer by",
  "calling the `complexity` tool once, and say nothing else.",
  `The five complexities, smallest first, and the rung each claims in this project's contract: ${
    COMPLEXITY_NAMES.map((one) => `${one} a ${rungFrom(one)}`).join(", ")}.`,
  "Judge the work the body describes — how many files and modules it reaches, whether a test and a document",
  "travel with it, whether it changes a contract other code depends on — and not how urgent it is or how long",
  "it has waited.",
  `Where the text reads ${DATE_MARK}, a date or a span of time stood there and was removed so it would not`,
  `weigh; where it reads ${COMPLEXITY_MARK}, a complexity somebody once set stood there and was removed so it`,
  "would not lead. Judge as if neither had been written.",
  "`confidence` is your own estimate between 0 and 1 of how likely your answer is the one a reader of the code",
  "would set; `why` is one sentence naming what in the body decided it.",
].join("\n");

/* Typed, never judged: the one place a confidence is looked at asks what it is and not how big. */
const numberOrNull = (value) => (typeof value === "number" ? value : null);

/** The typed answer, or the refusal: the first `complexity` call's input, its value held to the ladder.
 *  A confidence is carried as given and null where none was — nought is an estimate and its absence is not. */
export const readAnswer = (calls = []) => {
  const call = calls.find((one) => one.name === COMPLEXITY_TOOL.name);
  if (!call) return { refused: "the model made no `complexity` call, so there is no proposal to read" };
  const { complexity: given, confidence, why } = call.input ?? {};
  if (!COMPLEXITY_NAMES.includes(given)) return { refused: `\`${given}\` is no complexity; they are ${namesSaid()}` };
  return { proposed: given, confidence: numberOrNull(confidence), why: String(why ?? "").trim() };
};

/* What the tracker holds, in the rank's own word for none: read here rather than from rank/score.mjs
   because that module walks the requirements tree at import and this one is loaded by every codex hook. */
const UNSET = "unset";
const trackerOf = (row) => (row?.complexity ? String(row.complexity) : UNSET);

/** One question, one log row under its own kind, whatever came back. `ask` and `log` are handed in so
 *  the suite asks a fake and logs to a list; the live pair is the consult's own. */
export const askComplexity = async (values, model, row, { effort, signal, ask = askApi, log = logConsult } = {}) => {
  const state = stateOf(row);
  const tracker = trackerOf(row);
  const started = Date.now();
  const record = { kind: PROPOSAL, at: new Date().toISOString(), model, effort: effort ?? null, key: state.key };
  let answer;
  try {
    answer = await ask(values, model, [{ role: "user", content: JSON.stringify(state) }],
      { tools: [COMPLEXITY_TOOL], choose: COMPLEXITY_TOOL.name, system: COMPLEXITY_ROLE, effort, signal });
  } catch (error) {
    const ms = Date.now() - started;
    log({ ...record, ms, ok: false, error: error.message });
    return { key: state.key, tracker, refused: error.message, ms };
  }
  const ms = Date.now() - started;
  const read = readAnswer(answer.calls);
  log({ ...record, ms, ok: true, usage: answer.usage, ...read });
  return { key: state.key, tracker, ...read, ms, usage: answer.usage ?? null };
};

/* Average ranks for ties, so two runs at one complexity share a rank rather than one of them taking the
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

const perName = (runs, field) => Object.fromEntries(COMPLEXITY_NAMES.map((one) => {
  const minutes = runs.filter((run) => run[field] === one).map((run) => run.minutes);
  const middle = median(minutes);
  return [one, { n: minutes.length, median: middle === null ? null : Math.round(middle) }];
}));

/* Lowercase `neither` throughout, so one sentence answers whichever way it went. The arms are compared
   on the figure printed, not the raw coefficient: a sentence claiming one ordered minutes more closely
   "(0.35 against 0.35)" is refuted by its own parenthesis. */
const closing = (tracker, proposed) => {
  if (tracker === null || proposed === null) {
    return "Too few shared runs, or no spread in one arm's complexities, for either to have ordered minutes.";
  }
  if (tracker <= 0 && proposed <= 0) {
    return `Both at or under nought (tracker ${figureOf(tracker)}, proposed ${figureOf(proposed)}), so neither ordered minutes.`;
  }
  const [said, saidProposed] = [figureOf(tracker), figureOf(proposed)];
  if (said === saidProposed) return `Equal at ${said}, so neither ordered minutes more closely than the other.`;
  return tracker > proposed
    ? `On the shared runs the tracker's complexity ordered minutes more closely (${said} against ${saidProposed}).`
    : `On the shared runs the proposed complexity ordered minutes more closely (${saidProposed} against ${said}).`;
};

/** Two orderings of the same runs' minutes, by the complexity the tracker holds and by the one proposed.
 *  Both coefficients run over one population — the runs whose issue holds a complexity — so the arms
 *  are judged on the same runs; the proposed arm over every run is coverage, printed apart. */
export const agreementOf = (runs) => {
  const shared = runs.filter((one) => COMPLEXITY_NAMES.includes(one.tracker));
  const unset = runs.length - shared.length;
  const rho = (set, field) => spearman(set.map((one) => [COMPLEXITY_NAMES.indexOf(one[field]), one.minutes]));
  const arms = {
    tracker: { n: shared.length, perName: perName(runs, "tracker"), rho: rho(shared, "tracker") },
    proposed: { n: runs.length, perName: perName(runs, "proposed"), rho: rho(shared, "proposed"), rhoAll: rho(runs, "proposed") },
  };
  const said = ["arm       complexity  runs  median"];
  for (const arm of ["tracker", "proposed"]) {
    for (const one of COMPLEXITY_NAMES) {
      const cell = arms[arm].perName[one];
      said.push(`${arm.padEnd(9)} ${one.padEnd(11)} ${String(cell.n).padStart(4)}  ${cell.median === null ? "—" : `${cell.median}m`}`);
    }
  }
  said.push(`${shared.length} run(s) hold a complexity on the tracker and rank both arms; ${unset} run(s) whose issue holds none, left out of both.`);
  said.push(`Spearman, complexity order against minutes, over those ${shared.length}: tracker ${figureOf(arms.tracker.rho)}, proposed ${figureOf(arms.proposed.rho)}.`);
  said.push(`Proposed over every run, the unset included: ${figureOf(arms.proposed.rhoAll)} over ${runs.length}.`);
  said.push(closing(arms.tracker.rho, arms.proposed.rho));
  return { shared: shared.length, unset, arms, said };
};

/* The profile's slots, by the name a person types: `haiku` for `ANTHROPIC_DEFAULT_HAIKU_MODEL`. */
const SLOT_KEY = /^ANTHROPIC_DEFAULT_([A-Z0-9_]+)_MODEL$/u;
const slotsIn = (values) => Object.keys(values ?? {})
  .map((key) => SLOT_KEY.exec(key)?.[1]?.toLowerCase())
  .filter(Boolean)
  .sort();

/** The model one question goes to, in the order a caller decides it: the flag for this run, the
 *  machine's `codex.complexityModel` for every run, and absent both the consult's own rung table and
 *  slot — what the verb did before the key existed. An id carries a slash and travels as typed; a bare
 *  word is a slot of the profile, refused with the slots the profile holds where it names none. */
export const modelOf = (values, effort, asked, codex = {}) => {
  const named = asked ?? codex.complexityModel;
  if (named === undefined || named === null || named === "") return rungFor(effort, modelBehind(values));
  const given = String(named).trim();
  if (given.includes("/")) return given;
  const behind = modelBehind(values, given.toLowerCase());
  if (!behind) {
    fail(`codex complexity: \`${given}\` is neither a gateway id nor a slot the profile holds; its slots are `
      + `${slotsIn(values).join(", ") || "none"}. Name an id with a slash in it, or one of those. Nothing was sent.`);
  }
  return behind;
};

export const COMPLEXITY_USAGE = [
  "Usage: forge codex complexity <ISS-nn>... [--model m] [--effort e] [--json]",
  "       forge codex complexity --measure [--since 3d] [--checkout <dir>] [--model m] [--effort e] [--json]",
  "One typed question to the second model per issue — which of the tracker's five complexities the work",
  "its body describes claims — answered through a tool whose only values are those five, and printed as a",
  "proposal beside the complexity the tracker holds. It writes nothing: a reader who agrees sets the field",
  "with `forge issue ISS-nn --set complexity=<value> --why <w>`. The model's confidence is printed as given",
  "and gates nothing; every date, span of time and complexity mention in the title and body is redacted",
  "before it travels, so the model reads the work and not the calendar.",
  "",
  "  --measure       ask once per issue with a recorded run, then rank those runs' minutes by the complexity",
  "                  the tracker holds and by the proposed one, Spearman over the same runs for both, and say which",
  "                  ordered minutes more closely — the figure that decides whether a proposal is worth a glance",
  "  --since 3d      only runs that ended inside the window; the whole corpus unless you say otherwise",
  "  --checkout dir  the tree whose past runs are read; the working directory unless you say otherwise",
  "  --model m       a gateway id as it is, or a slot of the profile; absent, `codex.complexityModel` in this",
  "                  machine's config, and absent that the consult's own model",
  "  --effort e      minimal | low | medium | high, for these questions only",
  "  --json          the proposals, or the measurement, as one object",
  "",
  "The gateway is the consult's; absent one this refuses with the same route. A model of this model's own",
  "family is not refused here: that refusal is a review's, where a same-family second opinion is an echo,",
  "and this verb reviews nothing. docs/cli/codex-the-complexity.md.",
].join("\n");

/** Every dependency the verb reaches, by name, and every one a reader: the suite hands a proxy that
 *  throws on any other name, which is how "writes nothing" is proved rather than promised. */
export const READERS = Object.freeze(["gateway", "model", "rowOf", "ask", "log", "runs"]);

/* What the verb reaches when it runs and the suite replaces whole; `runs` is where the heavy readers live. */
const live = () => ({
  gateway,
  model: (values, effort, asked) => modelOf(values, effort, asked, userConfig().codex ?? {}),
  rowOf: async (key) => scoped("forge_issues", { action: "get", documentId: await documentIdOf(key), fields: [] }),
  ask: askApi,
  log: logConsult,
  runs: async (checkout, since) => {
    const [{ measuredRuns }, { rootFor }] = await Promise.all([import("../../rank/cost.mjs"), import("../../stats/corpus/corpus.mjs")]);
    return measuredRuns(rootFor(checkout ?? process.cwd()), since);
  },
});

const WIDTH = 4;

/* Batched, not serial: a corpus of five hundred issues at seconds a question is the difference between
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
  return `${key}  proposed ${one.proposed}  tracker ${one.tracker}  confidence ${figureOf(one.confidence)}  ${one.why}`;
};

/* Keyed by the key asked, which is the one the caller joins on; a row the tracker will not give is that
   key's refusal, so one issue gone from the tracker costs the measure one run and not the rest. */
const askAll = async (keys, deps, values, model, effort) => {
  const held = await eachBatched(keys, async (key) => {
    let row;
    try {
      row = await deps.rowOf(key);
    } catch (error) {
      return [key, { key, tracker: UNSET, refused: error.message, ms: 0 }];
    }
    return [key, await askComplexity(values, model, row, { effort, ask: deps.ask, log: deps.log })];
  });
  return new Map(held);
};

/* Agreement is agreement and nothing more: the tracker's value was set by a reader nobody has measured,
   so a proposal that matches it more often has matched a reader, not a cost. The ordering figure above
   is the one about cost; this one is printed beside it and never folded into it. */
const agreementWith = (runs) => {
  const shared = runs.filter((one) => COMPLEXITY_NAMES.includes(one.tracker));
  return { agreed: shared.filter((one) => one.proposed === one.tracker).length, of: shared.length };
};

/* What one question cost, over every question asked, refused ones included in the seconds — a refusal
   was paid for — and left out of the tokens, which only an answer carries. */
const costOf = (answers) => {
  const tokens = answers.map((one) => one.usage?.input_tokens).filter((one) => typeof one === "number");
  const middleTokens = median(tokens);
  return {
    questions: answers.length,
    medianMs: median(answers.map((one) => one.ms ?? 0)) ?? 0,
    medianInputTokens: middleTokens === null ? null : Math.round(middleTokens),
  };
};

export const complexity = async (rest, deps = live()) => {
  const VERB = "codex complexity";
  const row = { verb: VERB, usage: COMPLEXITY_USAGE };
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
  if (!asked.measure && !keys.length) fail(`${VERB}: name an issue key, or pass --measure.\n${COMPLEXITY_USAGE}`);
  for (const key of keys) {
    if (!HUMAN_REF.test(key)) fail(`${VERB}: \`${key}\` is not an issue key. They read ISS and digits, as ISS-45. Nothing was sent.`);
  }
  const since = asked.measure ? (await import("../../stats/runs.mjs")).windowFrom(asked.since, `forge ${VERB}`) : null;
  const { problem, values, path } = deps.gateway();
  if (problem) fail(`codex: the question has no gateway to be sent to — ${problem}.`);
  const effort = asked.effort ?? defaultEffort();
  const model = deps.model(values, effort, asked.model);
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
  const runs = await deps.runs(asked.checkout, since);
  const distinct = [...new Set(runs.map((one) => one.key))];
  const held = await askAll(distinct, deps, values, model, effort);
  const paired = runs.map((one) => {
    const answer = held.get(one.key);
    return { key: one.key, minutes: one.minutes, tracker: answer?.tracker ?? UNSET, proposed: answer?.proposed ?? null };
  });
  const measured = paired.filter((one) => one.proposed !== null);
  const dropped = paired.length - measured.length;
  const reading = agreementOf(measured);
  const agreement = agreementWith(measured);
  const cost = costOf([...held.values()]);
  const out = { model, effort, runs: runs.length, issues: distinct.length, dropped, ...reading, agreement, cost };
  if (asked.json) return console.log(JSON.stringify(out, null, 2));
  console.log(`${runs.length} run(s) over ${distinct.length} issue(s), asked to ${model} at ${effort} effort`
    + `${dropped ? `; ${dropped} run(s) left out, their question refused` : ""}.`);
  for (const line of reading.said) console.log(line);
  console.log(`Agreement with the tracker on the ${agreement.of} shared run(s): ${agreement.agreed} of ${agreement.of}.`);
  console.log(`Per question: median ${(cost.medianMs / 1000).toFixed(1)}s, median ${cost.medianInputTokens ?? "—"} input tokens, `
    + `over ${cost.questions} question(s).`);
  return null;
};
