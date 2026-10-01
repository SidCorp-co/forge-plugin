/* The three reads a release is decided and checked by: what would refuse one now, what is waiting
   for one, and what a recorded one wrote. Each prints the tracker's own fields and never judges them,
   for the reason `verb.mjs` gives for `status`. */
import { flags } from "../../resolve/flags.mjs";
import { fail } from "../../resolve/settings.mjs";
import { tried } from "../../tracker/rest.mjs";
import { answeredOr, reasonLines } from "./refused.mjs";

export const READINESS_USAGE = "Usage: forge release-batch readiness";
export const ROSTER_USAGE = "Usage: forge release-batch roster";
export const RECORDED_USAGE = "Usage: forge release-batch recorded <runId>";

export const readiness = async (argv) => {
  flags(argv, "release-batch readiness", [], { usage: READINESS_USAGE });
  const read = answeredOr("readiness", await tried("forge_release_batch.readiness", {}));
  console.log(`gate       ${read.hasReleaseGate ? "yes" : "none"} (release model ${read.releaseModel ?? "unread"})`);
  const blockers = read.blockers ?? [];
  console.log(blockers.length
    ? `blocked    ${blockers.length} reason(s) a release would be refused now:\n${reasonLines(blockers).join("\n")}`
    : "blocked    nothing: the tracker lists no reason a release would be refused now");
  const warnings = read.warnings ?? [];
  if (warnings.length) console.log(`warnings   ${warnings.length}:\n${reasonLines(warnings).join("\n")}`);
};

const rosterLine = (one) => {
  const days = one.waitingDays === null || one.waitingDays === undefined ? "?" : one.waitingDays;
  const held = one.claimedByRunId ? `  held by run ${one.claimedByRunId}` : "";
  return `  ${one.displayId ?? one.id}  ${days} day(s)  ${one.title ?? ""}${held}`;
};

export const roster = async (argv) => {
  flags(argv, "release-batch roster", [], { usage: ROSTER_USAGE });
  const read = answeredOr("roster", await tried("forge_release_batch.roster", {}));
  if (!read.gateStatus) {
    console.log("gate       none: this project has no release gate, so no issue waits for a release");
    return;
  }
  const waiting = read.issues ?? [];
  console.log(`gate       ${read.gateStatus}`);
  console.log(`version    ${read.currentVersion ?? "none shipped yet"}`);
  console.log(`waiting    ${waiting.length} issue(s), in the tracker's order (oldest merge first)`);
  for (const one of waiting) console.log(rosterLine(one));
};

export const verifiedLine = (verification, identity) => (verification === "unverified"
  ? "unverified: the project declares no live verify probe, so only the account says this commit is serving"
  : `probed: the deployment's probes read ${identity ?? "(no identity returned)"}`);

export const recorded = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) fail(`${RECORDED_USAGE}\nThe runId is what \`forge release-batch record\` printed.`);
  flags(rest, "release-batch recorded", [], { usage: RECORDED_USAGE });
  const read = answeredOr("recorded", await tried("forge_release_batch.recorded", { runId }));
  console.log(`runId      ${read.runId}`);
  console.log(`recorded   ${read.recordedAt ?? "unread"}`);
  console.log(`commit     ${read.commit ?? "unread"}`);
  console.log(`verified   ${verifiedLine(read.verification, read.identity)}`);
  if (read.providerRef) console.log(`provider   ${read.providerRef}`);
  console.log(`account    ${read.account ?? "unread"}`);
  const carried = read.issues ?? [];
  console.log(`issues     ${carried.length}:`);
  for (const one of carried) console.log(`  ${one.id}  merged ${one.mergedAt ?? "never marked"}`);
};
