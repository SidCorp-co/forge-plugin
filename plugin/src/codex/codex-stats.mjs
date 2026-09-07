/* What the log says about the harness rather than about the code it reviewed: how often a review
   ran out of calls, how often a recheck went looking instead of confirming, and what the rounds
   cost. A window before a change and a window after it is how a change to the harness is judged.
   docs/cli/codex-the-log.md. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

import { DIFF_CHARS, digest } from "./codex-api.mjs";
import { MARK, answered, logEntries, logPath, modelKey, numbered, scoreOf } from "./codex-log.mjs";
import { gitRootOf } from "./codex-tools.mjs";
import { incompleteIn, newFindingsIn } from "./codex-plan.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags } from "../resolve/flags.mjs";
import { WHEN, comparedWindows, groupBy, shiftBetween, shiftLine, tallied, twoWindows } from "../stats/windows.mjs";
import { CONSULTS, againstIn, heldAtMark, markLines, marksOf, resolveAgainst, writeMark, wroteSaid } from "../stats/marks.mjs";

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

/** The prompt a row ran at: the version and the digest of the text actually sent, so an edit nobody bumped for still separates two windows. */
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
  const { last, days, root, here } = flags(rest, "codex stats", ["--here"], { usage: STATS_USAGE });
  const asked = {
    last: last === undefined ? undefined : counted(last, "--last"),
    days: days === undefined ? undefined : counted(days, "--days"),
    root: here ? process.cwd() : root,
  };
  const rows = windowOf(logEntries(), asked);
  if (!rows.length) return console.log(`No answered consult in that window. ${logPath()}`);
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
   answer differently from `stats` the day either moved. The crossing writes the comparison once and
   `--against` reads it back as the before window — docs/cli/stats-the-eval.md. */
export const evalWindows = (entries, size = MARK) => {
  const own = answered(entries);
  return { ...twoWindows(own, size), total: own.length };
};

/* Both dimensions in one key: it is what the issue asks the numbers per, and it is the only key
   under which `scoreOf` answers with exactly one row rather than re-splitting by effort inside. */
const keyOf = (row) => `${modelKey(row)}  prompt ${promptKey(row)}`;

const byKey = (rows) => groupBy(rows, keyOf);

/* The whole log's verdicts, not the window's: a verdict is written after the consult it scores and
   lands outside the window as often as in it. Scored on the window alone every model reads 0 kept,
   which looks like a log nobody ruled on rather than like a defect. */
const groupNumbers = (rows, verdicts) => ({ score: scoreOf([...verdicts, ...rows])[0], held: statsOf(rows) });

/* An absent measurement is said, never averaged as a zero: a group whose rows predate `usage` would
   otherwise read as the cheap window, which is the one mistake the comparison exists to avoid. */
/* How many rows a figure stands on: a median over the timed rows and tokens over the metered ones. */
const coverageOf = (rows) => ({
  timed: rows.filter((row) => row.ms !== undefined).length,
  metered: rows.filter((row) => row.usage && Object.keys(row.usage).length).length,
});

const groupLines = (group, when) => {
  if (!group) return [`  ${when.padEnd(WHEN)} not in this window`];
  const { score, stats: held, timed, metered } = group;
  const ruled = score.accepted + score.rejected;
  const per = (many) => Math.round(many / metered);
  const short = (many) => many < group.consults;
  return [
    `  ${when.padEnd(WHEN)} ${String(group.consults).padStart(3)} consult(s)  ${String(score.findings).padStart(4)} finding(s) `
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
   may have met bigger diffs rather than a new default. Off each window's own tally, since a group's
   key folds slots and efforts together and a stored window has no rows to ask. */
export const changedBetween = (now, before) => shiftBetween(now.mix, before.mix);

const evalHead = (held) => {
  const { now, before } = held;
  const span = (window) => `${window.from} to ${window.to}`;
  const first = `the last ${now.consults} answered consult(s)  ${span(now)}`
    + (now.consults < MARK ? `  — ${MARK} is a full window and the log holds no more` : "");
  if (!before) {
    return [first, `no window before them: the log holds ${now.consults} answered consult(s) in all, so there is `
      + "nothing yet to compare this one against."];
  }
  if (held.against !== undefined) {
    return [first, heldAtMark(before.consults, held.against, span(before), now.from <= before.to)];
  }
  return [first, `the ${before.consults} before them  ${span(before)}`
    + (before.consults < MARK ? `  — the log does not reach a full ${MARK} further back` : "")];
};

/** The screen, off the object `--json` prints: one reader for a live before and a stored one. */
export const evalLines = (held) => {
  const { now, before } = held;
  const byKeyOf = (window) => new Map((window?.groups ?? []).map((group) => [group.key, group]));
  const nowBy = byKeyOf(now);
  const beforeBy = byKeyOf(before);
  const groups = [...new Set([...nowBy.keys(), ...beforeBy.keys()])].sort();
  return [
    ...evalHead(held),
    "",
    ...groups.flatMap((key) => [key, ...groupLines(nowBy.get(key), "now"), ...groupLines(beforeBy.get(key), "before")]),
    ...(before
      ? ["", "what separates the two windows, in consults before → now", ...held.shifts.map((shift) => shiftLine(shift))]
      : []),
    "",
    "Whether a reply could not check, and whether a recheck raised something New, are read from the "
      + "reply itself where the row predates the field, so the older window — which is the one likely "
      + "to predate a column — is counted the way the newer one is.",
  ];
};

export const MARKS_USAGE = [
  "Usage: forge codex marks",
  "The readings held on this device, one line each, newest first.",
].join("\n");

export const STATS_USAGE = [
  "Usage: forge codex stats [--last n] [--days n] [--root p] [--here]",
  "What the harness did over a window: calls against their budget, replies that could not check,",
  "rechecks that raised something New, tokens by kind, and the prompt versions that ran.",
  "",
  "  --last n       consults back from the newest",
  "  --days n       consults inside that many days instead",
  "  --root p       the checkout whose consults are read; every one the log holds unless you say",
  "  --here         the working directory as that checkout",
].join("\n");

export const REPLAY_USAGE = [
  "Usage: forge codex replay --prompt <file> [--last n] [--root p]",
  "Which of a window a candidate prompt could be scored against: the bytes wherever a commit or the",
  "record still proves them, and a row refused with its reason where nothing does.",
  "",
  "  --prompt <file>  the candidate prompt to score",
  "  --last n         consults back from the newest",
  "  --root p         the checkout whose consults are read",
].join("\n");

export const EVAL_USAGE = [
  "Usage: forge codex eval [--against [<mark>]] [--json]",
  `The last ${MARK} answered consults on this device against the ${MARK} before them, over every project`,
  "the log holds, per model, effort and prompt. The consult that crosses a hundred-mark writes the",
  "comparison once, and --against puts that reading in the before window's place. `forge codex stats`",
  "takes a window.",
  "",
  "  --against [<mark>]  the reading held at that mark as the before window, or the newest held",
  "  --json              the comparison alone, one object, in the outer shape `forge stats eval --json` prints",
].join("\n");

/* One group per key, its rows' own figures: the same numbers the screen prints, under one spelling
   each, so a reader that parses it and a reader of the screen quote the same window (ISS-484). */
const groupObject = (rows, verdicts) => {
  const { score, held } = groupNumbers(rows, verdicts);
  const [row] = rows;
  return {
    key: keyOf(row),
    slot: row.slot ?? "unrecorded",
    model: row.model ?? "unrecorded",
    prompt: promptKey(row),
    effort: row.effort ?? "unrecorded",
    consults: rows.length,
    ...coverageOf(rows),
    score,
    stats: held,
  };
};

/* The bounds and the mix are written while the rows are there: a stored window has none. */
export const windowObject = (rows, verdicts) => ({
  consults: rows.length,
  from: rows[0]?.at ?? null,
  to: rows.at(-1)?.at ?? null,
  stats: statsOf(rows),
  mix: tallied(rows, DIMENSIONS),
  groups: [...byKey(rows).values()].map((group) => groupObject(group, verdicts)),
});

/** The comparison in the outer shape `stats eval --json` prints (`evalRuns` in stats/eval.mjs). */
export const compared = (now, before, verdicts, total, against = null) => comparedWindows({
  size: MARK,
  total,
  against,
  now: windowObject(now, verdicts),
  before: against ? against.now : before.length ? windowObject(before, verdicts) : null,
  separates: changedBetween,
});

export const evalObject = (entries, against = null) => {
  const { now, before, total } = evalWindows(entries);
  return compared(now, before, entries.filter((one) => one.kind === "verdict"), total, against);
};

/** What the consult that crossed a mark says, having written the reading once: the log as it stood
 *  when that consult landed, so one finishing just behind it is not in the window the mark names. */
export const crossingSaid = ({ mark, at, said, entries }) => {
  const wrote = writeMark({ kind: CONSULTS, mark, at: new Date().toISOString(), ...evalObject(entries.slice(0, at + 1)) });
  return `${said} ${wroteSaid(wrote, mark, "forge codex eval")}`;
};

const WINDOW_FLAGS = ["--last", "--days", "--root", "--here"];
const WRITES = "the consult that brings the log to a multiple of a hundred answered consults writes one";

export const printEval = (argv) => {
  const { against, rest } = againstIn(argv, "codex eval");
  if (rest.some((one) => WINDOW_FLAGS.includes(one))) {
    fail(`codex: eval takes no window — it reads the last ${MARK} answered consults on this device `
      + `and the ${MARK} before them, over every project the log holds. \`forge codex stats\` is the one `
      + "that takes a window.");
  }
  const { json } = flags(rest, "codex eval", ["--json"], { usage: EVAL_USAGE });
  const stored = against === undefined ? null
    : resolveAgainst(CONSULTS, against, { verb: "codex eval", list: "forge codex marks", writes: WRITES });
  const held = evalObject(logEntries(), stored);
  if (json) return console.log(JSON.stringify(held, null, 2));
  if (!held.now.consults) return console.log(`No answered consult logged yet, so there is nothing to compare. ${logPath()}`);
  for (const line of evalLines(held)) console.log(line);
};

/** `forge codex marks`: the device's consult readings, as `stats marks` lists a project's runs. */
export const printMarks = (rest) => {
  flags(rest, "codex marks", [], { usage: MARKS_USAGE });
  const held = marksOf(CONSULTS);
  if (!held.length) return console.log(`No reading is held on this device yet; ${WRITES}.`);
  for (const line of markLines(held, (one) => `${String(one.now.consults).padStart(3)} consult(s)  ${one.now.from} to ${one.now.to}`)) console.log(line);
};

const gitIn = (root, argv) => spawnSync("git", argv, { cwd: root, encoding: "utf8", maxBuffer: 1e8 });

const NEAR_COMMITS = 10;
const MODE_LINE = /^(?:old|new) mode /mu;

/** Where a sent file's bytes provably are: the recorded commit, else the nearest commit after it holding a blob that hashes to the recorded digest, which is the whole proof — whichever commit answers it holds the bytes that were sent (ISS-531). */
const heldAt = (root, head, one) => {
  const at = gitIn(root, ["show", `${head}:${one.rel}`]);
  if (at.status === 0 && digest(at.stdout) === one.sha) return { commit: head, text: at.stdout, recorded: true };
  /* Every ref rather than this checkout's HEAD, since which checkout answered decides what HEAD is and the bytes are wherever they are; ordered on commit time, because a rebased-away head leaves the whole default branch in that range and the oldest of it is not the commit after the consult. */
  const since = Number(gitIn(root, ["show", "-s", "--format=%ct", head]).stdout.trim()) || 0;
  const walked = gitIn(root, ["log", "--format=%H%x09%ct", "--all", "--not", head, "--", one.rel]);
  const near = (walked.status === 0 ? walked.stdout.trim().split("\n").filter(Boolean) : [])
    .map((line) => line.split("\t"))
    .filter(([, when]) => Number(when) >= since)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .slice(0, NEAR_COMMITS);
  for (const [commit] of near) {
    const show = gitIn(root, ["show", `${commit}:${one.rel}`]);
    if (show.status === 0 && digest(show.stdout) === one.sha) return { commit, text: show.stdout, recorded: false };
  }
  return null;
};

/** The sent diff was the anchor against the WORKING TREE (`changedIn`) and `git diff` compares blobs, so the commit holding the sent bytes yields the same hunks. Two things that cannot prove, and both refuse the row: a path absent at the anchor was shown as an addition patch or as NEW FILE and the record does not say which; a mode header means the sides differ in mode, and the mode of the tree that was diffed is recorded nowhere. */
const diffFor = (root, row, one, commit) => {
  if (!row.anchoredTo) return { text: null };
  if (!commit.recorded && gitIn(root, ["cat-file", "-e", `${row.anchoredTo}:${one.rel}`]).status !== 0) {
    return { why: "a sent file was not in the base it was anchored to, so a new file and a changed one cannot be told apart" };
  }
  const diff = gitIn(root, ["diff", "--no-color", row.anchoredTo, commit.commit, "--", one.rel]);
  /* Status, not the text: a failed `git diff` answers with an empty stdout, and taking that for an
     empty diff would call an unreconstructable anchor a file that did not change. */
  if (diff.status !== 0) return { why: "the base it was anchored to is gone" };
  if (MODE_LINE.test(diff.stdout)) return { why: "a sent file's mode changed, and the mode of the tree that was diffed is not recorded" };
  /* Trimmed and clipped as `changedIn` does it, so this is the text the reviewer was given. */
  const text = diff.stdout.trim();
  return { text: text.slice(0, DIFF_CHARS) };
};

/** What a candidate prompt could be scored against, for one row, or the one reason it cannot be had. `roots` are checkouts to try where the recorded one is gone: the recorded commit and the digest are the proof, so a wrong checkout cannot pass. docs/cli/codex-the-replay.md. */
export const rebuiltFrom = (row, roots = []) => {
  if (!row.head) return { why: "no commit recorded" };
  const from = existsSync(row.root)
    ? row.root
    : roots.find((root) => gitIn(root, ["cat-file", "-e", `${row.head}^{commit}`]).status === 0);
  if (!from) return { why: "checkout gone, and no live checkout holds the commit" };
  const parts = [];
  for (const one of row.sent ?? []) {
    if (!one.sha) return { why: "no digest recorded" };
    const part = { rel: one.rel, chars: one.chars, sha: one.sha, clipped: Boolean(one.clipped) };
    if (typeof one.text === "string") {
      /* A file the log holds the text of was resolved outside the checkout, so `changedIn` answered
         untracked and the reviewer was shown NEW FILE rather than a diff — unless it sits in another
         checkout, where a diff was sent and this cannot reach the ref it was taken against. */
      if (row.anchoredTo && gitRootOf(one.rel)) return { why: "a sent file in another checkout carried a diff this cannot rebuild", where: one.rel };
      parts.push({ ...part, text: one.text, from: "the log", diff: null, masked: !one.clipped && digest(one.text) !== one.sha });
      continue;
    }
    if (one.textOmitted) return { why: `a sent file outside the checkout was over ${one.textOmitted}, so its text was not kept`, where: one.rel };
    if (isAbsolute(one.rel)) return { why: "a sent file was outside the checkout, from before the log kept its text", where: one.rel };
    const commit = heldAt(from, row.head, one);
    if (!commit) return { why: "a sent file was dirty at the commit and its bytes are in no later one", where: one.rel };
    const diff = diffFor(from, row, one, commit);
    if (diff.why) return { why: diff.why, where: one.rel };
    parts.push({ ...part, text: commit.text, from: commit.commit, diff: diff.text });
  }
  /* Unrecorded is not "diffs": `send` was only written from this change on, and claiming a shape
     for a row that never carried one is the defect this verb exists to avoid. */
  if (!row.send) return { why: "the shape it was sent in was not recorded" };
  return parts.length ? { parts, sends: row.send, anchoredTo: row.anchoredTo ?? null, root: from } : { why: "nothing was sent" };
};

/* Every checkout the window itself names that is still there, plus the one the verb runs in: a
   worktree removed after its consult leaves the commit in the repository it was cut from. */
const rootsIn = (rows) => [
  ...new Set([gitRootOf(process.cwd()), ...rows.map((one) => one.root)].filter((one) => one && existsSync(one))),
];

export const replayOf = (rows) => {
  const kept = [];
  const lost = new Map();
  const roots = rootsIn(rows);
  for (const row of rows) {
    const held = rebuiltFrom(row, roots);
    if (held.parts) kept.push({ row, ...held });
    else lost.set(held.why, { many: (lost.get(held.why)?.many ?? 0) + 1, where: lost.get(held.why)?.where ?? held.where });
  }
  return { kept, lost: [...lost.entries()].sort((a, b) => b[1].many - a[1].many) };
};

/** Every place a kept row's bytes came from, and the checkout that answered where it is not the one recorded: a rebuild off a later commit, another worktree or the log itself is a different claim from a rebuild off the row's own commit, and a reader counting rows is owed the difference. */
const sourceOf = (parts, row, from) => {
  const each = parts.map((part) => (part.from === row.head ? "the commit recorded" : part.from === "the log" ? "the log" : `commit ${part.from.slice(0, 7)}`));
  return `${[...new Set(each)].join(" and ")}${from === row.root ? "" : ` in ${from}`}`
    + `${parts.some((part) => part.masked) ? ", a masked body among them" : ""}`;
};

export const printReplay = (rest) => {
  const { prompt, last, root } = flags(rest, "codex replay", [], { usage: REPLAY_USAGE });
  if (!prompt) fail(REPLAY_USAGE);
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
  for (const { row, parts, root: from } of kept) {
    const made = numbered(row.reply, row.files).length;
    console.log(`  ${row.id ?? row.at}  ${row.head}  ${parts.length} file(s) sent as ${row.send}`
      + `${row.anchoredTo ? ` against ${row.anchoredTo}` : ""}, ${made} finding(s) at `
      + `${row.prompt ? `prompt v${row.prompt.v}` : "an unversioned prompt"}`
      + `, from ${sourceOf(parts, row, from)}`);
  }
  if (kept.length < rows.length) {
    console.log(`\n${rows.length - kept.length} of ${rows.length} cannot be replayed, each for the reason above `
      + "it: a file dirty at every commit the search reaches has bytes the log never kept, and a consult is "
      + "run on a dirty tree by nature. Widen the window, or compare prompt versions with `forge codex stats` "
      + "over the rounds each one ran.");
  }
  if (kept.length) {
    console.log("\nWhat is rebuilt is each file's body, and the diff where the consult was anchored. Two things "
      + "are not: the replayed history a consult opened with, which was the log as it then stood, and a file's "
      + "mode, which no row records — so a mode a working tree carried and no commit did would not show. A "
      + "comparison here is of the review, not of the byte-identical request.");
  }
};
