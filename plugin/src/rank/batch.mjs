/* Related issues printed together under the highest-ranked of them, relatedness read three ways in
   the order the issue gives. Why the module reading stops where it does: docs/cli/next.md. */
import { meets } from "./eligible.mjs";

/* The order a member is tested in, so its line says the strongest of the three. */
export const RELATION = "relation";
export const SEARCH = "search";
export const MODULE = "module";

const FIX = ["xs", "s"];

export const isFixSize = (band) => FIX.includes(String(band));

const sharedPath = (mine, theirs) =>
  mine.find((path) => theirs.some((other) => meets(path, other))) ?? null;

/** Which of the three made this pair related, or null where none did. `relates` and `near` are the
 *  head's own: a search asked about one head answers about that head and no other. */
export const relatednessOf = (head, other, { relates = new Map(), near = new Map(), paths = new Map() }) => {
  if ((relates.get(head.issueId) ?? []).includes(other.issueId)) {
    return { how: RELATION, said: `related to ${head.issueId} by relation` };
  }
  const score = (near.get(head.issueId) ?? new Map()).get(other.issueId);
  if (score !== undefined) {
    return { how: SEARCH, said: `reads like ${head.issueId} at ${score.toFixed(2)}` };
  }
  const shared = sharedPath(paths.get(head.issueId) ?? [], paths.get(other.issueId) ?? []);
  return shared ? { how: MODULE, said: `names ${shared}, as ${head.issueId} does` } : null;
};

/* Members are taken in rank order, so the cap keeps the strongest rather than the first read. */
export const batchUnder = (head, rest, context, weights) => {
  const members = [];
  const aside = [];
  for (const other of rest) {
    const related = relatednessOf(head, other, context);
    if (!related) continue;
    if (!isFixSize(other.score.band) || !isFixSize(head.score.band)) {
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

/** Every head with its batch, each issue appearing once: a member is not a head of its own. */
export const batchesOf = (ranked, context, weights) => {
  const taken = new Set();
  const out = [];
  for (const head of ranked) {
    if (taken.has(head.issueId)) continue;
    const rest = ranked.filter((one) => one.issueId !== head.issueId && !taken.has(one.issueId));
    const { members, aside } = batchUnder(head, rest, context, weights);
    for (const one of members) taken.add(one.issueId);
    taken.add(head.issueId);
    out.push({ head, members, aside });
  }
  return out;
};
