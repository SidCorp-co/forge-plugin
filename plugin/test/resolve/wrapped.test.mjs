/* ISS-335. The verb table read backwards: which verb is the route to a tool and action a raw call is
   asking for. Three things are watched here that a reader cannot see from either side alone — that
   the routing column left the capability keys where they were, that no two rows claim one pair, and
   that the CLI refuses before it asks the tracker anything. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { VERBS, actionIn, gateKey, verbFor, wrappedRefusal, wrapsOf } from "../../src/resolve/visibility.mjs";
import { toolOfCall } from "../../src/tracker/issue-read.mjs";
import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const SLUG = "wrapped-fixture";
const rowFor = (verb) => VERBS.find(([name]) => name === verb);

test("a pair a verb claims answers with that verb, and one no row claims answers with nothing", () => {
  assert.equal(verbFor("forge_issues", "create").verb, "new");
  assert.equal(verbFor("forge_issues", "list").verb, "issues");
  assert.equal(verbFor("forge_issues", "get").verb, "issue");
  assert.equal(verbFor("forge_comments", "create").verb, "comment");
  assert.equal(verbFor("forge_knowledge", "upsert").line, "`forge knowledge write`");
  assert.equal(verbFor("forge_uploads", "request").verb, "attach");

  /* No action of the record is left for a raw call to make: the override route is a verb, so is the
     status a check did not earn, and so are both directions of the merged mark. */
  assert.equal(verbFor("forge_issues", "update").line, "`forge issue --set`");
  assert.equal(verbFor("forge_issues", "transition").line, "`forge advance`");
  assert.equal(verbFor("forge_issues", "mark_merged").line, "`forge record merged`");
  assert.equal(verbFor("forge_issues", "unmark").line, "`forge record merged --undo`");
  assert.equal(verbFor("forge_comments", "list"), null);
  assert.equal(verbFor("forge_memory_write", "create"), null, "a tool no row names claims nothing");
  /* An action read off the prototype is claimed by nobody and would name a function as the command. */
  assert.equal(verbFor("forge_issues", "toString"), null);
  assert.equal(verbFor("forge_issues", "constructor"), null);
});

/* Built here rather than borrowed from the table: the last live row of this shape went with the
   gated edge write it wrapped (ISS-702). The two readings stay, because the shape is one row away
   whenever a credential's gate is an action rather than a tool, and no live row proves them now. */
const GATED_ROW = ["gated-verb", "[--x]", "a row gated on one action of its tool", "forge_example",
  { action: "spend" }];

test("the action a row spends is read out of whichever key of its gate object carries it", () => {
  assert.deepEqual(wrapsOf(GATED_ROW), { spend: "`forge gated-verb`" },
    "a gated row is the route to the action it names, and spelling it twice is how the two go out of step");
  assert.equal(wrapsOf(rowFor("plan")), null, "a verb that is no action's route claims none");
  assert.equal(wrapsOf(rowFor("call")), null);
});

/* The regression a routing entry could cause and nothing else would show: `gateKey` composes
   `tool.action`, and `forge doctor` records five keys and no others. A route read as a gate would
   compose a key nothing records, and the verb would stop being hidden from a credential that cannot
   spend it. So the key is composed off `action` alone, and this watches that it is. */
test("routing an action leaves every capability key exactly where it was", () => {
  assert.equal(gateKey(rowFor("knowledge")), "forge_knowledge");
  assert.equal(gateKey(rowFor("issues")), "forge_issues");
  assert.equal(gateKey(rowFor("attach")), "forge_uploads");
  assert.equal(gateKey(rowFor("project")), "forge_projects.list");
  assert.equal(gateKey(GATED_ROW), "forge_example.spend");
  for (const row of VERBS) {
    if (!row[4]?.wraps) continue;
    assert.equal(row[4].action, undefined, `${row[0]} names an action beside its routing entry`);
    assert.equal(gateKey(row), row[3], `${row[0]} composed a key out of its routing entry`);
  }
});

test("no two rows claim the same tool and action", () => {
  const seen = new Map();
  for (const row of VERBS) {
    for (const action of Object.keys(wrapsOf(row) ?? {})) {
      const key = `${row[3]} ${action}`;
      assert.equal(seen.get(key), undefined,
        `${key} is claimed by ${seen.get(key)} and ${row[0]}: a raw call cannot be told which to type`);
      seen.set(key, row[0]);
    }
  }
  assert.ok(seen.size > 5, "the column is not empty");
});

/* The class of regression this table creates, watched where it is created rather than one instance
   at a time: a refusal that hands back a raw call for a pair the table claims is a command the same
   binary will refuse, printed at the moment the caller has nowhere else to go. ISS-335 landed with
   one of these — the park path's escape, found by review and not by the suite. */
const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const under = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((one) => (one.isDirectory() ? under(join(dir, one.name)) : [join(dir, one.name)]))
  .filter((one) => one.endsWith(".mjs"));
const CALLS = /forge call\s+(forge_[a-z_]+)([\s\S]{0,240})/gu;
const ACTION = /"action"\s*:\s*"(\w+)"|action:\s*"(\w+)"/u;

test("nothing this CLI prints hands back a raw call for a pair the table claims", () => {
  const found = [];
  for (const path of [...under(join(SOURCE, "src")), ...under(join(SOURCE, "hooks"))]) {
    for (const [, tool, after] of readFileSync(path, "utf8").matchAll(CALLS)) {
      const said = ACTION.exec(after);
      const action = said?.[1] ?? said?.[2];
      if (action && verbFor(tool, action)) found.push(`${path.slice(SOURCE.length + 1)}: ${tool} ${action}`);
    }
  }
  assert.deepEqual(found, [], `printed as a route and refused as one: ${found.join("; ")}`);
});

test("a payload naming no action, or one that is not a name, claims nothing", () => {
  assert.equal(actionIn({ action: { create: true } }), null);
  assert.equal(actionIn({}), null);
  assert.equal(actionIn(null), null);
  assert.equal(wrappedRefusal("forge_issues", null), null);
  assert.equal(toolOfCall("Bash"), null,
    "a shell command names no tool, so the gate asks the table nothing and the CLI holds that reading");
});

test("the refusal names the verb and what it does that the raw call does not", () => {
  const said = wrappedRefusal("forge_issues", "create");
  assert.match(said, /forge_issues create is what `forge new` wraps/u);
  assert.match(said, /takes the reading this route skips/u);
  assert.equal(said.split("\n").length, 1, "one line, as a spent turn is owed");
});

/* `forge tools` prints the table's keys, and a caller who types one back is naming a pair rather
   than a tool: read as a tool name it would reach the route past this refusal and past the
   read-before-write check, both of which are keyed on the tool the tracker knows. */
test("a key typed where a tool name goes is refused by the verb that wraps the pair", async () => {
  const { ran, close } = await gated();
  try {
    const run = await ran("call", "forge_issues.create", '{"data":{"title":"x"}}');
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /forge_issues create is what `forge new` wraps/u);
  } finally {
    await close();
  }
});

/* ISS-335's second rule, on the tool whose action nothing wraps any more: the edge write moved to
   `forge_issues.link` and `forge_project_pm.set_dependency` is a pair the table serves no route for,
   so the raw call is refused as unserved rather than pointed at the verb that went with it. */
const gated = async () => {
  const tracker = await fakeTracker({
    declared: ["forge_project_pm", "forge_issues"],
    answer: {
      forge_project_pm: () => ({ nodes: [] }),
      forge_guide: () => ({ guides: [] }),
      "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-00000000027d" }] }),
    },
  });
  const cwd = tempRoom("wrapped-gated-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: SLUG }));
  await ranAsync(process.execPath, [CLI, "doctor"], tracker.env, cwd);
  return {
    close: tracker.close,
    ran: (...argv) => ranAsync(process.execPath, [CLI, ...argv], tracker.env, cwd),
  };
};

const gatedKnowledge = async () => {
  const tracker = await fakeTracker({
    declared: ["forge_knowledge", "forge_issues"],
    answer: {
      forge_knowledge: () => ({ refused: "FORBIDDEN: knowledge is not enabled for this credential" }),
      forge_guide: () => ({ guides: [] }),
      "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-00000000027d" }] }),
    },
  });
  const cwd = tempRoom("wrapped-knowledge-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: SLUG }));
  await ranAsync(process.execPath, [CLI, "doctor"], tracker.env, cwd);
  return {
    close: tracker.close,
    ran: (...argv) => ranAsync(process.execPath, [CLI, ...argv], tracker.env, cwd),
  };
};

test("an action no row claims and no route serves is refused as unserved, not handed a gone verb", async () => {
  const { ran, close } = await gated();
  try {
    const run = await ran("call", "forge_project_pm", '{"action":"set_dependency","data":{"from":"ISS-1"}}');
    assert.equal(run.status, 1);
    assert.match(run.stderr, /forge_project_pm\.set_dependency/u, "and names the pair it was asked for");
    assert.doesNotMatch(run.stderr, /type it instead/u, "and offers no verb, there being none to type");
  } finally {
    await close();
  }
});

/* The class the row above proved while it existed, on the arm of the reading that still has a live
   case: a verb this machine withheld is a verb the raw call is not the way round either. */
test("a withheld verb's action is refused with the verb and the withholding, not let through", async () => {
  const { ran, close } = await gatedKnowledge();
  try {
    const hidden = await ran("doctor", "--hide", "knowledge");
    assert.match(hidden.stdout, /knowledge is now withheld from the usage list/u, hidden.stderr);
    const run = await ran("call", "forge_knowledge", '{"action":"upsert","data":{"slug":"s"}}');
    assert.equal(run.status, 1);
    assert.match(run.stderr, /forge_knowledge upsert is what `forge knowledge write` wraps/u);
    assert.match(run.stderr, /is withheld on this machine/u);
    assert.match(run.stderr, /not the way round/u);
  } finally {
    await close();
  }
});

test("the graph read the same tool answers is not refused, because no verb claims it", async () => {
  const { ran, close } = await gated();
  try {
    const run = await ran("call", "forge_project_pm", '{"action":"graph"}');
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /wraps/u);
  } finally {
    await close();
  }
});

test("a gated verb with no refusal text of its own still says why it cannot be typed", async () => {
  const { ran, close } = await gatedKnowledge();
  try {
    const run = await ran("call", "forge_knowledge", '{"action":"upsert","data":{"slug":"s"}}');
    assert.equal(run.status, 1);
    assert.match(run.stderr, /forge_knowledge upsert is what `forge knowledge write` wraps/u);
    assert.match(run.stderr, /cannot spend forge_knowledge on this credential/u);
    assert.doesNotMatch(run.stderr, /type it instead/u, "the verb it names cannot be typed either");
  } finally {
    await close();
  }
});

/* The same regression from the other side, through the surface that shows it. */
test("a credential whose knowledge tool refuses still has the verb hidden from the usage list", async () => {
  const { ran, close } = await gatedKnowledge();
  try {
    const listed = await ran("-h");
    assert.doesNotMatch(listed.stdout, /^ {2}knowledge /mu, "the verb left the usage list");
    assert.match(listed.stdout, /^ {2}issues /mu, "and the verbs beside it did not");
  } finally {
    await close();
  }
});

/* The refusal is made off the table, so it costs no round trip: with the tracker gone the answer is
   the same one. A check that let the tool list be fetched first would hang or fail here instead. */
test("a wrapped action is refused with no tracker to ask", async () => {
  const tracker = await fakeTracker({ declared: ["forge_issues"], answer: {} });
  const cwd = tempRoom("wrapped-offline-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: SLUG }));
  await tracker.close();
  const run = await ranAsync(process.execPath, [CLI, "call", "forge_issues", '{"action":"list"}'], tracker.env, cwd);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge_issues list is what `forge issues` wraps/u);
});
