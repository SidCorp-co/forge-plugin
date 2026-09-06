/* The two-window comparison both harness evals share; what a row is stays each harness's own —
   docs/cli/stats-the-eval.md. */

export const twoWindows = (sorted, size) => {
  const both = sorted.slice(-(size * 2));
  const now = both.slice(-size);
  return { now, before: both.slice(0, both.length - now.length) };
};

export const shiftBetween = (now, before, dimensions) => {
  const tally = (rows, of) => rows.reduce((held, row) => held.set(of(row), (held.get(of(row)) ?? 0) + 1), new Map());
  return dimensions.map(([name, of]) => {
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
