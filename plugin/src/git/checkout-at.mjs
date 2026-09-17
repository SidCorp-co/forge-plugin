/* Which checkout a directory stands in and which repository it belongs to, walked off the disk:
   `git rev-parse` is a process, and one standing in the checkout is a test file the gate's read
   audit spends every run (ISS-1732). What this walk reads and where git disagrees: docs/cli/settings.md. */
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
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

const holdsGit = (dir) => Boolean(answered(() => lstatSync(join(dir, "HEAD"))));

const commonOf = (dir) => {
  const named = answered(() => readFileSync(join(dir, "commondir"), "utf8"))?.trim() || ".";
  const spelt = isAbsolute(named) ? named : `${dir}/${named}`;
  return answered(() => realpathSync.native(spelt)) ?? against(dir, named);
};

const anything = () => true;

const walked = (from, takes) => {
  const start = answered(() => realpathSync(resolve(from ?? ".")));
  if (!start) return null;
  for (let at = start; ; at = dirname(at)) {
    const dot = join(at, ".git");
    const kind = answered(() => statSync(dot));
    if (kind?.isDirectory() && takes(dot)) return { tree: at, gitDir: dot };
    if (kind?.isFile()) {
      const named = GITDIR.exec(answered(() => readFileSync(dot, "utf8")) ?? "")?.[1]?.trim();
      const gitDir = named ? against(at, named) : null;
      return gitDir && takes(gitDir) ? { tree: at, gitDir } : null;
    }
    if (dirname(at) === at) return null;
  }
};

export const gitEntryAt = (from) => walked(from, anything);

/** That checkout's own root, its git directory, and the root of the repository that directory belongs to; null where no checkout holds the path. */
export const checkoutAt = (from) => {
  const one = walked(from, holdsGit);
  return one === null ? null : { ...one, repository: dirname(commonOf(one.gitDir)) };
};
