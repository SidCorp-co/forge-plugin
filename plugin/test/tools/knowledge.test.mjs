/* The store's own verb. The tracker's upsert replaces the whole row — probed on 2026-09-04, an
   omitted `--injection` moved a stored `always` to `on_demand` and an omitted `--kind` labelled a
   reference entry `guide` — so the cases below are mostly about what a write KEEPS. */
import assert from "node:assert/strict";
import test from "node:test";

import { FIXTURE_ENUMS, fakeStore, fakeTracker, ranAsync } from "../fixtures.mjs";
import { credentialLeak, deployFrom } from "../../src/tracker/project-config.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

const { store, knowledge } = fakeStore();

const state = { issues: [], comments: {}, calls: [], answer: { forge_knowledge: knowledge } };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv, stdin = null) => ranAsync(FORGE, argv, tracker.env, ROOT, stdin);
const upserts = () => state.calls.filter((one) => one.name === "forge_knowledge" && one.args.action === "upsert");

const BODY = "What this module owns, read at plugin/src/tools/knowledge.mjs.\n";

const created = () => ran(["knowledge", "write", "module-knowledge", "-", "--kind", "reference",
  "--title", "The store's verb", "--injection", "always", "--confidence", "verified",
  "--meta", "issue=ISS-152"], BODY);

test.beforeEach(() => {
  store.clear();
  state.calls.length = 0;
});

test("an empty store says so, and names the verb that fills it", async () => {
  const run = await ran(["knowledge", "list"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^0 entries$/mu, run.stdout);
  assert.match(run.stdout, /forge knowledge write <slug> <file\.md> --kind K/u,
    `an empty answer with no route out of it: ${run.stdout}`);
});

test("a write to a slug the store does not hold says it created it, and reads it back", async () => {
  const run = await created();
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^created {2}module-knowledge/mu, run.stdout);
  assert.match(run.stdout, /reference {2}always {5}verified/u, `the row is not read back: ${run.stdout}`);
  const [sent] = upserts();
  assert.deepEqual(
    { kind: sent.args.kind, injection: sent.args.injection, confidence: sent.args.confidence },
    { kind: "reference", injection: "always", confidence: "verified" },
  );
  assert.equal(sent.args.body, BODY);
});

test("a replace naming nothing keeps every field the upsert would have reset, and says which", async () => {
  await created();
  state.calls.length = 0;
  const run = await ran(["knowledge", "write", "module-knowledge", "-"], "A second body.\n");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^replaced {2}module-knowledge/mu, run.stdout);
  assert.match(run.stdout, /reference {2}always {5}verified/u,
    `the tracker's own defaults came back instead of what was stored: ${run.stdout}`);
  for (const said of ["kind reference", "title The store's verb", "injection always",
    "confidence verified", `metadata {"issue":"ISS-152"}`]) {
    assert.ok(run.stdout.includes(said), `the carry is not said: ${said}\n${run.stdout}`);
  }
  const [sent] = upserts();
  assert.equal(sent.args.body, "A second body.\n", "the body is the one field a replace does replace");
  assert.equal(store.get("module-knowledge").injection, "always");
});

test("an empty stored field is not named as carried", async () => {
  await ran(["knowledge", "write", "module-knowledge", "-", "--kind", "reference", "--title", "T"], BODY);
  const run = await ran(["knowledge", "write", "module-knowledge", "-"], "a later body\n");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /carried from the stored entry/u, run.stdout);
  assert.doesNotMatch(run.stdout, /metadata \{\}/u,
    `a field with nothing in it is named as kept: ${run.stdout}`);
});

test("--meta overlays the stored keys rather than replacing them", async () => {
  await created();
  const run = await ran(["knowledge", "write", "module-knowledge", "-", "--meta", "correctedBy=ISS-232"],
    "A corrected body.\n");
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(store.get("module-knowledge").metadata, { issue: "ISS-152", correctedBy: "ISS-232" });
});

test("a create names its kind and its title, or is refused with what the tracker would have done", async () => {
  const kindless = await ran(["knowledge", "write", "fresh", "-", "--title", "T"], BODY);
  assert.equal(kindless.status, 1, kindless.stdout);
  assert.match(kindless.stderr, /a new entry needs --kind/u, kindless.stderr);
  assert.match(kindless.stderr, /labels one that names no kind `guide`/u,
    `the refusal does not say what would have happened: ${kindless.stderr}`);

  const titleless = await ran(["knowledge", "write", "fresh", "-", "--kind", "reference"], BODY);
  assert.equal(titleless.status, 1, titleless.stdout);
  assert.match(titleless.stderr, /a new entry needs --title/u, titleless.stderr);
  assert.deepEqual(upserts(), [], "a refusal that reached the tracker anyway");
});

/* The property, not the values: the fixture declares a set the real tracker does not have, so a
   verb holding a copy of the tracker's kinds fails both halves of this. */
test("the enums are the schema's at the call, and a value outside them never reaches the tracker", async () => {
  const outside = await ran(["knowledge", "write", "fresh", "-", "--kind", "guide", "--title", "T"], BODY);
  assert.equal(outside.status, 1, outside.stdout);
  assert.match(outside.stderr, /No kind named guide/u, outside.stderr);
  assert.ok(outside.stderr.includes(FIXTURE_ENUMS.kind.join(", ")),
    `the refusal does not print the set it read: ${outside.stderr}`);
  assert.deepEqual(upserts(), [], "refused after the call rather than before it");

  const declared = await ran(["knowledge", "write", "fresh", "-", "--kind", "fixture-only",
    "--title", "T"], BODY);
  assert.equal(declared.status, 0, `a kind the schema declares was refused: ${declared.stderr}`);
});

test("each enum flag is checked against its own field", async () => {
  for (const [flag, field] of [["--injection", "injection"], ["--confidence", "confidence"]]) {
    const run = await ran(["knowledge", "write", "fresh", "-", "--kind", "rule", "--title", "T",
      flag, "nonsense"], BODY);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, new RegExp(`No ${field} named nonsense`, "u"), run.stderr);
    assert.ok(run.stderr.includes(FIXTURE_ENUMS[field].join(", ")), run.stderr);
  }
});

test("a slug the store does not hold is answered with the slugs it does, not the tracker's refusal", async () => {
  await created();
  const run = await ran(["knowledge", "get", "module-knowldge"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No entry named module-knowldge\. Did you mean: module-knowledge\?/u, run.stderr);
  assert.doesNotMatch(run.stderr, /knowledge entry not found/u,
    `the tracker's own words reached the caller: ${run.stderr}`);
});

test("get prints the body as markdown, under the fields, and not escaped inside json", async () => {
  await created();
  const run = await ran(["knowledge", "get", "module-knowledge"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^kind: reference$/mu, run.stdout);
  assert.match(run.stdout, /^metadata: \{"issue":"ISS-152"\}$/mu, run.stdout);
  assert.ok(run.stdout.trimEnd().endsWith(BODY.trimEnd()), `the body is not the last thing: ${run.stdout}`);
  assert.doesNotMatch(run.stdout, /\\n/u, "a body a reader reads may not arrive escaped");
});

test("a delete says whether there was one to delete", async () => {
  await created();
  const first = await ran(["knowledge", "delete", "module-knowledge"]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /^deleted {2}module-knowledge$/mu, first.stdout);
  const again = await ran(["knowledge", "delete", "module-knowledge"]);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /no entry named module-knowledge was in the store/u, again.stdout);
});

test("search answers one line per hit, naming the slug", async () => {
  await created();
  const run = await ran(["knowledge", "search", "what the module owns", "--limit", "3"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /0\.50 {2}module-knowledge/u, run.stdout);
  assert.match(run.stdout, /^1 hit\(s\) for `what the module owns`$/mu, run.stdout);
  const [asked] = state.calls.filter((one) => one.args.action === "search");
  assert.equal(asked.args.topK, 3, "the limit is the tracker's topK");
});

test("a limit outside the range is refused before the call", async () => {
  const run = await ran(["knowledge", "search", "anything", "--limit", "500"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--limit takes an integer from 1 to 50/u, run.stderr);
});

test("an action and a flag the verb does not have each name what it does", async () => {
  const sub = await ran(["knowledge", "lst"]);
  assert.equal(sub.status, 1, sub.stdout);
  assert.match(sub.stderr, /No knowledge action named lst\. Did you mean: list/u, sub.stderr);
  const flag = await ran(["knowledge", "list", "--kinds", "rule"]);
  assert.equal(flag.status, 1, flag.stdout);
  assert.match(flag.stderr, /No knowledge list flag named --kinds\. Did you mean: --kind\?/u, flag.stderr);
});

test("a filter is the tracker's, and an empty filtered answer is not told to write anything", async () => {
  await created();
  const run = await ran(["knowledge", "list", "--kind", "rule"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^0 entries$/mu, run.stdout);
  assert.doesNotMatch(run.stdout, /Nothing has been written/u,
    "a filter that matched nothing is not an empty store");
});

/* A refusal the store's own words would have hidden: `get` answering anything but not-found means
   the row could not be read, and a write that took that for absent would replace it (F2). */
test("a store that cannot be read refuses the write rather than treating the entry as absent", async () => {
  state.answer.forge_knowledge = (args) =>
    (args.action === "get" ? { refused: "Error: forbidden for this credential" } : knowledge(args));
  try {
    const run = await ran(["knowledge", "write", "module-knowledge", "-", "--kind", "reference",
      "--title", "T"], BODY);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /the store could not be read for module-knowledge/u, run.stderr);
    assert.deepEqual(upserts(), [], "the create branch was taken on a refusal that named no absence");
  } finally {
    state.answer.forge_knowledge = knowledge;
  }
});

/* A field accepted and dropped answers success exactly like one that was stored (F4). */
test("a field the store did not keep is a failure, not a replace", async () => {
  await created();
  state.answer.forge_knowledge = (args) =>
    (args.action === "upsert" ? knowledge({ ...args, body: "something else" }) : knowledge(args));
  try {
    const run = await ran(["knowledge", "write", "module-knowledge", "-"], "the body as sent\n");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /came back with body not as sent/u, run.stderr);
    assert.match(run.stderr, /forge knowledge get module-knowledge/u,
      `the refusal names no way to look: ${run.stderr}`);
  } finally {
    state.answer.forge_knowledge = knowledge;
  }
});

test("metadata is compared whatever order the store hands it back", async () => {
  await ran(["knowledge", "write", "module-knowledge", "-", "--kind", "reference", "--title", "T",
    "--meta", "zeta=1", "--meta", "alpha=2"], BODY);
  state.answer.forge_knowledge = (args) => {
    const answer = knowledge(args);
    if (args.action !== "get" || answer.refused) return answer;
    return { ...answer, metadata: Object.fromEntries(Object.entries(answer.metadata).reverse()) };
  };
  try {
    const run = await ran(["knowledge", "write", "module-knowledge", "-"], "a later body\n");
    assert.equal(run.status, 0, `a reordered json object read as a dropped field: ${run.stderr}`);
  } finally {
    state.answer.forge_knowledge = knowledge;
  }
});

/* The guard reads a payload's leaves, and this tool has no `data` field for `write()`'s own seat to
   read — so the shape the verb hands it is what decides whether a body is covered at all. */
test("a body carrying this project's test credential is refused, and the field named is the body", async () => {
  const deploy = deployFrom({
    url: "https://staging.example.test",
    testCredentials: { password: "a-long-staging-secret" },
  });
  assert.deepEqual(
    credentialLeak({ slug: "module-knowledge", title: "T", body: `the password is a-long-staging-secret\n` }, deploy),
    { field: "body", credential: "test credentials · password" },
  );
  assert.equal(credentialLeak({ slug: "module-knowledge", body: "nothing of the sort" }, deploy), null);
});

test("neither a body nor a slug carrying it reaches the tracker", async () => {
  state.answer["forge_projects.get"] = () => ({
    project: { previewDeploy: { url: "https://staging.example.test", testCredentials: { password: "a-long-staging-secret" } } },
  });
  try {
    const run = await ran(["knowledge", "write", "module-knowledge", "-", "--kind", "reference",
      "--title", "T"], "the password is a-long-staging-secret\n");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /carries this project's test credentials · password, at body/u, run.stderr);
    assert.deepEqual(upserts(), [], "the payload went anyway");
    /* The data-less write, which `write()`'s own seat reads nothing of (F6). */
    const gone = await ran(["knowledge", "delete", "a-long-staging-secret"]);
    assert.equal(gone.status, 1, gone.stdout);
    assert.match(gone.stderr, /carries this project's test credentials · password, at slug/u, gone.stderr);
  } finally {
    delete state.answer["forge_projects.get"];
  }
});

/* `not found` alone was the reading, and a refusal about anything else that carries those two words
   would have sent the write down the create path and replaced the row it could not read. */
test("a refusal naming something else that is not found is not read as an absent entry", async () => {
  await created();
  state.answer.forge_knowledge = (args) =>
    (args.action === "get" ? { refused: "Error: project not found for this credential" } : knowledge(args));
  const run = await ran(["knowledge", "write", "module-knowledge", "-"], "A third body.\n");
  state.answer.forge_knowledge = knowledge;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the store could not be read for module-knowledge/u);
  assert.equal(store.get("module-knowledge").body, BODY, "and the stored entry is untouched");
});
