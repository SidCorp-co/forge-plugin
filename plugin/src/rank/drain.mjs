/* Whether the master a project declared drains the judging status is draining it, read off the rows
   standing there rather than taken on the declaration's word. A declaration subtracts a worker from a
   queue, so it is checked where it subtracts, and one the rows do not bear out stands nobody down.
   What counts as evidence, and why nothing else can: docs/cli/the-drain-key.md. */
import { DRAINS, drainScope, fromProject } from "../resolve/settings.mjs";
import { sessionOf } from "../resolve/config.mjs";
import { historyOf } from "../flow/lease/history.mjs";
import { firstLine } from "../resolve/flags.mjs";
import { scoped } from "../tracker/rest.mjs";
import { everyIssue } from "../tracker/issues.mjs";
import { ageOf } from "../codex/codex-state.mjs";
import { asksIndependent, judgementOf } from "../tracker/project-config.mjs";
import { JUDGING, judgingFrom } from "./eligible.mjs";

const MINUTE = 60_000;

/* The five cases a reading is in, each worded once below. `empty` is a declared master over no row:
   no evidence either way, which is neither draining nor not. */
const [UNKNOWN, UNDECLARED, EMPTY, HOLDS, UNHELD] = ["unknown", "undeclared", "empty", "holds", "unheld"];

/* The cases the key alone settles, before any row is read; null where only the rows can say. */
const keyState = (scope) => {
  if (scope.unknown !== undefined) return UNKNOWN;
  return scope.declared ? null : UNDECLARED;
};

const stateOf = (scope, { holds, standing, unreached, whole }) => {
  const settled = keyState(scope);
  if (settled) return settled;
  if (holds) return HOLDS;
  return !standing && !unreached && whole ? EMPTY : UNHELD;
};

const leaseAsk = (row) => ({ action: "get", documentId: row.documentId, fields: [] });

/** The one fact the browse projection does not carry, asked a row at a time: a judging candidate is
 *  offerable on its lease alone, and no listing answers for one. */
export const leaseOn = async (row) => (await scoped("forge_issues", leaseAsk(row)))?.sessionContext;

const stampOf = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : null;
};

const latest = (values) => {
  const held = values.map(stampOf).filter((one) => one !== null);
  return held.length ? Math.max(...held) : null;
};

/* When anybody last wrote the row: the listing's stamp, or the lease's where it is later and not the
   asking session's own. A row carrying neither is dated by its filing, which only makes it read older. */
const writtenAt = (one, own) => {
  const lease = one.lease?.holder === own ? {} : (one.lease ?? {});
  return latest([one.row?.updatedAt, lease.renewedAt, lease.released]) ?? stampOf(one.row?.createdAt);
};

/* The last claim another session recorded at the judging status on any row read. The asking
   session's own claims say nothing about whether another master is alive. */
const claimedAt = (judged, own) => latest(judged.flatMap((one) =>
  historyOf(one.lease)
    .filter((entry) => entry?.holder !== own && JUDGING.includes(String(entry?.status ?? "")))
    .map((entry) => entry?.at)));

/* The offered row written longest ago, an undated one first: it is the row a live drainer would have
   taken by now. */
const oldestOf = (offered, own) => offered
  .map((one) => ({ issueId: one.issueId, at: writtenAt(one, own) }))
  .reduce((held, one) => (held && (held.at ?? -Infinity) <= (one.at ?? -Infinity) ? held : one), null);

/** The declaration and its evidence. It holds on positive evidence alone — another session's live
 *  lease, a claim another session recorded inside the window, or an oldest offered row written inside
 *  it — and an empty offer is none: no row, and rows that are all the asking session's, leave the
 *  declaration unchecked. A read the window or the listing cut short holds nothing whatever its prefix
 *  showed, the rows behind it being the ones a live master would have been seen leaving. */
export const drainOf = (judging, { idle, whole = true, now = Date.now(), own = sessionOf() } = {}) => {
  const declared = drainScope();
  const judged = [...judging.offered, ...judging.left];
  const leased = judging.left.filter((one) => one.held === "live").length;
  const claimed = claimedAt(judged, own);
  const oldest = oldestOf(judging.offered, own);
  const within = (at) => at !== null && now - at < idle * MINUTE;
  const evidence = [
    leased ? "leased" : null,
    within(claimed) ? "claimed" : null,
    oldest && within(oldest.at) ? "fresh" : null,
  ].filter(Boolean);
  const holds = declared.value !== null && whole && !judging.unreached && evidence.length > 0;
  return {
    state: stateOf(declared, { holds, standing: judged.length, unreached: judging.unreached, whole }),
    drainedBy: declared.value,
    declared: declared.declared,
    unknown: declared.unknown ?? null,
    holds,
    evidence,
    standing: judged.length,
    leased,
    unreached: judging.unreached,
    whole,
    lastClaimAt: claimed === null ? null : new Date(claimed).toISOString(),
    oldest: oldest && { issueId: oldest.issueId,
      idleMinutes: oldest.at === null ? null : Math.floor((now - oldest.at) / MINUTE) },
    idle,
  };
};

const at = JUDGING.join(" or ");

/** The oldest offered row and how long it has stood untouched, said wherever the drainer is named. */
const oldestSaid = (drain, now = Date.now()) => {
  if (!drain.oldest) return "no row is offered";
  const { issueId, idleMinutes } = drain.oldest;
  return idleMinutes === null
    ? `the oldest offered, ${issueId}, carries no date at all`
    : `the oldest offered, ${issueId}, was last written ${ageOf(now - idleMinutes * MINUTE, now)}`;
};

const claimSaid = (drain, now) => (drain.lastClaimAt === null
  ? `no claim at ${at} by another session is recorded on them`
  : `another session last claimed one at ${at} ${ageOf(Date.parse(drain.lastClaimAt), now)}`);

const unreadSaid = (drain) => [
  drain.unreached
    ? `, and ${drain.unreached} further row(s) at ${at} went unread, so this is the window's evidence alone`
    : "",
  drain.whole ? "" : `, and the listing stopped before its end, so rows at ${at} it never returned stand unread`,
].join("");

/** Every fact the rows gave, in one clause both readers print: what a master stands down on, or why
 *  it does not. */
export const evidenceSaid = (drain, now = Date.now()) =>
  `${drain.leased} of the ${drain.standing} row(s) read at ${at} carry another session's live lease, `
  + `${claimSaid(drain, now)}, and ${oldestSaid(drain, now)}${unreadSaid(drain)}`;

/** The window the evidence is judged in, named with the key that sets it. */
const idleSaid = (drain) => `\`rank.drainIdle\` ${drain.idle} minute(s)`;

/** The judging rows and what they say about the master declared to drain them, one chain for the
 *  queue and the report alike, so neither judges rows the other did not. */
export const judgingRead = async (rows, { policy, leaseFor, weights, whole }) => {
  const judging = await judgingFrom(rows, { policy, leaseFor, cap: weights.windowCap });
  return judging && !judging.unread
    ? { ...judging, drain: drainOf(judging, { idle: weights.drainIdle, whole }) }
    : judging;
};

/** The same reading for a report that has not walked the backlog and has every other row to print: a
 *  read the tracker refused comes back as `unread`, the refusal's words with it, rather than ending
 *  the report or passing a lease nobody read for a free row. */
export const drainHere = async (policy, weights) => {
  const reads = await Promise.all(JUDGING.map((status) => everyIssue({ status })));
  const listed = reads.find((read) => read.refused)?.refused;
  if (listed) return { unread: firstLine(listed) };
  let refused = null;
  const leaseFor = async (row) => {
    const got = await scoped("forge_issues", leaseAsk(row), true);
    refused ??= got?.refused ?? null;
    return got?.sessionContext;
  };
  const judging = await judgingRead(reads.flatMap((read) => read.rows),
    { policy, leaseFor, weights, whole: reads.every((read) => read.whole) });
  if (refused) return { unread: firstLine(refused) };
  if (!judging || judging.unread) return judging && { unread: firstLine(judging.unread) };
  return judging.drain;
};

const ANYONE = `any master that reads the queue takes the rows at ${at}`;

/* The rows' evidence where a read gave any: a case the key settled before a read says no more. */
const rowsSaid = (drain, now) => (drain.evidence ? `. ${evidenceSaid(drain, now)}` : "");

const VERDICTS = {
  [UNKNOWN]: ["miss", (drain, now) => `\`drainedBy\` is \`${drain.unknown}\`, which is no master that `
    + `drains ${at}: it takes ${DRAINS.join(" or ")}. No master is declared, so ${ANYONE} until it is `
    + `put right${rowsSaid(drain, now)}`],
  [UNDECLARED]: ["note", (drain, now) => `no master — \`drainedBy\` is unset, so ${ANYONE}`
    + rowsSaid(drain, now)],
  [EMPTY]: ["note", (drain) => `${drain.drainedBy}, declared; no row stands at ${at}, so nothing here `
    + "says whether it is draining"],
  [HOLDS]: ["ok", (drain, now) => `${drain.drainedBy}, declared and draining: ${evidenceSaid(drain, now)}. `
    + "Another master leaves these standing"],
  [UNHELD]: ["miss", (drain, now) => `${drain.drainedBy}, declared and not draining: `
    + `${evidenceSaid(drain, now)}, judged against ${idleSaid(drain)}. So ${ANYONE}: start `
    + `${drain.drainedBy}, or take \`drainedBy\` out of the file`],
};

/** The one verdict both commands print, by the state the reading is in: the level a report rows it
 *  at, and the sentence. ISS-2354's two tables drifted apart over the same rows (ISS-3124). */
export const drainVerdict = (drain, now = Date.now()) => {
  const [level, said] = VERDICTS[drain.state];
  return { level, said: said(drain, now) };
};

/* A reading of the key alone, for a report that read no rows: the rows' facts are absent, not zero. */
const keyOnly = (scope) => ({ state: keyState(scope), drainedBy: scope.value, unknown: scope.unknown ?? null });

/** `forge doctor`'s rows for the drain key: the verdict wherever one was read or the key settles it,
 *  and the two readings that are no verdict on the rows — a master named for a judgement that offers
 *  nothing to drain, and a read that did not answer. */
export const drainRows = (policy, drain) => {
  const scope = drainScope();
  /* The file a declaration was read from, a value the key does not take included: that is the file
     it is put right in. An unset key was read from nowhere. */
  const sourced = (level, detail) => [{ level, label: "drained by",
    detail: scope.declared ? `${detail}  ← ${fromProject()}` : detail }];
  const verdictRow = (reading) => {
    const { level, said } = drainVerdict(reading);
    return sourced(level, said);
  };
  const settled = keyState(scope) && keyOnly(scope);
  if (!asksIndependent(policy)) {
    if (settled?.state === UNKNOWN) return verdictRow(settled);
    return scope.declared ? [{ level: "miss", label: "drained by", detail: `\`drainedBy\` names `
      + `${scope.value} and the judgement between ${at} and testing is ${judgementOf(policy)}, so `
      + "nothing is offered at that status for it to drain: set the judgement to independent, or take "
      + "the key out" }] : [];
  }
  if (drain && !drain.unread) return verdictRow(drain);
  if (settled) return verdictRow(settled);
  return sourced("note", `${scope.value}, declared; whether it is draining went unread: `
    + (drain?.unread ?? `nothing read the rows at ${at}`));
};
