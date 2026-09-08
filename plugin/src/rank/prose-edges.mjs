/* The edges an issue's BODY claims, which are not the edges the tracker holds: a sentence claiming
   an edge the store never got, and an edge no sentence mentions, are both real and neither proves
   the other. So the ranking reads the store and this reads the prose, and what only prose says is
   listed apart. What the marker sentence had to be, and why: docs/cli/next-the-edges.md. */
import { depsConvention } from "../resolve/settings.mjs";
import { everyIssue } from "../tracker/issues.mjs";
import { scoped } from "../tracker/rpc.mjs";

/* The marker sentence, and only it; the trailing period separates a claim from prose about one.
   The phrases come from the project file, which `forge doctor` names. */
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const PROSE = depsConvention().value;
const MARKER = new RegExp(`[^.|]*${escape(PROSE.marker)}\\.`, "giu");
const BLOCKED_BY = new RegExp(`${escape(PROSE.blockedBy)} (?:the )?(.+?) ${PROSE.noun}\\b`, "iu");
const BLOCKS = new RegExp(`\\b${escape(PROSE.blocks)} (?:the )?(.+?) ${PROSE.noun}\\b`, "iu");

export const PROSE_MARKER = PROSE.marker;
export const PROSE_FROM = depsConvention().from;

const STOPWORDS = new Set(["the", "and", "a", "an", "of", "for", "to", "issue", "issues"]);

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && !STOPWORDS.has(word));

/* A title's own code counts: whole-word matching alone ties unrelated titles. */
const overlaps = (left, right) =>
  left === right ||
  (left.length >= 4 && right.startsWith(left)) ||
  (right.length >= 4 && left.startsWith(right));

const score = (wanted, have) => wanted.filter((word) => have.some((candidate) => overlaps(word, candidate))).length;

const splitPhrases = (list) =>
  list
    .split(/,| and /iu)
    .map((part) => part.trim())
    .filter(Boolean);

const edgesIn = (description) => {
  const found = { blockedBy: [], blocks: [] };
  for (const sentence of (description ?? "").match(MARKER) ?? []) {
    const blockedBy = BLOCKED_BY.exec(sentence);
    if (blockedBy) found.blockedBy.push(...splitPhrases(blockedBy[1]));
    const blocks = BLOCKS.exec(sentence);
    if (blocks) found.blocks.push(...splitPhrases(blocks[1]));
  }
  return found;
};

/* Unique best, or nothing: a phrase tying two titles is reported as written. One pass keeps the
   best and whether a second title matched it. */
const resolve = (phrase, titled) => {
  const wanted = words(phrase);
  let best = null;
  let tied = false;
  for (const one of titled) {
    const points = score(wanted, one.have);
    if (!best || points > best.points) {
      best = { issue: one.issue, points };
      tied = false;
    } else if (points === best.points) {
      tied = true;
    }
  }
  return !best || best.points < 2 || tied ? null : best.issue;
};

/* Collected by pair rather than by the issue that spoke — that is what makes a one-sided claim visible. */
export const graphOf = (issues, universe) => {
  const claims = new Map();
  const unresolved = [];
  const silent = [];
  const key = (from, to) => `${from} ${to}`;
  const titled = universe.map((issue) => ({ issue, have: words(issue.title ?? "") }));
  for (const issue of issues) {
    const { blockedBy, blocks } = edgesIn(issue.description);
    if (!blockedBy.length && !blocks.length) {
      silent.push(issue);
      continue;
    }
    const add = (phrase, asBlocker) => {
      const other = resolve(phrase, titled);
      if (!other) {
        unresolved.push({ from: issue.issueId, phrase, asBlocker });
        return;
      }
      const pair = asBlocker ? [other.issueId, issue.issueId] : [issue.issueId, other.issueId];
      const seen = claims.get(key(...pair)) ?? { from: pair[0], to: pair[1], by: new Set() };
      seen.by.add(issue.issueId);
      claims.set(key(...pair), seen);
    };
    for (const phrase of blockedBy) add(phrase, true);
    for (const phrase of blocks) add(phrase, false);
  }
  return { claims: [...claims.values()], unresolved, carriers: issues.length - silent.length };
};

const bodyOf = async (summary) => ({
  ...summary,
  ...(await scoped("forge_issues", { action: "get", documentId: summary.documentId, fields: ["description"] })),
});

/** The candidates a prose edge can be read out of, and the bodies to read it from: the search
 *  narrows, the regex above decides. One reading, spent by the ranking and by the graph alike, and
 *  read a window at a time under the ranking's own cap — every body at once answered 503. */
export const carriersOf = async (windowCap) => {
  const matched = await everyIssue({ search: PROSE_MARKER });
  const issues = [];
  for (let at = 0; at < matched.rows.length; at += windowCap) {
    issues.push(...await Promise.all(matched.rows.slice(at, at + windowCap).map(bodyOf)));
  }
  return { issues, read: matched };
};
