/* What a verdict write recorded, read back counted: echoed block by block, twenty-eight `pass` and one
   `skipped` look exactly like the eighteen and eleven the writer meant, and one line by value is what a
   writer can hold against their intent in the second after the write (ISS-2198). A `--why` riding onto
   a `pass` is said rather than refused, because the shape's own check also judges records already on
   the tracker, and a pass carrying a why is a record somebody has written. */
import { SHORT, VERDICTS, criterionNumber } from "../../machine.mjs";
import { typed } from "../../../hooks/shell-spans.mjs";

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

const identityOf = (got) => (got.landing !== undefined ? `--landing ${typed(got.landing)}` : `--commit ${typed(got.commit)}`);

/* One command per identity the blocks recorded, since one write may judge two heads. */
const whyOnPass = (reference, blocks) => {
  const carried = blocks.filter((got) => got.verdict === "pass" && got.why !== undefined);
  if (!carried.length) return null;
  const commands = [...grouped(carried, identityOf)].map(([identity, held]) =>
    `  forge record verdict ${typed(reference)} ${identity} ${held.map((got) =>
      `--criterion ${criterionNumber(got.criterion)} --verdict skipped --why ${typed(got.why)}`).join(" ")}`);
  return `--why rode onto criterion ${numbered(carried).join(", ")}, recorded \`pass\`. A pass owes no why, so a `
    + "reason written there is most often one meant for a block that went without it. The record stands as "
    + "written. Where those criteria were not met as written, a later verdict on each replaces it — `skipped` "
    + "below, or `fail` or `short` where one was exercised:\n"
    + commands.join("\n");
};

/** Prints, once the write has landed, the count of what a verdict write recorded and any `pass` a
 *  `--why` rode onto, on stderr: stdout carries the records, which a caller reads back by parsing it.
 *  A kind other than `verdict` says nothing. */
export const tallied = (kind, reference, blocks) => {
  if (kind !== "verdict" || !blocks.length) return null;
  const line = countLine(reference, blocks);
  const remark = whyOnPass(reference, blocks);
  return () => console.error(remark ? `${line}\n${remark}` : line);
};
