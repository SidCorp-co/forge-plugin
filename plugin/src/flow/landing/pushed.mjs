/* Whether the head a ready capture names is the one origin holds for its branch, asked of origin
   itself. The capture is the one read that goes to the remote: a landing fetches the branch it names
   from there, and a head only this disk has armed a landing that then failed at its first fetch
   (ISS-2662). docs/cli/claim.md. */
import { spawnSync } from "node:child_process";

import { shortSha } from "../../tracker/evidence.mjs";

const REMOTE = "origin";

/* git's first fatal line is its reason; what follows it is advice about access rights. */
const reasonOf = (text) => {
  const lines = String(text ?? "").split("\n").map((one) => one.trim()).filter(Boolean);
  return (lines.find((one) => /^(fatal|error):/u.test(one)) ?? lines[0] ?? "").replace(/\.$/u, "");
};

const again = (ref) => `forge claim ${ref} --pushed --ready`;

/* The sha origin answers for the branch, "" where it holds none, or the failure git gave. Bounded,
   and with no prompt for credentials, since nobody is at this terminal to answer one and a capture
   that waits forever is not a refusal; the bound is the one `forge baseline publish` gives the same
   question. */
export const REMOTE_MS = 30_000;

export const remoteTip = (branch, { cwd = process.cwd(), ms = REMOTE_MS } = {}) => {
  const run = spawnSync("git", ["ls-remote", REMOTE, `refs/heads/${branch}`],
    { cwd, encoding: "utf8", timeout: ms, killSignal: "SIGKILL", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (run.error?.code === "ETIMEDOUT") return { failed: `no answer inside ${ms / 1000}s` };
  if (run.error) return { failed: run.error.message };
  if (run.status !== 0) return { failed: reasonOf(run.stderr) || `git ls-remote exited ${run.status}` };
  const line = run.stdout.split("\n").find((one) => one.endsWith(`\trefs/heads/${branch}`));
  return { tip: line ? line.split("\t")[0] : "" };
};

/** The refusal for a ready capture whose head origin does not hold at its branch, or null where it does. */
export const unpushedRefusal = (ref, { branch, head }) => {
  if (!branch || branch === "detached" || branch === "HEAD") {
    return `claim --ready names a branch the landing fetches from ${REMOTE}, and this checkout stands `
      + `on no branch. Put the head on one and push it, then capture again:\n`
      + `  git switch -c <branch>\n  git push -u ${REMOTE} <branch>\n  ${again(ref)}`;
  }
  const push = `  git push -u ${REMOTE} ${branch}\n  ${again(ref)}`;
  const { tip, failed } = remoteTip(branch);
  if (failed !== undefined) {
    return `claim --ready asks ${REMOTE} whether it holds \`${branch}\` at ${shortSha(head)}, and it did `
      + `not answer: ${failed}. Nothing was written. Once ${REMOTE} answers:\n  ${again(ref)}`;
  }
  if (!tip) {
    return `claim --ready names \`${branch}\` at ${shortSha(head)}, and ${REMOTE} holds no branch of that `
      + `name, so the landing would find nothing to fetch. Nothing was written. Push it, then capture again:\n${push}`;
  }
  if (tip !== head) {
    return `claim --ready names \`${branch}\` at ${shortSha(head)}, and ${REMOTE} holds it at `
      + `${shortSha(tip)}, so the landing would fetch a head this capture did not name. Nothing was `
      + `written. Push this head, then capture again:\n${push}`;
  }
  return null;
};
