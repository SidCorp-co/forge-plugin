/* The scored links a sweep collected, turned into the families it prints and the accounting under
   them. Nothing here calls anything and nothing here holds a number: the floor is the create path's
   own export. Why a family is a transitive join and what the score does not say: docs/cli/alike.md. */
import { FLOOR } from "../tracker/filing/neighbours.mjs";

const KEY = 8;
const PAIR = "~";

const scoreSaid = (score) => score.toFixed(2);

/** One link per unordered pair, at the better of the two readings and carrying the end whose query
 *  saw it: the search answers one direction at a time and the two disagree. */
export const linksFrom = (found) => {
  const held = new Map();
  for (const link of found) {
    const at = [link.from, link.to].sort().join(` ${PAIR} `);
    const before = held.get(at);
    if (!before || link.score > before.score) held.set(at, link);
  }
  return [...held.values()].sort((one, two) =>
    two.score - one.score || `${one.from}${one.to}`.localeCompare(`${two.from}${two.to}`));
};

const nearMap = (links) => {
  const near = new Map();
  const join = (from, to) => near.set(from, (near.get(from) ?? new Set()).add(to));
  for (const link of links) {
    join(link.from, link.to);
    join(link.to, link.from);
  }
  return near;
};

const widest = (near, held) =>
  [...held].reduce((best, one) => (near.get(one).size > (near.get(best)?.size ?? -1) ? one : best), null);

/* Bron-Kerbosch, and the pivot is what keeps a set that reads alike all round from costing a branch
   per subset of it: docs/cli/alike.md. */
const cliquesIn = (near) => {
  const out = [];
  const grow = (held, may, gone) => {
    if (!may.size && !gone.size) return out.push(held);
    const pivot = near.get(widest(near, new Set([...may, ...gone])));
    for (const one of [...may].filter((other) => !pivot.has(other))) {
      const its = near.get(one);
      grow([...held, one], new Set([...may].filter((other) => its.has(other))),
        new Set([...gone].filter((other) => its.has(other))));
      may.delete(one);
      gone.add(one);
    }
    return out;
  };
  grow([], new Set(near.keys()), new Set());
  return out;
};

/** A family is a set every member of which reads alike to every other: joined transitively instead,
 *  418 of 585 open issues came back as one family. */
export const familiesOf = (links) => {
  const near = nearMap(links);
  const held = cliquesIn(near).filter((members) => members.length > 1);
  return held
    .map((members) => ({
      members: [...members].sort(),
      links: links.filter((link) => members.includes(link.from) && members.includes(link.to)),
    }))
    .sort((one, two) => two.links[0].score - one.links[0].score
      || two.members.length - one.members.length
      || one.members[0].localeCompare(two.members[0]));
};

const bandOf = (links) => {
  const scores = links.map((one) => one.score);
  return `${scoreSaid(Math.min(...scores))} to ${scoreSaid(Math.max(...scores))}`;
};

const headLine = (family, at) =>
  `family ${at} — ${family.members.length} issue(s) over ${family.links.length} link(s), `
  + `${bandOf(family.links)}`;

const memberLine = (key, titles) => `  ${key.padEnd(KEY)}  ${titles.get(key) ?? ""}`;

const linkLine = (link) =>
  `  ${link.from} ${PAIR} ${link.to}  ${scoreSaid(link.score)}  off ${link.from}'s own title`;

const familyLines = (family, at, titles) => [
  headLine(family, at),
  ...family.members.map((key) => memberLine(key, titles)),
  ...family.links.map(linkLine),
  "",
];

const FLOOR_SAID = `${scoreSaid(FLOOR)}, the floor a filing is shown a neighbour at`;

const EVERY_PAIR = "Every member of a family reads alike to every other member of it, and each of"
  + " those readings is printed with its score and the end whose query measured it. One issue is in"
  + " two families where it reads alike to two sets that do not read alike to each other.";

const NOTHING_DECIDED = "Nothing was folded and nothing was written. No member is the head: which of"
  + " a family is one issue, and which is a second issue about the same words, is read off the"
  + " bodies.";

const countLine = (families, measured) => {
  const joined = new Set(families.flatMap((one) => one.members));
  return `${families.length} family(ies) over ${joined.size} of the ${measured} open issue(s) `
    + `measured, at ${FLOOR_SAID}. The strongest reading is first.`;
};

/* The two ways a query answers less than the backlog holds, said apart: one the search cut, one the
   tracker refused. Neither says how much is missing, because neither reading can know, and the width
   is the one the reader handed over: this module has measured nothing and states no figure of its own. */
const widthsOf = (saturated) =>
  [...new Set(saturated.map((one) => one.inBand))].sort((one, two) => one - two).join(" and ");

const saturatedLine = (saturated) =>
  `${saturated.length} query(ies) came back with every hit of the reading at or above the floor — `
  + `${widthsOf(saturated)} of them, and the reading was cut there — so what else is open beside `
  + `these reads short by an unknown amount: `
  + `${saturated.map((one) => one.issueId).join(", ")}.`;

const refusedLine = (notes) =>
  `${notes.length} query(ies) could not run, and the issues behind them were measured against`
  + ` nothing: ${notes.join("; ")}.`;

/** The answer whole. A count of what was measured goes out on every outcome, because a sweep that
 *  found nothing and a sweep that read nothing print the same empty list. */
export const sweepLines = ({ families, titles, measured, saturated, notes, short }) => {
  const out = families.length
    ? [countLine(families, measured), EVERY_PAIR, NOTHING_DECIDED]
    : [`No two of the ${measured} open issue(s) measured read alike at ${FLOOR_SAID}.`];
  if (saturated.length) out.push(saturatedLine(saturated));
  if (notes.length) out.push(refusedLine(notes));
  if (short) out.push(short);
  /* The accounting opens the answer: a reader piping this to a pager never reaches a footer. */
  out.push("");
  return [...out, ...families.flatMap((family, at) => familyLines(family, at + 1, titles))];
};
