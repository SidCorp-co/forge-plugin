/* One reading of what a path really is, so a checkout reached by two symlinked paths is one key wherever it is keyed. A name resolving to nothing is the name itself: a path pointing nowhere is still the one the caller was given. */
import { realpathSync } from "node:fs";

export const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};
