/* The checks a project declares a run spends before it arms a landing. They are the project's to name
   and never this plugin's to guess, because the landing a run skips them for is the first thing to
   find out which were owed, and it finds out at the landing's price (ISS-2515). The method served to
   every project says the cheap checkers go first and names none; this is where one project names its
   own. */
import { fromProject, projectFileAt } from "../../resolve/settings.mjs";

export const READY_CHECKS = "ready.checks";
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

/** The lines a capture that arms nothing prints, so the run reads them before the call that does. */
export const readyChecksLines = (ref, declared) => {
  if (!declared) return [];
  const arming = `forge claim ${ref} --pushed --ready`;
  if (declared.problem) {
    const { key, takes, given } = declared.problem;
    return [`\`${key}\` in ${declared.from} is ${takes}, not \`${JSON.stringify(given ?? null)}\`, so no `
      + `check is named for before \`${arming}\`. Declare them: forge doctor --set ${READY_CHECKS}=<command>,<command>`];
  }
  return [`Before \`${arming}\`, the checks this project declares (\`${READY_CHECKS}\` in ${declared.from}):`,
    ...declared.checks.map((one) => `  ${one}`)];
};
