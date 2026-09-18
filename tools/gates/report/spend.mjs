/* One step's spend, read off the record before the step is spawned — that spawn is what rewrites the per-file seconds these come off, so a narrowed run leaves the record holding the narrowed set alone, prices only what some run really ran, and the held-back files it prices nothing for are counted beside the sum rather than summed into it as zero. The reach is read off the recorded sets and never off the digests, so a run distrusting the record enough to narrow nothing still says what its spend was for (ISS-1746). */
import { closuresFor, contextOf, readsDir } from "../reads/sets.mjs";
import { launcherOf } from "../steps.mjs";
import { fileSeconds } from "../timing.mjs";
import { reachOf } from "./reach.mjs";

export const spendOf = (step, { record, changed }) => {
  if (!step.tests) return null;
  const known = step.known ?? step.files.length;
  const seconds = fileSeconds(record, step.label);
  const priced = (step.held ?? []).filter((one) => seconds.has(one));
  const closures = changed === null ? null : step.closures ?? closuresFor(readsDir(record), step.files);
  return { spent: step.files.length, known, unpriced: known - step.files.length - priced.length,
    seconds: priced.reduce((sum, one) => sum + seconds.get(one), 0),
    reach: closures === null ? null
      : reachOf(step.files, closures, changed, contextOf(launcherOf(step))) };
};
