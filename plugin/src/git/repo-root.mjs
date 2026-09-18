/* The checkout a directory stands in: the first ancestor holding a `.git` of any kind, canonical because that root is the key a state file and a log are grouped by, and a checkout reached through a symlink would otherwise be two repositories. `checkout-at.mjs` beside this asks it strictly. */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { canonical } from "../resolve/canonical.mjs";

export const repoRoot = (start) => {
  let directory = resolve(start);
  for (;;) {
    if (existsSync(join(directory, ".git"))) return canonical(directory);
    const up = dirname(directory);
    if (up === directory) return null;
    directory = up;
  }
};
