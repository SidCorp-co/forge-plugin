/* `forge deps` — the graph as the issue BODIES state it, not the recorded edges, which no PAT can
   read. Two issues that disagree are the finding this verb exists for: docs/cli/deps.md. */
import { depsConvention, fail } from "../resolve/settings.mjs";
import { scoped } from "./rpc.mjs";
import { MAX_LIMIT, listIssues, rowsOf, truncated } from "./issues.mjs";

/* The marker sentence, and only it; the trailing period separates a claim from prose about one.
   The phrases come from the tracker's own `.forge.json`. */
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const PROSE = depsConvention().value;
const MARKER = new RegExp(`[^.|]*${escape(PROSE.marker)}\\.`, "giu");
const BLOCKED_BY = new RegExp(`${escape(PROSE.blockedBy)} (?:the )?(.+?) ${PROSE.noun}\\b`, "iu");
const BLOCKS = new RegExp(`\\b${escape(PROSE.blocks)} (?:the )?(.+?) ${PROSE.noun}\\b`, "iu");

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

const score = (phrase, title) => {
  const wanted = words(phrase);
  const have = words(title);
  return wanted.filter((word) => have.some((candidate) => overlaps(word, candidate))).length;
};

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

/* Unique best, or nothing: a phrase tying two titles is reported as written. */
const resolve = (phrase, issues) => {
  const ranked = issues
    .map((issue) => ({ issue, points: score(phrase, issue.title ?? "") }))
    .sort((left, right) => right.points - left.points);
  const [best, next] = ranked;
  if (!best || best.points < 2) return null;
  if (next && next.points === best.points) return null;
  return best.issue;
};

const arrow = (from, to, claimedBy, both) =>
  `${from.padEnd(7)} ->blocks-> ${to.padEnd(7)}  ${both ? "both sides agree" : `stated by ${claimedBy} only`}`;

const number = (reference) => Number(reference.replace(/\D+/gu, ""));

/* One line per blocker, ASCII throughout: 595 bytes and 19 arrows became 180 and none. */
const compact = (claims) => {
  const byBlocker = new Map();
  for (const claim of claims) {
    const marked = claim.by.size > 1 ? claim.to : `${claim.to}?`;
    byBlocker.set(claim.from, [...(byBlocker.get(claim.from) ?? []), marked]);
  }
  return [...byBlocker.entries()]
    .sort(([left], [right]) => number(left) - number(right))
    .map(([from, targets]) => {
      const sorted = targets.sort((left, right) => number(left) - number(right));
      return `${from.padEnd(7)}-> ${sorted.join(" ")}`;
    });
};

/* A literal NUL made git read this file as binary. The escape is the same byte at runtime. */
const key = (from, to) => `${from}\u0000${to}`;

/* Collected by pair rather than by the issue that spoke — that is what makes a one-sided claim
   visible. */
const graphOf = (issues, universe) => {
  const claims = new Map();
  const unresolved = [];
  const silent = [];
  for (const issue of issues) {
    const { blockedBy, blocks } = edgesIn(issue.description);
    if (!blockedBy.length && !blocks.length) {
      silent.push(issue);
      continue;
    }
    const add = (phrase, asBlocker) => {
      const other = resolve(phrase, universe);
      if (!other) {
        unresolved.push({ from: issue.issueId, phrase });
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

const printGraph = ({ claims, unresolved, carriers }, focus, total, long) => {
  const shown = focus ? claims.filter((c) => c.from === focus || c.to === focus) : claims;
  if (long) {
    for (const claim of shown.sort((l, r) => number(l.from) - number(r.from))) {
      console.log(arrow(claim.from, claim.to, [...claim.by][0], claim.by.size > 1));
    }
  } else {
    for (const row of compact(shown)) console.log(row);
  }
  const missed = focus ? unresolved.filter((claim) => claim.from === focus) : unresolved;
  for (const miss of missed) {
    console.log(`unresolved: ${miss.from} names "${miss.phrase}", matching no title`);
  }
  const sided = shown.filter((claim) => claim.by.size === 1).length;
  console.log(
    `${shown.length} edges${focus ? ` touching ${focus}` : ""}, ${sided} one-sided (?), ` +
      `${carriers} of ${total} carry prose. Prose only; PM_REQUIRES_DEVICE.`,
  );
};

/* One search, not three: the other two phrases returned strict subsets. */
const MARKER_SEARCH = PROSE.marker;

export const deps = async (rest) => {
  const long = rest.includes("--long");
  const [focus] = rest.filter((argument) => argument !== "--long");
  /* Ranked against every issue, not only those carrying prose, and issued in parallel. */
  const [all, matched] = await Promise.all([
    listIssues({}, MAX_LIMIT),
    listIssues({ search: MARKER_SEARCH }, MAX_LIMIT),
  ]);
  const universe = rowsOf(all);
  if (truncated(universe, MAX_LIMIT)) {
    console.error(`warning: the tracker holds at least ${MAX_LIMIT} issues; this graph may be partial.`);
  }
  const candidates = rowsOf(matched);
  if (!candidates.length) {
    fail(
      `No issue carries the sentence "${PROSE.marker}" (${depsConvention().from}).\n` +
        "Set `deps: { marker, blockedBy, blocks }` in .forge.json if this tracker words it differently.",
    );
  }
  /* Only `description` is read, and the whole body is ~8% more wire for nothing. */
  const issues = await Promise.all(
    candidates.map(async (summary) => ({
      ...summary,
      ...(await scoped("forge_issues", {
        action: "get",
        documentId: summary.documentId,
        fields: ["description"],
      })),
    })),
  );
  const wanted = focus?.toUpperCase();
  if (wanted && !issues.some((issue) => issue.issueId?.toUpperCase() === wanted)) {
    console.log(`${focus} carries no dependency prose, and no issue names it.
`);
  }
  printGraph(graphOf(issues, universe), wanted, universe.length, long);
};
