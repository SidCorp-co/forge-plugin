/* The tree a git command runs in, which is its `-C` taken from where the shell stands, not the shell's
   directory alone. Two gates read it: bash-guard and codex-second. */
import { isAbsolute, join, resolve } from "node:path";

import { NOWHERE } from "../hooks/shell-spans.mjs";

/** `moved` is a `directoryAt` or `standsIn` reading, where the shell stands, and `named` is the tree the
 *  command's own globals name, null for none. With a `base` the answer is placed against it. With none,
 *  the answer is returned as the text spells it, and a relative move is joined rather than resolved,
 *  since resolving it reads this process's cwd and not the event's. Where the shell stands nowhere the text
 *  names, only an absolute `-C` still answers, and `NOWHERE` goes back to the caller, because `resolve`
 *  would throw on it. */
export const treeNamed = (moved, named, base = null) => {
  if (moved === NOWHERE) return named && isAbsolute(named) ? named : NOWHERE;
  if (base !== null) return resolve(base, moved ?? ".", named ?? ".");
  if (!named || !moved || isAbsolute(named)) return named || moved;
  return isAbsolute(moved) ? resolve(moved, named) : join(moved, named);
};
