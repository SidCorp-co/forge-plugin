/* One reading of what a path really is, so a checkout reached by two symlinked paths is one key wherever it is keyed. A name resolving to nothing is the name itself: a path pointing nowhere is still the one the caller was given. */
import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** Where a path lands on disk, existing or not: the deepest part of it that exists, resolved, with the
 *  rest appended as spelt. A file not written yet under a directory not made yet still lands wherever a
 *  link above them leads, and reading only the whole path would take the spelling for the answer. */
export const landing = (path) => {
  const rest = [];
  /* Unnormalised, so a `..` is taken after the link before it rather than cancelling the link's own name. */
  let at = isAbsolute(path) ? path : resolve(path);
  for (;;) {
    try {
      return join(realpathSync(at), ...rest);
    } catch {
      const up = dirname(at);
      if (up === at) return resolve(path);
      rest.unshift(basename(at));
      at = up;
    }
  }
};
