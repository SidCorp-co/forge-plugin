/* The score and its parts. Nothing here calls anything; why each weight: docs/cli/next.md. */
import { TAKEABLE } from "./weights.mjs";

const DAY = 86_400_000;

/* The word is the CLI's, never the tracker's name for the column it reads: checks/tracker-names. */
export const bandOf = (row, { fix = null } = {}) => {
  if (row?.complexity) return { band: String(row.complexity), from: "the tracker's size" };
  if (fix === true) return { band: "xs", from: "the Size line" };
  return { band: "unset", from: fix === null ? "the body unread" : "neither source" };
};

/** Every issue this one holds up: blocking one that blocks three counts four, and a cycle
 *  terminates on the visited set. */
export const chainOf = (key, blocks, open) => {
  const held = new Set();
  const queue = [...(blocks.get(key) ?? [])];
  while (queue.length) {
    const one = queue.shift();
    if (held.has(one) || one === key) continue;
    held.add(one);
    queue.push(...(blocks.get(one) ?? []));
  }
  return [...held].filter((one) => open.has(one));
};

const points = (table, name, fallback = 0) =>
  (Object.hasOwn(table, String(name)) ? table[String(name)] : fallback);

/** The total and its parts, `now` passed rather than read: age is the one weight a clock moves, and
 *  a case that could not fix the clock could not pin the order. */
export const scoreOf = (row, { weights, chain = [], fix = null, now = Date.now() }) => {
  const { band, from } = bandOf(row, { fix });
  const filed = Date.parse(row?.createdAt ?? "");
  const days = Number.isFinite(filed) ? Math.max(0, Math.floor((now - filed) / DAY)) : 0;
  const reopened = Number(row?.reopenCount ?? 0) || 0;
  const parts = [
    ["priority", String(row?.priority ?? "none"), points(weights.priority, row?.priority ?? "none")],
    ["kind", String(row?.category ?? "feature"), points(weights.kind, row?.category ?? "feature")],
    ["band", `${band} (${from})`, points(weights.band, band, weights.band.unset)],
    ["age", `${days}d`, Math.min(days * weights.agePerDay, weights.ageCap)],
    ["reopened", `${reopened}`, reopened ? weights.reopened : 0],
    ["blocks", `${chain.length} chained`, chain.length * weights.blocks],
  ];
  return { total: parts.reduce((sum, one) => sum + one[2], 0), parts, band, bandFrom: from, days, chain };
};

const filedAt = (row) => Date.parse(row?.createdAt ?? "") || Infinity;

export const ordered = (scored) =>
  scored
    .map((one, arrived) => ({ one, arrived }))
    .sort((left, right) =>
      right.one.score.total - left.one.score.total
      || filedAt(left.one.row) - filedAt(right.one.row)
      || left.arrived - right.arrived)
    .map((held) => held.one);

export const openKeys = (rows) =>
  new Set(rows.filter((one) => TAKEABLE.includes(String(one?.status ?? ""))).map((one) => one.issueId));
