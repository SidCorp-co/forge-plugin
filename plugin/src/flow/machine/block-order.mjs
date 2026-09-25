/* Between two `--criterion` flags a flag reads two ways: the parser binds it to the block before, and a
   writer grouping criteria under a heading means the block after (ISS-435). Only a flag the shared part
   also names changes what a block records, so that is the flag whose two readings disagree, and only
   once one of the block's other flags stands ahead of it: directly after its own `--criterion` it has
   one reading, and the last block has no block after it to be read as. Checked on the argv `blocksIn`
   in record.mjs splits, before anything is read or sent. */
import { FLAG_WORD } from "../../resolve/flags.mjs";
import { refuse, typedBack } from "../../refusal.mjs";
import { SHAPES } from "../machine.mjs";

const isFlag = (token) => token !== undefined && FLAG_WORD.test(token);

const splitAt = (tokens, opener) => {
  const blocks = [];
  for (const token of tokens) {
    if (token === opener) blocks.push([]);
    blocks.at(-1).push(token);
  }
  return blocks;
};

const misplaced = (kind, { per, flag, value, own, next, ahead }) => {
  const opener = `--${per}`;
  const valued = isFlag(value) || value === undefined ? flag : `${flag} ${typedBack(value)}`;
  return `record ${kind}: ${valued} stands in ${per} ${own}'s block after ${[...new Set(ahead)].join(" and ")}, with `
    + `${opener} ${next} next. It would be written onto ${per} ${own}, and it reads as opening ${per} `
    + `${next}. Nothing was sent. Inside a block another ${opener} follows, a flag the part before the `
    + `first ${opener} also names stands directly after that block's own ${opener}. Write the one you meant:\n`
    + `  ${opener} ${own} ${valued} ${[...new Set(ahead)].map((one) => `${one} …`).join(" ")}   for ${per} ${own}\n`
    + `  ${opener} ${next} ${valued} …   for ${per} ${next}\n`
    + `or give the ${per} values that differ from the shared ones a write of their own.`;
};

/** Refuses a flag the shared part names, written inside a block that another block follows and after
 *  one of that block's own flags; a kind whose shape opens no blocks is never refused here. */
export const blockOrderChecked = (kind, argv) => {
  const per = SHAPES[kind]?.per;
  if (!per) return;
  const opener = `--${per}`;
  const opens = argv.indexOf(opener);
  if (opens < 0) return;
  const shared = new Set(argv.slice(0, opens).filter(isFlag));
  if (!shared.size) return;
  const blocks = splitAt(argv.slice(opens), opener);
  for (let at = 0; at < blocks.length - 1; at += 1) {
    const own = blocks[at];
    /* A block whose key has no value is the parser's syntax error to answer, not a position to judge. */
    if (isFlag(own[1]) || own[1] === undefined) continue;
    const ahead = [];
    for (let index = 2; index < own.length; index += 1) {
      const flag = own[index];
      if (!isFlag(flag)) continue;
      if (!shared.has(flag)) ahead.push(flag);
      else if (ahead.length) {
        refuse(misplaced(kind, { per, flag, value: own[index + 1], own: own[1], next: blocks[at + 1][1], ahead }));
      }
    }
  }
};
