/* A flag whose values this CLI declares is judged by the parser, where it already judges the flag's
   name, so no verb writes a judge per flag and none can forget one. The unit half hands `flags()` a
   verb and a row no source line judges; the verb half runs with no credential in reach, so a refusal
   that arrives at all arrived before anything could be sent (ISS-1135). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { flags, pullRepeated } from "../../../src/resolve/flags.mjs";
import { Refusal, refusing } from "../../../src/resolve/settings.mjs";
import { setsFor, setsOf } from "../../../src/tracker/declared/value-sets.mjs";
import { declaredValue } from "../../../src/tracker/rest.mjs";
import { complexityRefusal, kindRefusal, valueOutsideSet } from "../../../src/tracker/issue-shape.mjs";
import { LIST_USAGE } from "../../../src/commands.mjs";
import { usageOf } from "../../../src/resolve/visibility.mjs";
import { homeEnv, projectRoom, ranAsync, tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const SRC = new URL("../../../src", import.meta.url).pathname;
const env = homeEnv("value-sets");
const room = projectRoom(tempRoom("value-sets-"), env.XDG_CONFIG_HOME, { slug: "value-sets" });
const ran = (...argv) => ranAsync(FORGE, argv, env, room);
const body = join(room, "body.md");
writeFileSync(body, "## Outcome\n\nA body the refusal is reached before.\n");

const refused = async (call) => {
  try {
    await refusing(async () => call());
  } catch (error) {
    assert.ok(error instanceof Refusal, `not a refusal: ${error.stack}`);
    return error.message;
  }
  return assert.fail("nothing was refused");
};

const passes = (call) => refusing(async () => call());

/* The list path's filters are hidden flags of `forge issue`, as the verb hands them to the parser. */
const LIST_ROW = { usage: LIST_USAGE, hidden: ["--statusNot", "--priority", "--category", "--complexity"] };
const NEW_ROW = { usage: usageOf("new") };

/* Every declared-set flag of each path, a word outside its set and one inside it. */
const LIST_SLOTS = [["--status", "finishd", "open"], ["--statusNot", "closd", "closed"],
  ["--priority", "urgent", "high"], ["--category", "chore", "bug"], ["--complexity", "huge", "m"]];
const NEW_SLOTS = [["--status", "finishd", "open"], ["--category", "chore", "bug"],
  ["--complexity", "huge", "m"], ["--priority", "urgent", "high"]];

test("every declared-set filter of the issue list is refused by the parser, naming the nearest", async () => {
  for (const [flag, outside] of LIST_SLOTS) {
    const said = await refused(() => flags([flag, outside], "issue", [], LIST_ROW));
    assert.match(said, new RegExp(`^issue ${flag}: No \\w+ named ${outside}\\.`, "u"), said);
    assert.match(said, /Nothing was sent: the set is this CLI's own/u, said);
  }
  const near = await refused(() => flags(["--status", "closd"], "issue", [], LIST_ROW));
  assert.match(near, /Did you mean: closed\?/u, "the nearest declared name is the route out");
});

test("every declared-set flag of a filing is refused by the parser, with the field's own sentence where it has one", async () => {
  for (const [flag, outside] of NEW_SLOTS) {
    const said = await refused(() => flags(["--title", "t", flag, outside], "new", ["--new"], NEW_ROW));
    assert.match(said, new RegExp(`^new ${flag}: No \\w+ named ${outside}\\.`, "u"), said);
  }
  /* Compared against what the issue's fields compose, since the sentence is theirs and only carried here. */
  const category = await refused(() => flags(["--category", "chore"], "new", ["--new"], NEW_ROW));
  assert.ok(category.includes(kindRefusal("chore")), category);
  const complexity = await refused(() => flags(["--complexity", "huge"], "new", ["--new"], NEW_ROW));
  assert.ok(complexity.includes(complexityRefusal("huge")), complexity);
  const priority = await refused(() => flags(["--priority", "urgent"], "new", ["--new"], NEW_ROW));
  assert.ok(priority.includes(valueOutsideSet("priority", "urgent").said), priority);
});

test("a value inside its set passes the parser on every declared-set flag", async () => {
  for (const [flag, , inside] of LIST_SLOTS) {
    assert.equal((await passes(() => flags([flag, inside], "issue", [], LIST_ROW)))[flag.slice(2)], inside);
  }
  for (const [flag, , inside] of NEW_SLOTS) {
    assert.equal((await passes(() => flags([flag, inside], "new", ["--new"], NEW_ROW)))[flag.slice(2)], inside);
  }
  const knowledge = { usage: "Usage: forge knowledge write <slug> <file> --kind K [--injection I] [--confidence C]" };
  const given = await passes(() => flags(["--kind", "rule", "--injection", "none", "--confidence", "verified"],
    "knowledge write", [], knowledge));
  assert.deepEqual(given, { kind: "rule", injection: "none", confidence: "verified" });
  const doctor = await passes(() => flags(["--confidence", "inferred"], "doctor", [],
    { usage: usageOf("doctor"), sets: { "--confidence": setsOf("forge_knowledge")["--confidence"] } }));
  assert.equal(doctor.confidence, "inferred");
});

/* The case the issue asks for: a verb nothing in the source judges, whose row declares a set. */
test("a set a verb's row declares is judged by the parser with no judge written anywhere", async () => {
  const row = { usage: "Usage: forge widget [--shade s]", sets: { "--shade": { field: "shade", values: ["red", "blue"], held: "a case" } } };
  const said = await refused(() => flags(["--shade", "rde"], "widget", [], row));
  assert.match(said, /^widget --shade: No shade named rde\. Did you mean: red\?/u, said);
  assert.match(said, /at a case, so a name outside it is answered here/u, "where the set is held");
  const repeated = await refused(() => pullRepeated(["--shade", "red", "--shade", "green"], "--shade", "widget", row));
  assert.match(repeated, /^widget --shade: No shade named green\./u, "a flag whose values accumulate is judged per value");
  const sourced = readdirSync(SRC, { recursive: true }).filter((one) => one.endsWith(".mjs"))
    .filter((one) => statSync(join(SRC, one)).isFile())
    .filter((one) => readFileSync(join(SRC, one), "utf8").includes("shade"));
  assert.deepEqual(sourced, [], "and no source file names the flag, so nothing but the row judged it");
});

test("the word a refusal quotes is the caller's own for that flag, two declared flags in one call", async () => {
  const said = await refused(() => flags(["--priority", "high", "--category", "chroe"], "issue", [], LIST_ROW));
  assert.match(said, /^issue --category: No category named chroe\./u, said);
  const second = await refused(() => flags(["--category", "bug", "--priority", "hihg"], "issue", [], LIST_ROW));
  assert.match(second, /^issue --priority: No priority named hihg\./u, second);
});

/* Finding b4fd3576: the parser's reading of a usage row is the population, so a flag cited inside a
   quoted command or declared on a second usage line is no slot of this verb, whatever set it names. */
test("a declared-set flag inside a quoted command, or on a second usage line, is no slot of the verb", async () => {
  const usage = "Usage: forge issue [--limit n]\n  after it, run `forge issue --status s`\nUsage: forge issue --priority p";
  for (const flag of ["--status", "--priority"]) {
    const said = await refused(() => flags([flag, "open"], "issue", [], { usage }));
    assert.match(said, new RegExp(`^No issue flag named ${flag}\\.`, "u"), said);
  }
});

test("a verb's sets are the ones its row's tool declares, and a verb with no tool has none", () => {
  assert.deepEqual(Object.keys(setsFor("issue")).sort(),
    ["--category", "--complexity", "--priority", "--status", "--statusNot"]);
  assert.deepEqual(Object.keys(setsFor("knowledge write")).sort(),
    ["--authoredBy", "--confidence", "--injection", "--kind"]);
  assert.deepEqual(setsFor("cloudflare"), {}, "--priority there is a DNS record's, and no declared set");
  assert.deepEqual(setsFor("record verdict")["--kind"], undefined, "a park's --kind is no field of an issue");
});

test("declaredValue and the parser answer one question with one rule", () => {
  assert.equal(declaredValue("forge_issues", "status", "open"), null);
  assert.match(declaredValue("forge_issues", "status", "closd"), /^No status named closd\. Did you mean: closed\?/u);
  assert.equal(declaredValue("forge_issues", "nothing-declared", "anything"), null, "an empty set passes");
});

/* The verbs themselves, with no credential in reach: the value refusal is what comes back. */
test("the list path refuses an out-of-set filter before anything is sent", async () => {
  const run = await ran("issue", "--statusNot", "closd");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^issue --statusNot: No status named closd\. Did you mean: closed\?/mu, run.stderr);
});

test("a filing refuses an out-of-set status before its body is read", async () => {
  const run = await ran("new", body, "--title", "t", "--category", "bug", "--status", "finishd");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^new --status: No status named finishd\./mu, run.stderr);
});

test("the knowledge verb refuses a kind, an injection or a confidence outside the store's set", async () => {
  const list = await ran("knowledge", "list", "--injection", "sometimes");
  assert.equal(list.status, 1, list.stdout);
  assert.match(list.stderr, /^knowledge list --injection: No injection named sometimes\./mu, list.stderr);
  const kind = await ran("knowledge", "write", "a-slug", body, "--kind", "nonesuch");
  assert.match(kind.stderr, /^knowledge write --kind: No kind named nonesuch\./mu, kind.stderr);
  const confidence = await ran("knowledge", "write", "a-slug", body, "--kind", "rule", "--confidence", "sure");
  assert.match(confidence.stderr, /^knowledge write --confidence: No confidence named sure\./mu, confidence.stderr);
});

test("doctor refuses a brief's confidence outside the store's set", async () => {
  const run = await ran("doctor", "--refresh", body, "--confidence", "sure");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^doctor --confidence: No confidence named sure\./mu, run.stderr);
});
