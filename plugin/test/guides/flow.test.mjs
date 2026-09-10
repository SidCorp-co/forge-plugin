/* Which flow a project is served, and which flow each contract part came from. Every assertion is
   watched failing on a planted tree or a planted declaration: the shipped set is one flow, so a case
   reading only it would pass on a resolver that had no flow axis at all. */
import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { flat, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("flow").path;
const {
  addressed, contractParts, contractPath, contractProblems, flowProblems, missingIn,
  partFileProblem, partFor, readContract,
} = await import("../../src/guides/contract.mjs");
const { DEFAULT, FLOWS, FLOW_SLUGS } = await import("../../src/guides/flow.mjs");

const PLUGIN = new URL("../../", import.meta.url).pathname;
const FORGE = join(PLUGIN, "bin", "forge");
const FIXTURE = "erp-flow";

/* A flow is read off a `.forge.json` by a resolver answering once per process, so a case varying one
   runs the verb: two flows in one process would both read whichever was resolved first. */
const room = (keys) => {
  const dir = tempRoom("flow-");
  writeFileSync(join(dir, ".forge.json"), JSON.stringify({ slug: "flow-fixture", ...keys }));
  return dir;
};

const asked = (keys, ...argv) =>
  spawnSync(FORGE, argv, { encoding: "utf8", env: { ...process.env, HOME: process.env.HOME }, cwd: room(keys) });

test("this copy ships one flow, and it is the base every other one inherits from", () => {
  assert.deepEqual(FLOW_SLUGS, [DEFAULT], "a second shipped flow is its own issue, blocked by ISS-902");
  assert.deepEqual(FLOWS[DEFAULT], { overrides: [], requires: [] },
    "the base declares no override and demands no declaration of a plan");
  assert.deepEqual(flowProblems(), [], flowProblems().join("\n"));
});

/* The declaration and the directories against each other, and no pin in the question: the answer to
   *what does this copy ship* must not move with a `.forge.json` no gate step declares. */
const shipping = (parts, flows) => {
  const dir = tempRoom("flow-ship-");
  for (const [flow, files] of Object.entries(parts)) {
    mkdirSync(join(dir, "guides", "contract", flow), { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(dir, "guides", "contract", flow, name), text);
    }
  }
  return flowProblems(dir, flows);
};

const BASE = {
  "01-first.md": "# First\n\n**Contract 1.** The number.\n",
  "09-developed.md": "### `developed` — reads the review\n\nThe base's own.\n",
  "10-testing.md": "### `testing` — reads the verdict\n\nAlso the base's.\n",
};
const DECLARED = { [DEFAULT]: { overrides: [], requires: [] },
  [FIXTURE]: { overrides: ["09-developed.md"], requires: [] } };

test("a flow declared with no directory is named, and so is a directory nothing declares", () => {
  const absent = shipping({ [DEFAULT]: BASE }, DECLARED);
  assert.equal(absent.length, 2, absent.join("\n"));
  assert.match(absent[0], new RegExp(`${FIXTURE} is declared and \\S+ holds no part`, "u"));
  assert.match(absent[1], new RegExp(`${FIXTURE} declares 09-developed\\.md and has not got it`, "u"));
  const stranger = shipping(
    { [DEFAULT]: BASE, unnamed: { "09-developed.md": "### `developed`\n\nNobody's.\n" } },
    { [DEFAULT]: { overrides: [], requires: [] } },
  );
  assert.equal(stranger.length, 1, stranger.join("\n"));
  assert.match(stranger[0], /holds unnamed and FLOWS names no such flow/u);
});

test("an override of a part default has not got, and one nothing declares, are each named", () => {
  const inserted = shipping(
    { [DEFAULT]: BASE, [FIXTURE]: { "20-new.md": "### `new` — reads nothing\n\nInserted.\n" } },
    { ...DECLARED, [FIXTURE]: { overrides: ["20-new.md"], requires: [] } },
  );
  assert.equal(inserted.length, 1, inserted.join("\n"));
  assert.match(inserted[0], /declares 20-new\.md and default has no part of that name/u);
  const undeclared = shipping(
    { [DEFAULT]: BASE, [FIXTURE]: { "10-testing.md": "### `testing`\n\nA flow's own.\n" } },
    DECLARED,
  );
  assert.equal(undeclared.length, 2, undeclared.join("\n"));
  assert.match(undeclared[0], /declares 09-developed\.md and has not got it/u);
  assert.match(undeclared[1], /holds 10-testing\.md and declares no override for it/u);
});

test("a flow file byte-identical to the default it overrides carries nothing and is refused", () => {
  const copied = shipping(
    { [DEFAULT]: BASE, [FIXTURE]: { "09-developed.md": BASE["09-developed.md"] } },
    DECLARED,
  );
  assert.equal(copied.length, 1, copied.join("\n"));
  assert.match(copied[0], /09-developed\.md is byte-identical to default's/u);
  const differing = shipping(
    { [DEFAULT]: BASE, [FIXTURE]: { "09-developed.md": "### `developed` — reads the review\n\nThe flow's own.\n" } },
    DECLARED,
  );
  assert.deepEqual(differing, [], differing.join("\n"));
});

/* One flow's parts resolved against another's: the override answers from the flow, every part it
   does not declare from `default`, and no sibling flow is read for either. */
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

const OWN = "### `developed` — reads the review\n\nThe flow's own.\n";

test("a declared override answers from the flow and every other part from default", () => {
  const root = installed({
    [DEFAULT]: BASE,
    [FIXTURE]: { "09-developed.md": OWN },
    sibling: { "10-testing.md": "### `testing`\n\nA sibling's, which nothing may reach.\n" },
  });
  const parts = addressed(contractParts({ root, flow: FIXTURE, flows: DECLARED }));
  assert.deepEqual(parts.map((one) => [one.keys[0], one.from]),
    [["first", DEFAULT], ["developed", FIXTURE], ["testing", DEFAULT]],
    "each part names the flow it came from, and the sibling is never probed");
  assert.match(partFor(parts, "developed").text, /The flow's own/u);
  assert.match(partFor(parts, "testing").text, /Also the base's/u);
  const base = addressed(contractParts({ root, flow: DEFAULT, flows: DECLARED }));
  assert.match(partFor(base, "developed").text, /The base's own/u,
    "and the base is served its own file, not the flow's");
});

test("a part a flow declares and has not got is refused by name, and its neighbours are served", () => {
  const root = installed({ [DEFAULT]: BASE, [FIXTURE]: { "11-other.md": "### `other`\n\nx\n" } });
  const flows = { ...DECLARED, [FIXTURE]: { overrides: ["09-developed.md", "11-other.md"], requires: [] } };
  const entries = contractParts({ root, flow: FIXTURE, flows });
  assert.deepEqual(missingIn(entries).map((one) => one.name), ["09-developed.md"]);
  const parts = addressed(entries);
  assert.equal(partFor(parts, "developed").missing, true,
    "the part is addressed by default's heading so the refusal answers the key a reader typed");
  assert.equal(partFor(parts, "testing").missing, false, "and the parts the damage does not touch stand");
  assert.match(readContract(root, FIXTURE), /Also the base's/u,
    "the join leaves the lost part out rather than withholding every part with it");
});

/* The part carrying `**Contract 1.**` is the one whose loss reaches every other part: read off the
   served join, the number would be gone and the whole contract refused as stating none, which is the
   per-part rule breaking on exactly the part that tests it. */
test("a lost override of the part carrying the number leaves every other part servable", () => {
  const root = installed({ [DEFAULT]: BASE, [FIXTURE]: { "09-developed.md": OWN } });
  const flows = { ...DECLARED, [FIXTURE]: { overrides: ["01-first.md", "09-developed.md"], requires: [] } };
  assert.deepEqual(contractProblems({ root, flow: FIXTURE, flows }), [],
    "the number is still knowable, so nothing says this copy states none");
  const parts = addressed(contractParts({ root, flow: FIXTURE, flows }));
  assert.equal(partFor(parts, "first").missing, true, "the lost part is the only one refused");
  assert.equal(partFor(parts, "developed").missing, false);
  assert.match(partFor(parts, "testing").text, /Also the base's/u, "and an inherited part is served");
  assert.deepEqual(missingIn(contractParts({ root, flow: FIXTURE, flows })).map((one) => one.name),
    ["01-first.md"]);
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

/* The fence's value class carries the hyphen because a flow slug is kebab-case like every other slug
   here: without it the opener matches nothing, the closer reports closing a block nothing opened,
   and the body is served to every flow alike. */
test("a fence value carrying a hyphen opens a block, and without the hyphen it is malformed", async () => {
  const { render } = await import("../../src/guides/render.mjs");
  const text = `Above.\n\n<!-- forge:when flow ${FIXTURE} -->\nOnly that flow's.\n<!-- forge:end -->\n\nBelow.`;
  const conditions = { flow: { value: FIXTURE, allowed: [DEFAULT, FIXTURE] } };
  const kept = render(text, conditions);
  assert.deepEqual(kept.problems, [], kept.problems.join("\n"));
  assert.match(kept.text, /Only that flow's\./u);
  const dropped = render(text, { flow: { value: DEFAULT, allowed: [DEFAULT, FIXTURE] } });
  assert.deepEqual(dropped.problems, []);
  assert.doesNotMatch(dropped.text, /Only that flow's\./u);
  const OPEN = readFileSync(join(PLUGIN, "src", "guides", "render.mjs"), "utf8")
    .match(/^const OPEN = .*$/mu)[0];
  assert.ok(OPEN.includes(String.raw`[a-z][a-z0-9\s-]`),
    "the value class without the hyphen leaves a kebab-case flow governing nothing");
});
