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
