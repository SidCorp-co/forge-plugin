/* A flow's directory is the whole of what that flow serves. Every assertion is watched failing on a
   planted tree: the shipped set is one flow, so a case reading only it would pass on a resolver that
   had no flow axis at all, and one reading only `default` would pass on a resolver that still fell
   back to it. */
import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("flow").path;
const {
  addressed, contractAnswer, contractParts, contractPath, contractProblems, flowProblems,
  partFileProblem, partFor, readContract, unansweredIn,
} = await import("../../src/guides/contract.mjs");
const flowModule = await import("../../src/guides/flow.mjs");
const { DEFAULT, FLOWS, FLOW_SLUGS } = flowModule;
const { ORDER } = await import("../../src/flow/earned.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");
const FIXTURE = "erp-flow";
const SIBLING = "qa-flow";

/* A flow is read off a `.forge.json` by a resolver answering once per process, so a case varying one
   runs the verb: two flows in one process would both read whichever was resolved first. */
const room = (keys) => {
  const dir = tempRoom("flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "flow-fixture", ...keys }));
  return dir;
};

const asked = (keys, ...argv) =>
  spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env, HOME: process.env.HOME }, cwd: room(keys) });

test("this copy ships one flow, and the declaration says nothing about what a flow holds", () => {
  assert.deepEqual(FLOW_SLUGS, [DEFAULT], "a second shipped flow is its own issue, ISS-1088");
  assert.deepEqual(FLOWS[DEFAULT], { requires: [] },
    "an `overrides` key would be a flow declaring a part, and a flow's directory declares that");
  assert.equal(Object.hasOwn(flowModule, "overridesOf"), false,
    "the override lookup is gone, or a caller can still resolve a part against a base");
  assert.deepEqual(flowProblems(), [], flowProblems().join("\n"));
});

/* Whole sets, planted: each flow's directory is everything that flow serves, so a case hands over a
   directory rather than a declaration and nothing about parts is declared anywhere. */
const installed = (files) => {
  const dir = tempRoom("flow-parts-");
  for (const [flow, held] of Object.entries(files)) {
    mkdirSync(join(dir, "guides", "contract", flow), { recursive: true });
    for (const [name, text] of Object.entries(held)) {
      writeFileSync(join(dir, "guides", "contract", flow, name), text);
    }
  }
  return dir;
};

const BASE = {
  "01-first.md": "# First\n\n**Contract 1.** The number.\n",
  "09-developed.md": "### `developed` — reads the review\n\nThe base's own.\n",
  "10-testing.md": "### `testing` — reads the verdict\n\nAlso the base's.\n",
};

const OWN = {
  "01-first.md": "# First\n\n**Contract 1.** The flow's own number.\n",
  "05-a-part-of-its-own.md": "### `open` — reads a finding\n\nA part default has not got.\n",
  "09-developed.md": "### `developed` — reads the review\n\nThe flow's own.\n",
};

test("a flow holding three parts is served exactly those three, in its own order", () => {
  const root = installed({ [DEFAULT]: BASE, [FIXTURE]: OWN });
  const entries = contractParts({ root, flow: FIXTURE });
  assert.deepEqual(entries.map(({ name }) => name),
    ["01-first.md", "05-a-part-of-its-own.md", "09-developed.md"],
    "a fourth entry is default's order leaking into a flow that never asked for it");
  const parts = addressed(entries);
  assert.deepEqual(parts.map((one) => one.keys[0]), ["first", "open", "developed"]);
  assert.match(partFor(parts, "developed").text, /The flow's own/u);
  assert.match(partFor(parts, "open").text, /A part default has not got/u,
    "a part name default has not got needs no permission and is served");
  assert.equal(partFor(parts, "testing"), null,
    "default holds 10-testing.md and this flow does not: serving it would be the base coming back");
  assert.match(readContract(root, FIXTURE), /The flow's own number/u);
  assert.doesNotMatch(readContract(root, FIXTURE), /Also the base's/u,
    "the join is the flow's directory and nothing merged into it");
});

test("serving one flow reads no other flow's file, for a part it holds or one it has not got", () => {
  const root = installed({
    [DEFAULT]: BASE,
    [FIXTURE]: OWN,
    [SIBLING]: { "10-testing.md": "### `testing`\n\nA sibling's, which nothing may reach.\n" },
  });
  const missing = contractAnswer({ root, flow: FIXTURE, part: "testing" });
  assert.match(missing.refusal, /No guide contract named testing/u,
    "the part is refused, not fetched from default or from the sibling");
  assert.doesNotMatch(missing.refusal, /sibling|Also the base's|A sibling's/u);
  const held = contractAnswer({ root, flow: FIXTURE, part: "developed" });
  assert.match(held.lines.join("\n"), /The flow's own/u);
  assert.equal(held.lines.at(-1), `Flow ${FIXTURE}, which this project runs; \`forge doctor\` names its source.`,
    "and the answer names the flow it was served for, not the one the settings pin");
  const base = addressed(contractParts({ root, flow: DEFAULT }));
  assert.match(partFor(base, "developed").text, /The base's own/u,
    "and default is served its own file, never the flow's");
});

test("two flows holding one part byte-identically are both served it, and nothing is refused", () => {
  const shared = "### `developed` — reads the review\n\nWord for word in both.\n";
  const root = installed({
    [DEFAULT]: { ...BASE, "09-developed.md": shared },
    [FIXTURE]: { ...OWN, "09-developed.md": shared },
  });
  for (const flow of [DEFAULT, FIXTURE]) {
    const parts = addressed(contractParts({ root, flow }));
    assert.match(partFor(parts, "developed").text, /Word for word in both/u, flow);
    assert.deepEqual(contractProblems({ root, flow }), [], contractProblems({ root, flow }).join("\n"));
  }
  assert.deepEqual(
    flowProblems(root, { [DEFAULT]: { requires: [] }, [FIXTURE]: { requires: [] } }), [],
    "duplication between flows is the expected shape, so nothing about it is a finding",
  );
});

/* The declaration and the directories against each other, and no pin in the question: the answer to
   *what does this copy ship* must not move with a `.forge.json` no gate step declares. */
const shipping = (parts, flows) => flowProblems(installed(parts), flows);

test("a declared flow whose directory holds no part is named, with the way out", () => {
  const said = shipping({ [DEFAULT]: BASE }, { [DEFAULT]: { requires: [] }, [FIXTURE]: { requires: [] } });
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], new RegExp(`${FIXTURE} is declared and \\S+ holds no part`, "u"));
  assert.match(said[0], /take the flow out of FLOWS/u);
  const whole = shipping({ [DEFAULT]: BASE, [FIXTURE]: OWN },
    { [DEFAULT]: { requires: [] }, [FIXTURE]: { requires: [] } });
  assert.deepEqual(whole, [], whole.join("\n"));
});

test("a directory FLOWS names no flow for is named, with the way out", () => {
  const said = shipping({ [DEFAULT]: BASE, unnamed: OWN }, { [DEFAULT]: { requires: [] } });
  assert.equal(said.length, 1, said.join("\n"));
  assert.match(said[0], /holds unnamed and FLOWS names no such flow — declare it, or delete the directory/u);
});

/* A join is one text, so a file that lost its heading would have its prose served under the part
   above it and a file with two would hold a part its name does not address. Both are named, and the
   call that names them takes no file list: the parts are the directory's, so no caller can omit its
   way past the rule and be told the contract is well formed (ISS-848). */
test("a part file with no heading of its own, or with two, is a finding naming that file", () => {
  const dir = join(tempRoom("contract-files-"), "guides", "contract", DEFAULT);
  mkdirSync(dir, { recursive: true });
  const root = join(dir, "..", "..", "..");
  writeFileSync(join(dir, "01-first.md"), "# First\n\n**Contract 1.** The number.\n");
  writeFileSync(join(dir, "02-second.md"), "Prose with no heading over it at all.\n");
  assert.equal(readContract(root), null, "the raw reader served a join it should have withheld");
  const said = contractProblems({ root });
  assert.equal(said.length, 1, said.join("; "));
  assert.match(said[0], /02-second\.md opens with no heading, so nothing addresses it/u);
  writeFileSync(join(dir, "02-second.md"), "## Second\n\nProse.\n\n## Third\n\nMore prose.\n");
  const two = contractProblems({ root });
  assert.equal(two.length, 1, two.join("; "));
  assert.match(two[0], /02-second\.md carries 2 headings, and its name addresses one part/u);
  assert.deepEqual(partFileProblem("03-ok.md", "### `x` — reads y\n\nProse.\n"), null);
});

/* Planted rather than handed in as a string: the parts are resolved by the call itself, so a room is
   the only way to put a copy in front of it (ISS-848). */
const stating = (text) => {
  const held = tempRoom("contract-number-");
  mkdirSync(join(held, "guides", "contract", DEFAULT), { recursive: true });
  writeFileSync(join(held, "guides", "contract", DEFAULT, "01-only.md"), text);
  return held;
};

test("a copy with no contract, one with no number and one from another build are each a finding", () => {
  assert.deepEqual(contractProblems({}), []);
  assert.match(contractProblems({ root: tempRoom("contract-none-") })[0], /no contract at \S+/u);
  assert.match(contractProblems({ root: stating("# No number\n") })[0], /states no contract number/u);
  assert.match(contractProblems({ root: stating("# Nine\n\n**Contract 9.** nine.\n") })[0],
    /states contract 9 and this build reads contract 1/u);
  assert.match(contractProblems({ reads: 2 })[0],
    /states contract 1 and this build reads contract 2/u,
    "an older file under a newer build is the same finding: the number is matched, never ranged");
});

/* The one completeness reading kept, and the reason it may not become a gate: a flow deliberately
   without a part is legal, and `stageLine` already answers for one at the call. */
test("the statuses a set leaves unanswered are read off that set and off no other flow's", () => {
  const parts = addressed(contractParts({ root: installed({ [FIXTURE]: OWN }), flow: FIXTURE }));
  assert.deepEqual(unansweredIn(parts, ORDER),
    ORDER.filter((one) => one !== "open" && one !== "developed"),
    "a status the flow's own parts answer is not reported, and every other one is");
  assert.deepEqual(unansweredIn(addressed(contractParts({})), ORDER), [],
    "and the shipped set answers every stage of the ladder");
});

/* A copy of the code with no guides/ beside it is what every installed copy was before ISS-78, and
   the only way to watch the report say so is to make one. */
const copyOfCode = (contract, argv = ["doctor"]) => {
  const held = tempRoom("contract-copy-");
  for (const one of ["src", "hooks"]) cpSync(join(PLUGIN, one), join(held, one), { recursive: true });
  if (contract === "whole") {
    cpSync(contractPath(), join(held, "guides", "contract", DEFAULT), { recursive: true });
  } else if (contract !== null) {
    mkdirSync(join(held, "guides", "contract", DEFAULT), { recursive: true });
    writeFileSync(join(held, "guides", "contract", DEFAULT, "01-only.md"), contract);
  }
  const home = tempRoom("contract-home-");
  const run = spawnSync(process.execPath, [join(held, "src", "cli.mjs"), ...argv], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return `${run.stdout}${run.stderr}`;
};

test("doctor names the missing file, and a file from another build, in the copy that is running", () => {
  assert.match(copyOfCode(null), /\[ miss \] contract\s+no contract at \S+guides\/contract\/default/u);
  assert.match(copyOfCode("# A contract\n\n**Contract 9.**\n"), /\[ miss \] contract\s+\S+ states contract 9/u);
  assert.match(copyOfCode("# A contract\n\nNo number here.\n"), /\[ miss \] contract\s+\S+ states no contract number/u);
  assert.match(copyOfCode("**Contract 1.** No heading over it.\n"),
    /\[ miss \] contract\s+\S+: 01-only\.md opens with no heading/u,
    "a part file the install truncated is named, not served under the part before it");
  assert.match(copyOfCode("whole"), /\[ {2}ok {2}\] contract\s+\S+ states contract 1/u);
});

/* The completeness line through the report rather than through the function, because the mark is the
   half that matters: a `miss` here would make a flow's own choice of parts a refusal. */
test("doctor reports a flow's set and what it leaves unanswered, at a mark that refuses nothing", () => {
  const short = copyOfCode("# A contract\n\n**Contract 1.** The number.\n");
  assert.match(short, /\[ note \] flow set\s+default: 1 part\(s\) — leaves open, confirmed, approved/u);
  assert.match(short, /which `stageLine` says at the call/u, "and names where a run would meet it");
  assert.doesNotMatch(short, /\[ miss \] flow set/u,
    "an unanswered status is a report; a miss here would make a flow's own set a refusal");
  assert.match(copyOfCode("whole"), /\[ {2}ok {2}\] flow set\s+default: 19 part\(s\) — every stage of the ladder answered/u);
});

/* Serving is the same route as reporting and is asked by the verb rather than by a call: a copy
   holding a malformed part is refused by that file's name, never by the absent-contract line, which
   would send a reader looking for a directory that is right there. */
test("the verb refuses a copy whose part carries two headings, naming the file and not the absence", () => {
  const said = flat(copyOfCode("# A contract\n\n**Contract 1.** The number.\n\n## A second heading\n\nProse.\n",
    ["guide", "contract"]));
  assert.match(said, /01-only\.md carries 2 headings, and its name addresses one part/u);
  assert.doesNotMatch(said, /no contract at/u);
});

/* Every pairing of the two keys, because the retirement is a precedence rule and a rule with a hole
   in it serves whichever branch was written first. */
const SERVED = /^Flow (\S+), which this project runs/mu;

test("flow wins, method 1 reads as default and says so, and any other method is refused", () => {
  const one = asked({}, "guide", "contract", "open");
  assert.equal(one.status, 0, one.stderr);
  assert.equal(SERVED.exec(one.stdout)?.[1], DEFAULT, "neither key is the base flow");
  const named = asked({ flow: DEFAULT }, "guide", "contract", "open");
  assert.match(named.stdout, /Flow default, which this project runs; `forge doctor` names its source\./u);
  const retired = asked({ method: 1 }, "guide", "contract", "open");
  assert.equal(retired.status, 0, retired.stderr);
  assert.equal(SERVED.exec(retired.stdout)?.[1], DEFAULT);
  assert.match(retired.stdout, /`method` is retired: \.forge\.json sets `method: 1`, read as flow default\./u);
  const both = asked({ flow: DEFAULT, method: 4 }, "guide", "contract", "open");
  assert.equal(both.status, 0, both.stderr);
  assert.equal(SERVED.exec(both.stdout)?.[1], DEFAULT, "a present flow wins over any method");
});

test("a method no flow answers, and a flow this copy does not serve, are refused naming the way out", () => {
  for (const keys of [{ method: 4 }, { method: 0 }, { method: null }, { method: "one" }]) {
    const run = asked(keys, "guide", "contract", "open");
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /`method` is retired: this copy serves default/u, JSON.stringify(keys));
    assert.match(run.stderr, /Set `flow` to one of those/u, JSON.stringify(keys));
  }
  const strange = asked({ flow: FIXTURE }, "guide", "contract", "open");
  assert.equal(strange.status, 1, strange.stdout);
  assert.match(strange.stderr, new RegExp(`sets \`flow: ${FIXTURE}\`, and this copy serves default`, "u"));
  const outranked = asked({ flow: FIXTURE, method: 1 }, "guide", "contract", "open");
  assert.equal(outranked.status, 1, outranked.stdout);
  assert.match(outranked.stderr, new RegExp(`sets \`flow: ${FIXTURE}\``, "u"),
    "a present flow wins even where it is one this copy cannot serve");
});

/* Every surface that would have served it, since a refusal one verb gives and another does not is
   how a project came to be refused the method and served the other skills without a word. */
test("a flow this copy does not serve is the same line on the method, the contract and the listing", () => {
  const keys = { flow: FIXTURE };
  const refusal = asked(keys, "guide", "issue-flow").stderr.trimEnd();
  assert.equal(refusal.split("\n").length, 1, `the refusal is one line, not:\n${refusal}`);
  assert.equal(asked(keys, "guide", "contract").stderr.trimEnd(), refusal);
  assert.equal(asked(keys, "guide", "dispatch").stderr.trimEnd(), refusal,
    "and a skill no flow has an opinion about is refused too: the coverage is every served slug");
  const listing = asked(keys, "guide").stdout;
  for (const slug of ["contract", "issue-flow", "dispatch"]) {
    assert.match(listing, new RegExp(`${slug}\\n {2}${refusal.replace(/^guide: /u, "")}`, "u"),
      `${slug}'s row answers as the verb does, or one surface serves what another refuses`);
  }
  assert.ok(!listing.includes("table of contents"), "and never the contract's own row as if it were reachable");
  assert.ok(!listing.includes("SKILL.md"), "and never that a method is loaded with the skill");
});

test("the flow the doctor serves is printed with where the value was read", () => {
  const held = asked({ flow: DEFAULT }, "doctor").stdout;
  assert.match(held, /\[ {2}ok {2}\] flow\s+default {2}← \.forge\.json/u);
  assert.match(asked({}, "doctor").stdout, /\[ {2}ok {2}\] flow\s+default {2}← the plugin's default/u);
  assert.match(asked({ method: 1 }, "doctor").stdout,
    /\[ miss \] flow\s+default, read off the retired `method: 1` {2}← \.forge\.json\. Set `flow` instead/u);
});

/* The fence's value class carries the hyphen because every other slug here is kebab-case: without it
   the opener matches nothing, the closer reports closing a block nothing opened, and the body is
   served to every project alike. The condition is planted, because the flow is no longer one. */
test("a fence value carrying a hyphen opens a block, and without the hyphen it is malformed", async () => {
  const { render } = await import("../../src/guides/render.mjs");
  const text = `Above.\n\n<!-- forge:when mode take-two -->\nOnly that value's.\n<!-- forge:end -->\n\nBelow.`;
  const allowed = ["take-one", "take-two"];
  const kept = render(text, { mode: { value: "take-two", allowed } });
  assert.deepEqual(kept.problems, [], kept.problems.join("\n"));
  assert.match(kept.text, /Only that value's\./u);
  const dropped = render(text, { mode: { value: "take-one", allowed } });
  assert.deepEqual(dropped.problems, []);
  assert.doesNotMatch(dropped.text, /Only that value's\./u);
  const OPEN = readFileSync(join(PLUGIN, "src", "guides", "render.mjs"), "utf8")
    .match(/^const OPEN = .*$/mu)[0];
  assert.ok(OPEN.includes(String.raw`[a-z][a-z0-9\s-]`),
    "the value class without the hyphen leaves a kebab-case value governing nothing");
});
