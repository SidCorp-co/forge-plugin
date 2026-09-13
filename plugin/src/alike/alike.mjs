/* Every open issue measured against every other, through the search and the floor the create path
   already spends on one filing. It reads and reports; the act it leads to is a person's. What the
   score can and cannot say, and what one sweep costs: docs/cli/alike.md. */
import { neighboursOf } from "../tracker/filing/neighbours.mjs";
import { familiesOf, linksFrom, sweepLines } from "./families.mjs";
import { liveTitles } from "../tracker/issue-shape.mjs";
import { shortOf } from "../tracker/issues.mjs";
import { flags } from "../resolve/flags.mjs";
import { helpOf } from "../resolve/visibility.mjs";

/* Twelve at once answered in thirteen seconds where one answers in eight, and the ceiling above it
   is the 503 that 171 reads issued together came back with: docs/cli/alike.md. */
const AT_ONCE = 12;
const SAID_EVERY = 50;

const spread = async (rows, each) => {
  const queue = [...rows];
  const worker = async () => {
    for (let one = queue.shift(); one !== undefined; one = queue.shift()) await each(one);
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, rows.length) }, worker));
};

/* On the error stream, so a reader piping the report gets the report alone. */
const saying = (total) => {
  let done = 0;
  return () => {
    done += 1;
    if (done % SAID_EVERY === 0 || done === total) console.error(`alike: ${done} of ${total} measured`);
  };
};

export const alike = async (argv) => {
  flags(argv, "alike", [], { usage: helpOf("alike") });
  const { live, read } = await liveTitles();
  const said = saying(live.length);
  const found = [];
  const saturated = [];
  const notes = [];
  await spread(live, async (one) => {
    const beside = await neighboursOf({ seed: one.title, place: null }, live);
    if (beside.cut) saturated.push({ issueId: one.issueId, inBand: beside.inBand });
    for (const note of beside.notes) notes.push(`${one.issueId}, ${note}`);
    for (const near of beside.suggestions) {
      /* Its own row comes back ranked like any other and often highest. */
      if (near.documentId === one.documentId || near.score === null) continue;
      found.push({ from: one.issueId, to: near.issueId, score: near.score });
    }
    said();
  });
  const lines = sweepLines({
    families: familiesOf(linksFrom(found)),
    titles: new Map(live.map((one) => [one.issueId, one.title])),
    measured: live.length,
    saturated: saturated.sort((one, two) => one.issueId.localeCompare(two.issueId)),
    notes,
    short: shortOf(read, "The walk over the open issues"),
  });
  for (const line of lines) console.log(line);
};
