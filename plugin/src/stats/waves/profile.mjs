/* One row per wave: what it cost the dispatcher, what it moved, and the mistakes and savings a record
   carries. The wave itself is its headline's wave and fold records; the dispatcher's calls come from
   its own sessions, cut to the wave's span; hand-backs come off each member's lease history. What no
   record carries is not counted: docs/cli/stats-the-waves.md. */
import { dispatchersOf, headlinesOf, landed } from "./find.mjs";
import { stamp } from "../figures.mjs";
import { checkoutFrom, refusalIn, windowFrom } from "../runs.mjs";
import { cacheRoot, copyAt, installedCopies } from "../versions.mjs";
import { readMember, wavesOf } from "../../flow/record/wave.mjs";
import { NO_LONGER_OWES } from "../../flow/earned/park-status.mjs";
import { FIELD, HISTORY_KEPT } from "../../flow/lease.mjs";
import { LANDING_BUILDER_OWED, LANDING_HEAD_OWED } from "../../flow/landing/checkpoint.mjs";
import { commentPage } from "../../tracker/comments.mjs";
import { documentIdIfAny } from "../../tracker/issues.mjs";
import { flags } from "../../resolve/flags.mjs";

const HANDED_BACK = [LANDING_HEAD_OWED, LANDING_BUILDER_OWED];
const RANKED = /\bforge next\b/u;
const DISPOSED = /\bforge record confirmation (?<key>ISS-\d+)\b[^\n]*?--finding[ =](?<finding>[\w-]+)/u;
const HOLDS = "holds";

const stampOf = (text) => Date.parse(text ?? "") || null;

const tally = (values) => {
  const held = {};
  for (const one of values) held[one] = (held[one] ?? 0) + 1;
  return held;
};

/** The wave's span and the dispatcher sessions it ran in: from its first `forge next` after the fold
 *  before it (or its first dispatch where it ran none) to its fold, or to its last call while open. */
export const spanOf = (wave, before, ref, sessions) => {
  const after = stampOf(before?.fold?.stamp) ?? -Infinity;
  const folded = wave.state === "folded" ? stampOf(wave.fold.stamp) : Infinity;
  const own = sessions.filter((one) => one.writes.some((write) => write.ref === ref && write.at > after && write.at <= folded));
  const first = stampOf(wave.dispatches[0]?.stamp) ?? folded;
  const ranked = own.flatMap((one) => one.calls)
    .filter((call) => RANKED.test(call.shell) && call.at > after && call.at <= first);
  const from = ranked.length ? Math.min(...ranked.map((call) => call.at)) : first;
  const all = own.flatMap((one) => one.calls);
  const to = Number.isFinite(folded) ? folded : Math.max(from, ...all.map((call) => call.at));
  return { from, to, sessions: own.map((one) => one.session), calls: all.filter((call) => call.at >= from && call.at <= to) };
};

/** A member's hand-backs inside the span, and whether its kept history may have lost some. */
export const handBacksOf = (member, from, to) => {
  const history = member.body?.[FIELD]?.lease?.history ?? [];
  const within = history.filter((row) => HANDED_BACK.includes(row.landing)
    && (stampOf(row.at) ?? 0) >= from && (stampOf(row.at) ?? 0) <= to);
  const cut = history.length >= HISTORY_KEPT && (stampOf(history[0]?.at) ?? 0) > from;
  return { count: within.length, cut };
};

/** The members named by two dispatches under two sessions: a run replaced where it could have resumed. */
export const replacedIn = (dispatches) => {
  const by = new Map();
  for (const one of dispatches) for (const key of one.members) by.set(key, (by.get(key) ?? new Set()).add(one.session));
  return [...by].filter(([, held]) => held.size > 1).map(([key]) => key);
};

/** The dispatcher's own dispositions in the span that ended an issue without a run, by finding. */
export const dispositionsIn = (calls) => tally(calls.filter(landed)
  .map((call) => DISPOSED.exec(call.shell)?.groups?.finding)
  .filter((finding) => finding && finding !== HOLDS));

const memberRows = async (keys, read, seen) => {
  const rows = [];
  for (const key of keys) {
    if (!seen.has(key)) seen.set(key, await read(key));
    rows.push({ key, ...seen.get(key) });
  }
  return rows;
};

const outcomesOf = (members) => tally(members.map((one) => {
  if (one.refused) return "unreadable";
  const status = String(one.body?.status ?? "unknown");
  return NO_LONGER_OWES.includes(status) ? status : "owed";
}));

/** One wave's row, off the span the caller cut and the member rows it read. */
export const rowOf = ({ ref, wave, span, members, copies }) => {
  const read = members.filter((one) => !one.refused);
  const backs = read.map((one) => ({ key: one.key, ...handBacksOf(one, span.from, span.to) }));
  return {
    headline: ref,
    state: wave.state,
    summary: wave.fold?.summary ?? null,
    from: new Date(span.from).toISOString(),
    to: Number.isFinite(span.to) ? new Date(span.to).toISOString() : null,
    minutes: Math.round((span.to - span.from) / 60_000),
    calls: span.calls.length,
    copy: copyAt(copies, span.from),
    sessions: span.sessions,
    dispatches: wave.dispatches.length,
    members: members.length,
    outcomes: outcomesOf(members),
    unreadable: members.filter((one) => one.refused).map((one) => ({ key: one.key, refused: one.refused })),
    handBacks: backs.reduce((many, one) => many + one.count, 0),
    handBacksCut: backs.filter((one) => one.cut).map((one) => one.key),
    replaced: replacedIn(wave.dispatches),
    dispositions: dispositionsIn(span.calls),
    refusals: tally(span.calls.map(refusalIn).filter(Boolean)),
  };
};

const pageOf = async (ref) => {
  const found = await documentIdIfAny(ref, { soft: true });
  if (found.refused) return { refused: String(found.refused) };
  const page = await commentPage(found.id, true);
  return page?.refused ? { refused: String(page.refused) } : page;
};

/** Every wave on every headline the sessions wrote against, oldest first by where each began. Each
 *  headline page and each member issue is read once however many waves name it. */
export const wavesProfiled = async (sessions, headlines, { read = readMember, copies = installedCopies(cacheRoot()) } = {}) => {
  const seen = new Map();
  const rows = [];
  const headlinesUnread = [];
  for (const ref of headlines) {
    const page = await pageOf(ref);
    if (page.refused) {
      headlinesUnread.push({ ref, refused: page.refused });
      continue;
    }
    const waves = wavesOf(page.comments ?? []);
    for (const [at, wave] of waves.entries()) {
      const span = spanOf(wave, waves[at - 1], ref, sessions);
      const keys = [...new Set(wave.dispatches.flatMap((one) => one.members))];
      rows.push(rowOf({ ref, wave, span, members: await memberRows(keys, read, seen), copies }));
    }
  }
  rows.sort((a, b) => a.from.localeCompare(b.from));
  return { waves: rows, headlinesUnread, membersRead: seen.size };
};

/** The whole reading both `stats waves` and `stats eval --waves` answer from. */
export const wavesRead = async (directory, options = {}) => {
  const found = dispatchersOf(directory);
  const profiled = await wavesProfiled(found.sessions, headlinesOf(found.sessions), options);
  return { where: found.where, read: found.read, unreadable: found.unreadable, ...profiled };
};

export const WAVES_USAGE = [
  "Usage: forge stats waves [--since 3d] [--checkout <dir>] [--json]",
  "What each dispatch wave cost the dispatcher and what went wrong in it, one row per wave, oldest",
  "first. A wave is the wave records on a headline up to the fold that ends it; one with no fold yet",
  "prints as open. The headlines are the ones the project's dispatcher sessions wrote a wave or a",
  "fold record against, and each headline and member issue is read once. Nothing is written.",
  "",
  "  --since 3d     the waves that ended inside the window, in d, h or m; every wave unless you say otherwise",
  "  --checkout <dir>  as for runs",
  "  --json         every wave's figures, one object",
].join("\n");

const counted = (held) => Object.entries(held).map(([name, many]) => `${name} ${many}`).join(", ");

const handBacksSaid = (row) => (row.handBacksCut.length
  ? `at least ${row.handBacks}, history cut on ${row.handBacksCut.join(", ")}`
  : String(row.handBacks));

/** A wave's row as printed: its cost, what it moved, and the mistakes and savings it carries. */
export const waveLines = (row) => [
  `${row.headline}  ${row.state}  ${stamp(row.from)} to ${stamp(row.to)}  ${row.minutes} min, `
    + `${row.calls} call(s), copy ${row.copy}`,
  ...(row.summary ? [`  ${row.summary}`] : []),
  `  ${row.dispatches} dispatch(es), ${row.members} member(s): ${counted(row.outcomes) || "none"}`,
  `  hand-backs ${handBacksSaid(row)}; replaced ${row.replaced.join(", ") || "none"}; `
    + `disposed without a run ${counted(row.dispositions) || "none"}`,
  ...(Object.keys(row.refusals).length ? [`  refusals met: ${counted(row.refusals)}`] : []),
  ...row.unreadable.map((one) => `  ${one.key} unreadable: ${one.refused}`),
];

/** `forge stats waves` — the profile of every dispatch wave the project's dispatchers recorded. */
export const printWaves = async (rest) => {
  const { since, checkout, json } = flags(rest, "stats waves", ["--json"], { usage: WAVES_USAGE });
  const from = windowFrom(since, "stats waves");
  const directory = checkoutFrom(checkout, "stats waves");
  const held = await wavesRead(directory);
  const waves = from === null ? held.waves : held.waves.filter((one) => Date.parse(one.to) >= from);
  if (json) return console.log(JSON.stringify({ ...held, waves }, null, 2));
  const unread = held.headlinesUnread.map((one) => `${one.ref} unreadable: ${one.refused}`);
  if (!waves.length) {
    return console.log([`No dispatch wave for this project${since ? ` in the last ${since}` : ""}: `
      + `${held.read} session(s) read under ${held.where}, ${held.unreadable} unparsed.`, ...unread].join("\n"));
  }
  console.log(`${waves.length} wave(s)${since ? ` in the last ${since}` : ""}, off ${held.read} session(s) under `
    + `${held.where}; ${held.membersRead} member issue(s) read.`);
  for (const line of unread) console.log(line);
  for (const row of waves) console.log(`\n${waveLines(row).join("\n")}`);
  return null;
};
