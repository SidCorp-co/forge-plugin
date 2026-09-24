/* `forge baseline publish`: the route a project's own release takes to publish the whole-tree result
   a later branch cites, where this repository's ship calls `publishBaseline` directly. The authority
   rule is held here by three refusals and not by who runs the verb: a commit the remote's default
   branch does not hold is one run's own and nobody else's, a tree with uncommitted work is not the
   tree the commit names, and a scope short of whole is no result to cite. Why the store stays one
   machine's: docs/cli/the-published-baseline.md. */
import { spawnSync } from "node:child_process";

import { fail, slugIfAny } from "../../resolve/settings.mjs";
import { flags, wantsHelp } from "../../resolve/flags.mjs";
import { helpOf } from "../../resolve/visibility.mjs";
import { isCommit, sameCommit, shortSha } from "../../tracker/evidence.mjs";
import { headNow } from "../worklog.mjs";
import { FAILED, declaredGates, publishBaseline, publishedSaid } from "./published.mjs";

const REMOTE = "origin";
const REMOTE_MS = 30_000;
const WHOLE = "whole";

/* No prompt and no ssh that can ask for anything: a release script blocked on a credential prompt is a step that never ends. */
const git = (args) => {
  const run = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: REMOTE_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -oBatchMode=yes" },
  });
  return run.status === 0 ? String(run.stdout ?? "").trim() : null;
};

/** The commit the remote's own default branch names, read off its HEAD rather than off a branch name guessed here, or null where the remote did not answer. */
export const remoteDefaultHead = (ask = git) => {
  const out = ask(["ls-remote", "--symref", REMOTE, "HEAD"]);
  return /^([0-9a-f]{40})\tHEAD$/mu.exec(out ?? "")?.[1] ?? null;
};

const refused = (why) => fail(`baseline publish: ${why} Nothing was published.`);

const gateOf = (given) => {
  const declared = declaredGates();
  if (given === undefined) {
    if (declared.length) return declared[0];
    return refused("--gate names the command the result is of, and this project declares none under "
      + "`stats.commands.gate`. Name it here, or declare it once so every baseline form arrives filled "
      + "in:\n  forge doctor --set stats.commands.gate=\"<command>\"");
  }
  if (declared.length && !declared.includes(given.trim())) {
    return refused(`--gate \`${given}\` is none of the gate commands this project declares `
      + `(${declared.map((one) => `\`${one}\``).join(", ")}), so a citation of it would name a gate `
      + "that is not the project's. Name one of those, or leave --gate out for the first.");
  }
  return given.trim();
};

/* The head in hand, clean: the one reading the baseline write stamps its own head with, so the published commit and the head a citing write stamps cannot be read two ways. */
const cleanHeadOr = () => {
  const head = headNow();
  if (head) return head;
  if (git(["rev-parse", "HEAD"]) === null) {
    return refused(`${process.cwd()} is in no git checkout with a commit, so there is no head to publish for.`);
  }
  return refused("this checkout holds uncommitted work, so the gate's reading is of content no commit "
    + "carries. Publish from the release's own checkout, clean, at the commit it pushed.");
};

const checked = (asked) => {
  if (asked.scope !== WHOLE) {
    refused(`--scope \`${asked.scope}\` is not \`${WHOLE}\`, and only a result over the whole tree is `
      + "published: a part leaves what it did not run with no answer, which is no green to cite.");
  }
  if (!isCommit(asked.commit)) refused(`--commit takes a commit sha, not \`${asked.commit}\`.`);
  if (!asked.result?.trim()) refused("--result says what the gate reported at that commit, and it is blank.");
  const head = cleanHeadOr();
  if (!sameCommit(asked.commit, head)) {
    refused(`--commit ${asked.commit} is not the commit this checkout stands at (${shortSha(head)}), and `
      + "the result is published for the tree in hand. Check out the commit the gate ran at.");
  }
  const held = remoteDefaultHead();
  if (!held) {
    refused(`${REMOTE}'s default branch could not be read with \`git ls-remote --symref ${REMOTE} HEAD\`, `
      + "so nothing says this commit is released.");
  }
  if (held !== head) {
    refused(`${REMOTE}'s default branch holds ${shortSha(held)} and this checkout is at ${shortSha(head)}: `
      + "a commit the default branch does not hold is one run's own, and one run's own gate is no "
      + "authority for the next. Publish after the push, for the commit it landed.");
  }
  return head;
};

const publish = (argv) => {
  const usage = helpOf("baseline");
  const asked = flags(argv, "baseline publish", [], { usage });
  for (const flag of ["commit", "result", "scope"]) {
    if (asked[flag] === undefined) fail(`baseline publish: --${flag} is owed. Nothing was published.\n${usage}`);
  }
  const commit = checked(asked);
  const outcome = publishBaseline({
    project: slugIfAny(),
    commit,
    gate: gateOf(asked.gate),
    result: asked.result.trim(),
    scope: WHOLE,
    version: asked.version?.trim() || null,
  });
  if (outcome === FAILED) refused(publishedSaid(outcome, commit));
  console.log(publishedSaid(outcome, commit));
};

const MORE = [
  "",
  "Run by a release, from its own checkout, after the push. Refused unless the commit is the one",
  `${REMOTE}'s default branch names, nothing in the checkout is uncommitted and the scope is whole,`,
  "so no run's own commit becomes the next run's authority. --gate defaults to the first command",
  "under `stats.commands.gate` and is refused where the project declares others. The result lands",
  "in this machine's store alone: `forge advance <ref> --owed` offers the citation to a run here.",
].join("\n");

export const baseline = async (argv) => {
  if (wantsHelp(argv)) return console.log(`${helpOf("baseline")}\n${MORE}`);
  const [sub, ...rest] = argv;
  if (sub !== "publish") {
    return fail(`baseline: \`${sub ?? ""}\` is no action of this verb, whose one action is publish.\n`
      + helpOf("baseline"));
  }
  return publish(rest);
};

baseline.answersHelp = true;
