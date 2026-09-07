/* `forge stats <subject>` — one verb, a subject per thing profiled: docs/cli/stats.md. */
import { EVAL_USAGE, printEval, printMarks } from "./eval.mjs";
import { RUNS_USAGE, printRuns } from "./runs.mjs";
import { helpAskedOf } from "../resolve/flags.mjs";

const SUBJECTS = { runs: printRuns, eval: printEval, marks: printMarks };

export const USAGE = [RUNS_USAGE, "", EVAL_USAGE].join("\n");

/* What each subject takes: `eval` and `marks` are documented by the one text, which is where their two usage lines are spelled. */
export const SAYS = { runs: RUNS_USAGE, eval: EVAL_USAGE, marks: EVAL_USAGE };

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
  SUBJECTS[subject](rest);
};

stats.answersHelp = true;
