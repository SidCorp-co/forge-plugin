/* A project's flow and everything that flow asks the project for, written by one call over two
   resources. The file is the half whose undo is certain, so it goes first and comes back whenever
   the tracker says the other half did not land: docs/cli/the-flow-axis.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";
import { restoreFailed, withKey } from "../../../src/tools/project-settings.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const SLUG = "forge-plugin";

/* Its own line breaks and its own spacing, because what this write must not do is reformat them. */
const HELD = `{
  "slug": "${SLUG}",
  "runs": 2,
  "jobs": {
    "ba": { "verbs": ["issue"] }
  }
}
`;

const state = {
  answer: {
    forge_guide: () => ({ guides: [] }),
    forge_config: (args) => {
      if (state.dead?.includes(args.action)) return { refused: "Error: the tracker would not answer" };
      /* The report reads the policy through `get`, so what the write left has to be visible there
         or the clash row would answer for a project this case never configured. */
      if (args.action === "get") {
        return { config: { baseBranch: "master", productionBranch: "master",
          pipelineConfig: state.settings?.pipelineConfig ?? {} } };
      }
      return undefined;
    },
  },
  config: { pipelineConfig: { autoProdDeploy: false, qa: "builder" } },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const room = tempHome("doctor-flow");
test.after(() => room.remove());
const file = join(room.path, ".forge.json");

/** Each case starts from the same file and the same project record, since every one of them is
 *  about what one call left behind and a case reading another's leftovers proves neither. */
const fresh = () => {
  writeFileSync(file, HELD);
  state.settings = { pipelineConfig: { autoProdDeploy: false, qa: "builder" }, projectFacts: {} };
  state.dead = [];
  state.calls = [];
};

const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], tracker.env, room.path);
const sent = () => (state.calls ?? []).filter((one) => one.method === "PATCH");

test("one call sets the flow in the project's file and the judgement that flow asks for", async () => {
  fresh();
  const run = await ask("--flow", "screen");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).flow, "screen");
  assert.equal(state.settings.pipelineConfig.qa, "independent");
  assert.match(run.stdout, new RegExp(`^flow: screen {2}← ${file}$`, "mu"),
    "the flow half, with the file it was read back off");
  assert.match(run.stdout, /^pipeline\.qa: independent {2}← the tracker's pipeline configuration$/mu,
    "and the tracker half, with the resource it was read back off");
});

/* The whole point of writing the key into the text: this file is its owner's, written by hand. */
test("every other byte of the project file is what it was", async () => {
  fresh();
  await ask("--flow", "screen");
  assert.equal(readFileSync(file, "utf8"), HELD.replace("{\n", '{\n  "flow": "screen",\n'));
});

test("a project the call moved to screen gets no flow clash row from the report", async () => {
  fresh();
  await ask("--flow", "screen");
  const run = await ask();
  assert.doesNotMatch(run.stdout, /\[ miss \] flow/u, run.stdout);
  assert.match(run.stdout, /^\[ {2}ok {2}\] flow {2,}screen/mu);
});

test("the default flow writes the file alone and says it asks for nothing further", async () => {
  fresh();
  const run = await ask("--flow", "default");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).flow, "default");
  assert.match(run.stdout, /^flow default asks this project for nothing further$/mu);
  assert.equal(sent().length, 0, "and the tracker was sent nothing at all");
  assert.equal(state.settings.pipelineConfig.qa, "builder", "so the key it held is the key it holds");
});

/* The case the read back exists for, now reached with a file already written: the tracker takes the
   key, keeps nothing, and the flow must not be left standing on a judgement nothing holds. */
test("a tracker that takes the key and keeps it not is refused, and the file goes back", async () => {
  fresh();
  state.stripped = ["qa"];
  try {
    const run = await ask("--flow", "screen");
    assert.equal(run.status, 1);
    assert.match(run.stderr, /flow screen asks this project for the judgement between developed and testing/u);
    assert.match(run.stderr, /pipeline\.qa was sent as "independent" and the tracker's pipeline configuration reads back "builder"/u);
    assert.match(run.stderr, /The project file is as it was, so this project is on the flow it had/u);
    assert.equal(readFileSync(file, "utf8"), HELD);
  } finally {
    state.stripped = [];
  }
});

test("a tracker that refuses the write outright leaves the project file as it was", async () => {
  fresh();
  state.dead = ["set_pipeline"];
  const run = await ask("--flow", "screen");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /refused the write/u, run.stderr);
  assert.equal(readFileSync(file, "utf8"), HELD);
});

/* Neither restoring nor reporting success: the write may have landed and nothing here can say. */
test("a read back that will not answer leaves the flow standing and names the setting unconfirmed", async () => {
  fresh();
  state.dead = ["pipeline"];
  const run = await ask("--flow", "screen");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /pipeline\.qa was sent as "independent" and the tracker's pipeline configuration would not say what it now holds/u, run.stderr);
  assert.match(run.stderr, /is left that way, the write having as likely landed as not/u);
  assert.match(run.stderr, /forge doctor/u, "and the call that reads it");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).flow, "screen");
});

/* The two outcomes that refusal cannot tell apart, each read off the report it leaves. */
test("the report after an unread write says which of the two outcomes it was, and one call ends either", async () => {
  fresh();
  state.dead = ["pipeline"];
  await ask("--flow", "screen");
  state.dead = [];
  assert.equal(state.settings.pipelineConfig.qa, "independent", "the write the read back could not confirm");
  const kept = await ask();
  assert.doesNotMatch(kept.stdout, /\[ miss \] flow/u, "a write that landed leaves nothing to report");

  state.settings.pipelineConfig.qa = "builder";
  const dropped = await ask();
  assert.match(dropped.stdout, /\[ miss \] flow {2,}flow screen asks for independent judgement/u,
    "and one that did not is the clash row, which is what says so");
  const again = await ask("--flow", "screen");
  assert.equal(again.status, 0, again.stderr);
  assert.equal(state.settings.pipelineConfig.qa, "independent");
});

test("a slug no flow declares is refused with the flows this copy serves, and nothing is written", async () => {
  fresh();
  const run = await ask("--flow", "erp-flow");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`erp-flow` is no flow this copy serves — it serves default, screen/u);
  assert.equal(readFileSync(file, "utf8"), HELD);
  assert.equal(sent().length, 0);
});

test("a checkout with no project file is refused before anything reaches the tracker", async () => {
  const bare = tempHome("doctor-flow-bare");
  try {
    state.calls = [];
    const run = await ranAsync(FORGE, ["doctor", "--flow", "screen"], tracker.env, bare.path);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /`flow` is a key of \.forge\.json and no such file was found/u);
    assert.equal(state.calls.length, 0);
  } finally {
    bare.remove();
  }
});

test("--set and --flow in one call are refused rather than one of them preferred", async () => {
  fresh();
  const run = await ask("--set", "pipeline.qa=builder", "--flow", "screen");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /two answers to what this call writes/u);
  assert.equal(sent().length, 0);
  assert.equal(readFileSync(file, "utf8"), HELD);
});

/* A write of a file that succeeds and a write of the same bytes back that does not is a pair no
   call through the CLI can be made to produce, so the sentence is read off what composes it. */
test("the refusal for a restore that failed names what the file now holds", () => {
  const said = restoreFailed("/w/.forge.json", "screen", "EACCES");
  assert.match(said, /\/w\/\.forge\.json was set to `flow: screen` and putting its previous bytes back failed: EACCES/u);
  assert.match(said, /That file holds the new flow now and nothing here changed it further/u);
});

/* The write is textual, so the shapes a hand-written file comes in are its cases and not the
   resolver's: a key already there, a key that is not, an empty document, and a key of the same
   name nested inside another object, which is not the key this sets. */
test("one top-level key is set in the text, and a key of that name inside another object is not it", () => {
  assert.equal(withKey('{\n  "flow": "default"\n}\n', "flow", "screen"), '{\n  "flow": "screen"\n}\n');
  assert.equal(withKey('{\n  "slug": "a"\n}\n', "flow", "screen"), '{\n  "flow": "screen",\n  "slug": "a"\n}\n');
  assert.equal(withKey("{}\n", "flow", "screen"), '{\n  "flow": "screen"\n}\n');
  assert.equal(
    withKey('{\n  "jobs": { "flow": "nested" },\n  "flow": "default"\n}\n', "flow", "screen"),
    '{\n  "jobs": { "flow": "nested" },\n  "flow": "screen"\n}\n',
  );
  assert.equal(
    withKey('{\n  "codex": { "pathRe": "a\\\\.b\\"c" },\n  "flow": "default"\n}\n', "flow", "screen"),
    '{\n  "codex": { "pathRe": "a\\\\.b\\"c" },\n  "flow": "screen"\n}\n',
  );
});

test("the flag is named in the verb's own help", async () => {
  const run = await ask("-h");
  assert.match(run.stdout, /\[--flow slug\]/u);
  assert.match(run.stdout, /^ {2}--flow <slug> {8}the flow, into the project's own file/mu);
});
