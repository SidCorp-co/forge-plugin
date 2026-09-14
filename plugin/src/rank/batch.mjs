/* Related issues printed together under the highest-ranked of them, relatedness read three ways in
   the order the issue gives. Why the module reading stops where it does: docs/cli/next.md. */
import { meets } from "./eligible.mjs";
import { belowTop, rungFrom } from "../ladder.mjs";

export const RELATION = "relation";
export const SEARCH = "search";
export const MODULE = "module";

/** The first meeting pair of named paths this checkout holds both ends of, and the first it holds
 *  neither end of. */
export const sharedPaths = (mine, theirs, resolves) => {
  let gone = null;
  for (const path of mine) {
    for (const other of theirs) {
      if (!meets(path, other)) continue;
      const absent = [...new Set([path, other])].filter((one) => !resolves(one));
      if (!absent.length) return { path, gone: null };
      gone ??= absent;
    }
  }
  return { path: null, gone };
};

/** Which of the three made this pair related, or null where none did. `relates` and `near` are the
 *  head's own: a search asked about one head answers about that head and no other. */
export const relatednessOf = (head, other,
  { relates = new Map(), near = new Map(), paths = new Map(), resolves = () => true }) => {
  if ((relates.get(head.issueId) ?? []).includes(other.issueId)) {
    return { how: RELATION, said: `related to ${head.issueId} by relation` };
  }
  const score = near.get(other.issueId);
  if (score !== undefined) {
    return { how: SEARCH, said: `reads like ${head.issueId} at ${score.toFixed(2)}` };
  }
  const { path: shared, gone } = sharedPaths(
    paths.get(head.issueId) ?? [], paths.get(other.issueId) ?? [], resolves);
  if (shared) return { how: MODULE, said: `names ${shared}, as ${head.issueId} does` };
  if (gone) return { how: MODULE, gone, said: `names ${gone.join(" and ")}, which this checkout has not got` };
  return null;
};

/* Members are taken in rank order, so the cap keeps the strongest rather than the first read. */
export const batchUnder = (head, rest, context, weights) => {
  const members = [];
  const aside = [];
  for (const other of rest) {
    const related = relatednessOf(head, other, context);
    if (!related) continue;
    if (related.gone) {
      aside.push({ ...other, ...related });
      continue;
    }
    if (!belowTop(rungFrom(other.score.complexity)) || !belowTop(rungFrom(head.score.complexity))) {
      aside.push({ ...other, ...related });
      continue;
    }
    if (members.length + 1 >= weights.batchCap) {
      aside.push({ ...other, ...related, capped: true });
      continue;
    }
    members.push({ ...other, ...related });
  }
  return { members, aside };
};

/** Each issue appearing once, and a head settled before it is searched: heads chosen up front leave
 *  the one an earlier batch promoted with no search of its own. */
export const batchesOf = async (ranked, { nearOf, ...context }, weights, limit = Infinity) => {
  const taken = new Set();
  const out = [];
  for (const head of ranked) {
    if (out.length >= limit) break;
    if (taken.has(head.issueId)) continue;
    const rest = ranked.filter((one) => one.issueId !== head.issueId && !taken.has(one.issueId));
    const near = await nearOf(head);
    const { members, aside } = batchUnder(head, rest, { ...context, near }, weights);
    for (const one of members) taken.add(one.issueId);
    taken.add(head.issueId);
    out.push({ head, members, aside, near });
  }
  return out;
};
