/* The three writes that put a release on the record: opening a batch, finishing one, and recording a
   release somebody already performed outside a batch. None of them moves a status itself: the
   tracker closes what a release carried on its own sanctioned path, and a status this CLI set would
   be the second route around that gate ISS-1992 rules out. docs/cli/release-batch.md. */
import { flags } from "../../resolve/flags.mjs";
import { fail } from "../../resolve/settings.mjs";
import { documentIdOf } from "../../tracker/issues.mjs";
import { write } from "../../tracker/rest.mjs";
import { verifiedLine } from "./reads.mjs";
import { answeredOr } from "./refused.mjs";

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
   the key the caller typed. */
const idsOf = async (keys) => {
  const byId = new Map();
  for (const key of keys) byId.set((await documentIdOf(key)).toLowerCase(), key);
  return byId;
};

const keyOf = (byId, id) => byId.get(String(id).toLowerCase()) ?? id;

export const start = async (argv) => {
  const [keys, rest] = keysThen(argv);
  const { "recut-of": recutOf } = flags(rest, "release-batch start", [], { usage: START_USAGE });
  if (!keys.length) owed("start", START_USAGE, "at least one issue key");
  const byId = await idsOf(keys);
  const opened = answeredOr("start", await write("forge_release_batch.create",
    { data: { issueIds: [...byId.keys()], ...(recutOf ? { recutOf } : {}) } }, undefined, true));
  console.log(`runId      ${opened.runId}`);
  console.log(`version    ${opened.version ?? "unread"}`);
  console.log(`roster     ${(opened.issueIds ?? []).map((id) => keyOf(byId, id)).join(", ") || "none"}`);
  if (opened.ownerDeadlineAt) console.log(`owner by   ${opened.ownerDeadlineAt}`);
  console.log(`Finish it once the deploy is serving: forge release-batch finish ${opened.runId} --commit <sha>`);
};

export const finish = async ([runId, ...rest]) => {
  if (!runId || runId.startsWith("--")) owed("finish", FINISH_USAGE, "the runId `forge release-batch start` printed");
  const { commit } = flags(rest, "release-batch finish", [], { usage: FINISH_USAGE });
  const answer = answeredOr("finish", await write("forge_release_batch.finish",
    { runId, data: commit ? { commit } : {} }, undefined, true));
  const done = answer.finish ?? {};
  console.log(`runId      ${answer.runId ?? runId}`);
  console.log(`finish     ${done.state ?? "unread"}`);
  if (done.closed?.length) console.log(`closed     ${done.closed.join(", ")}`);
  for (const one of done.failed ?? []) console.log(`failed     ${one.id}: ${one.reason}`);
  if (done.refusal) console.log(`refused    ${done.refusal.code ?? ""}: ${done.refusal.message ?? JSON.stringify(done.refusal)}`);
};

export const record = async (argv) => {
  const [keys, rest] = keysThen(argv);
  const given = flags(rest, "release-batch record", [], { usage: RECORD_USAGE });
  if (!keys.length) owed("record", RECORD_USAGE, "at least one issue key");
  if (!given.commit) owed("record", RECORD_USAGE, "--commit, the whole sha production is serving,");
  if (!given.account) owed("record", RECORD_USAGE, "--account, how the release was performed and why not by a batch,");
  const byId = await idsOf(keys);
  const data = { issueIds: [...byId.keys()], commit: given.commit, account: given.account,
    ...(given["provider-ref"] ? { providerRef: given["provider-ref"] } : {}) };
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
