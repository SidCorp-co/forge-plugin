/* What a refused test step leaves on its verdict for the landing to read: each case that reproduced,
   and what its file's own process read in the run that refused. The per-file store holds passes
   only, so its entry for a file that has just failed answers for other content; the audit of this
   run is the one reading of the failing content there is (ISS-2480). */
import { isAbsolute, relative } from "node:path";

import { setsFrom } from "./sets.mjs";

const sorted = (held) => [...held].sort();

/* Null where the audit cannot answer for the file: no finished record of it, or a child it could not
   follow. A reading short of what the file read would clear a member that wrote the rest. */
const readOf = (set) => (!set || set.blind.length > 0
  ? null
  : { paths: sorted(set.paths), dirs: sorted(set.dirs), trees: sorted(set.trees), whole: sorted(set.whole) });

/** The cases, each with what its failure said of itself, and the reads, keyed by the repository path
 *  of each failing file. */
export const failedReads = (out, root, reproduced) => {
  const sets = new Map(setsFrom(out, root).map((one) => [one.file, one]));
  const cases = reproduced.map(({ one }) => ({
    file: isAbsolute(one.file) ? relative(root, one.file) : one.file,
    name: one.name,
    said: Array.isArray(one.said) ? one.said : [],
  }));
  const reads = Object.fromEntries(cases.map(({ file }) => [file, readOf(sets.get(file))]));
  return { cases, reads };
};
