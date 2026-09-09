/* The half of the eval the tracker holds: what became of the work a window's runs did, counted over
   run-and-issue pairs and never over issues. What each figure claims: docs/cli/stats-the-eval.md. */
import { commentPage } from "../tracker/comments.mjs";
import { everyIssue } from "../tracker/issues.mjs";
import { criterionNumber } from "../flow/machine.mjs";
import { parseAll } from "../flow/record/page.mjs";
import { pairedOneToOne } from "./joined.mjs";
import { accountCredentials } from "../resolve/settings.mjs";

export const HORIZON = 86_400_000;
export const BUDGET = 400;
export const AT_ONCE = 4;
const WAIT_SECONDS = 20;
/* The gap between a write and the result the harness stamps, and nothing wider: widen it and two
   calls a second apart both reach one entry, so neither pairs. */
const SLACK = 5000;

export const UNAVAILABLE = "unavailable";
export const AFTER_RUN = "after run, within horizon";
export const DURING_RUN = "during run";

const NO_PAIRS = "the runs of this window own no issue this reading could establish";
const NO_ENDPOINT = "no Forge endpoint is configured, so no tracker read could be made";
const SHORT = "its run has not finished the horizon";

/** One budget for the whole eval, charged through `callTool`'s `spend`, whose accounting is the transport's. */
export const budgetOf = (most = BUDGET) => {
  const spent = { requests: 0, most, stopped: null };
  const bound = {
    once: true,
    soft: true,
    waits: WAIT_SECONDS,
    spend: () => {
      if (spent.requests >= most) {
        spent.stopped ??= `the eval's request budget of ${most} request(s) is spent`;
        return spent.stopped;
      }
      spent.requests += 1;
      return null;
    },
  };
  return { spent, bound };
};

const recordsOn = (comments) => (comments ?? []).flatMap((one) => {
  const at = Date.parse(one?.createdAt ?? "") || 0;
  return parseAll(one?.body ?? "").map((record) => ({ at, kind: record.kind, fields: record.fields }));
});

/* Whole or not at all: a page that reported rows behind it and a paging run that stopped are both a
   prefix, and a figure over a prefix is a figure that read less and says it read the same. */
const threadOf = (page) => {
  if (page?.refused) return { unread: page.refused };
  if (page?.stopped) return { unread: "the thread's paging stopped part way" };
  if (page?.hasMore !== false) return { unread: "the tracker never called this thread whole" };
  return { records: recordsOn(page?.comments) };
};

const inBatches = async (list, most, each) => {
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const at = next;
      next += 1;
      await each(list[at]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(most, list.length)) }, worker));
};

/** Every issue the corpus's runs owned, read once: the walk maps a reference to a row and a thread
 *  read per issue carries the records. Both spend the one budget. */
export const readThreads = async (references, bound) => {
  const held = new Map();
  if (!references.length) return held;
  /* Asked here and not left to the transport: `settings()` exits the process where no endpoint
     resolves, soft caller or not, so an eval that would have said `unavailable` would instead take
     its own cost figures down with it. */
  const account = accountCredentials();
  if (!account.url.value || !account.token.value) {
    for (const one of references) held.set(one, { unread: NO_ENDPOINT });
    return held;
  }
  const read = await everyIssue({}, bound);
  const rows = new Map();
  for (const row of read.rows) if (row?.issueId) rows.set(String(row.issueId).toUpperCase(), row);
  const missed = read.refused ?? (read.whole ? null : "the issue list came back a prefix");
  await inBatches(references, AT_ONCE, async (reference) => {
    const row = rows.get(reference) ?? null;
    if (!row) {
      held.set(reference, { unread: missed ?? "no row on this project's tracker answers to it" });
      return;
    }
    held.set(reference, threadOf(await commentPage(row.documentId, true, bound)));
  });
  return held;
};

/* A pair is a run and one issue it owned; the run carries the cost and the pair carries none, which
   is what keeps an issue worked twice from doubling anything. */
export const pairsOf = (runs) => runs.flatMap((run) => run.issues.map((ref) => ({ run, ref })));

export const unreadIn = (runs) => runs.filter((run) => !run.issues.length).length;

const grouped = (reasons) => {
  const held = new Map();
  for (const why of reasons) held.set(why, (held.get(why) ?? 0) + 1);
  return [...held].map(([why, pairs]) => ({ why, pairs })).sort((a, b) => b.pairs - a.pairs);
};

/* `count` null is `unavailable` and is not zero: a population of nothing has no rate to print, and
   printing one is how a reading that saw nothing comes to look like a reading that saw no problem. */
const figure = ({ name, when, over, count, later = null, unread = [] }) => ({
  name,
  when,
  count: over > 0 ? count : null,
  over,
  ...(later === null ? {} : { later }),
  unread: grouped(unread),
});

const matured = (pair, horizon, now) => pair.run.endedAt + horizon <= now;

/** A figure observed after its run, so counted only inside one common interval and only for a pair
 *  whose run has finished that interval; an outcome landing later is counted apart, never inside. */
const afterRun = (name, pairs, threads, horizon, now, hit) => {
  const unread = [];
  let over = 0;
  let count = 0;
  let later = 0;
  for (const pair of pairs) {
    const held = threads.get(pair.ref);
    if (!held?.records) {
      unread.push(held?.unread ?? "no thread was read for it");
      continue;
    }
    if (!matured(pair, horizon, now)) {
      unread.push(SHORT);
      continue;
    }
    over += 1;
    const at = hit(pair, held.records);
    if (at.length) {
      if (at.some((one) => one <= pair.run.endedAt + horizon)) count += 1;
      else later += 1;
    }
  }
  return figure({ name, when: AFTER_RUN, over, count, later, unread });
};

const reopensIn = (pair, records) => records
  .filter((one) => one.kind === "finding" && one.at > pair.run.endedAt)
  .map((one) => one.at);

/* A criterion judged twice after a run is one criterion and not two verdicts, so the number the
   verdict names is the key — kept apart where it cannot be read, as `record/page.mjs` keeps it. */
const judgedTwiceIn = (pair, records) => {
  const byCriterion = new Map();
  for (const one of records) {
    if (one.kind !== "verdict" || one.at <= pair.run.endedAt) continue;
    const number = criterionNumber(one.fields.criterion);
    if (number === null) continue;
    if (!byCriterion.has(number)) byCriterion.set(number, []);
    byCriterion.get(number).push(one.at);
  }
  const twice = [...byCriterion.values()].filter((held) => held.length > 1);
  return twice.map((held) => Math.min(...held.slice(1)));
};

const wrote = (run, at) => run.parks.some((span) => at >= span.at - SLACK && at <= span.endedAt + SLACK);

/** Which run each park record belongs to, keyed on the issue and resolved over the whole corpus
 *  before any window is cut, as the ruling pairing is: among the issue's owners, the one whose own
 *  park-writing call the record landed inside, and exactly one. The record's claim, never a state. */
export const parkedOver = (runs, threads) => {
  const byRef = new Map();
  for (const pair of pairsOf(runs)) {
    if (!threads?.get(pair.ref)?.records) continue;
    if (!byRef.has(pair.ref)) byRef.set(pair.ref, []);
    byRef.get(pair.ref).push(pair);
  }
  const owned = new Map();
  const loose = new Map();
  for (const [ref, held] of byRef) {
    for (const record of threads.get(ref).records.filter((one) => one.kind === "park")) {
      const writers = held.filter((one) => wrote(one.run, record.at));
      if (writers.length !== 1) {
        loose.set(ref, (loose.get(ref) ?? 0) + 1);
        continue;
      }
      /* The transcript's own path: a window's rows are copies, and only what a spread carries keys. */
      const owner = writers[0].run.path;
      if (!owned.has(owner)) owned.set(owner, new Set());
      owned.get(owner).add(ref);
    }
  }
  return { owned, loose };
};

/** The window's share of that resolution, so `--size` cannot make an owner of a run the corpus refused. */
export const parkedFor = (pairs, threads, { owned, loose }) => {
  const unread = [];
  const refs = new Set();
  let over = 0;
  let count = 0;
  for (const pair of pairs) {
    const held = threads.get(pair.ref);
    if (!held?.records) {
      unread.push(held?.unread ?? "no thread was read for it");
      continue;
    }
    over += 1;
    refs.add(pair.ref);
    if (owned.get(pair.run.path)?.has(pair.ref)) count += 1;
  }
  let unattributed = 0;
  for (const ref of refs) unattributed += loose.get(ref) ?? 0;
  return {
    ...figure({ name: "parked or dropped", when: DURING_RUN, over, count, unread }),
    unattributed,
  };
};

/** Every ruling call of the corpus paired to at most one log entry, resolved before any window is
 *  cut: a competitor outside the window still spoils a match, so `--size` cannot decide whether a
 *  call was paired. */
export const ruledOver = (runs, entries) => {
  const timed = entries
    .filter((one) => one.kind === "verdict")
    .map((one) => ({ at: Date.parse(one.at) || 0, of: one.of ?? null, accepted: one.accepted ?? 0, rejected: one.rejected ?? 0 }));
  const spans = runs.flatMap((run) => run.rulings);
  const { pairs } = pairedOneToOne(spans, timed, SLACK);
  return new Map(pairs.map((one) => [one.span, one.entry]));
};

/** The one figure counted over findings rather than pairs, on sources the tracker is not among: a
 *  refused tracker read leaves this row standing. Its population is the findings RULED, so a window
 *  whose rulings never paired and one whose paired rulings ruled on nothing both have none. */
export const rejectedFor = (runs, ruled) => {
  let rejected = 0;
  let over = 0;
  let paired = 0;
  let unpaired = 0;
  for (const run of runs) {
    for (const span of run.rulings) {
      const entry = ruled.get(span);
      if (!entry) {
        unpaired += 1;
        continue;
      }
      paired += 1;
      rejected += entry.rejected;
      over += entry.accepted + entry.rejected;
    }
  }
  return {
    ...figure({ name: "consult findings rejected", when: DURING_RUN, over, count: rejected }),
    unit: "finding",
    paired,
    unpaired,
  };
};

/** Every outcome figure of one window, each with the population it was counted over and what it
 *  could not read. The three pair figures answer `unavailable` where the tracker did not; the
 *  fourth does not read the tracker and answers whatever the log and the transcripts said. */
export const outcomesOf = (runs, { threads, ruled, parks, horizon, now }) => {
  const pairs = pairsOf(runs);
  const none = (name, when) => figure({ name, when, over: 0, count: 0, unread: pairs.length ? [] : [NO_PAIRS] });
  return {
    pairs: pairs.length,
    unread: unreadIn(runs),
    horizonMs: horizon,
    readAt: new Date(now).toISOString(),
    figures: [
      threads ? afterRun("reopened", pairs, threads, horizon, now, reopensIn) : none("reopened", AFTER_RUN),
      threads
        ? afterRun("criteria judged twice", pairs, threads, horizon, now, judgedTwiceIn)
        : none("criteria judged twice", AFTER_RUN),
      threads ? parkedFor(pairs, threads, parks) : none("parked or dropped", DURING_RUN),
      rejectedFor(runs, ruled),
    ],
  };
};
