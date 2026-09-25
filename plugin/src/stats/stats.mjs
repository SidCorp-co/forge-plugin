/* `forge stats <subject>` — one verb, a subject per thing profiled: docs/cli/stats.md. */
import { CHANGE_USAGE, printChange } from "./eval/change.mjs";
import { DAILY_USAGE, printDaily } from "./daily/daily.mjs";
import { DIAGNOSE_USAGE, printDiagnose } from "./eval/diagnose.mjs";
import { EVAL_USAGE, MARKS_USAGE, printEval, printMarks } from "./eval/eval.mjs";
import { MODELS_USAGE, printModels } from "./models.mjs";
import { RUNS_USAGE, printRuns } from "./runs.mjs";
import { SURFACE_USAGE, printSurface } from "./surface/surface.mjs";
import { WAVES_USAGE, printWaves } from "./waves/profile.mjs";
import { helpAskedOf } from "../resolve/flags.mjs";

const SUBJECTS = { runs: printRuns, models: printModels, eval: printEval, change: printChange,
  marks: printMarks, diagnose: printDiagnose, waves: printWaves, surface: printSurface, daily: printDaily };

export const USAGE = [
  /* The set off the map rather than beside it: the words this verb refuses against are its keys, and
     a line restating them is the copy that disagrees with the refusal the first time one is added. */
  `Usage: forge stats <${Object.keys(SUBJECTS).join("|")}>`,
  "Where an issue-flow run's and a dispatch wave's time and rounds go, and how the last window",
  "compares with the one before it. Each subject's own flags: `forge stats <subject> -h`.",
  "",
  "  runs      the profile of the runs in a window: time, rounds and calls by phase",
  "  models    what a run of each model spent against what it got, and which arms are comparable",
  "  eval      the last fifty runs against the fifty before them, with what separates them named",
  "  change    one change as the unit: the runs that ran the copy carrying it, against those before",
  "  marks     the run readings `stats eval --against` takes, held for this project, newest first",
  "  diagnose  a second model's reading of the runs you name: what went wrong, cited call by call",
  "  waves     what each dispatch wave cost its dispatcher, and the hand-backs and replaced runs in it",
  "  surface   what the help and guide texts this copy serves cost in tokens, and what repeats in them",
  "  daily     one page for a calendar day: what the harness cost, what landed in it, where rounds went",
].join("\n");

/* One text per subject, which is the set its own parse refuses against, so neither can move alone. */
export const SAYS = { runs: RUNS_USAGE, models: MODELS_USAGE, eval: EVAL_USAGE, change: CHANGE_USAGE,
  marks: MARKS_USAGE, diagnose: DIAGNOSE_USAGE, waves: WAVES_USAGE, surface: SURFACE_USAGE,
  daily: DAILY_USAGE };

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
