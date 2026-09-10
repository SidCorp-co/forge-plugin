/* The workspace one run works in: the worktree beside the checkout, the two links a gate in it
   resolves its linter through, the id it holds its lease under and the directory its scratch belongs
   in. `finish.mjs` is the counterpart, and the two read one derivation of the path (ISS-1106). */
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { checkoutRoot, defaultBranch, git, loud, stop } from "../../checkout.mjs";
import { LINKED } from "../install.mjs";
import { KEY, occupied, worktreePath } from "./occupant.mjs";
import { mintRunId, RUN_ID_VAR, scratchMinted } from "./run-id.mjs";

/* Made here rather than left to the run, so a run's logs and its seeded config home have a place whose name says whose
   they are and `finish` removes that one path. One that cannot be made is said and stops nothing: a run without one
   writes elsewhere and `finish` then finds nothing to remove, which is the safe answer either way. */
const scratchMade = (tree, id, self) => {
  const at = scratchMinted(tree, id);
  try {
    mkdirSync(at, { recursive: true });
  } catch (error) {
    return console.error(`  ${at} could not be made (${error.message}), so this run has no scratch `
      + `directory of its own and whatever it writes elsewhere is nobody's to remove.`);
  }
  console.log(`Put every scratch file this run makes under that id's own directory, which is what`);
  console.log(`${self} finish removes and the only path under the temporary root it will:`);
  return console.log(`  TMPDIR=${at}  XDG_CONFIG_HOME=${at}`);
};

export const start = ({ words: [given, slug] }, { here, self }) => {
  const key = String(given ?? "").toUpperCase();
  if (!KEY.test(key)) stop(`start takes the issue key it works, \`ISS-nn\`, not \`${given ?? ""}\`.`);
  const root = checkoutRoot(here);
  const path = worktreePath(root, key);
  if (existsSync(path)) stop(occupied(root, path));
  const branch = `iss-${key.slice(4).toLowerCase()}${slug ? `-${slug}` : ""}`;
  const base = defaultBranch(root);
  loud("git", ["-C", root, "worktree", "add", path, "-b", branch, base], root,
    `Pick another branch name than ${branch} if it is taken.`);
  /* All of it or none of it: a half-linked tree refuses the next `start` for the path it left and
     keeps the branch it cut, so the run's escape is two commands it was never told. */
  try {
    for (const one of LINKED) {
      if (!existsSync(join(root, one))) {
        console.error(`  ${one} is not installed in the checkout, so nothing was linked for it.`);
        continue;
      }
      symlinkSync(join(root, one), join(path, one));
      console.log(`  linked  ${join(path, one)}`);
    }
  } catch (error) {
    git(["-C", root, "worktree", "remove", "--force", path], root);
    git(["-C", root, "branch", "-D", branch], root);
    stop(`${path} could not be linked (${error.message}), so the worktree and ${branch} are removed `
      + `again and nothing is half-made. Install the checkout's dependencies, then start over.`);
  }
  console.log(`\nBranch ${branch} on ${path}, cut from ${base}.`);
  console.log(`This run's own lease holder, which every tracker write it makes carries — without it`);
  console.log(`the run writes under the dispatching session's id, which every agent of a wave shares:`);
  const id = mintRunId(path, key);
  console.log(`  ${RUN_ID_VAR}=${id}`);
  scratchMade(path, id, self);
  console.log(`Probe the change with this tree's own wrapper, never the one on PATH:`);
  console.log(`  ${join(path, "plugin", "bin", "forge")} <args>`);
  console.log(`  node ${join(path, "plugin", "hooks", "entries")}/<gate>.mjs   one gate, alone`);
  console.log(`Ship it from that tree: ${self} ship`);
  console.log(`End the workspace from the checkout once the issue is closed: ${self} finish ${key}`);
};
