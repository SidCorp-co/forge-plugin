/* The middle of a set of numbers, for the reports that print one — three modules declared it and answered differently on the same input (ISS-364), so the two answers that were the drift are decided here rather than re-derived per caller. **An empty set answers `null`, not nought**: nought is a measurement and the absence of one is not, and `forge next` prints a dash for it where a nought would read as a run that took no time — a caller wanting a nought says so where it calls, that being its report's decision about what to print and not this function's about what is true. **An even-length set answers with the mean of its two middle values**, not the upper of them, which is the median rather than a value the set happens to contain. */
export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
