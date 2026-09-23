/* A subagent run as the harness recorded it, read back as pairs of call and result — docs/cli/stats.md. */
import { CLASSES, POLL, READY_CLASS, WHOLE_SET_CLASS, classOf } from "./classes.mjs";
import { NOTHING, logRead } from "../../hooks/log-reads.mjs";
import { quoting } from "../../hooks/shell-spans.mjs";
import { isHumanPrompt } from "../../hooks/transcripts.mjs";
import { RUNGS, highest } from "../../ladder.mjs";
import { stampedIn } from "../../flow/machine.mjs";

/* The brief, never the whole file: over raw text a transcript that had only GREPPED the words was admitted as a run, and the rung below is off a record for the same reason — docs/cli/stats.md. */
export const FLOW_BRIEF = /issue-flow/u;

const CONFIRMS = "forge record confirmation";
const CONFIRMED = "confirmation";

export const RUNG_UNKNOWN = "unknown";

/* A model id the host wrapped in angle brackets is a marker for a turn no model generated —
   `<synthetic>` is the one this corpus carries — so it names no arm and is dropped before the
   attribution rather than counted as a model nobody can dispatch to. */
const MARKER = /^<.*>$/u;
export const MODEL_MIXED = "mixed";
export const MODEL_NONE = "unattributed";

/* Two records the host writes beside the ones a call reads: `isCompactSummary` on a user record is
   the host losing what a run knew and carrying on under a written summary in its place, and
   `isApiErrorMessage` on an assistant record is a request that came back as an error rather than an
   answer — the latter always under the marker model, so it is already outside the token tally and
   never dilutes it. Neither is a call this plugin issued or refused, so neither belongs in the
   refusals listing or the other-errors line; both are counted apart, off the same pass — a run's
   *condition*, not what it spent — docs/cli/stats-the-condition.md. */

/* `isHumanPrompt`, imported rather than reimplemented, is that condition's third fact: a person
   present inside a run this harness dispatched, and never a call either. */
const compactSummary = (record) => record.message?.role === "user" && record.isCompactSummary === true;
const apiError = (record) => record.message?.role === "assistant" && record.isApiErrorMessage === true;

/** The four prices the API bills a request under, in the field names it writes them. All four or
 *  none: the measurement is the set, so a usage object short of one of them is not a smaller
 *  measurement, and a host that renames a field costs this reading its figure rather than reporting
 *  a harness that got cheaper — docs/cli/stats-the-cost.md. */
export const PRICES = {
  input: "input_tokens",
  cacheCreate: "cache_creation_input_tokens",
  cacheRead: "cache_read_input_tokens",
  output: "output_tokens",
};

const NAMES = Object.keys(PRICES);

const noTokens = () => ({
  ...Object.fromEntries(NAMES.map((name) => [name, 0])), requests: 0, unmeasured: 0,
});

const measured = (usage) => usage !== null && typeof usage === "object"
  && NAMES.every((name) => Number.isFinite(usage[PRICES[name]]));

/* One API response is several records, each repeating that response's usage: 24,598 assistant
   records over 11,757 distinct `message.id` on one transcript of this corpus, 12,841 of them
   repeating an id and no repeat disagreeing. Summed per record the figure reads 2.09 times what was
   billed, which looks entirely plausible. A record carrying no id is its own request, there being
   nothing to fold it into. */
const tally = (spent, message, counted) => {
  /* Eligibility before the id, so an unmeasured record cannot reserve one and drop the measured
     record that shares it: reserved first, the same two records read differently in either order.
     The count of records carrying none is per record and not per id, which is what it says. */
  if (!measured(message.usage)) {
    spent.unmeasured += 1;
    return;
  }
  const id = typeof message.id === "string" ? message.id : null;
  if (id !== null) {
    if (counted.has(id)) return;
    counted.add(id);
  }
  spent.requests += 1;
  for (const name of NAMES) spent[name] += message.usage[PRICES[name]];
};

/** Which model ran a whole run, off the models its assistant records name. Two real models is
 *  `MODEL_MIXED` and never the busier of them: a run two models generated is one neither answers for. */
export const modelRun = (models) => {
  const real = [...models.keys()].filter((name) => !MARKER.test(name));
  if (!real.length) return MODEL_NONE;
  return real.length === 1 ? real[0] : MODEL_MIXED;
};

const RETIRED_STAMP = "tier";

/* Which rung a whole run was worked at, off the records its writes posted and never off the output a class covers whole: docs/cli/the-rung-in-text.md. Named apart from `ladder.mjs`'s `rungOf`, which answers for one issue's fields where this reads a transcript, and `RUNG_UNKNOWN` is no rung of the ladder rather than its cheapest. Either stamp reads, so a transcript written before the record's field was renamed classifies at the rung it always did (ISS-822). */
export const rungRun = (calls) => {
  const said = calls
    .filter((call) => call.class === CONFIRMS)
    .map((call) => String(stampedIn(call.body ?? "", CONFIRMED, "rung")
      ?? stampedIn(call.body ?? "", CONFIRMED, RETIRED_STAMP) ?? "").trim().toLowerCase())
    .filter((one) => RUNGS.includes(one));
  /* The largest, which is the batch rule: a run of three issues is as heavy as its heaviest. */
  return said.length ? highest(said) : RUNG_UNKNOWN;
};

/* Text a command carries is not a command it ran: read as one, heredoc bodies named `npm run
   check` 423 times and `printf '%s\n' '; forge close ISS-45'` was a close that never happened.
   Which spans go back to a shell, and what an operator is struck to: docs/cli/stats.md. */
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1(?:[\s\S]*?^[ \t]*\2[ \t]*$|[\s\S]*)/gmu;
const OPERATOR = /[\n;|&(){}]/u;
const TEXT = new Set(["'", "#", "\\"]);
const RUNS = /(?:^|[\s;&|(){}])(?:\S*\/)?(?:ba|da|k|z|a)?sh\s+(?:(?:-\S+|[A-Za-z][\w-]*)\s+)*-[a-zA-Z]*c[a-zA-Z]*\s*$/u;
const SPENT = "\u0000";
const ENDS_A_WORD = /[\s;|&(){}<>]/u;

export const shellOf = (command) => {
  const text = command.replaceAll(HEREDOC, "<<");
  const said = [];
  const outer = [];
  let word = 0;
  let handed = false;
  let last = " ";
  for (const { at, one, under } of quoting(text)) {
    if (under === " ") {
      if (one === "(") {
        outer.push(text[at - 1] === "$" ? word : null);
        word = at + 1;
      } else if (one === ")") {
        const back = outer.pop();
        word = typeof back === "number" ? back : at + 1;
      } else if (ENDS_A_WORD.test(one)) word = at + 1;
    }
    if (under === "'" && last !== "'") handed = RUNS.test(text.slice(0, word));
    last = under;
    const ran = under === "'" ? handed : !TEXT.has(under);
    said.push(ran || !OPERATOR.test(one) ? one : SPENT);
  }
  return said.join("");
};

/* A poll is only in the order, so: off the same function `bash-guard.mjs` refuses with, forgetting
   where that gate forgets — one class here is one refusal there, and the third read is the recovery. */
const polled = (calls) => {
  let before = "";
  for (const call of calls) {
    const key = call.name === "Bash" ? logRead(call.command) : null;
    if (key && key === before) {
      call.class = POLL;
      before = "";
      continue;
    }
    if (key !== NOTHING) before = key ?? "";
  }
  return calls;
};

/* Off the class the call already has, so the two cannot disagree: no run writes a phase into its transcript. `after` is the phase that must have opened first, and the last row carries one because the method types a gap where the run met it and reads the knowledge store at phase 0, so without it either would take a run that landed nothing to the last phase; the row above it carries none, having once closed its own phase and left the rest of the transcript in this one (ISS-1714). The numbers are the method's, read off `PHASES`: this table said 5 for the ship where the contract says 5 for the proving, and a figure is only worth a phase both readings can name (ISS-700). */
export const MARKERS = [
  { phase: 1, classes: ["forge claim"] },
  { phase: 2, classes: ["forge record confirmation"] },
  { phase: 3, classes: ["forge record decision"] },
  { phase: 4, classes: ["forge record plan", "forge record criteria", "forge record baseline"] },
  { phase: 5, classes: [WHOLE_SET_CLASS], after: 4 },
  /* `only` books its own call and moves the run's phase for nothing after it: the method posts the note after the landing under one ship mode and before the ready checkpoint under the other, so a row that opened a segment measured the interval to whatever came next rather than the note (ISS-1583). */
  { phase: 6, classes: ["forge record note"], only: true },
  /* The three ways a change reaches production, which is what a landing is: a command the project
     declares, a checkpoint another actor lands, and — where the release reaches production on its
     own and the project commands nothing — the record that verifies the change where it now runs,
     which `ENDS_PHASE` already calls this phase's. Not the landing mark and not the `deploy` row:
     where the merge sits before the judging both fall in phases 4 and 5, and either as a marker
     would take those phases' calls into this one (ISS-1975). */
  { phase: 7, classes: ["ship", READY_CLASS, "forge record verification"] },
  { phase: 8, classes: ["cleanup", "forge record gap", "forge knowledge write"], after: 7 },
];

export const markerOf = (label) => MARKERS.find((row) => row.classes.includes(label)) ?? null;

/* A name that is not a string is what a change on the host's side looks like from here. */
const string = (value) => (typeof value === "string" ? value : "");

/** What a call carried, in characters of the model's own output. */
const sizeOf = (name, input) => {
  if (name === "Bash") return string(input?.command).length;
  if (name === "Edit") return string(input?.old_string).length + string(input?.new_string).length;
  if (name === "Write") return string(input?.content).length;
  return 0;
};

/** What a call asked for, in the words the caller wrote, for a reader that has to say what a run did
 *  rather than count it. `command` answers for `Bash` and is empty for every other tool, which
 *  leaves an `Edit` reading as the bare word `Edit` — a run that edited the wrong file and a run
 *  that edited the right one are then the same two characters. The size beside it is the measure and
 *  this is the subject; neither stands in for the other. Bounding it is the reader's, not this. */
const askedOf = (name, input) => {
  if (name === "Bash") return string(input?.command);
  const where = string(input?.file_path || input?.notebook_path || input?.path || input?.url);
  if (name === "Edit") return `${where}\n- ${string(input?.old_string)}\n+ ${string(input?.new_string)}`;
  if (name === "Write") return `${where}\n${string(input?.content)}`;
  /* Every part a call carried and never the first one found: a search names a pattern and a place,
     and read as alternatives two searches of one directory for different things came out the same. */
  const also = string(input?.prompt || input?.description || input?.query
    || input?.skill || input?.subagent_type || input?.old_string);
  return [string(input?.pattern), where, also].filter(Boolean).join("\n");
};

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "object" && part ? part.text ?? "" : "")).join(" ");
};

/** A transcript folded into its calls, the moments it ran between, the brief it opened with and what
 *  the API billed for it. The
 *  bounds are every record's: the opening prompt and the closing report are generation the run spent, and a window it belongs to. */
export const callsIn = (whole, classes = CLASSES) => {
  const uses = new Map();
  const results = new Map();
  const order = [];
  let firstAt = null;
  let lastAt = 0;
  let brief = "";
  const models = new Map();
  const spent = noTokens();
  const counted = new Set();
  let compactions = 0;
  let apiErrors = 0;
  let humanPrompts = 0;
  for (const line of whole.split("\n")) {
    if (!line.startsWith("{")) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const stamp = Date.parse(record.timestamp);
    if (record.message?.role === "assistant") {
      if (typeof record.message.model === "string") {
        models.set(record.message.model, (models.get(record.message.model) ?? 0) + 1);
      }
      /* A marker model is a turn no model generated, so it is no request and cannot dilute a
         per-request figure — the same test the attribution drops it by. Only that: a record the host
         named no model on was still billed, and the attribution's own guard is not the usage's. */
      if (!MARKER.test(String(record.message.model ?? ""))) tally(spent, record.message, counted);
      if (apiError(record)) apiErrors += 1;
    }
    if (compactSummary(record)) compactions += 1;
    if (isHumanPrompt(record)) humanPrompts += 1;
    if (!stamp) continue;
    if (firstAt === null) {
      firstAt = stamp;
      brief = textOf(record.message?.content);
    }
    lastAt = Math.max(lastAt, stamp);
    const content = record.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "tool_use") {
        const name = string(block.name) || "Bash";
        uses.set(block.id, { at: stamp, name, command: string(block.input?.command),
          asked: askedOf(name, block.input), size: sizeOf(name, block.input) });
        order.push(block.id);
      } else if (block?.type === "tool_result") {
        results.set(block.tool_use_id, { at: stamp, body: textOf(block.content), error: Boolean(block.is_error) });
      }
    }
  }
  const calls = polled(order.map((id) => {
    const use = uses.get(id);
    const result = results.get(id);
    const shell = use.name === "Bash" ? shellOf(use.command) : "";
    return {
      at: use.at,
      name: use.name,
      command: use.command,
      asked: use.asked,
      size: use.size,
      shell,
      class: classOf(use.name, shell, classes),
      answered: Boolean(result),
      /* Zero for a call that never returned, neither skipped nor stretched to the next: the hand
         profilers took one of the three each, and a run cut mid-gate is the common case. */
      wait: result ? Math.max(0, result.at - use.at) / 1000 : 0,
      endedAt: result ? result.at : use.at,
      body: result?.body ?? "",
      error: result?.error ?? false,
    };
  }));
  return {
    calls, brief, models, spent, compactions, apiErrors, humanPrompts, firstAt,
    lastAt: Math.max(lastAt, ...calls.map((one) => one.endedAt)),
  };
};
