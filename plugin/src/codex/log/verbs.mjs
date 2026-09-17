/* `forge codex log` and `forge codex verdict`: where a person reads the log back and writes what
   became of a review. This is the piece with no module above it, so it is the one that may import
   both the rows and the grammar, and the only import of it is the verb table's. docs/cli/codex-the-log.md. */
import { jsonLines } from "../../hooks/log/hook-log-file.mjs";
import { NO_SESSION } from "../../resolve/config.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags, pullRepeated } from "../../resolve/flags.mjs";
import { answered, budgetMs, logBytes, logConsult, logEntries, logPath, maskedDeep, pairedLog, verdictsBy } from "../codex-log.mjs";
import { countedIn, scoreOf, unverdicted, verdictRecord } from "./replies.mjs";

const LOG_TAIL = 10;

/* Inside the budget it is in flight; past it, nothing is coming. Reading the second as the first
   is how a log stops being believed. */
export const startedState = (entry, now = Date.now()) => {
  const age = now - Date.parse(entry.at);
  return age <= budgetMs() ? `running for ${Math.round(age / 1000)}s` : "started and never reported back";
};

const countFrom = (raw, floor = 1, fallback = LOG_TAIL) => {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < floor) {
    fail(`Expected an integer of ${floor} or more, not \`${raw}\`.`);
  }
  return value;
};

const wroteIt = (entry) => {
  if (entry.run) return `  by ${entry.run} (${entry.runFrom ?? "?"})`;
  return entry.runFrom === NO_SESSION ? "  by no run id" : "";
};

export const logLine = (stored, full) => {
  const entry = maskedDeep(stored);
  if (entry.kind === "started") {
    return `${entry.id ? `${entry.id}  ` : ""}${entry.at}  ${startedState(entry)} `
      + `on ${(entry.files ?? []).join(" ")}${wroteIt(entry)}`;
  }
  if (entry.kind === "verdict") {
    const note = entry.note ? `  ${entry.note}` : "";
    return `${entry.at}  verdict on ${entry.of}: ${entry.accepted} accepted, ${entry.rejected} rejected`
      + `${wroteIt(entry)}${note}`;
  }
  const answer = stored.ok ? `${(stored.reply ?? "").length}ch` : `failed: ${entry.error ?? "?"}`;
  const id = entry.id ? `${entry.id}  ` : "";
  const at = entry.head ? `${entry.head}${entry.dirty ? "+dirty" : ""}` : "no commit";
  const served = entry.served?.length ? `  +${entry.served.length} served` : "";
  const counted = countedIn(stored.reply);
  const many = counted ? `  ${counted.total} finding(s)` : "";
  const head = `${id}${entry.at}  ${entry.model ?? entry.slot ?? "?"}  ${Math.round((entry.ms ?? 0) / 1000)}s  `
    + `${at}  ${answer}${many}${served}${wroteIt(entry)}`;
  const files = `  files  ${(entry.files ?? []).join(" ")}`;
  if (!full) return `${head}\n${files}`;
  /* The bytes that were judged: a field with no reader is a field nobody can trust. */
  const sent = (entry.sent ?? [])
    .map((one) => `  ${one.sha ?? "?"}  ${String(one.chars ?? "?").padStart(6)}  ${one.rel}${one.clipped ? "  clipped" : ""}`
      + `${one.text ? "  text kept" : ""}${one.textOmitted ? `  text over ${one.textOmitted}` : ""}`)
    .join("\n");
  return [head, files, sent, "", entry.reply ?? entry.error ?? "", ""].filter((one) => one !== null).join("\n");
};

const scoreLine = (row) =>
  `${row.model.padEnd(24)} ${String(row.consults).padStart(4)} consults  ${String(row.findings).padStart(4)} findings `
  + `(${row.zero} none)  ${String(row.accepted).padStart(4)} accepted  ${String(row.rejected).padStart(3)} rejected  `
  + `${String(row.median).padStart(4)}s median  ${row.input ? Math.round((row.cached / row.input) * 100) : 0}% cached`;

export const LOG_USAGE = [
  "Usage: forge codex log [--last n] [--id i] [--full] [--score]",
  "Past consults, for scoring the advice later.",
  "",
  "  --last n       how many print; the newest of them",
  "  --id i         one consult and its recheck, by the id the reply printed",
  "  --full         each entry whole rather than a line",
  "  --score        per model instead: consults, findings, what was kept, time, cache",
].join("\n");

/* `--id` and not `--last 1`: two consults in flight make "the last one" a race. */
export const printLog = (rest) => {
  const { last, id, full, score } = flags(rest, "codex log", ["--full", "--score"], { usage: LOG_USAGE });
  const entries = pairedLog(logEntries());
  if (!entries.length) return console.log(`No consults logged yet. ${logPath()} appears on the first.`);
  if (score) {
    for (const row of scoreOf(entries)) console.log(scoreLine(row));
    return;
  }
  if (id) {
    const held = entries.filter((one) => one.id === id || one.of === id);
    if (!held.length) fail(`codex: no consult logged as ${id}.`);
    for (const entry of held) console.log(logLine(entry, full));
    return;
  }
  for (const entry of entries.slice(-countFrom(last))) console.log(logLine(entry, full));
  console.log(`\n${entries.length} logged; ${logPath()}`);
};

export const VERDICT_USAGE = [
  'Usage: forge codex verdict --accepted F1,F3 --rejected F2=why [--note "why"] [--of <id>]',
  "What became of each finding, which is the half of an eval set only the caller holds. A recheck",
  "records one for what it refuted, and a commit waits for one.",
  "",
  "  --accepted F1,F3   the findings taken; repeatable",
  "  --rejected F2=why  the findings turned down, each with its reason; repeatable",
  "  --note t           one line about the consult as a whole",
  "  --of <id>          the consult this verdict is about, where it is not the open one",
].join("\n");

/* The reply is half an eval set. Which findings survived contact with the work is the other half,
   and only the caller knows it — so it is recorded, not inferred. */
export const verdict = (rest, root) => {
  const { values: accepted, rest: r1 } = pullRepeated(rest, "--accepted", "codex verdict", { usage: VERDICT_USAGE });
  const { values: rejected, rest: r2 } = pullRepeated(r1, "--rejected", "codex verdict", { usage: VERDICT_USAGE });
  const { note, of } = flags(r2, "codex verdict", [], { usage: VERDICT_USAGE });
  if (!accepted.length && !rejected.length && !note) fail(VERDICT_USAGE);
  /* This repository's last consult that made findings and heard nothing back, not the last answer:
     after a converged recheck the last answer found nothing, and a verdict landed on it twice. */
  const bytes = logBytes();
  const entries = jsonLines(bytes.toString("utf8"));
  const own = answered(entries).filter((one) => !root || one.root === root);
  const open = unverdicted(bytes, root);
  const last = of
    ? own.find((one) => one.id === of)
    : open && own.find((one) => one.id === open.id) || own.at(-1);
  if (!last) fail(of ? `codex: no consult ${of} has answered here.` : `codex: no consult has answered${root ? " for this repository" : ""} yet.`);
  const held = verdictRecord(last, {
    accepted: accepted.length ? accepted.join(",") : undefined,
    rejected: rejected.length ? rejected.join(",") : undefined,
    note,
  }, verdictsBy(entries).get(last.id ?? last.at) ?? null);
  if (held.problem) fail(`codex: ${held.problem}`);
  logConsult(held.record);
  console.log(`recorded against consult ${last.id ?? last.at} on ${(last.files ?? []).join(", ")}`);
  if (held.undecided > 0) console.error(`codex: ${held.undecided} finding(s) undecided — say what happened to them.`);
};
