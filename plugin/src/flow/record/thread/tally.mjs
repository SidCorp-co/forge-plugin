/* What a verdict write recorded, read back counted: echoed block by block, twenty-eight `pass` and one
   `skipped` look exactly like the eighteen and eleven the writer meant, and one line by value is what a
   writer can hold against their intent in the second after the write (ISS-2198). */
import { SHORT, VERDICTS, criterionNumber } from "../../machine.mjs";

/* The order the help's list of values reads in, with any value that list does not name kept after it. */
const ORDER = [...new Set(["pass", "fail", SHORT, "skipped", ...VERDICTS])];

const grouped = (blocks, key) => {
  const by = new Map();
  for (const got of blocks) by.set(key(got), [...(by.get(key(got)) ?? []), got]);
  return by;
};

const numbered = (blocks) => blocks.map((got) => criterionNumber(got.criterion)).sort((one, two) => one - two);

const countLine = (reference, blocks) => {
  const by = grouped(blocks, (got) => got.verdict);
  const parts = ORDER.filter((value) => by.has(value))
    .map((value) => `${by.get(value).length} ${value} (${numbered(by.get(value)).join(", ")})`);
  return `wrote ${blocks.length} verdict(s) on ${reference}: ${parts.join(", ")}`;
};

// cm:why a `--why` on a `pass` is the judge's observation and is not remarked on: the judging method asks every verdict to say what was exercised, and a `fail` with no why is refused before sending, so no slip is left for a remark to catch (ISS-117)
/** Prints, once the write has landed, the count of what a verdict write recorded, on stderr: stdout
 *  carries the records, which a caller reads back by parsing it. A kind other than `verdict` says
 *  nothing. */
export const tallied = (kind, reference, blocks) => {
  if (kind !== "verdict" || !blocks.length) return null;
  const line = countLine(reference, blocks);
  return () => console.error(line);
};
