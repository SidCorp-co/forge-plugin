/* Which of a change's paths hold other bytes at one commit than at another, as git reads it. The merged
   mark's `landing moved` clause is this reading and never a run's word for it (ISS-1362), and the
   landing task asks the same question of its candidates, so the diff is spelt once. */
import { spawnSync } from "node:child_process";

const gitOut = (argv, tree) => {
  const { status, stdout, error } = spawnSync("git", argv, { cwd: tree, encoding: "utf8" });
  return error || status !== 0 ? null : String(stdout ?? "");
};

/** The first of these commits git cannot read in that tree, or null where it reads them all. */
export const unreadableIn = (tree, commits) =>
  commits.find((one) => gitOut(["rev-parse", "--verify", "--quiet", `${one}^{commit}`], tree) === null) ?? null;

/** The paths among `paths` whose content differs between `from` and `to`, in git's order; [] where
 *  there are no paths to ask about, and null where git could not answer. `--no-renames`, because with
 *  detection on a renamed path's source is absent from the list and an edit to it passes unseen; the
 *  paths literal, since a name holding `*` is a file and not a pattern. */
export const movedBetween = (tree, from, to, paths) => {
  if (!paths.length) return [];
  /* From the top of the checkout, the paths being the repository's own: asked from a subdirectory, git
     reads a pathspec relative to it and a changed file would match nothing. */
  const top = gitOut(["rev-parse", "--show-toplevel"], tree)?.trim();
  if (!top) return null;
  const said = gitOut(["--literal-pathspecs", "diff", "--no-renames", "--name-only", from, to, "--", ...paths], top);
  return said === null ? null : said.split("\n").filter(Boolean);
};
