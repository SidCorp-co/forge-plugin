/* Which checkout a directory stands in and which repository it belongs to, walked off the disk:
   `git rev-parse` is a process, and one standing in the checkout is a test file the gate's read
   audit spends every run (ISS-1732). What this walk reads and where git disagrees: docs/cli/settings.md. */
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const answered = (read) => {
  try {
    return read();
  } catch {
    return null;
  }
};

const GITDIR = /^gitdir:\s*(\S.*)$/mu;

const against = (at, named) => (isAbsolute(named) ? named : resolve(at, named));

const holdsGit = (dot) => Boolean(answered(() => statSync(join(dot, "HEAD"))));

const commonOf = (dir) => {
  const named = answered(() => readFileSync(join(dir, "commondir"), "utf8"))?.trim();
  const at = named ? against(dir, named) : dir;
  return answered(() => realpathSync(at)) ?? at;
};

const found = (tree, gitDir) => ({ tree, gitDir, repository: dirname(commonOf(gitDir)) });

/** That checkout's own root, its git directory, and the root of the repository that directory belongs to; null where no checkout holds the path. */
export const checkoutAt = (from) => {
  const start = answered(() => realpathSync(resolve(from ?? ".")));
  if (!start) return null;
  for (let at = start; ; at = dirname(at)) {
    const dot = join(at, ".git");
    const kind = answered(() => statSync(dot));
    if (kind?.isDirectory() && holdsGit(dot)) return found(at, dot);
    if (kind?.isFile()) {
      const named = GITDIR.exec(answered(() => readFileSync(dot, "utf8")) ?? "")?.[1]?.trim();
      return named ? found(at, against(at, named)) : null;
    }
    if (dirname(at) === at) return null;
  }
};
