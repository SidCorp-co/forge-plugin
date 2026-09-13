/* Silent where the project declares no job, that level's own rule: docs/cli/withholding-a-verb.md.
   Why a match and not a cause: `matchingJobs`. Why rows and not lines: doctor-harness.mjs. */
import { userConfig } from "../../resolve/config.mjs";
import { declaredJobs } from "../../resolve/settings.mjs";
import { jobProblems, matchingJobs } from "../../resolve/visibility.mjs";

const matchRow = (matched, withheld) => {
  if (!matched.length) {
    return withheld.length
      ? "no declared job matches what this machine withholds"
      : "none — this machine withholds nothing";
  }
  const said = matched.length > 1 ? "are the declared jobs" : "is the declared job";
  return `${matched.join(", ")} ${said} this machine's withheld verbs match`
    + " — `forge doctor --job all` offers every verb again";
};

export const withholdingLines = () => {
  const withheld = userConfig().withheld ?? [];
  const { jobs, from } = declaredJobs();
  const names = Object.keys(jobs);
  return [
    ...(withheld.length
      ? [{ label: "withheld verbs", detail: `${withheld.join(", ")} — \`forge doctor --show <verb>\`` }]
      : []),
    ...(from && names.length ? [{ label: "jobs", detail: `${names.join(", ")}  ← ${from}` }] : []),
    ...(from ? [{ label: "job", detail: matchRow(matchingJobs(), withheld) }] : []),
    ...jobProblems().map((problem) => ({ level: "miss", label: "jobs", detail: problem })),
  ];
};
