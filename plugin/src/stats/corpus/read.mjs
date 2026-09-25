/* One project's corpus as both evals read it: the transcripts under it, what the project declared,
   and the two answers about the checkout that are not each other. Here rather than in either verb,
   because a second copy of this is two readings of one project that can drift apart in what they
   count — docs/cli/stats.md. */
import { classesFor } from "./classes.mjs";
import { answersIn } from "./answers.mjs";
import { declaredIn } from "./declared.mjs";
import { phase7For } from "./release.mjs";
import { rootFor } from "./corpus.mjs";
import { scopeOf } from "../marks/marks.mjs";
import { runsUnder } from "../runs.mjs";
import { cacheRoot, installedCopies } from "../versions.mjs";

/** The corpus a checkout names, and who it belongs to. `root` is WHERE the transcripts were read, a
 *  path under whatever temporary directory this run was handed; `scope` is WHOSE reading it is, which
 *  `scopeOf` derives. Neither stands in for the other, and holding a reading under the first is what
 *  made it unreachable from any other run (ISS-1984). */
export const corpusOf = async (directory) => {
  const root = rootFor(directory);
  const declared = declaredIn(directory);
  const act = await phase7For(directory);
  return { root, scope: scopeOf(directory), declared, act,
    ...runsUnder(root, null, classesFor(declared, act), answersIn(directory)),
    copies: installedCopies(cacheRoot()) };
};
