/* What the reading in `holder.mjs` found, said to the caller who has to rule on it: nothing here can
   tell whose a process is. Which processes count and what the caller is asked:
   docs/cli/the-dead-holder.md (ISS-1872). */
import { RUN_ID, besideGit, runIdAt } from "../../resolve/session/run-id.mjs";
import { treeOf } from "./holder.mjs";
import { STOPPED, describe } from "../lease.mjs";

const NAMED = 3;

const rowLines = (rows) => [
  ...rows.slice(0, NAMED).map((one) => `  pid ${one.pid}  ${one.command}`
    + `${one.since ? `, running since ${one.since.slice(11, 16)}` : ""}`),
  ...(rows.length > NAMED ? [`  and ${rows.length - NAMED} more`] : []),
];

/* A caller standing outside the tree is told nothing by the file that mints the id. */
const reachedBy = (lease, tree, at) => (runIdAt(at) === lease.holder
  ? `That holder is the id ${besideGit(at, RUN_ID)} mints, so it names this tree and not one run in `
    + `it: every call made from here resolves ${lease.holder}.`
  : `That lease was claimed in ${tree}, which still mints ${lease.holder}, so the tree this reads is `
    + `the one the record names and not the one this call stands in.`);

export const workingSaid = (rows, lease, at = process.cwd()) => {
  const tree = treeOf(lease, at);
  return [`${reachedBy(lease, tree, at)} ${rows.length} process(es) standing in ${tree} run what that `
    + `project declares a run's own work and are neither this call, nor above it, nor anything it `
    + "started:",
  ...rowLines(rows),
  `They match \`lease.workingRe\`, which \`forge doctor\` prints. Nothing here can tell whose they `
    + `are, so whether a run is working under that lease is yours to `
    + `establish: \`ps -o pid,lstart,args -p ${rows.map((one) => one.pid).join(",")}\` reads them `
    + `again, and whatever each one is running says which run it belongs to.`].join("\n");
};

export const workingRefusal = (ref, lease, rows, at = process.cwd()) =>
  `${ref} is claimed and this claim would take a lease whose run may still be working: `
  + `${describe(lease)}. ${workingSaid(rows, lease, at)}\nWhere that work is this call's own, or you `
  + `have established that no run is under this lease, say so:\n  forge claim ${ref} ${STOPPED}`;
