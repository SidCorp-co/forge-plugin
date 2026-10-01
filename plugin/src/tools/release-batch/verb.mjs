/* `forge release-batch` — this project's own release, read and written without its MCP client.
   `active` says which run, if any, is in flight; `state` carries its roster and the tracker's own
   bounds reading, the same three-bound liveness measurement the release path already keeps and
   never a second one invented here. `clear` re-reads both before it writes and refuses a run the
   tracker's own bounds do not yet call holding unless told `--force`. The other reads and the
   writes that put a release on the record are `reads.mjs` and `writes.mjs`.

   Named `release-batch` rather than the bare word: `release` is already a form meaning the move to
   `awaiting_release` (`plugin/src/resolve/handler.mjs`), and a second meaning under one word is the
   ambiguity a form exists to avoid rather than add. docs/cli/release-batch.md. */
import { fail } from "../../resolve/settings.mjs";
import { flags, helpAskedOf, wantsHelp } from "../../resolve/flags.mjs";
import { typed } from "../../hooks/shell-spans.mjs";
import { didYouMean } from "../../suggest.mjs";
import { scoped, write } from "../../tracker/rest.mjs";
import { usageOf } from "../../resolve/visibility.mjs";
import { sharedNow } from "../../wire/shared-clock.mjs";
import { READINESS_USAGE, RECORDED_USAGE, ROSTER_USAGE, finishLines, readiness, recorded, roster } from "./reads.mjs";
import { FINISH_USAGE, RECORD_USAGE, START_USAGE, finish, record, start } from "./writes.mjs";

const STATUS_USAGE = "Usage: forge release-batch [status [<runId>]]";
const CLEAR_USAGE = 'Usage: forge release-batch clear <runId> --reason "<text>" [--force]';

const USAGE = [
  usageOf("release-batch"),
  "This project's release, read and written without this CLI's MCP client: whether a batch is",
  "running, what would refuse one, what waits for one, and the record of one that shipped.",
  "",
  "  status (default)              the active batch's runId, age, roster, finish record and the",
  "                                 tracker's own bounds reading — bare `forge release-batch` is this",
  "  status <runId>                that run's status and finish record, active or not: where a",
  "                                 finish's verdict is read once the tracker has taken it",
  "  readiness                     every reason the tracker would refuse a release now, by code",
  "  roster                        the issues waiting at the release gate, oldest merge first",
  "  start <ISS-nn>...             open a batch over exactly those issues; prints its runId",
  "  [--recut-of <version>]        and the version it cut. --recut-of re-cuts a FAILED release",
  "  finish <runId> [--commit S]   ask the tracker to verify the deploy and close the batch's",
  "                                 issues; no --commit asks only that the deploy arrived",
  "  record <ISS-nn>... --commit <sha> --account \"<text>\" [--provider-ref <ref>]",
  "                                 a release already performed outside a batch, by hand or",
  "                                 otherwise: the tracker checks the commit against the",
  "                                 deployment's probes and closes the issues itself",
  "  recorded <runId>              read a recorded release back",
  '  clear <runId> --reason "<t>"  cancel that run: release its claims, close no issue. Refused',
  "  [--force]                     unless a fresh read agrees runId is the active batch and its",
  "                                 bounds reading holds (past a bound the tracker itself measures);",
  "                                 --force is the one way past that second refusal alone",
  "",
  "Every call goes through the tracker's own release routes and never through /mcp, and no",
  "subcommand moves a status itself: the closes are the tracker's, on its own release path. A",
  "refusal prints every reason the tracker listed, not only the first.",
].join("\n");

const SAYS = { clear: CLEAR_USAGE, readiness: READINESS_USAGE, roster: ROSTER_USAGE, recorded: RECORDED_USAGE,
  start: START_USAGE, finish: FINISH_USAGE, record: RECORD_USAGE };

/* `now` takes a fixed instant so a case can prove this arithmetic exactly, on a constant it chose,
   rather than against the real clock a subprocess spawn's own share of the machine would move
   (ISS-1274: no case bounds elapsed wall-clock time by a constant). */
export const minutesSince = (iso, now = sharedNow()) => {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) ? Math.round((now - at) / 60_000) : null;
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

/* One run's state by its id, active or not: a finished batch is no longer the active one, so the
   verdict of a finish the tracker took is read here and never off the active read. A read, so it
   exits 0 whatever the record says. */
const statusOf = async (runId, rest) => {
  flags(rest, "release-batch status", [], { usage: STATUS_USAGE });
  const state = await scoped("forge_release_batch.state", { runId });
  console.log(`runId      ${state?.runId ?? runId}`);
  console.log(`status     ${state?.runStatus ?? "unread"}`);
  for (const line of finishLines(state?.finish)) console.log(line);
  console.log(boundsBlock(state?.bounds));
};

const status = async (argv) => {
  if (argv[0] && !argv[0].startsWith("--")) return statusOf(argv[0], argv.slice(1));
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
  for (const line of finishLines(state?.finish)) console.log(line);
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
  if (!state?.bounds) {
    fail("release-batch clear: the tracker's own bounds reading for this run did not come back — no "
      + "probe channel is configured for this project, or the state read named none — so nothing here "
      + `has measured anything to force past. Read what the tracker did answer: \`forge release-batch\`.`);
  }
  if (!force && !state.bounds.holding) {
    fail("release-batch clear: this run has crossed none of the tracker's own bounds — nothing here "
      + "has decided it is dead, and clearing a batch that is still going is what ISS-1486 recorded "
      + `as a near-miss. Read what the tracker measured: \`forge release-batch\`. If you still mean `
      + `to clear it, say so:\n  ${rerun} --force`);
  }
};

const clear = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) fail(`${CLEAR_USAGE}\n\n${USAGE}`);
  const { reason, force } = flags(rest, "release-batch clear", ["--force"], { usage: CLEAR_USAGE });
  const rerun = `forge release-batch clear ${runId} --reason ${typed(reason ?? "")}`;
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

const SUBS = { clear, readiness, roster, start, finish, record, recorded };

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
