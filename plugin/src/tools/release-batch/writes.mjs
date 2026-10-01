/* The three writes that put a release on the record: opening a batch, finishing one, and recording a
   release somebody already performed outside a batch. None of them moves a status itself: the
   tracker closes what a release carried on its own sanctioned path, and a status this CLI set would
   be the second route around that gate ISS-1992 rules out. docs/cli/release-batch.md. */
import { flags } from "../../resolve/flags.mjs";
import { fail } from "../../resolve/settings.mjs";
import { documentIdOf } from "../../tracker/issues.mjs";
import { write } from "../../tracker/rest.mjs";
import { IN_FLIGHT, finishLines, verifiedLine } from "./reads.mjs";
import { answeredOr, reasonSaid } from "./refused.mjs";

export const START_USAGE = "Usage: forge release-batch start <ISS-nn>... [--recut-of <version>]";
export const FINISH_USAGE = "Usage: forge release-batch finish <runId> [--commit <sha>]";
export const RECORD_USAGE = 'Usage: forge release-batch record <ISS-nn>... --commit <sha> --account "<text>" '
  + "[--provider-ref <ref>]";

/* The keys come first and the flags after, so a key is any word before the first flag. */
const keysThen = (argv) => {
  const at = argv.findIndex((word) => word.startsWith("--"));
  return at < 0 ? [argv, []] : [argv.slice(0, at), argv.slice(at)];
};

const owed = (verb, usage, what) =>
  fail(`release-batch ${verb}: ${what} is owed, and nothing was sent.\n${usage}`);

/* Each key read to its id once, in the order given, so what the tracker answers by id is printed by
   the key the caller typed. Two keys naming one issue are refused rather than folded into one, which
   would send a roster the caller did not type. */
const idsOf = async (verb, keys) => {
  const byId = new Map();
  for (const key of keys) {
    const id = (await documentIdOf(key)).toLowerCase();
    if (byId.has(id)) {
      fail(`release-batch ${verb}: ${key} and ${byId.get(id)} name the same issue, and nothing was sent. `
        + "Name each issue once.");
    }
    byId.set(id, key);
  }
  return byId;
};

/* A flag given with nothing in it is refused rather than read as absent: either reading would send
   something other than what was typed. */
const filledOr = (verb, usage, given, flag) => {
  const value = given[flag];
  if (value !== undefined && !value.trim()) owed(verb, usage, `a value for --${flag}`);
  return value;
};

const keyOf = (byId, id) => byId.get(String(id).toLowerCase()) ?? id;

export const start = async (argv) => {
  const [keys, rest] = keysThen(argv);
  const given = flags(rest, "release-batch start", [], { usage: START_USAGE });
  const recutOf = filledOr("start", START_USAGE, given, "recut-of");
  if (!keys.length) owed("start", START_USAGE, "at least one issue key");
  const byId = await idsOf("start", keys);
  const opened = answeredOr("start", await write("forge_release_batch.create",
    { data: { issueIds: [...byId.keys()], ...(recutOf === undefined ? {} : { recutOf }) } }, undefined, true));
  console.log(`runId      ${opened.runId}`);
  console.log(`version    ${opened.version ?? "unread"}`);
  console.log(`roster     ${(opened.issueIds ?? []).map((id) => keyOf(byId, id)).join(", ") || "none"}`);
  if (opened.ownerDeadlineAt) console.log(`owner by   ${opened.ownerDeadlineAt}`);
  console.log(`Finish it once the deploy is serving: forge release-batch finish ${opened.runId} --commit <sha>`);
};

export const finish = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) owed("finish", FINISH_USAGE, "the runId `forge release-batch start` printed");
  const commit = filledOr("finish", FINISH_USAGE, flags(rest, "release-batch finish", [], { usage: FINISH_USAGE }),
    "commit");
  const answer = answeredOr("finish", await write("forge_release_batch.finish",
    { runId, data: commit === undefined ? {} : { commit } }, undefined, true));
  const id = answer.runId ?? runId;
  console.log(`runId      ${id}`);
  for (const line of finishLines(answer.finish)) console.log(line);
  finishOutcome(id, answer.finish ?? {}, commit);
};

/* The door answers before the job has done anything, so an attempt in flight is a success that names
   the read carrying the verdict; an attempt the tracker ended red, or a finish that left issues it
   could not close, is a failure the exit says rather than a line the caller has to notice. */
const finishOutcome = (id, done, commit) => {
  if (IN_FLIGHT.has(done.state)) {
    console.log("The tracker took this finish and a job is verifying the deploy and closing the roster; "
      + `nothing more needs to be sent. Read its verdict: forge release-batch status ${id}`);
    return;
  }
  if (done.state === "failed") {
    const refusal = done.refusal ?? {};
    fail(`release-batch finish: the tracker's attempt ended failed, so the batch did not finish.\n`
      + `  ${reasonSaid(refusal.code, refusal.reason)}\n`
      + "Sending finish again starts a new attempt, once that is cleared: "
      + `forge release-batch finish ${id}${commit === undefined ? "" : ` --commit ${commit}`}`);
  }
  const failed = done.state === "finished" ? done.failed ?? [] : [];
  if (failed.length) {
    fail(`release-batch finish: the tracker finished the batch and could not close ${failed.length} of its `
      + `issue(s):\n${failed.map((one) => `  ${one.id}: ${one.reason}`).join("\n")}\n`
      + "Each stands where the tracker left it; read one with forge issue <id>.");
  }
};

export const record = async (argv) => {
  const [keys, rest] = keysThen(argv);
  const given = flags(rest, "release-batch record", [], { usage: RECORD_USAGE });
  if (!keys.length) owed("record", RECORD_USAGE, "at least one issue key");
  if (!given.commit?.trim()) owed("record", RECORD_USAGE, "--commit, the whole sha production is serving,");
  if (!given.account?.trim()) owed("record", RECORD_USAGE, "--account, how the release was performed and why not by a batch,");
  const providerRef = filledOr("record", RECORD_USAGE, given, "provider-ref");
  const byId = await idsOf("record", keys);
  const data = { issueIds: [...byId.keys()], commit: given.commit, account: given.account,
    ...(providerRef === undefined ? {} : { providerRef }) };
  const done = answeredOr("record", await write("forge_release_batch.record", { data }, undefined, true));
  console.log(`runId      ${done.runId}`);
  console.log(`commit     ${done.commit}`);
  console.log(`verified   ${verifiedLine(done.verification, done.identity)}`);
  const closed = (done.closed ?? []).map((id) => keyOf(byId, id));
  console.log(`closed     ${closed.length} issue(s): ${closed.join(", ") || "none"}`);
  console.log(`Read it back: forge release-batch recorded ${done.runId}`);
  const failed = done.failed ?? [];
  if (failed.length) {
    fail(`release-batch record: the tracker recorded the release and could not close ${failed.length} of its `
      + `issue(s):\n${failed.map((one) => `  ${keyOf(byId, one.id)}: ${one.reason}`).join("\n")}`);
  }
};
