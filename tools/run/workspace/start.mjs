/* The workspace one run works in: the worktree beside the checkout, the two links a gate in it
   resolves its linter through, the id it holds its lease under and the directory its scratch belongs
   in. `finish.mjs` is the counterpart, and the two read one derivation of the path (ISS-1106). */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { configSource } from "../../../plugin/src/resolve/config.mjs";
import { BORROW_VAR } from "../../../plugin/src/resolve/machine/borrowed.mjs";
import { checkoutRoot, defaultBranch, git, loud, stop } from "../../checkout.mjs";
import { endedDropped } from "./ended.mjs";
import { borrowedInto, BROKEN } from "./links.mjs";
import { KEY, occupied, worktreePath } from "./occupant.mjs";
import { mintRunId, RUN_ID_VAR, scratchMinted } from "./run-id.mjs";

/* Made here rather than left to the run, so a run's logs and scratch files have a place whose name says whose they are and `finish` removes that one path. One that cannot be made is said and stops nothing: a run without one writes elsewhere and `finish` then finds nothing to remove, which is the safe answer either way. */
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
  console.log(`  TMPDIR=${at}`);
  /* That variable and no second one for the run itself. This directory is made empty, so a shell pointing XDG_CONFIG_HOME at it held no credential, wrote its consults to a log the commit gate does not read and `finish` then removed, and every delegated run that did as it was told went missing from the corpus a release is judged on (ISS-189). */
  console.log(`Plugin state is not scratch: the credential, the consult log and the turn `
    + `record stay in this machine's own config directory, which is where the hooks read them from `
    + `whatever this shell exports.`);
  /* A probe is the exception, and it had no route: four runs of one day that needed live data made a
     home of their own and copied the token into it, and `finish` refuses while such a copy stands
     (ISS-2612). */
  console.log(`A probe that needs live data and must write nothing of this machine's own points its home`);
  console.log(`under that directory and borrows the credentials, read-only, rather than copying them in:`);
  return console.log(`  XDG_CONFIG_HOME=${join(at, "home")} ${BORROW_VAR}=${configSource("token")}`);
};

/* The keys first and the slug after them, rather than a count: a batch is one tree under one id and
   the id is what its members' claims are taken on, so a `start` that read one key left the second
   and third of a batch with no tree whose id names them (ISS-1295). */
const dispatched = (words, self) => {
  const keys = [];
  for (const one of words) {
    const key = String(one).toUpperCase();
    if (!KEY.test(key)) break;
    keys.push(key);
  }
  if (!keys.length) stop(`start takes the issue key it works, \`ISS-nn\`, not \`${words[0] ?? ""}\`.`);
  const rest = words.slice(keys.length);
  if (rest.length > 1) {
    stop(`start takes the keys of one batch and then one slug for the branch, and \`${rest[1]}\` `
      + `follows the slug \`${rest[0]}\`. A key after the slug is read as the slug's neighbour and `
      + `not as a key: ${self} start ${[...keys, rest[1]].join(" ")} ${rest[0]}`);
  }
  return { keys, slug: rest[0] };
};

export const start = ({ words }, { here, self, write }) => {
  const { keys, slug } = dispatched(words, self);
  const [key] = keys;
  const root = checkoutRoot(here);
  const path = worktreePath(root, key);
  if (existsSync(path)) stop(occupied(root, path));
  const branch = `iss-${key.slice(4).toLowerCase()}${slug ? `-${slug}` : ""}`;
  const base = defaultBranch(root);
  loud("git", ["-C", root, "worktree", "add", path, "-b", branch, base], root,
    `Pick another branch name than ${branch} if it is taken.`);
  // A record of this key's earlier ending would otherwise answer for this tree once it is gone.
  endedDropped(root, key);
  /* All of it or none of it: a half-linked tree refuses the next `start` for the path it left and
     keeps the branch it cut, so the run's escape is two commands it was never told. */
  const made = borrowedInto(root, path, write);
  const broken = made.filter((one) => BROKEN.has(one.kind));
  if (broken.length) {
    git(["-C", root, "worktree", "remove", "--force", path], root);
    git(["-C", root, "branch", "-D", branch], root);
    stop(`${path} was cut and what it borrows does not resolve, so the worktree and ${branch} are `
      + `removed again and nothing is half-made:\n${broken.map((one) => `  ${one.said}`).join("\n")}\n`
      + `A link this filesystem writes and cannot then read is what this refuses rather than hands `
      + `you, the tree's own gate having no way to say it: ${self} start ${key} again.`);
  }
  for (const one of made) {
    if (one.kind === "absent") console.error(`  ${one.said}.`);
    else console.log(`  linked  ${one.at}`);
  }
  console.log(`\nBranch ${branch} on ${path}, cut from ${base}.`);
  console.log(`This run's own lease holder, which every tracker write it makes carries — without it`);
  console.log(`the run writes under the dispatching session's id, which every agent of a wave shares.`);
  console.log(`It names ${keys.join(", ")}, so a claim on any of them is this run's to take:`);
  const id = mintRunId(path, keys);
  console.log(`  ${RUN_ID_VAR}=${id}`);
  scratchMade(path, id, self);
  console.log(`Probe the change with this tree's own wrapper, never the one on PATH:`);
  console.log(`  ${join(path, "plugin", "bin", "forge")} <args>`);
  console.log(`  node ${join(path, "plugin", "hooks", "entries")}/<gate>.mjs   one gate, alone`);
  console.log(`Put those links back if they stop resolving, by that tree's own copy of this script:`);
  console.log(`  node ${join(path, "tools", "run.mjs")} relink`);
  /* Every other line here names `self`, the checkout's own command, because it is read from where
     this call stands. This one names a later moment: the reader is standing in `path`, the worktree
     just cut, where `self`'s `forge-plugin/` prefix resolves nothing. `tools/run.mjs` is the same
     script found from there instead (ISS-978). */
  console.log(`Ship it from that tree: node tools/run.mjs ship`);
  console.log(`End the workspace from the checkout once the issue is closed: ${self} finish ${key}`);
};
