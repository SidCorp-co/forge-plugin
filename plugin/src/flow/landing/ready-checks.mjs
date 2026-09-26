/* The checks a project declares a run spends before it arms a landing. They are the project's to name
   and never this plugin's to guess, because the landing a run skips them for is the first thing to
   find out which were owed, and it finds out at the landing's price (ISS-2515). The method served to
   every project says the cheap checkers go first and names none; this is where one project names its
   own. */
import { spawnSync } from "node:child_process";

import { repoRoot } from "../../git/repo-root.mjs";
import { fail, fromProject, projectFileAt } from "../../resolve/settings.mjs";
import { shortSha } from "../../tracker/evidence.mjs";
import { uncommittedOver } from "../worklog.mjs";

const READY_CHECKS = "ready.checks";
const TAKES = "a list of one or more commands, none of them blank";

/** Why `ready` cannot be read as it stands, or null. `forge doctor --set` and the capture both ask
 *  this one function, which is what keeps a value one of them takes from being one the other drops. */
export const readyProblem = (given) => {
  if (given === undefined) return null;
  if (!given || typeof given !== "object" || Array.isArray(given)) return { key: "ready", takes: "a table", given };
  const { checks } = given;
  if (checks === undefined) return null;
  const takes = Array.isArray(checks) && checks.length
    && checks.every((one) => typeof one === "string" && one.trim());
  return takes ? null : { key: READY_CHECKS, takes: TAKES, given: checks };
};

/** What the checkout at `directory` declares: `{ checks, from }`, `{ problem, from }` for a value the
 *  key does not take, or null where it declares nothing — the case that prints nothing at all. */
export const readyChecks = (directory = process.cwd()) => {
  const ready = projectFileAt(directory)?.ready;
  const problem = readyProblem(ready);
  if (problem) return { problem, from: fromProject() };
  return ready?.checks === undefined ? null : { checks: ready.checks.map((one) => one.trim()), from: fromProject() };
};

const arming = (ref) => `forge claim ${ref} --pushed --ready`;
const declare = `forge doctor --set ${READY_CHECKS}=<command>,<command>`;
const problemSaid = ({ problem, from }) =>
  `\`${problem.key}\` in ${from} is ${problem.takes}, not \`${JSON.stringify(problem.given ?? null)}\``;

/** The lines a capture that arms nothing prints, so the run reads them before the call that does. */
export const readyChecksLines = (ref, declared) => {
  if (!declared) return [];
  if (declared.problem) {
    return [`${problemSaid(declared)}, so no check is named for before \`${arming(ref)}\`. Declare them: ${declare}`];
  }
  return [`Before \`${arming(ref)}\`, which runs them and refuses on a red one, the checks this project declares `
    + `(\`${READY_CHECKS}\` in ${declared.from}):`,
  ...declared.checks.map((one) => `  ${one}`)];
};

const TAIL = 30;
/* Each check's output is only read when it fails, so it is held whole rather than streamed. */
const BUFFER = 256 * 1024 * 1024;

const tailOf = (output) => {
  const lines = String(output ?? "").replace(/\s+$/u, "").split("\n");
  return lines.slice(-TAIL).map((one) => `  | ${one}`);
};

const exitSaid = (run) => (run.error ? `could not start (${run.error.message})`
  : run.signal ? `was stopped by ${run.signal}` : `exited ${run.status}`);

/** Runs every check `declared` names, in order, from the top of the checkout `head` was captured
 *  in, and refuses the capture on the first that fails: a check shown and not held is one a run
 *  skips, and the landing that runs it next finds the red at the landing's price (ISS-2555). The
 *  tree has to be that head, since a green over uncommitted files answers for no commit. Returns
 *  the line saying they passed, or null where nothing is declared. */
export const runReadyChecks = (ref, declared, head) => {
  if (!declared) return null;
  if (declared.problem) {
    fail(`claim --ready runs the checks this project declares before it writes the checkpoint, and `
      + `${problemSaid(declared)}, so no checkpoint was written. Declare them, then capture again:\n`
      + `  ${declare}\n  ${arming(ref)}`);
  }
  const loose = uncommittedOver(head);
  if (loose) {
    fail(`claim --ready runs the checks this project declares in this tree, and the tree holds `
      + `${loose.length} path(s) ${shortSha(head)} does not carry (${loose.slice(0, 5).join(", ")}`
      + `${loose.length > 5 ? ", ..." : ""}), so a green here would answer for no commit. Commit them `
      + `and push, or move them out of the tree, then capture again:\n  git add -- <path>... && git commit\n  ${arming(ref)}`);
  }
  const root = repoRoot(process.cwd()) ?? process.cwd();
  for (const check of declared.checks) {
    console.error(`${READY_CHECKS}: running \`${check}\``);
    /* One stream, so the tail printed is the order the check wrote it in. */
    const run = spawnSync("/bin/sh", ["-c", `exec 2>&1\n${check}`], { cwd: root, encoding: "utf8", maxBuffer: BUFFER });
    if (run.status === 0) continue;
    fail([`claim --ready runs the checks this project declares (\`${READY_CHECKS}\` in ${declared.from}) `
      + `before it writes the checkpoint, and \`${check}\` ${exitSaid(run)} in ${root}, so no checkpoint `
      + `was written and none after it was run. Its last lines:`,
    ...tailOf(run.stdout),
    `Make it pass, then run it again and capture:\n  ${check}\n  ${arming(ref)}`].join("\n"));
  }
  return `${READY_CHECKS}: ${declared.checks.length} check(s) green at ${shortSha(head)} — `
    + declared.checks.map((one) => `\`${one}\``).join(", ");
};
