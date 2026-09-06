/* What a row is stays each harness's own — docs/cli/stats-the-eval.md. */

export const twoWindows = (sorted, size) => {
  const both = sorted.slice(-(size * 2));
  const now = both.slice(-size);
  return { now, before: both.slice(0, both.length - now.length) };
};

/** The envelope both harness evals answer in, so a key added to one reaches the other. Any key
 *  beyond these rides between `before` and `shifts`, where `stats eval`'s `moved` has always sat. */
export const comparedWindows = ({ size, total, against, now, before, separates, ...rest }) => ({
  size,
  total,
  ...(against ? { against: against.mark } : {}),
  now,
  before,
  ...rest,
  shifts: before ? separates(now, before) : [],
});

/** One count per value of each dimension — `{ name: { value: count } }` — kept on a window for when its rows are gone. */
export const tallied = (rows, dimensions) => Object.fromEntries(dimensions.map(([name, of]) => {
  const held = {};
  for (const row of rows) held[of(row)] = (held[of(row)] ?? 0) + 1;
  return [name, held];
}));

/** What separates two windows, off their tallies and never their rows: a stored before has none. */
export const shiftBetween = (now, before) =>
  [...new Set([...Object.keys(now), ...Object.keys(before)])].map((name) => {
    const here = now[name] ?? {};
    const there = before[name] ?? {};
    return {
      name,
      values: [...new Set([...Object.keys(there), ...Object.keys(here)])]
        .map((value) => ({ value, now: here[value] ?? 0, before: there[value] ?? 0 }))
        .filter((one) => one.now || one.before)
        .sort((a, b) => b.now - a.now || b.before - a.before),
    };
  });

/** Rows under the key each answers to, first-seen order. Both harness evals were spelling their own. */
export const groupBy = (rows, keyOf) => {
  const held = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!held.has(key)) held.set(key, []);
    held.get(key).push(row);
  }
  return held;
};

export const WHEN = 7;

const said = (one) => `${one.value} ${one.before || "—"} → ${one.now || "—"}`;

/** One dimension's row of the before → now line. Under `least` a value is summed into a tail rather
 *  than listed, and which dimension is worth that is the caller's; without one every value is listed. */
export const shiftLine = ({ name, values }, least = null) => {
  const listed = [];
  const thin = [];
  for (const one of values) {
    if (least !== null && one.now < least && one.before < least) thin.push(one);
    else listed.push(one);
  }
  const lines = listed.map(said);
  if (thin.length) {
    const sum = (side) => thin.reduce((many, one) => many + one[side], 0);
    lines.push(`${thin.length} more with fewer than ${least} runs on either side `
      + `${sum("before")} → ${sum("now")}`);
  }
  return `  ${name.padEnd(WHEN)} ${lines.join(", ")}`;
};
