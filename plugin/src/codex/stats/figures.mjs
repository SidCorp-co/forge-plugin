/* The one reader of the consult log's figures: a group of answered consults in, its figures out,
   whatever the rows were grouped by. `stats` groups a window by nothing, by model or by prompt, and
   `eval` groups two windows by model and prompt at once; each asks this module, so a figure is
   defined once and two verbs quoting it cannot disagree (ISS-349). docs/cli/codex-the-log.md. */
import { answered, verdictsBy } from "../codex-log.mjs";
import { countedIn, modelKey, numbered, ruledOn } from "../log/replies.mjs";
import { incompleteIn, newFindingsIn } from "../codex-plan.mjs";
import { groupBy } from "../../stats/windows.mjs";
import { median } from "../../stats/median.mjs";

export const KINDS = ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"];

/* Unknown, never assumed: `--rounds` and `codex.rounds` were both settable before the budget was
   recorded, so calling an old row three would misclassify exactly the rate it is quoted for. What
   needs no assumption is the calls histogram, which is where the cap's signature shows anyway. */
const budgetOf = (row) => row.budget ?? row.cap ?? null;

/* Recomputed where the row predates the field: the predicate is one definition, so the same
   sentence is read the same way whichever side of the change wrote it. */
const wasIncomplete = (row) => (row.incomplete === undefined ? incompleteIn(row.reply) : row.incomplete);
const newFindingsOf = (row) =>
  (row.newFindings === undefined ? newFindingsIn(numbered(row.reply, row.files)) : row.newFindings);

/** The prompt a row ran at: the version and the digest of the text actually sent, so an edit nobody bumped for still separates two windows. */
export const promptKey = (row) => (row.prompt ? `v${row.prompt.v} ${row.prompt.sha}` : "unversioned");

/** What the rows cost and did: calls against budget, replies that could not check, rechecks, tokens by kind, prompt versions. */
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

/* What the rows found and what became of it, each consult ruled by the verdict the whole log holds
   on it: a verdict is written after its consult and lands outside a window as often as in it, and
   scored on the window alone every group reads nothing kept. */
const scoreFigures = (rows, scored) => {
  const held = { consults: 0, findings: 0, zero: 0, accepted: 0, rejected: 0, sound: 0, misreasoned: 0, cached: 0, input: 0 };
  const seconds = [];
  for (const one of rows) {
    const counted = countedIn(one.reply);
    held.consults += 1;
    if (counted) {
      held.findings += counted.total;
      if (counted.total === 0) held.zero += 1;
    }
    const verdict = scored.get(one.id ?? one.at);
    if (verdict) {
      const ruled = ruledOn(verdict, one);
      for (const name of ["accepted", "rejected", "sound", "misreasoned"]) held[name] += ruled[name];
    }
    if (one.ms !== undefined) seconds.push(Math.round(one.ms / 1000));
    const usage = one.usage ?? {};
    held.cached += usage.cache_read_input_tokens ?? 0;
    held.input += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return { ...held, median: median(seconds) ?? 0 };
};

/** One group's figures, both halves, computed once: `scored` is the verdict of each consult, keyed as `verdictsBy` keys it. */
export const figuresOf = (rows, scored) => ({ consults: rows.length, score: scoreFigures(rows, scored), stats: statsOf(rows) });

/** Every group of `rows` under `keyOf`, in the order each key first appears, the verdicts read once for all of them. */
export const groupsOf = (rows, verdicts, keyOf) => {
  const scored = verdictsBy(verdicts);
  return [...groupBy(rows, keyOf).entries()].map(([key, own]) => ({ key, rows: own, ...figuresOf(own, scored) }));
};

/** The whole log per model, each group's score under the model it is keyed by. */
export const scoreOf = (entries) =>
  groupsOf(answered(entries), entries, modelKey).map(({ key, score }) => ({ model: key, ...score }));

/* A retried row is kept out of its kind's histogram and its tokens are kept in: its `calls` has
   counted two different things over the log's life, while its usage was both attempts' throughout. */
const ROUND_KINDS = [["pass", (row) => !row.recheck], ["recheck", (row) => Boolean(row.recheck)]];

/** A pass beside a recheck, each over its own rows: its count, cache share, retries and calls histogram. */
export const roundKindsOf = (rows) => ROUND_KINDS.map(([name, is]) => {
  const own = rows.filter(is);
  const held = statsOf(own);
  const once = own.filter((row) => (row.attempt ?? 1) === 1);
  return { name, consults: own.length, sent: held.sent, cached: held.cached, retried: held.retried, calls: statsOf(once).calls };
});
