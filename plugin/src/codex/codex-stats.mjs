/* What the log says about the harness rather than about the code it reviewed: how often a review
   ran out of calls, how often a recheck went looking instead of confirming, and what the rounds
   cost. A window before a change and a window after it is how a change to the harness is judged.
   docs/cli/codex-the-log.md. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { digest } from "./codex-api.mjs";
import { LOG_PATH, MARK, answered, logEntries, modelKey, numbered, scoreOf } from "./codex-log.mjs";
import { incompleteIn, newFindingsIn } from "./codex-plan.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";

const DEFAULT_WINDOW = 100;
const REPLAY_WINDOW = 30;
const KINDS = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"];

const counted = (raw, what, floor = 1) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < floor) fail(`codex: ${what} takes an integer of ${floor} or more, not \`${raw}\`.`);
  return value;
};

/* Unknown, never assumed: `--rounds` and `codex.rounds` were both settable before the budget was
   recorded, so calling an old row three would misclassify exactly the rate it is quoted for. What
   needs no assumption is the calls histogram, which is where the cap's signature shows anyway. */
const budgetOf = (row) => row.budget ?? row.cap ?? null;

/* Recomputed where the row predates the field: the predicate is one definition, so the same
   sentence is read the same way whichever side of the change wrote it. */
const wasIncomplete = (row) => (row.incomplete === undefined ? incompleteIn(row.reply) : row.incomplete);
const newFindingsOf = (row) =>
  (row.newFindings === undefined ? newFindingsIn(numbered(row.reply, row.files)) : row.newFindings);

export const windowOf = (entries, { last = DEFAULT_WINDOW, days, root } = {}) => {
  const since = days ? Date.now() - days * 86_400_000 : null;
  const own = answered(entries)
    .filter((one) => !root || one.root === root)
    .filter((one) => !since || (Date.parse(one.at) || 0) >= since);
  return since ? own : own.slice(-last);
};

const share = (many, of) => (of ? `${Math.round((many / of) * 100)}%` : "—");

/** The prompt a row ran at: the version and the digest of the text actually sent, so an edit nobody
 *  bumped for still separates two windows. */
const promptKey = (row) => (row.prompt ? `v${row.prompt.v} ${row.prompt.sha}` : "unversioned");

export const statsOf = (rows) => {
  const spent = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  const versions = new Map();
  const calls = new Map();
  const held = { consults: rows.length, budgeted: 0, atBudget: 0, incomplete: 0, retried: 0, rechecks: 0, raisedNew: 0, newFindings: 0 };
  for (const row of rows) {
    const budget = budgetOf(row);
    if (budget !== null) {
      held.budgeted += 1;
      if (row.retriedFrom !== undefined || (row.calls ?? 0) >= budget) held.atBudget += 1;
    }
    calls.set(row.calls ?? 0, (calls.get(row.calls ?? 0) ?? 0) + 1);
    if (wasIncomplete(row)) held.incomplete += 1;
    if ((row.attempt ?? 1) > 1) held.retried += 1;
    if (row.recheck) {
      held.rechecks += 1;
      const many = newFindingsOf(row);
      held.newFindings += many;
      if (many) held.raisedNew += 1;
    }
    for (const kind of KINDS) spent[kind] += row.usage?.[kind] ?? 0;
    const key = promptKey(row);
    versions.set(key, (versions.get(key) ?? 0) + 1);
  }
  const read = spent.cache_read_input_tokens;
  const sent = spent.input_tokens + read + spent.cache_creation_input_tokens;
  return {
    ...held,
    spent,
    sent,
    cached: sent ? read / sent : 0,
    versions: [...versions.entries()],
    calls: [...calls.entries()].sort((a, b) => a[0] - b[0]),
  };
};

const statLines = (held) => {
  const per = (many) => (held.consults ? Math.round(many / held.consults) : 0);
  return [
    `consults          ${held.consults}`,
    `calls reached     ${held.calls.map(([many, rows]) => `${many}:${rows}`).join("  ")}`,
    `ended at budget   ${held.atBudget} of the ${held.budgeted} that recorded one  `
      + `${share(held.atBudget, held.budgeted)}`,
    `said it could not check  ${held.incomplete}  ${share(held.incomplete, held.consults)}`,
    `retried at the ceiling   ${held.retried}  ${share(held.retried, held.consults)}`,
    `rechecks          ${held.rechecks}, ${held.raisedNew} raised a New finding `
      + `${share(held.raisedNew, held.rechecks)}, ${held.newFindings} of them in all`,
    `tokens per consult  ${per(held.spent.input_tokens)} in, ${per(held.spent.cache_read_input_tokens)} from cache, `
      + `${per(held.spent.cache_creation_input_tokens)} written, ${per(held.spent.output_tokens)} out`,
    `read from cache   ${Math.round(held.cached * 100)}% of ${held.sent} input token(s)`,
    ...held.versions.map(([name, many]) => `prompt ${name}  ${many} consult(s)`),
  ];
};

export const printStats = (rest) => {
  const { last, days, root, here } = flags(rest, "codex stats", ["--here"]);
  const asked = {
    last: last === undefined ? undefined : counted(last, "--last"),
    days: days === undefined ? undefined : counted(days, "--days"),
    root: here ? process.cwd() : root,
  };
  const rows = windowOf(logEntries(), asked);
  if (!rows.length) return console.log(`No answered consult in that window. ${LOG_PATH}`);
  const named = asked.days ? `the last ${asked.days} day(s)` : `the last ${asked.last ?? DEFAULT_WINDOW} consult(s)`;
  console.log(`${named}${asked.root ? ` in ${asked.root}` : ""}, ${rows[0].at} to ${rows.at(-1).at}\n`);
  for (const line of statLines(statsOf(rows))) console.log(line);
  console.log("\nWhether a reply could not check, and whether a recheck raised something New, are read "
    + "from the reply itself where the row predates the field, so both windows are counted the same way. "
    + "A budget cannot be recovered that way and is left unknown, which is what the calls line is for.");
};

/* What the cadence line points at: the last hundred answered consults against the hundred before
   them, so a harness upgrade is read off the log rather than off the feel of the next few consults.
   Every number is a column one of the two readers above already computes — a second copy would
   answer differently from `stats` the day either moved. It writes nothing.
   docs/cli/codex-the-log.md. */
export const evalWindows = (entries, size = MARK) => {
  const both = windowOf(entries, { last: size * 2 });
  const now = both.slice(-size);
  return { now, before: both.slice(0, both.length - now.length) };
};

/* Both dimensions in one key: it is what the issue asks the numbers per, and it is the only key
   under which `scoreOf` answers with exactly one row rather than re-splitting by effort inside. */
const keyOf = (row) => `${modelKey(row)}  prompt ${promptKey(row)}`;

const byKey = (rows) => {
  const held = new Map();
  for (const row of rows) held.set(keyOf(row), [...(held.get(keyOf(row)) ?? []), row]);
  return held;
};

/* The whole log's verdicts, not the window's: a verdict is written after the consult it scores and
   lands outside the window as often as in it. Scored on the window alone every model reads 0 kept,
   which looks like a log nobody ruled on rather than like a defect. */
const groupNumbers = (rows, verdicts) => ({ score: scoreOf([...verdicts, ...rows])[0], held: statsOf(rows) });

const WHEN = 7;

/* An absent measurement is said, never averaged as a zero: a group whose rows predate `usage` would
   otherwise read as the cheap window, which is the one mistake the comparison exists to avoid. */
const groupLines = (rows, verdicts, when) => {
  if (!rows.length) return [`  ${when.padEnd(WHEN)} not in this window`];
  const { score, held } = groupNumbers(rows, verdicts);
  const ruled = score.accepted + score.rejected;
  const timed = rows.filter((row) => row.ms !== undefined).length;
  const metered = rows.filter((row) => row.usage && Object.keys(row.usage).length).length;
  const per = (many) => Math.round(many / metered);
  const short = (many) => many < rows.length;
  return [
    `  ${when.padEnd(WHEN)} ${String(rows.length).padStart(3)} consult(s)  ${String(score.findings).padStart(4)} finding(s) `
      + `(${score.zero} found none)  ${ruled ? `${share(score.accepted, ruled)} kept of ${ruled} ruled` : "none ruled on"}  `
      + `${held.raisedNew} of ${held.rechecks} recheck(s) raised New  `
      + `${timed ? `${score.median}s median${short(timed) ? ` of the ${timed} timed` : ""}` : "none timed"}  `
      + `${held.incomplete} could not check`,
    metered
      ? `  ${" ".repeat(WHEN)} tokens/consult${short(metered) ? ` over the ${metered} that recorded usage` : ""}  `
        + `${per(held.spent.input_tokens)} in, `
        + `${per(held.spent.cache_read_input_tokens)} from cache, ${per(held.spent.cache_creation_input_tokens)} written, `
        + `${per(held.spent.output_tokens)} out`
      : `  ${" ".repeat(WHEN)} no consult here recorded what it spent`,
  ];
};

/* Four dimensions and not one: the slot stayed `codex` while the model behind it changed, and a
   comparison keyed on either alone names the wrong change or none. */
const DIMENSIONS = [
  ["slot", (row) => row.slot ?? "unrecorded"],
  ["model", (row) => row.model ?? "unrecorded"],
  ["prompt", promptKey],
  ["effort", (row) => row.effort ?? "unrecorded"],
];

/* Counted, not merely present: a window that went 99 low-effort to one has the same values in it, and
   "unchanged" is the one word that must not describe the mix these numbers are read against. Named
   and never called a cause either — `effort` is derived from a change's size, so a window that moved
   may have met bigger diffs rather than a new default. */
export const changedBetween = (now, before) => {
  const tally = (rows, of) => rows.reduce((held, row) => held.set(of(row), (held.get(of(row)) ?? 0) + 1), new Map());
  return DIMENSIONS.map(([name, of]) => {
    const here = tally(now, of);
    const there = tally(before, of);
    return {
      name,
      values: [...new Set([...there.keys(), ...here.keys()])]
        .map((value) => ({ value, now: here.get(value) ?? 0, before: there.get(value) ?? 0 }))
        .sort((a, b) => b.now - a.now || b.before - a.before),
    };
  });
};

const changedLine = ({ name, values }) =>
  `  ${name.padEnd(WHEN)} ${values.map((one) => `${one.value} ${one.before || "—"} → ${one.now || "—"}`).join(", ")}`;

const evalHead = (now, before) => {
  const span = (rows) => `${rows[0].at} to ${rows.at(-1).at}`;
  return [
    `the last ${now.length} answered consult(s)  ${span(now)}`
      + (now.length < MARK ? `  — ${MARK} is a full window and the log holds no more` : ""),
    before.length
      ? `the ${before.length} before them  ${span(before)}`
        + (before.length < MARK ? `  — the log does not reach a full ${MARK} further back` : "")
      : `no window before them: the log holds ${now.length} answered consult(s) in all, so there is `
        + "nothing yet to compare this one against.",
  ];
};

export const evalLines = (now, before, verdicts) => {
  const groups = [...new Set([...byKey(now).keys(), ...byKey(before).keys()])].sort();
  const nowBy = byKey(now);
  const beforeBy = byKey(before);
  return [
    ...evalHead(now, before),
    "",
    ...groups.flatMap((key) => [
      key,
      ...groupLines(nowBy.get(key) ?? [], verdicts, "now"),
      ...groupLines(beforeBy.get(key) ?? [], verdicts, "before"),
    ]),
    ...(before.length
      ? ["", "what separates the two windows, in consults before → now", ...changedBetween(now, before).map(changedLine)]
      : []),
    "",
    "Whether a reply could not check, and whether a recheck raised something New, are read from the "
      + "reply itself where the row predates the field, so the older window — which is the one likely "
      + "to predate a column — is counted the way the newer one is.",
  ];
};

export const printEval = (rest) => {
  if (rest.length) {
    fail(`codex: eval takes no arguments — it reads the last ${MARK} answered consults on this device `
      + `and the ${MARK} before them, over every project the log holds. \`forge codex stats\` is the one `
      + "that takes a window.");
  }
  const entries = logEntries();
  const { now, before } = evalWindows(entries);
  if (!now.length) return console.log(`No answered consult logged yet, so there is nothing to compare. ${LOG_PATH}`);
  const verdicts = entries.filter((one) => one.kind === "verdict");
  for (const line of evalLines(now, before, verdicts)) console.log(line);
};

const gitIn = (root, argv) => spawnSync("git", argv, { cwd: root, encoding: "utf8", maxBuffer: 1e8 });

/* The recorded sha is the digest of the file whole, before any clipping, so it is the one thing a
   checkout can be held to. Where the consult was anchored the diff is rebuilt too, base against
   head — sound only because a row that hashes clean had a clean tree, which is when the two agree. */
export const rebuiltFrom = (row) => {
  if (!row.head) return { why: "no commit recorded" };
  if (!existsSync(row.root)) return { why: "checkout gone" };
  const parts = [];
  for (const one of row.sent ?? []) {
    if (!one.sha) return { why: "no digest recorded" };
    const show = gitIn(row.root, ["show", `${row.head}:${one.rel}`]);
    if (show.status !== 0) return { why: "a sent file is not in the commit recorded", where: one.rel };
    if (digest(show.stdout) !== one.sha) return { why: "a sent file was dirty when it was sent", where: one.rel };
    const diff = row.anchoredTo ? gitIn(row.root, ["diff", "--no-color", row.anchoredTo, row.head, "--", one.rel]) : null;
    /* Status, not the text: a failed `git diff` answers with an empty stdout, and taking that for an
       empty diff would call an unreconstructable anchor a file that did not change. */
    if (diff && diff.status !== 0) return { why: "the base it was anchored to is gone", where: one.rel };
    parts.push({ rel: one.rel, text: show.stdout, chars: one.chars, sha: one.sha, clipped: Boolean(one.clipped), diff: diff ? diff.stdout : null });
  }
  /* Unrecorded is not "diffs": `send` was only written from this change on, and claiming a shape
     for a row that never carried one is the defect this verb exists to avoid. */
  if (!row.send) return { why: "the shape it was sent in was not recorded" };
  return parts.length ? { parts, sends: row.send, anchoredTo: row.anchoredTo ?? null } : { why: "nothing was sent" };
};

export const replayOf = (rows) => {
  const kept = [];
  const lost = new Map();
  for (const row of rows) {
    const held = rebuiltFrom(row);
    if (held.parts) kept.push({ row, ...held });
    else lost.set(held.why, { many: (lost.get(held.why)?.many ?? 0) + 1, where: lost.get(held.why)?.where ?? held.where });
  }
  return { kept, lost: [...lost.entries()].sort((a, b) => b[1].many - a[1].many) };
};

export const printReplay = (rest) => {
  const { prompt, last, root } = flags(rest, "codex replay");
  if (!prompt) fail("Usage: forge codex replay --prompt <file> [--last n] [--root path]");
  const candidate = (() => {
    try {
      return readFileSync(prompt, "utf8");
    } catch (error) {
      return fail(`codex: ${prompt} is not a readable file (${error.code ?? error.message}).`);
    }
  })();
  const rows = windowOf(logEntries(), { last: last === undefined ? REPLAY_WINDOW : counted(last, "--last"), root });
  const { kept, lost } = replayOf(rows);
  console.log(`candidate prompt  ${prompt}  ${candidate.length} chars, digest ${digest(candidate)}`);
  console.log(`window            ${rows.length} answered consult(s)`);
  console.log(`rebuildable       ${kept.length}`);
  for (const [why, held] of lost) console.log(`  not rebuilt     ${held.many}  ${why}${held.where ? `, such as ${held.where}` : ""}`);
  for (const { row, parts } of kept) {
    const made = numbered(row.reply, row.files).length;
    console.log(`  ${row.id ?? row.at}  ${row.head}  ${parts.length} file(s) sent as ${row.send}`
      + `${row.anchoredTo ? ` against ${row.anchoredTo}` : ""}, ${made} finding(s) at `
      + `${row.prompt ? `prompt v${row.prompt.v}` : "an unversioned prompt"}`);
  }
  if (kept.length < rows.length) {
    console.log(`\n${rows.length - kept.length} of ${rows.length} cannot be replayed: the log keeps each sent `
      + "file's digest and not its bytes, and a consult is run on a dirty tree by nature. Widen the window, "
      + "or compare prompt versions with `forge codex stats` over the rounds each one ran.");
  }
  if (kept.length) {
    console.log("\nWhat is rebuilt is each file's body, and the diff where the consult was anchored. The "
      + "replayed history a consult opened with is not: it was the log as it then stood, and the log has "
      + "grown since. A comparison here is of the review, not of the byte-identical request.");
  }
};
