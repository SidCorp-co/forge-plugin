/* What the log says about the harness rather than about the code it reviewed: how often a review
   ran out of calls, how often a recheck went looking instead of confirming, and what the rounds
   cost. A window before a change and a window after it is how a change to the harness is judged.
   docs/FORGE-CLI.md. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { digest } from "./codex-api.mjs";
import { LOG_PATH, answered, logEntries, numbered } from "./codex-log.mjs";
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
    const key = row.prompt ? `v${row.prompt.v} ${row.prompt.sha}` : "unversioned";
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
