/* The score and its parts. Nothing here calls anything; why each weight: docs/cli/next.md. */
import { TAKEABLE, UNSET } from "./weights.mjs";
import { holdsBack } from "../flow/earned.mjs";
import { FIELD_SAID } from "../ladder.mjs";

const DAY = 86_400_000;


/** The complexity the score weighs, off the tracker's field and nothing else: the field's own value, so `l` and `xl` still score apart on a three-wide rung, and an issue holding none is scored as unset rather than as the rung it would fall to. `complexitySaid` is the provenance a json reader wants and the gloss a row gets only where the field holds nothing — a parenthetical repeating the column's own word is the translation this CLI keeps no second vocabulary for. */
export const complexityOf = (row) => (row?.complexity ? String(row.complexity) : UNSET);

export const complexitySaid = (complexity) => (complexity === UNSET ? "none on the tracker" : FIELD_SAID);

/** Every issue this one holds up: blocking one that blocks three counts four, a cycle terminates on the visited set, and the walk stops at one that landed — what waited on it is free already. */
export const chainOf = (key, blocks, alive) => {
  const held = new Set();
  const queue = [...(blocks.get(key) ?? [])];
  while (queue.length) {
    const one = queue.shift();
    if (held.has(one) || one === key || !alive.has(one)) continue;
    held.add(one);
    queue.push(...(blocks.get(one) ?? []));
  }
  return [...held];
};

const points = (table, name, fallback = 0) =>
  (Object.hasOwn(table, String(name)) ? table[String(name)] : fallback);

/** The total and its parts, `now` passed rather than read: age is the one weight a clock moves, and
 *  a case that could not fix the clock could not pin the order. */
export const scoreOf = (row, { weights, chain = [], now = Date.now() }) => {
  const complexity = complexityOf(row);
  const filed = Date.parse(row?.createdAt ?? "");
  const days = Number.isFinite(filed) ? Math.max(0, Math.floor((now - filed) / DAY)) : 0;
  const reopened = Number(row?.reopenCount ?? 0) || 0;
  const said = complexity === UNSET ? `${complexity} (${complexitySaid(complexity)})` : complexity;
  const parts = [
    ["priority", String(row?.priority ?? "none"), points(weights.priority, row?.priority ?? "none")],
    ["kind", String(row?.category ?? "feature"), points(weights.kind, row?.category ?? "feature")],
    ["complexity", said, points(weights.complexity, complexity, weights.complexity.unset)],
    ["age", `${days}d`, Math.min(days * weights.agePerDay, weights.ageCap)],
    ["reopened", `${reopened}`, reopened ? weights.reopened : 0],
    ["blocks", `${chain.length} chained`, chain.length * weights.blocks],
  ];
  return { total: parts.reduce((sum, one) => sum + one[2], 0), parts, complexity, days, chain };
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

export const takeableKeys = (rows) =>
  new Set(rows.filter((one) => TAKEABLE.includes(String(one?.status ?? ""))).map((one) => one.issueId));

/** What still holds work up, which is not what a run may take: whether an edge gates is the flow's
 *  own reading, so a blocker here is exactly one `forge advance` would refuse to move past. */
export const holdingKeys = (rows) =>
  new Set(rows.filter((one) => holdsBack({ kind: "blocks", otherStatus: String(one?.status ?? "") }))
    .map((one) => one.issueId));
