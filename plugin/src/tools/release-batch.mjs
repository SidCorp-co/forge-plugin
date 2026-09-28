/* `forge release-batch` — this project's own release batch, read and cleared without its MCP
   client. `active` says which run, if any, is in flight; `state` carries its roster and the
   tracker's own bounds reading, the same three-bound liveness measurement the release path already
   keeps and never a second one invented here. `clear` re-reads both before it writes and refuses a
   run the tracker's own bounds do not yet call holding unless told `--force`.

   Named `release-batch` rather than the bare word: `release` is already a form meaning the move to
   `awaiting_release` (`plugin/src/resolve/handler.mjs`), and a second meaning under one word is the
   ambiguity a form exists to avoid rather than add. docs/cli/release-batch.md. */
import { fail } from "../resolve/settings.mjs";
import { flags, helpAskedOf, wantsHelp } from "../resolve/flags.mjs";
import { didYouMean } from "../suggest.mjs";
import { scoped, write } from "../tracker/rest.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { sharedNow } from "../wire/shared-clock.mjs";

const STATUS_USAGE = "Usage: forge release-batch [status]";
const CLEAR_USAGE = 'Usage: forge release-batch clear <runId> --reason "<text>" [--force]';

export const USAGE = [
  usageOf("release-batch"),
  "Whether a release batch is running for this project, and clearing a dead one, without this",
  "CLI's MCP client.",
  "",
  "  status (default)              the active batch's runId, age, roster and the tracker's own",
  "                                 bounds reading — bare `forge release-batch` is this",
  '  clear <runId> --reason "<t>"  cancel that run: release its claims, close no issue. Refused',
  "  [--force]                     unless a fresh read agrees runId is the active batch and its",
  "                                 bounds reading holds (past a bound the tracker itself measures);",
  "                                 --force is the one way past that second refusal alone",
  "",
  "Every read and the clear both go through the tracker's own release-batch routes — the same ones",
  "the release agent itself uses — and never through /mcp. There is no verb that judges a batch dead",
  "on this CLI's own say-so: what prints is the tracker's own record, and a person reads it to decide.",
].join("\n");

const SAYS = { clear: CLEAR_USAGE };

const minutesSince = (iso) => {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) ? Math.round((sharedNow() - at) / 60_000) : null;
};

const boundLine = (bound) =>
  `  ${bound.name.padEnd(10)} crossed=${bound.crossed} measuredMs=${bound.measuredMs ?? "null"}`
    + ` thresholdMs=${bound.thresholdMs ?? "null"}\n    why: ${bound.why}`;

const boundsBlock = (bounds) => {
  if (!bounds) return "bounds     not read (no probe channel is configured for this project)";
  const lines = (bounds.bounds ?? []).map(boundLine).join("\n");
  const holding = bounds.holding
    ? `yes — ${bounds.crossedNames.join(", ")}`
    : "no";
  return `holding    ${holding}\nbounds\n${lines}`;
};

const rosterLine = (issueIds) =>
  `roster     ${issueIds.length} issue(s): ${issueIds.join(", ") || "none"}`;

const status = async (argv) => {
  flags(argv, "release-batch status", [], { usage: STATUS_USAGE });
  const active = await scoped("forge_release_batch.active", {});
  if (!active) {
    console.log("no release batch is running for this project.");
    return;
  }
  const age = minutesSince(active.startedAt);
  console.log(`runId      ${active.runId}`);
  console.log(`started    ${active.startedAt}${age === null ? "" : ` (${age} minute(s) ago)`}`);
  console.log(rosterLine(active.issueIds ?? []));
  const state = await scoped("forge_release_batch.state", { runId: active.runId });
  console.log(`status     ${state?.runStatus ?? "unread"}`);
  console.log(boundsBlock(state?.bounds));
};

/* Trusts no argument over a fresh read. The active read and the mismatch or absent-batch refusal it
   can earn run every time, `--force` included: a runId nothing here is running is nothing to force.
   Only the bounds refusal — the run is real and named right, but the tracker's own bounds do not yet
   call it holding — is what `--force` is the way past. Takes the rerun line so the refusal that
   needs it and the one that does not share one reading rather than building the line twice. */
const rereadOrRefuse = async (runId, rerun, force) => {
  const active = await scoped("forge_release_batch.active", {});
  if (!active) {
    fail(`release-batch clear: no release batch is running for this project, so ${runId} is nothing `
      + "to clear. Nothing was sent. Read the current state first: `forge release-batch`");
  }
  if (active.runId !== runId) {
    fail(`release-batch clear: the batch running now is ${active.runId}, not ${runId}. Nothing was `
      + "sent — read it again and clear that one if it is the one to clear: `forge release-batch`");
  }
  const state = await scoped("forge_release_batch.state", { runId });
  if (!force && !state?.bounds?.holding) {
    fail("release-batch clear: this run has crossed none of the tracker's own bounds — nothing here "
      + "has decided it is dead, and clearing a batch that is still going is what ISS-1486 recorded "
      + `as a near-miss. Read what the tracker measured: \`forge release-batch\`. If you still mean `
      + `to clear it, say so:\n  ${rerun} --force`);
  }
};

const clear = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) fail(`${CLEAR_USAGE}\n\n${USAGE}`);
  const { reason, force } = flags(rest, "release-batch clear", ["--force"], { usage: CLEAR_USAGE });
  const rerun = `forge release-batch clear ${runId} --reason "${reason ?? ""}"`;
  if (!reason) {
    fail("release-batch clear: --reason is owed, and nothing was sent. Say why this batch is being "
      + `cleared:\n  forge release-batch clear ${runId} --reason "<text>"${force ? " --force" : ""}`);
  }
  await rereadOrRefuse(runId, rerun, force);
  const result = await write("forge_release_batch.abort", { runId, data: { reason } });
  console.log(`aborted    ${result?.aborted ? "yes" : "no"}`);
  const released = result?.releasedIds ?? [];
  console.log(`released   ${released.length} issue(s): ${released.join(", ") || "none"}`);
};

const SUBS = { clear };

export const releaseBatch = async (argv) => {
  const [sub, ...rest] = argv;
  if (wantsHelp(argv)) return console.log(USAGE);
  const help = helpAskedOf(argv, Object.keys(SUBS));
  if (help) return console.log(help.subject ? SAYS[help.subject] : USAGE);
  if (!sub || sub === "status") return status(sub === "status" ? rest : argv);
  if (!Object.hasOwn(SUBS, sub)) {
    fail(`${didYouMean("release-batch action", sub, ["status", ...Object.keys(SUBS)])}\n\n${USAGE}`);
  }
  return SUBS[sub](rest);
};

releaseBatch.answersHelp = true;
