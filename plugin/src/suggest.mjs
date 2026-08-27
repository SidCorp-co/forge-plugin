/* "Did you mean" for every name this CLI accepts.

   An agent's mistakes are not a human's. It does not fat-finger adjacent keys; it recalls a name
   from the wrong shape — a dot where the server wants an underscore, a singular for a plural, a
   stem it saw in a schema three calls ago. So the match is on the separator-stripped form, and
   containment counts as much as edit distance. */

const bare = (name) => name.replace(/[._\- ]/gu, "").toLowerCase();

const distance = (left, right) => {
  let previous = [...Array(right.length + 1).keys()];
  for (let index = 1; index <= left.length; index += 1) {
    const row = [index];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[index - 1] === right[column - 1] ? 0 : 1;
      row[column] = Math.min(row[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
    }
    previous = row;
  }
  return previous[right.length];
};

/* Zero is an exact match on the stripped form, so a name that differs only by separator sorts
   ahead of everything — that is the commonest miss against this server's dotted tool names. */
const rank = (given, candidate) => {
  const [left, right] = [bare(given), bare(candidate)];
  if (left === right) return 0;
  if (right.includes(left) || left.includes(right)) return 1;
  const gap = distance(left, right);
  return gap <= Math.max(2, Math.floor(left.length / 3)) ? 1 + gap : Infinity;
};

export const suggest = (given, candidates, limit = 5) =>
  candidates
    .map((candidate) => ({ candidate, points: rank(given, candidate) }))
    .filter((scored) => Number.isFinite(scored.points))
    .sort((one, other) => one.points - other.points)
    .slice(0, limit)
    .map((scored) => scored.candidate);

export const didYouMean = (kind, given, candidates, hint) => {
  const close = suggest(given, candidates);
  if (close.length) return `No ${kind} named ${given}. Did you mean: ${close.join(", ")}?`;
  return `No ${kind} named ${given}.${hint ? ` ${hint}` : ""}`;
};
