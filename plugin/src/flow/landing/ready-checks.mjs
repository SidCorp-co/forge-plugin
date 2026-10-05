/* The checks a project declares a run spends before it arms a landing. They are the project's to name
   and never this plugin's to guess, because the landing a run skips them for is the first thing to
   find out which were owed, and it finds out at the landing's price (ISS-2515). The method served to
   every project says the cheap checkers go first and names none; this is where one project names its
   own. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import { repoRoot } from "../../git/repo-root.mjs";
import { fail, fromProject, projectFileAt } from "../../resolve/settings.mjs";
import { shortSha } from "../../tracker/evidence.mjs";
import { uncommittedOver } from "../worklog.mjs";

const READY_CHECKS = "ready.checks";
const TAKES = "a list of one or more commands, none of them blank";
/* Where a check names it, the capture puts the files the change touched, so the check reads the change
   and not the tree (ISS-3192). A check naming no place for them runs as declared: which of a project's
   checks are scoped is the project's to say, never this plugin's to guess off a command. */
const FILES = "{files}";

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

/** The files the branch changed against `base` that `head` still carries, read from git: a deleted
 *  path is no file a check can read. Null where the capture has no base to measure them from. */
const changedFiles = (base, head, root) => {
  if (!base) return null;
  /* NUL-separated, since git quotes a name it would print with an unusual byte and the quoted form names no file. */
  const diff = spawnSync("git", ["diff", "--name-only", "-z", "--diff-filter=d", `${base}..${head}`], { cwd: root, encoding: "utf8" });
  return diff.status === 0 ? diff.stdout.split("\0").filter(Boolean) : null;
};

const quoted = (path) => `'${path.replaceAll("'", "'\\''")}'`;

/* A batch's members captured at one head ask one question, so a green answer is kept where every
   worktree of the checkout reads it, keyed by the head, the base and the checks as declared; any one
   of the three moving is another question (ISS-3191). */
const recordAt = (root, head, base, checks) => {
  const common = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8" });
  if (common.status !== 0) return null;
  const dir = common.stdout.trim();
  const key = createHash("sha256").update(JSON.stringify({ head, base, checks })).digest("hex").slice(0, 16);
  return join(isAbsolute(dir) ? dir : join(root, dir), "forge", "ready-checks", `${head}-${key}.json`);
};

const greenBefore = (path) => {
  try {
    return path ? JSON.parse(readFileSync(path, "utf8")) : null;
  } catch {
    return null;
  }
};

const TAIL = 30;
/* Each check's output is only read when it fails, so it is held whole rather than streamed. */
const BUFFER = 256 * 1024 * 1024;

/* A check that wrote nothing visible is said to have, since a blank tail line reads as output lost. */
const outputSaid = (output) => {
  const whole = String(output ?? "");
  const shown = whole.replace(/\s+$/u, "");
  if (!shown) return [whole ? "It wrote only whitespace." : "It wrote no output."];
  return ["Its last lines:", ...shown.split("\n").slice(-TAIL).map((one) => `  | ${one}`)];
};

const exitSaid = (run) => (run.error ? `could not start (${run.error.message})`
  : run.signal ? `was stopped by ${run.signal}` : `exited ${run.status}`);

/** Runs every check `declared` names, in order, from the top of the checkout `head` was captured
 *  in, and refuses the capture on the first that fails: a check shown and not held is one a run
 *  skips, and the landing that runs it next finds the red at the landing's price (ISS-2555). The
 *  tree has to be that head, since a green over uncommitted files answers for no commit. A check
 *  naming `{files}` is handed the files the branch changed against `base`, and skipped where there
 *  are none; a list already green at this head, base and declaration is not run again. Returns the
 *  line saying they passed, or null where nothing is declared. */
export const runReadyChecks = (ref, declared, head, base = null) => {
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
  const record = recordAt(root, head, base, declared.checks);
  const before = greenBefore(record);
  if (before) {
    return `${READY_CHECKS}: green at ${shortSha(head)} already, by the capture of ${before.ref} at ${before.at}, `
      + "so none was run again — " + declared.checks.map((one) => `\`${one}\``).join(", ");
  }
  const scoped = declared.checks.some((one) => one.includes(FILES));
  const files = scoped ? changedFiles(base, head, root) : null;
  if (scoped && !files) {
    fail(`claim --ready hands a check naming \`${FILES}\` the files the change touched against its base, and `
      + `this capture has no base to read them from, so no checkpoint was written. Capture from the branch's own `
      + `worktree, where the base is read:\n  ${arming(ref)}`);
  }
  const skipped = [];
  for (const declaredCheck of declared.checks) {
    if (declaredCheck.includes(FILES) && !files.length) {
      skipped.push(declaredCheck);
      console.error(`${READY_CHECKS}: skipping \`${declaredCheck}\`: the change touches no file it would be handed`);
      continue;
    }
    const check = declaredCheck.replaceAll(FILES, (files ?? []).map(quoted).join(" "));
    console.error(`${READY_CHECKS}: running \`${declaredCheck}\`${declaredCheck.includes(FILES) ? ` over ${files.length} changed file(s)` : ""}`);
    /* One stream, so the tail printed is the order the check wrote it in. */
    const run = spawnSync("/bin/sh", ["-c", `exec 2>&1\n${check}`], { cwd: root, encoding: "utf8", maxBuffer: BUFFER });
    if (run.status === 0) continue;
    fail([`claim --ready runs the checks this project declares (\`${READY_CHECKS}\` in ${declared.from}) `
      + `before it writes the checkpoint, and \`${declaredCheck}\` ${exitSaid(run)} in ${root}, so no checkpoint `
      + `was written and none after it was run. ${outputSaid(run.stdout).join("\n")}`,
    `Make it pass, then run it again and capture:\n  ${check}\n  ${arming(ref)}`].join("\n"));
  }
  if (record) {
    mkdirSync(join(record, ".."), { recursive: true });
    writeFileSync(record, `${JSON.stringify({ ref, at: new Date().toISOString(), checks: declared.checks })}\n`);
  }
  const ran = declared.checks.length - skipped.length;
  return `${READY_CHECKS}: ${ran} check(s) green at ${shortSha(head)} — `
    + declared.checks.filter((one) => !skipped.includes(one)).map((one) => `\`${one}\``).join(", ")
    + (skipped.length ? `; ${skipped.length} skipped, the change touching no file they read` : "");
};
