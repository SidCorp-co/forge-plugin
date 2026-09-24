/* `forge codex log` and `forge codex verdict`: where a person reads the log back and writes what
   became of a review. This is the piece with no module above it, so it is the one that may import
   both the rows and the grammar, and the only import of it is the verb table's. docs/cli/codex-the-log.md. */
import { existsSync } from "node:fs";

import { jsonLines } from "../../hooks/log/hook-log-file.mjs";
import { NO_SESSION } from "../../resolve/config.mjs";
import { fail } from "../../resolve/settings.mjs";
import { flags, pullRepeated } from "../../resolve/flags.mjs";
import { DIAGNOSTIC, PROPOSAL, answered, byRun, hereOf, inRepo, isAnswered, logBytes, logConsult, logEntries, logPath, maskedDeep,
  pairedLog, runOf, verdictsBy } from "../codex-log.mjs";
import { budgetMs } from "../../resolve/settings.mjs";
import { countedIn, misreasonedSaid, recheckSaid, unverdicted, verdictRecord } from "./replies.mjs";

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
    const note = [entry.note, recheckSaid(entry)].filter(Boolean).join("  ");
    return `${entry.at}  verdict on ${entry.of}: ${entry.accepted} accepted${misreasonedSaid(entry)}, ${entry.rejected} rejected`
      + `${wroteIt(entry)}${note ? `  ${note}` : ""}`;
  }
  const answer = stored.ok ? `${(stored.reply ?? "").length}ch` : `failed: ${entry.error ?? "?"}`;
  const id = entry.id ? `${entry.id}  ` : "";
  /* A row of its own, because the rest of this line is a review's: a diagnostic reads runs rather
     than files, so the files line under it was blank and the head said `no commit` of a reading that
     is about no commit. What it answers for is the runs it was taken over and what came back. */
  if (entry.kind === DIAGNOSTIC) {
    const said = stored.ok
      ? `${entry.replyRead ? `${entry.findings ?? 0} finding(s)` : "the reply unread"}`
        + `${entry.leftOut ? `, ${entry.leftOut} citing no call of the set` : ""}`
      : answer;
    const head = `${id}${entry.at}  ${entry.model ?? "?"}  ${Math.round((entry.ms ?? 0) / 1000)}s  `
      + `diagnostic over ${(entry.runs ?? []).length} run(s)  ${said}${wroteIt(entry)}`;
    if (!full) return head;
    /* `--full` promises the entry whole, and for this kind the whole of it is which runs it read and
       what came back — the reply above all, since an unread one is the row somebody most wants to
       open. The runs stand in for the files a review names: it read runs and no file. */
    const over = `  runs   ${(entry.runs ?? []).map((one) => `${one.label}${one.issues?.length ? ` ${one.issues.join(",")}` : ""}`).join("  ")}`;
    return [head, over, "", entry.reply ?? entry.error ?? "", ""].join("\n");
  }
  /* A proposal row is about one issue and no file, so its line is the key and the complexity that came
     back; a refusal is the row's own — the answer was outside the ladder — and never a review's
     `failed`, which is the gateway's. `--full` opens the why, the one thing a person reading the log back wants. */
  if (entry.kind === PROPOSAL) {
    const came = stored.ok
      ? (entry.refused ? `refused: ${entry.refused}` : `-> ${entry.proposed}${typeof entry.confidence === "number" ? `  confidence ${entry.confidence}` : ""}`)
      : answer;
    const head = `${id}${entry.at}  ${entry.model ?? "?"}  ${Math.round((entry.ms ?? 0) / 1000)}s  `
      + `complexity ${entry.key ?? "?"}  ${came}${wroteIt(entry)}`.replace("  -> ", " -> ");
    return full ? [head, "", entry.why ?? entry.error ?? "", ""].join("\n") : head;
  }
  const at = entry.head ? `${entry.head}${entry.dirty ? "+dirty" : ""}` : "no commit";
  const served = entry.served?.length ? `  +${entry.served.length} served` : "";
  const counted = countedIn(stored.reply);
  const many = counted ? `  ${counted.total} finding(s)` : "";
  /* Absent and `none` are two facts, so they print differently: a row with no field at all was
     written before the round recorded what became of the declared check, and one reading `none` is a
     checkout that declared no command to run (ISS-1898). */
  const state = entry.check ? `  check ${entry.check}` : "";
  const head = `${id}${entry.at}  ${entry.model ?? entry.slot ?? "?"}  ${Math.round((entry.ms ?? 0) / 1000)}s  `
    + `${at}  ${answer}${many}${served}${state}${wroteIt(entry)}`;
  const files = `  files  ${(entry.files ?? []).join(" ")}`;
  if (!full) return `${head}\n${files}`;
  const check = entry.checkCommand ? `  check   ${entry.check}  ${entry.checkCommand}` : null;
  /* The bytes that were judged: a field with no reader is a field nobody can trust. */
  const sent = (entry.sent ?? [])
    .map((one) => `  ${one.sha ?? "?"}  ${String(one.chars ?? "?").padStart(6)}  ${one.rel}${one.clipped ? "  clipped" : ""}`
      + `${one.text ? "  text kept" : ""}${one.textOmitted ? `  text over ${one.textOmitted}` : ""}`)
    .join("\n");
  return [head, files, check, sent, "", entry.reply ?? entry.error ?? "", ""].filter((one) => one !== null).join("\n");
};

export const LOG_USAGE = [
  "Usage: forge codex log [--last n] [--id i] [--full]",
  "Past consults, newest last. What they found and what of it was kept, per model or prompt, is",
  "`forge codex stats --by model`.",
  "",
  "  --last n       how many print; the newest of them",
  "  --id i         one consult and its recheck, by the id the reply printed",
  "  --full         each entry whole rather than a line",
].join("\n");

/* Refused for one release rather than dropped as a stranger flag, so a recipe still typing it is
   told where its figures went: the window that reads every consult `--score` read is the log's
   whole count, `stats` reading every project's consults unless a checkout is named (ISS-349). */
const scoreMoved = (many) => "codex: `log --score` is `forge codex stats --by model` now, which prints the same "
  + "figures per model over a window, beside each model's rechecks, budget and retries. "
  + (many
    ? `Over every consult \`--score\` read: \`forge codex stats --by model --last ${many}\`.`
    : "The log holds no answered consult yet: `forge codex stats --by model`.");

/* `--id` and not `--last 1`: two consults in flight make "the last one" a race. */
export const printLog = (rest) => {
  if (rest.includes("--score")) fail(scoreMoved(answered(logEntries()).length));
  const { last, id, full } = flags(rest, "codex log", ["--full"], { usage: LOG_USAGE });
  const entries = pairedLog(logEntries());
  if (!entries.length) return console.log(`No consults logged yet. ${logPath()} appears on the first.`);
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
  'Usage: forge codex verdict --accepted F1,F3 --rejected F2=why [--misreasoned F4=why] [--note "why"] [--of <id>]',
  "What became of each finding, which is the half of an eval set only the caller holds. A recheck",
  "records one for what it refuted, and a commit waits for one. What you record here is yours: a",
  "recheck after it leaves it standing, reason and all, and says on its way out what it found instead.",
  "",
  "  --accepted F1,F3   the findings taken, right about what was wrong and about why; repeatable",
  "  --rejected F2=why  the findings turned down, each with its reason; repeatable",
  "  --misreasoned F4=why  the findings taken whose conclusion held and whose stated mechanism did",
  "                     not, each with what the mechanism got wrong; a commit reads them as accepted,",
  "                     and `forge codex eval` counts them apart from the ones right about both; repeatable",
  "  --note t           one line about the consult as a whole",
  "  --of <id>          the consult this verdict is about, any run's in this repository; without it,",
  "                     this run's open one in any worktree of the repository, and never another run's",
].join("\n");

const whose = (one) => `by ${one.run ?? "no run id"}`;

/* Where an answered consult outside this repository's reach was taken, and why it is out of reach: a row carrying its repository names another one, and a row from before rows carried it is reached from its own checkout alone. */
const whereSaid = (one) => {
  const root = one.root ?? "no checkout";
  if (one.repo) return `${root}, of the repository ${one.repo}`;
  const there = one.root && existsSync(one.root) ? `: \`cd ${one.root}\` and send it there` : ", which is gone";
  return `${root}, logged before a consult carried its repository, so reached from that checkout alone${there}`;
};

/* An id `--of` did not find in this repository, said by where it is instead: a refusal reading as though the id were unknown sent a run to the raw log for one it could see a line away (ISS-898). */
const missing = (of, entries, here) => {
  const elsewhere = answered(entries).filter((one) => one.id === of);
  if (elsewhere.length) {
    return `codex: consult ${of} is out of this repository's reach${here.repo ? ` (${here.repo})` : ""}; it answered in `
      + `${[...new Set(elsewhere.map(whereSaid))].join("; ")}.`;
  }
  const started = entries.some((one) => one.kind === "started" && one.id === of);
  return started
    ? `codex: consult ${of} started and never answered, so it made no findings to rule on.`
    : `codex: no answered consult in ${logPath()} carries the id ${of}; \`forge codex log --last 10\` lists the ones it holds.`;
};

/* The flagless form lands on this run's consult or on none: a verdict is a record, and one on another run's consult is corrected rather than removed, so refusing costs a retyped command where guessing cost a finding (ISS-898). */
const notOurs = (bytes, root, here, run) => {
  const open = unverdicted(bytes, root, { repo: here.repo });
  const who = run ?? "no run id";
  if (!open) return `codex: no consult by this run (${who}) has answered${root ? " in this repository" : ""} yet.`;
  const writer = jsonLines(bytes.toString("utf8")).findLast((one) => isAnswered(one) && (one.id ?? one.at) === open.id);
  return `codex: no consult by this run (${who}) has answered${root ? " in this repository" : ""}, and the open one, `
    + `${open.id} on ${open.files.join(", ")}, was written ${whose(writer ?? {})}. Where it is yours under another id: `
    + `\`forge codex verdict --of ${open.id} --accepted <ids> --rejected <id>=<why>\`.`;
};

/* The reply is half an eval set. Which findings survived contact with the work is the other half,
   and only the caller knows it — so it is recorded, not inferred. */
export const verdict = (rest, root) => {
  const { values: accepted, rest: r1 } = pullRepeated(rest, "--accepted", "codex verdict", { usage: VERDICT_USAGE });
  const { values: rejected, rest: r2 } = pullRepeated(r1, "--rejected", "codex verdict", { usage: VERDICT_USAGE });
  const { values: misreasoned, rest: r3 } = pullRepeated(r2, "--misreasoned", "codex verdict", { usage: VERDICT_USAGE });
  const { note, of } = flags(r3, "codex verdict", [], { usage: VERDICT_USAGE });
  if (!accepted.length && !rejected.length && !misreasoned.length && !note) fail(VERDICT_USAGE);
  /* This run's last consult in this repository that made findings and heard nothing back, not the
     last answer: after a converged recheck the last answer found nothing, and a verdict landed on it
     twice. Every worktree of the repository is one place here, and `--of` reaches any run's. */
  const bytes = logBytes();
  const entries = jsonLines(bytes.toString("utf8"));
  const here = hereOf(root);
  const local = answered(entries).filter((one) => !root || inRepo(one, here));
  const run = runOf();
  const own = local.filter((one) => byRun(one, run));
  const open = unverdicted(bytes, root, { repo: here.repo, run });
  const last = of
    ? local.findLast((one) => one.id === of)
    : open && own.find((one) => (one.id ?? one.at) === open.id) || own.at(-1);
  if (!last) fail(of ? missing(of, entries, here) : notOurs(bytes, root, here, run));
  const held = verdictRecord(last, {
    accepted: accepted.length ? accepted.join(",") : undefined,
    rejected: rejected.length ? rejected.join(",") : undefined,
    misreasoned: misreasoned.length ? misreasoned.join(",") : undefined,
    note,
  }, verdictsBy(entries).get(last.id ?? last.at) ?? null);
  if (held.problem) fail(`codex: ${held.problem}`);
  logConsult(held.record);
  console.log(`recorded against consult ${last.id ?? last.at} (${whose(last)}) on ${(last.files ?? []).join(", ")}`);
  if (held.undecided > 0) console.error(`codex: ${held.undecided} finding(s) undecided — say what happened to them.`);
};
