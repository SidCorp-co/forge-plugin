/* A judge that names no runtime has exercised none, so where the project asks for a judge other than
   the builder and the landing checkpoint names what the deployment serves, a verdict saying somebody
   looked owes the identity it looked at: docs/cli/record-the-judge.md. */
import { refuse } from "../../../refusal.mjs";
import { releasePolicy } from "../../../tracker/project-config.mjs";
import { shortSha } from "../../../tracker/evidence.mjs";
import { somebodyLooked } from "../../machine.mjs";
import { RUNTIME_ASK, owesRuntime } from "../../qa/verdicts.mjs";

/** Refuses the write where a looked verdict names no `--runtime` under an independent judge with a
 *  deployment on the checkpoint. Silent everywhere else, the policy read being cached per call. */
export const runtimeChecked = async (ref, blocks, issue, landing) => {
  const bare = blocks.filter((got) => somebodyLooked(got.verdict) && got.runtime === undefined);
  if (!bare.length || !owesRuntime(await releasePolicy(), issue, landing)) return;
  const numbers = bare.map((got) => String(got.criterion).split(/\s/u)[0]);
  refuse(`record verdict: the verdict on criterion ${numbers.join(", ")} names no --runtime. ${ref}'s `
    + "project asks for a judge other than the run that built the change, and its landing checkpoint "
    + `names ${shortSha(landing.deployment)} as what the deployment serves: a commit says which code was read `
    + "and never that it was running, so it cannot stand in for the runtime a judge exercised. "
    + "Nothing was sent. Name the whole id you read back from the deployment, or say what you lacked:\n"
    + `  --runtime ${RUNTIME_ASK}\n`
    + "  or: --verdict skipped --why \"<what kept you from exercising it>\"");
};
