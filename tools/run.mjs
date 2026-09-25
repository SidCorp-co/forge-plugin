#!/usr/bin/env node
/* One home for the procedure a change goes through outside its own diff. A prompt carrying it is a
   copy with nothing to fail when it ages past the tree, and four of the lines sixteen runs obeyed
   were workarounds for defects closed three releases earlier (ISS-79). */
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultBranch, git, gitOut, loud, Stop, stop } from "./checkout.mjs";
import { flagLines, VERBS, verbUsage, wanted } from "./run/args.mjs";
import { REPLAY_HELP } from "./run/replayed.mjs";
import { asDetached, detach, DETACH_HELP, DETACHES } from "./run/detached/landing.mjs";
import { landingWait } from "./run/detached/wait.mjs";
import { land } from "./run/land.mjs";
import { landReady } from "./run/land-ready.mjs";
import { named, NO_MARK, ship, shipHelp } from "./run/ship.mjs";
import { start } from "./run/workspace/start.mjs";
import { finish, FINISH_HELP } from "./run/workspace/finish.mjs";
import { LINKS_HELP } from "./run/workspace/links.mjs";
import { relink } from "./run/workspace/relink.mjs";
import { markRefused, REVIEWED, reviewedAt, reviewSays } from "./run/review.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = `node ${join(basename(HERE), "tools", "run.mjs")}`;

const sig = (verb) => VERBS.get(verb).signature;

const usage = () => [
  `Usage: ${SELF} <start|relink|finish|ship|land|land-ready|wait|review> [args]`,
  "The repository's own steps around one change: the worktree a run works in, the release that puts",
  "its commit in the plugin copy the next session loads, and the call that ends that workspace again.",
  "Everything else is the change itself.",
  "",
  `  ${sig("start")}`,
  "                          add the worktree beside this checkout, link both node_modules, and",
  "                          print the wrapper a probe of the change must invoke, the id this run",
  "                          holds its lease under, and the one directory its scratch belongs in.",
  "                          Several keys are one batch on one tree: the id names every one of them,",
  "                          so each member's lease is that run's to take, and the tree and branch",
  "                          are named for the first",
  `  ${sig("relink")}                  put back what the worktree holding this copy of the script borrows,`,
  "                          and remove nothing to do it: the tree, its branch and every",
  "                          uncommitted path in it stand whatever this finds. It says of each",
  "                          borrowed path whether it was kept, relinked, left or is still broken,",
  "                          and exits non-zero where any of them does not resolve",
  `  ${sig("finish")}         end the workspace \`start\` made for that key: the scratch directory under`,
  "                          that run's own id, the worktree, its branch through git's own merged",
  "                          check, and that tree's verdict record. It removes nothing else and",
  "                          nothing by pattern or by age, refuses where a removal would destroy",
  "                          work no record cites, and says what it left and why",
  `  ${sig("ship")}`,
  "                          clean tree, fetch, the review proved to answer for the head this lands,",
  "                          rebase, `npm run check`, a version above the remote head, push, the",
  "                          checkout offered that head, the marketplace and the plugin installed",
  "                          from the tree that shipped, then the installed copy named, the sha the",
  "                          change landed as, the landing checkpoint of every issue this tree was",
  "                          started for finished, and every file of it a session cannot pick up",
  "                          without restarting",
  `  ${sig("land")}         land a commit that is not a release: clean tree, fetch, rebase, push,`,
  "                          under the same lock the ship takes and nothing else of it. It spends no",
  "                          gate and raises no version, so what it pushes is the caller's judgement",
  "                          and the installed plugin copy is untouched. It is the checkout's own",
  "                          verb — a wave's journal entry, not a run's change, which is a release",
  `  ${sig("land-ready")}`,
  "                          land the branches a build left ready as one candidate: the base head",
  "                          pinned by ls-remote, the branches merged onto it in that order as",
  "                          one chain of candidate commits, each change's own paths proved unmoved",
  "                          by it, then one gate, one version above the pin, one push against that",
  "                          pin, one install, and the merged mark and statuses each issue's own",
  "                          record earns. It edits no run's tree and repairs no conflict: a conflict",
  "                          parks the issue, a moved path hands that branch back to the run that",
  "                          built it, and so does a branch whose diff takes back work that landed",
  "                          under it since it was cut, as the ship's step before its rebase says",
  "                          below. A candidate the gate refuses is landed one branch at a",
  "                          time rather than searched for a subset. Where the landing is is each",
  "                          issue's checkpoint, so a second run finishes what is owed and needs no",
  "                          step number. Naming no issue takes every one this project left ready,",
  "                          in the order they were captured; it prints that set, the state each",
  "                          checkpoint reads and what it left out, before it spends anything",
  `  ${sig("wait")}`,
  "                          wait on the landing of a tree, one this call did not start included,",
  "                          and exit with what that landing recorded: its own code where it ended,",
  "                          at once where it had already; 76 where it is gone having recorded no",
  "                          end or was ended by a signal, which is a failure and never a success;",
  "                          77 at this wait's own deadline with the landing still running, M",
  "                          minutes and at most what a call can hold; 78 where the tree holds no",
  "                          landing record at all. It reads the record and never a process or a log",
  `  ${sig("review")}   the range the next review reads, or --done to move the mark to it`,
  "",
  ...flagLines([...VERBS.values()].flatMap((one) => one.flags)),
  "",
  "ship stops at the first failure and writes nothing past it, and a resume past the gate spends the",
  "gate first, so nothing that pushes runs against a tree no gate has passed.",
  "",
  ...LINKS_HELP,
  "",
  ...FINISH_HELP,
  "",
  ...DETACH_HELP,
  "",
  ...REPLAY_HELP,
  ...shipHelp(),
].join("\n");

/* The mark's only writer, so nothing else has to agree with it about where a reading reached. */
const review = ({ flags }) => {
  const tree = process.cwd();
  const done = flags.get("--done");
  const from = reviewedAt(tree);
  if (!flags.has("--done")) {
    if (!from) stop(NO_MARK(SELF));
    const said = reviewSays(tree, from);
    if (said.refusal) stop(said.refusal);
    const { owed, range, count, threshold, paths, source } = said;
    console.log(`${range} is the next review's, and holds ${count} under ${paths.join(", ")}  ← ${source}`);
    console.log(`  git diff ${from}..HEAD -- ${paths.join(" ")}`);
    return console.log(owed
      ? `A review is owed: ${threshold} changed line(s) call for one, and this range is past that.`
      : `Short of the ${threshold} changed line(s) that call for a reading.`);
  }
  /* Refused, not reported: a mark too far forward reads like a reading that finished and grows
     nothing; the volume since it is a net diff, shrinking as later commits delete (ISS-146). */
  if (done === null && from) {
    stop(`a move of the mark names the head the reading reached, and only the first plant defaults: `
      + `other runs land on this branch while a reading is read, so this tree's HEAD is not that head. `
      + `${SELF} review --done <that head>, the end of the range the issue you were given names. Where `
      + `the reading did reach HEAD, say so: ${SELF} review --done ${gitOut(["rev-parse", "HEAD"], tree)}`);
  }
  const asked = done ?? "HEAD";
  const to = gitOut(["rev-parse", "--verify", `${asked}^{commit}`], tree);
  if (!to) stop(`\`${asked}\` is no commit in this tree, and the mark records where a reading reached.`);
  const reaches = git(["merge-base", "--is-ancestor", to, "HEAD"], tree).status === 0;
  const forward = !from || git(["merge-base", "--is-ancestor", from, to], tree).status === 0;
  if (!reaches || !forward) stop(markRefused({ tree, from, to, reaches, forward, self: SELF }));
  /* Two worktrees share this ref: without the old value, the second to finish drops the first's range. */
  loud("git", ["update-ref", REVIEWED, to, from ?? ""], tree,
    `The mark is not where this run read it. Another reading finished first: ${SELF} review, then move it again.`);
  console.log(from
    ? `${REVIEWED} ${from.slice(0, 7)} -> ${to.slice(0, 7)}; the next review reads from there.`
    : `${REVIEWED} planted at ${to.slice(0, 7)}; the next review reads from there.`);
};

const VERB_RUNS = new Map([
  ["start", (read) => start(read, { here: HERE, self: SELF })],
  ["relink", (read) => relink(read, { here: HERE })],
  ["finish", (read) => finish(read, { here: HERE })],
  ["ship", ship],
  ["land", (read) => land(read, SELF)],
  ["land-ready", (read) => landReady(read, { ...named(), root: HERE, base: defaultBranch(HERE), self: SELF })],
  ["wait", (read) => landingWait(read, { script: fileURLToPath(import.meta.url) })],
  ["review", review]]);

const main = async (argv) => {
  const [verb, ...rest] = argv;
  if (!verb || verb === "-h" || verb === "--help") return console.log(usage());
  if (!VERB_RUNS.has(verb)) {
    stop(`no step \`${verb}\`. It is ${[...VERB_RUNS.keys()].join(", ")}; \`${SELF} -h\` says what each does.`);
  }
  const read = wanted(verb, rest, SELF);
  if (!read) return console.log(verbUsage(verb, SELF));
  /* After the line is read whole, so help and a refused argument answer here and start nothing. */
  if (DETACHES.has(verb) && !asDetached(verb, rest) && await detach(verb, rest, fileURLToPath(import.meta.url))) return undefined;
  return VERB_RUNS.get(verb)(read);
};

/* Awaited: one step files in-process, so a `Stop` raised past the first await would land on nobody. */
try {
  await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
