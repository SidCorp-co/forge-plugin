/* ISS-335. The verb table read backwards: which verb is the route to a tool and action a raw call is
   asking for. The raw caller left is a connected MCP client, so the gate over it is where the answer
   is spent. Three things are watched here that a reader cannot see from either side alone — that the
   routing column left the capability keys where they were, that no two rows claim one pair, and that
   the refusal is made before the tracker is asked anything. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { VERBS, actionIn, gateKey, verbFor, wrappedRefusal, wrapsOf } from "../../src/resolve/visibility.mjs";
import { noRouteRefusal } from "../../src/tracker/rest.mjs";
import { toolOfCall } from "../../src/tracker/issue-read.mjs";
import { callHookAsync, fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const SLUG = "wrapped-fixture";
const rowFor = (verb) => VERBS.find(([name]) => name === verb);

test("a pair a verb claims answers with that verb, and one no row claims answers with nothing", () => {
  assert.equal(verbFor("forge_issues", "create").verb, "new");
  assert.equal(verbFor("forge_issues", "list").verb, "issue");
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
  assert.equal(verbFor("forge_comments", "list").line, "`forge comment ISS-45`");
  /* Answered from the route, not the owning column, the ask arriving whole with no action. */
  assert.equal(verbFor("forge_projects.list", null).verb, "project");
  assert.equal(verbFor("forge_memory.search", null).line, "`forge knowledge search`");
  assert.equal(verbFor("forge_memory", "search").line, "`forge knowledge search`");
  assert.equal(verbFor("forge_memory_write", "create"), null, "a tool no row names claims nothing");
  /* An action read off the prototype is claimed by nobody and would name a function as the command. */
  assert.equal(verbFor("forge_issues", "toString"), null);
  assert.equal(verbFor("forge_issues", "constructor"), null);
});

/* Both directions of one claim, across two tables and belonging to neither, so the transport stays
   independent of the verb surface. A route no verb prints is a raw call somebody must make; a claim
   on a route the table does not serve refuses when typed, which is how `knowledge search` shipped. */
test("every route a verb owns exists, and every route the table serves is some verb's", async () => {
  const { served } = await import("../../src/tracker/rest.mjs");
  const owner = new Map();
  for (const row of VERBS) {
    for (const key of Object.keys(wrapsOf(row) ?? {})) {
      owner.set(key, [...(owner.get(key) ?? []), row[0]]);
    }
  }
  const routes = served().map((one) => one.key ?? one.tool);
  assert.ok(routes.length > 20, `${routes.length} route(s) read; the table was not reached`);
  assert.deepEqual(routes.filter((key) => !owner.has(key)), [],
    "a route no verb prints is a raw call this CLI is still asking somebody to make");
  assert.deepEqual([...owner.keys()].filter((key) => !routes.includes(key)), [],
    "a verb claims a route the transport does not serve, so typing it refuses");
  assert.deepEqual([...owner].filter(([, verbs]) => verbs.length > 1).map(([key]) => key), [],
    "two verbs claim one route, so the refusal names whichever row is read first");
});

/* Built here rather than borrowed from the table: the last live row of this shape went with the
   gated edge write it wrapped (ISS-702). The two readings stay, because the shape is one row away
   whenever a credential's gate is an action rather than a tool, and no live row proves them now. */
const GATED_ROW = ["gated-verb", "[--x]", "a row gated on one action of its tool", "forge_example",
  { action: "spend" }];

test("the action a row spends is read out of whichever key of its gate object carries it", () => {
  assert.deepEqual(wrapsOf(GATED_ROW), { "forge_example.spend": "`forge gated-verb`" },
    "a gated row is the route to the action it names, and spelling it twice is how the two go out of step");
  /* Off the table, so the row exists: named, a verb that has since gone passes this on two undefineds. */
  const unclaimed = VERBS.find((row) => !row[4]?.wraps && !row[4]?.action);
  assert.ok(unclaimed, "some verb is no action's route, or this reading has nothing to make");
  assert.equal(wrapsOf(unclaimed), null, "a verb that is no action's route claims none");
  assert.equal(wrapsOf(rowFor("call")), null);
});

/* The regression a routing entry could cause and nothing else would show: `gateKey` composes
   `tool.action`, and `forge doctor` records five keys and no others. A route read as a gate would
   compose a key nothing records, and the verb would stop being hidden from a credential that cannot
   spend it. So the key is composed off `action` alone, and this watches that it is. */
test("routing an action leaves every capability key exactly where it was", () => {
  assert.equal(gateKey(rowFor("knowledge")), "forge_knowledge");
  assert.equal(gateKey(rowFor("issue")), "forge_issues");
  assert.equal(gateKey(rowFor("attach")), "forge_uploads");
  assert.equal(gateKey(rowFor("project")), "forge_projects.list",
    "the seven it owns are one column and the one it spends is the other");
  assert.equal(gateKey(GATED_ROW), "forge_example.spend");
  /* The two owning what they must not be hidden by: `doctor` is the only surface allowed to say a thing is gated, so a gate on what it probes may not take it away. */
  assert.equal(gateKey(rowFor("doctor")), null);
  assert.equal(gateKey(rowFor("guide")), null);
  for (const row of VERBS) {
    if (!row[4]?.wraps) continue;
    assert.equal(row[4].action, undefined, `${row[0]} names an action beside its routing entry`);
    const owed = Object.hasOwn(row[4], "needs") ? row[4].needs : row[3];
    assert.equal(gateKey(row), owed, `${row[0]} composed a key out of its routing entry`);
  }
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

/* A whole key where a tool name goes: the generated help names routes that way, so the refusal has to
   read it that way too. Read as a tool name it would reach the route past this refusal and past the
   read-before-write check, both of which are keyed on the tool the tracker knows. */
test("a key given where a tool name goes is refused by the verb that wraps the pair", () => {
  assert.match(wrappedRefusal("forge_issues.create", null), /forge_issues create is what `forge new` wraps/u);
  assert.match(wrappedRefusal("forge_issues", "create"), /forge_issues create is what `forge new` wraps/u,
    "and the two spellings of one pair answer alike");
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

/* Written, not probed: doctor records four capabilities and `forge_issues` is none, so the state the `needs` rule was declared for is reachable only by seeding it. */
const gatedTool = async (tool) => {
  const tracker = await fakeTracker({
    declared: [tool, "forge_project_pm"],
    answer: {
      forge_guide: () => ({ guides: [] }),
      forge_project_pm: () => ({ nodes: [] }),
      "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-00000000027d" }] }),
    },
  });
  const cwd = tempRoom("wrapped-gated-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: SLUG }));
  const at = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  const held = JSON.parse(readFileSync(at, "utf8"));
  writeFileSync(at, JSON.stringify({
    ...held,
    capabilities: { [SLUG]: { checkedAt: "2026-09-08T00:00:00.000Z", [tool]: "not for this token" } },
  }));
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
    cwd,
    env: tracker.env,
    ran: (...argv) => ranAsync(process.execPath, [CLI, ...argv], tracker.env, cwd),
  };
};

/* The refusal's one caller: the gate over a connected MCP client. Asked through it rather than of a command, because no verb types a tool name and the withholding is machine state a child has to be pointed at. */
const HOOK = new URL("../../hooks/entries/issue-read-first.mjs", import.meta.url).pathname;
const refusedBy = async (env, cwd, name, input) => {
  const run = await callHookAsync(HOOK, { tool_name: name, tool_input: input, cwd }, env, cwd);
  return JSON.parse(run.stdout || "{}")?.hookSpecificOutput?.permissionDecisionReason ?? run.stdout;
};

/* A pair no row claims is named back rather than offered a verb nobody has. */
test("an action no row claims and no route serves is refused as unserved, not handed a gone verb", () => {
  assert.equal(wrappedRefusal("forge_project_pm", "set_dependency"), null,
    "no row claims the pair, so the wrapping refusal has nothing to say about it");
  const said = noRouteRefusal("forge_project_pm.set_dependency");
  assert.match(said, /forge_project_pm\.set_dependency/u, "and the transport names the pair it was asked for");
  assert.doesNotMatch(said, /type it instead/u, "and offers no verb, there being none to type");
});

/* A verb this machine withheld is a verb the raw surface is not the way round either. */
test("a withheld verb's action is refused with the verb and the withholding, not let through", async () => {
  const { ran, close, env, cwd } = await gatedKnowledge();
  try {
    const hidden = await ran("doctor", "--hide", "knowledge");
    assert.match(hidden.stdout, /knowledge is now withheld from the usage list/u, hidden.stderr);
    const said = await refusedBy(env, cwd, "mcp__forge__forge_knowledge", { action: "upsert", data: { slug: "s" } });
    assert.match(said, /forge_knowledge upsert is what `forge knowledge write` wraps/u, said);
    assert.match(said, /is withheld on this machine/u);
    assert.match(said, /not the way round/u);
  } finally {
    await close();
  }
});

/* Judged on the word typed, `forge list` has no row, is blocked by nothing, and performs the gated `forge issue` anyway — a way round the refusal withholding-a-verb.md exists for (F1). */
test("a form is refused by the capability its verb needs, and answers with the same line", async () => {
  const { ran, close } = await gatedTool("forge_issues");
  try {
    const verb = await ran("issue", "-h");
    assert.equal(verb.status, 1, verb.stdout);
    assert.match(verb.stderr, /needs forge_issues, which this credential may not call/u, verb.stderr);
    for (const form of ["list", "get", "show", "read", "issues"]) {
      const run = await ran(form, "-h");
      assert.equal(run.status, 1, `forge ${form}: ${run.stdout}`);
      assert.match(run.stderr, /needs forge_issues, which this credential may not call/u, run.stderr);
      assert.doesNotMatch(run.stderr, /^forge: read /mu, "and nothing ran, so no line says one did");
    }
  } finally {
    await close();
  }
});

test("the graph read is refused with the verb that prints it, and that verb still reads it", async () => {
  assert.match(wrappedRefusal("forge_project_pm", "graph"),
    /forge_project_pm graph is what `forge doctor` wraps/u);
  const { ran, close } = await gated();
  try {
    const doctor = await ran("doctor");
    assert.match(doctor.stdout, /dependency graph/u, "and the verb that owns it still reads it");
  } finally {
    await close();
  }
});

/* Why `doctor` spends an explicit nothing rather than the tool it owns: gated on `forge_config`, the one verb that records a capability refusal would be hidden by the record it wrote, and no run could clear it. Derived, `needs` is `row[3]`, so this is the arm that makes the column worth having. */
test("a recorded refusal of the tool doctor owns hides neither the verb nor its probe", async () => {
  const { ran, close } = await gatedTool("forge_config");
  try {
    const listed = await ran("-h");
    assert.match(listed.stdout, /^ {2}doctor /mu, listed.stdout);
    const doctor = await ran("doctor");
    assert.match(doctor.stdout, /dependency graph/u, "and it asks again rather than trusting the record");
  } finally {
    await close();
  }
});

test("a gated verb with no refusal text of its own still says why it cannot be typed", async () => {
  const { close, env, cwd } = await gatedKnowledge();
  try {
    const said = await refusedBy(env, cwd, "mcp__forge__forge_knowledge", { action: "upsert", data: { slug: "s" } });
    assert.match(said, /forge_knowledge upsert is what `forge knowledge write` wraps/u, said);
    assert.match(said, /cannot spend forge_knowledge on this credential/u);
    assert.doesNotMatch(said, /type it instead/u, "the verb it names cannot be typed either");
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
    assert.match(listed.stdout, /^ {2}issue /mu, "and the verbs beside it did not");
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
  const said = await refusedBy(tracker.env, cwd, "mcp__forge__forge_issues", { action: "list" });
  assert.match(said, /forge_issues list is what `forge issue` wraps/u, said);
});
