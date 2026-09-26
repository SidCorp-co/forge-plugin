/* Where commits the default branch lacks go, which is not one answer (ISS-2543). Under ship mode
   `ready` a run never lands its own change: the landing does, from the pushed branch its checkpoint
   names, so `ship` is the one route such a run may not be sent down, and commits `origin/<branch>`
   already carries do not die with the tree. The ancestry reading stays in `finish.mjs`; this reads
   the two sources that decide the route — the project's ship mode and the checkpoint the landing
   writes — and no third. docs/cli/the-checkpoint.md. */
import { REMOTE, git, remoteRef } from "../../checkout.mjs";
import { landingOf, landingTurn } from "../../../plugin/src/flow/landing/checkpoint.mjs";
import { readContext } from "../../../plugin/src/flow/lease.mjs";
import { refusing, shipMode } from "../../../plugin/src/resolve/settings.mjs";
import { documentIdOf } from "../../../plugin/src/tracker/issues.mjs";

const READY = "ready";
const LANDER = "lander";

/* Off the remote-tracking ref and never the remote, as the default branch is read: a ref this
   checkout has not fetched can only name fewer commits, so a stale one says they die and never lets
   one die. */
const carried = (path, branch) =>
  git(["merge-base", "--is-ancestor", "HEAD", remoteRef(branch)], path).status === 0;

const checkpointOf = async (key) => {
  try {
    return { landing: landingOf(await refusing(async () => readContext(await documentIdOf(key)))) };
  } catch (error) {
    return { unread: error?.message ?? String(error) };
  }
};

const turnSaid = (landing) => {
  const turn = landingTurn(landing);
  return turn ? `the ${turn}'s turn` : "nobody's turn";
};

/** The refusal for commits `origin/<base>` does not carry where the ship mode and the checkpoint
 *  decide it, or null where they do not and the ship route stands. `held` is the commits' own line. */
export const aheadRoute = async ({ key, root, path, base, branch, held, runner }) => {
  if (shipMode().value !== READY) return null;
  const lacks = `${branch} holds ${held.length} commit(s) ${REMOTE}/${base} does not carry`;
  const resume = `forge resume ${key}`;
  const read = await checkpointOf(key);
  if (read.unread) {
    return { why: `${lacks}, and under ship mode \`${READY}\` landing them is not this run's; the landing `
      + `checkpoint on ${key} could not be read (${read.unread}), so nothing here says whose turn it is: `
      + held.join("; "), how: resume };
  }
  if (!read.landing || read.landing.branch !== branch) return null;
  const state = `the checkpoint on ${key} reads \`${read.landing.state}\`, ${turnSaid(read.landing)}`;
  if (!carried(path, branch)) {
    return { why: `${lacks}, which die with the tree: ${REMOTE}/${branch}, which the landing builds from, `
      + `does not carry its head, and ${state}: ${held.join("; ")}`,
    how: `git -C ${path} push ${REMOTE} ${branch}` };
  }
  const own = `${lacks}, which ${REMOTE}/${branch} carries for the landing to build from, and ${state}`;
  return landingTurn(read.landing) === LANDER
    ? { why: `${own}, so landing them is the landing's and not this run's: ${held.join("; ")}`,
      how: `${runner(root, "run.mjs")} land-ready ${key}` }
    : { why: `${own}, so what lands them is whatever that turn owes: ${held.join("; ")}`, how: resume };
};
