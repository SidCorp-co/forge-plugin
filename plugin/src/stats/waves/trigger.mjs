/* When a wave comparison is due: at every tenth fold the project's dispatchers wrote, said once by
   the fold write that reaches it, so nobody has to remember to run the eval. */
import { dispatchersOf, foldsIn } from "./find.mjs";
import { WAVE_WINDOW } from "./eval.mjs";

/** The line a fold write prints where it makes the folded count a multiple of the window, or null.
 *  The write itself is still running and so is in no transcript as answered: it is the one added. */
export const foldDue = (directory) => {
  const folds = foldsIn(dispatchersOf(directory).sessions) + 1;
  if (folds % WAVE_WINDOW) return null;
  return `${folds} waves folded for this project. Compare the last ${WAVE_WINDOW} with the ${WAVE_WINDOW} `
    + "before them:\n  forge stats eval --waves";
};
