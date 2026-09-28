/* Whether one commit carries another, as the checkout a write stands in reads it. The `testing` rung
   reads no repository, so the verdict write asks this where both commits are at hand and puts the
   answer on the record (ISS-1302). Replacements and grafts are switched off and a shallow history
   settles nothing, as `carriedByLanding` holds: a yes read over either proves only the overlay. */
import { spawnSync } from "node:child_process";

import { shortSha } from "../tracker/evidence.mjs";

const PROVEN = { GIT_NO_REPLACE_OBJECTS: "1", GIT_GRAFT_FILE: "/dev/null", GIT_TERMINAL_PROMPT: "0" };

const ran = (argv, cwd) => spawnSync("git", argv, { cwd, encoding: "utf8", env: { ...process.env, ...PROVEN } });

const said = (argv, cwd) => {
  const done = ran(argv, cwd);
  return done.error || done.status !== 0 ? null : String(done.stdout ?? "").trim();
};

const unsettled = (why) => ({ carries: null, why });

/** `{ carries: true }` where git reads `ancestor` as an ancestor of `descendant` or as that commit,
 *  `{ carries: false, why }` where it reads it as neither, and `{ carries: null, why }` where this
 *  checkout cannot answer, the reason saying what would let it. */
export const commitCarries = (ancestor, descendant, cwd = process.cwd()) => {
  if (said(["rev-parse", "--git-dir"], cwd) === null) return unsettled("this directory is no git checkout");
  if (said(["rev-parse", "--is-shallow-repository"], cwd) !== "false") {
    return unsettled("this checkout is shallow, so no ancestry read over it settles anything; `git fetch --unshallow` first");
  }
  const absent = [ancestor, descendant]
    .find((one) => said(["rev-parse", "--verify", "--quiet", `${one}^{commit}`], cwd) === null);
  if (absent) return unsettled(`this checkout holds no one commit named ${absent}; \`git fetch\` the branch that carries it`);
  const asked = ran(["merge-base", "--is-ancestor", ancestor, descendant], cwd);
  if (asked.status === 0) return { carries: true, why: null };
  if (asked.status === 1) return { carries: false, why: `${shortSha(ancestor)} is no ancestor of ${shortSha(descendant)}` };
  return unsettled("git could not answer whether the one reaches the other");
};
