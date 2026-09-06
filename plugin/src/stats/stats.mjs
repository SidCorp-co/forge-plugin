/* `forge stats <subject>` — one verb, a subject per thing profiled: docs/cli/stats.md. */
import { EVAL_USAGE, printEval, printMarks } from "./eval.mjs";
import { RUNS_USAGE, printRuns } from "./runs.mjs";
import { wantsHelp } from "../resolve/flags.mjs";

const SUBJECTS = { runs: printRuns, eval: printEval, marks: printMarks };

export const USAGE = [RUNS_USAGE, "", EVAL_USAGE].join("\n");

export const stats = (argv) => {
  const [subject, ...rest] = argv;
  /* Help stands after the verb and after the subject, through the one predicate that decides. */
  if (wantsHelp(argv) || wantsHelp(rest)) {
    console.log(USAGE);
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
