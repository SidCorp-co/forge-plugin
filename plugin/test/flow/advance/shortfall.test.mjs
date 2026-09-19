/* The shortfall carries a sentence about the reading it stands on, one per reading, and the two part
   immediately after the clause they open with (ISS-841). Neither had a case until ISS-1045, and a
   prefix ending in the words its continuation opens with is a repeat neither line shows on its own.
   Spawned, because what a run acts on is the line the verb printed and not the pieces of it. */
import assert from "node:assert/strict";
import test from "node:test";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("advance-shortfall").path;

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const OPEN = {
  documentId: "short-uuid",
  issueId: "ISS-97",
  status: "open",
  title: "the issue whose thread came back a prefix",
  description: "no mark here",
};
const COUNTED = { ...OPEN, documentId: "counted-uuid", issueId: "ISS-98" };
const state = {
  calls: [],
  issues: [OPEN, COUNTED],
  answer: {},
};
/* `hasMore` true with no cursor is the one page a walk cannot finish; called whole above its own rows
   is the other reading, and the default fixture hands back neither. */
state.answer.forge_comments = (args) => {
  if (args.action !== "list") return { documentId: "comment-uuid" };
  const rows = [{ createdAt: "2026-09-02T10:00:00.000Z", authorId: "agent", body: "a note that earns nothing" }];
  if (args.filters?.issue === "short-uuid") return { comments: rows, hasMore: true };
  return { comments: rows, total: 9, hasMore: false };
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const owed = (reference) => ranAsync(FORGE, ["advance", reference, "--owed"], tracker.env);

test("a shortfall off a thread the tracker called whole says so in one sentence", async () => {
  const run = await owed("ISS-98");
  assert.ok(run.stdout.includes("The tracker called this thread whole at 1 comment(s) and counted 9 on it."
    + " The rows it handed over are what everything here is judged on. What the rows read earn, they"
    + " earn, and anything they say is owed on rows the tracker called whole, so write it again for"
    + " this status: a record written now is in the rows the next read hands back."), run.stdout);
});

test("a shortfall off a thread that came back a prefix says so in one sentence", async () => {
  const run = await owed("ISS-97");
  assert.ok(run.stdout.includes("The thread was walked and stopped after 1 comment(s) of 1 without the"
    + " tracker ever calling the read complete, so this is a prefix and not the thread. Which comments"
    + " are missing it does not say, and the tracker's own screens hold the rest. What the rows read"
    + " earn, they earn, and anything they say is owed may be a record past that prefix, so this"
    + " shortfall is a ceiling and not a count. Once the thread, read where it is whole, shows the"
    + " record that earns the status, `forge advance ISS-97 --set <status> --why \"<why>\"` puts that"
    + " status on with no entry check read and a correction saying so."), run.stdout);
});
