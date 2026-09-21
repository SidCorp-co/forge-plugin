/* What a write says about where it went, and when. The rule and why the unit is the command rather
   than the send are in docs/cli/what-a-write-says.md; what is judged here is which of the cases says it,
   which stays silent, and that a second write to a scope already named says nothing (ISS-1192). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { fakeTracker, projectRecord, ranAsync, standsInNoTree } from "../fixtures.mjs";
import { useProject } from "../../src/resolve/settings.mjs";
import { write } from "../../src/tracker/rest.mjs";

standsInNoTree("write-announce");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;
const UUID = "announce-uuid";

const ISSUE = {
  documentId: UUID,
  issueId: "ISS-1192",
  status: "open",
  title: "a thread with nothing on it",
  description: "no mark here",
};

const state = { issues: [ISSUE], comments: { [UUID]: [] }, calls: [] };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
/* Every call below is made from this checkout, whose project is a record beside the machine's own
   keys now: written under the home the children read, or they are refused for the slug. */
projectRecord(ROOT, tracker.env.XDG_CONFIG_HOME,
  JSON.parse(readFileSync(new URL("../../../.forge.json", import.meta.url), "utf8")));
const ENV = { ...tracker.env, HOME: tracker.env.XDG_CONFIG_HOME };

const ran = (argv, stdin = null) => ranAsync(FORGE, argv, ENV, ROOT, stdin);

const posted = () => ran(["comment", "ISS-1192", "-", "--title", "a line about it"],
  "The write went where the caller is standing.");

test("the scope the caller is standing in is the one a write says nothing about", async () => {
  state.calls = [];
  const run = await posted();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.ok(state.calls.some((one) => one.name === "forge_comments" && one.args?.action === "create"),
    "nothing was written to say this of");
  assert.doesNotMatch(run.stderr, /-> project/u,
    "this checkout's own project, its own row and its own prose is what the caller already holds");
});

test("a thread with nothing on it holds no write, and says so by not holding it", async () => {
  const run = await posted();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stderr, /no comments on/u,
    "a gate that did not hold trains a reader to skip the place the refusal appears");
});

test("a write to the scope the caller stands in says its own line and nothing above it", async () => {
  const run = await posted();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.deepEqual(run.stderr.split("\n").filter((line) => line.trim() !== ""), [],
    `nothing stood above the answer: ${run.stderr}`);
});

const heard = async (call) => {
  const said = [];
  const was = console.error;
  console.error = (line) => said.push(line);
  try {
    await call();
  } finally {
    console.error = was;
  }
  return said.filter((line) => String(line).includes("-> project"));
};

const AIMED = "the CLI, for a reason of its own";

/* A re-aim is what ISS-700 gave this line for, and it is said. What varies underneath it is how many
   requests the verb needed — a renewal, a probe, the retry behind one — which no caller can see. */
test("a re-aimed write names the scope once, however many sends follow it", async () => {
  useProject({ slug: "forge-plugin", from: AIMED });
  const sent = (status) => write("forge_issues", { action: "update", documentId: UUID, data: { status } });
  const first = await heard(() => sent("confirmed"));
  assert.equal(first.length, 1, `the re-aim said nothing: ${first.join(" | ")}`);
  assert.match(first[0], new RegExp(`-> project forge-plugin \\(from ${AIMED}\\)`, "u"));
  const again = await heard(async () => {
    await sent("approved");
    await sent("in_progress");
  });
  assert.deepEqual(again, [], "two more sends to a scope already named say nothing of their own");
});

/* The scope and not the route is what the ledger is kept on: a second tool going to the same place
   tells a reader nothing the first did not, and the reader is paying for it by the token. */
test("a second tool writing to a scope already named says nothing either", async () => {
  useProject({ slug: "forge-plugin", from: AIMED });
  const said = await heard(() => write("forge_comments",
    { action: "create", data: { issue: UUID, body: "a line" } }));
  assert.deepEqual(said, []);
});
