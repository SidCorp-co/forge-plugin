/* `forge stats <subject>` — one verb, a subject per thing profiled: docs/cli/stats.md. */
import { EVAL_USAGE, MARKS_USAGE, printEval, printMarks } from "./eval.mjs";
import { RUNS_USAGE, printRuns } from "./runs.mjs";
import { helpAskedOf } from "../resolve/flags.mjs";

const SUBJECTS = { runs: printRuns, eval: printEval, marks: printMarks };

export const USAGE = [
  "Usage: forge stats <runs|eval|marks>",
  "Where an issue-flow run's time and rounds go, and how the last window compares with the one",
  "before it. Each subject's own flags: `forge stats <subject> -h`.",
  "",
  "  runs      the profile of the runs in a window: time, rounds and calls by phase",
  "  eval      the last fifty runs against the fifty before them, with what separates them named",
  "  marks     the readings held for this project, newest first",
].join("\n");

/* One text per subject, which is the set its own parse refuses against, so neither can move alone. */
export const SAYS = { runs: RUNS_USAGE, eval: EVAL_USAGE, marks: MARKS_USAGE };

export const stats = (argv) => {
  const [subject, ...rest] = argv;
  /* Help stands after the verb and after the subject, through the one predicate that decides. */
  const help = helpAskedOf(argv, Object.keys(SUBJECTS));
  if (help) {
    console.log(SAYS[help.subject] ?? USAGE);
    process.exit(0);
  }
  if (!subject || !Object.hasOwn(SUBJECTS, subject)) {
    if (subject) console.error(`stats: no subject named ${subject}. There is: ${Object.keys(SUBJECTS).join(", ")}.\n`);
    console.error(USAGE);
    process.exit(1);
  }
  /* Returned: the eval awaits the tracker, and a promise nobody awaits exits before its answer. */
  return SUBJECTS[subject](rest);
};

stats.answersHelp = true;
