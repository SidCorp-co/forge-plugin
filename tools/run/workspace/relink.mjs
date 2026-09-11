/* The route back the grant's refusal cannot give a tree already cut: `start` refuses a worktree it
   did not make, so the repair was two commands nobody was told (ISS-884). This removes nothing. */
import { resolve } from "node:path";

import { checkoutRoot, gitOut, stop } from "../../checkout.mjs";
import { borrowedInto, BROKEN } from "./links.mjs";

const REFUSED = 1;

const MARK = { absent: "left", kept: "kept", made: "relinked", occupied: "left", unresolved: "broken" };

const WIDTH = 10;

/* The tree is the one holding the copy of the script that runs, as a ship's is, and never the
   shell's directory: a verb deriving it from the cwd repairs a sibling's tree from inside your own. */
export const relink = (read, { here, write }) => {
  const root = checkoutRoot(here);
  const tree = gitOut(["rev-parse", "--show-toplevel"], here);
  if (!tree) {
    stop(`git names no worktree root for ${here}, so nothing here knows what that path borrows. `
      + `Take this from the tree itself: git -C ${root} worktree list`);
  }
  if (resolve(tree) === resolve(root)) {
    stop(`${root} is the checkout, and what a worktree borrows is the checkout's own install: this `
      + `writes there for nobody. Take that tree's own copy: git -C ${root} worktree list`);
  }
  console.log(`What ${tree} borrows from ${root}:`);
  const held = borrowedInto(root, tree, write);
  for (const one of held) console.log(`  ${MARK[one.kind].padEnd(WIDTH)}${one.said}`);
  const broken = held.filter((one) => BROKEN.has(one.kind));
  const skipped = held.filter((one) => one.kind === "absent").length;
  if (!broken.length) {
    return console.log(skipped
      ? `Every path this tree borrows and the checkout holds resolves to the checkout's own; the `
        + `${skipped} above it does not hold are the checkout's to install and nobody's to link.`
      : `Every path this tree borrows resolves to the checkout's own, and nothing else here was touched.`);
  }
  console.error(`${broken.length} borrowed path(s) still do not resolve, and finding that out took `
    + `nothing: the worktree, its branch and every uncommitted path in it are where they were.`);
  process.exitCode = REFUSED;
  return undefined;
};
