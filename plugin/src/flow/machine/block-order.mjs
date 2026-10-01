/* Between two `--criterion` flags a flag reads two ways: the parser binds it to the block before, and a
   writer grouping criteria under a heading means the block after (ISS-435). Only a flag the shared part
   also names changes what a block records, so that is the flag whose two readings disagree, and it
   disagrees wherever in the block it stands: directly after its own `--criterion` is where a heading
   writer puts the next group's value (ISS-2151). The last block has no block after it to be read as.
   Checked on the argv `blocksIn` in record.mjs splits, before anything is read or sent. */
import { FLAG_WORD } from "../../resolve/flags.mjs";
import { refuse } from "../../refusal.mjs";
import { typed } from "../../hooks/shell-spans.mjs";
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
  const valued = isFlag(value) || value === undefined ? flag : `${flag} ${typed(value)}`;
  const after = ahead.length ? ` after ${[...new Set(ahead)].join(" and ")}` : "";
  return `record ${kind}: ${valued} stands in ${per} ${own}'s block${after}, with ${opener} ${next} next. `
    + `It would be written onto ${per} ${own}, and it reads as opening ${per} ${next}. Nothing was sent. `
    + `A flag the part before the first ${opener} also names is restated only in the last block, which no `
    + `block follows to be read as. Write the one you meant:\n`
    + `  … ${opener} ${next} … ${opener} ${own} ${valued} …   for ${per} ${own}, its block moved last\n`
    + `  record ${kind} <issue> ${valued} … ${opener} ${next} …   for ${per} ${next} and those after it, a write of its own\n`
    + `or give every block its own ${flag} and name none before the first ${opener}.`;
};

/** Refuses a flag the shared part names, written anywhere inside a block that another block follows;
 *  a kind whose shape opens no blocks is never refused here. */
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
    /* `--criterion` with nothing after it is refused by name further on, so no position is judged here. */
    if (isFlag(own[1]) || own[1] === undefined) continue;
    const ahead = [];
    for (let index = 2; index < own.length; index += 1) {
      const flag = own[index];
      if (!isFlag(flag)) continue;
      if (!shared.has(flag)) ahead.push(flag);
      else {
        refuse(misplaced(kind, { per, flag, value: own[index + 1], own: own[1], next: blocks[at + 1][1], ahead }));
      }
    }
  }
};
