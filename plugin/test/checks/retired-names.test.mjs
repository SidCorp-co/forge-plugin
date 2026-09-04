/* The registry is empty until the first replacement lands, and an empty one reads exactly like a
   clean tree: every case below runs a name through the real walk, so a walk that reaches neither the
   skills nor the topics fails here rather than the day a verb is retired. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { RETIRED, exempt, problems, registryProblems } from "../../src/checks/retired-names.mjs";
import { VERB_NAMES } from "../../src/resolve/visibility.mjs";

/* The dispatcher's own registry is read, not described, and it reaches the live config directory on
   the way in: a run on the developer's credential is the one thing a check may not do. */
const ROOM = mkdtempSync(join(tmpdir(), "retired-names-"));
process.env.XDG_CONFIG_HOME = ROOM;
const { commands } = await import("../../src/commands.mjs");
after(() => rmSync(ROOM, { recursive: true, force: true }));

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const READ = /\.(?:mjs|md|html)$/u;
const SKIP = new Set(["vendor", "node_modules"]);

const walk = (dir, at) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((one) => {
    if (one.isDirectory()) return SKIP.has(one.name) ? [] : walk(join(dir, one.name), `${at}/${one.name}`);
    if (!READ.test(one.name)) return [];
    return [{ rel: `${at}/${one.name}`, text: readFileSync(join(dir, one.name), "utf8") }];
  });

const files = [...walk(join(ROOT, "plugin"), "plugin"), ...walk(join(ROOT, "docs"), "docs")];
const AS_IF = { name: "advance", kind: "verb", release: "3.36.0" };

test("no surface under plugin/ or docs/ names something that was retired", () => {
  assert.ok(files.length > 150, `${files.length} file(s) walked; the selector matches too little`);
  assert.deepEqual(problems(files), [], `a retired name is still readable:\n${problems(files).join("\n")}`);
  assert.deepEqual(registryProblems(), []);
});

test("a retired verb is refused on the help, the skills, the topics and the contract", () => {
  const found = problems(files, [AS_IF]);
  for (const surface of [
    "plugin/skills/issue-flow/SKILL.md",
    "docs/cli/advance.md",
    "plugin/guides/issue-flow-contract.md",
    "plugin/src/resolve/visibility.mjs",
  ]) {
    assert.ok(found.some((one) => one.startsWith(surface)), `${surface} went unread:\n${found.slice(0, 5).join("\n")}`);
  }
  assert.ok(
    found.every((one) => one.includes("retired in 3.36.0") && one.includes("withholding-a-verb.md")),
    "a finding names the release that retired the name and where the rule reads",
  );
  assert.ok(found.some((one) => /^docs\/cli\/advance\.md is named for/u.test(one)), "a topic named for it goes too");
});

test("history and the one place the name is held are exempt", () => {
  const found = problems(files, [AS_IF]);
  assert.deepEqual(found.filter((one) => /^docs\/(?:issue-flow-dry-runs\.md|requirements\/)/u.test(one)), []);
  assert.ok(exempt("plugin/src/checks/retired-names.mjs"), "the registry holds the name once");
  assert.deepEqual(problems([{ rel: "plugin/src/checks/retired-names.mjs", text: "`forge advance`" }], [AS_IF]), []);
  assert.deepEqual(problems([{ rel: "docs/requirements/srs/fr-05-earned-transitions.md", text: "`forge advance`" }], [AS_IF]), []);
});

test("the word is a mention where the CLI uses it and not where English does", () => {
  const said = (text) => problems([{ rel: "one.md", text }], [AS_IF]);
  assert.deepEqual(said("the run had to advance the issue before the advanced gate ran\n"), []);
  assert.equal(said("read it, then run `forge advance ISS-45 --owed`\n").length, 1);
  assert.equal(said('  ["advance", "<uuid|ISS-45>", "the next status"],\n').length, 1);
  const flag = { name: "pushed", kind: "flag", release: "3.36.0" };
  assert.deepEqual(problems([{ rel: "two.md", text: "the branch was pushed at the claim\n" }], [flag]), []);
  assert.equal(problems([{ rel: "two.md", text: "run `forge claim ISS-45 --pushed`\n" }], [flag]).length, 1);
});

test("an entry holds a name, a kind and the release, and nothing pointing at a live one", () => {
  assert.match(registryProblems([{ ...AS_IF, instead: "route" }])[0], /carries instead/u);
  assert.match(registryProblems([{ name: "advance", kind: "verb" }])[0], /names no release/u);
  assert.match(registryProblems([{ name: "advance", kind: "shortcut", release: "3.36.0" }])[0], /verb, flag, tool/u);
  assert.match(registryProblems([{ kind: "verb", release: "3.36.0" }])[0], /not a name a pattern can match/u);
  assert.deepEqual(registryProblems([AS_IF]), []);
});

test("neither the verb table nor the dispatcher holds a retired name, and the two agree", () => {
  const dispatched = Object.keys(commands);
  assert.deepEqual(dispatched.filter((name) => !VERB_NAMES.includes(name)), [], "a verb runs unlisted");
  assert.deepEqual(VERB_NAMES.filter((name) => !dispatched.includes(name)), [], "a listed verb runs nowhere");
  const gone = RETIRED.map(({ name }) => name);
  assert.deepEqual(gone.filter((name) => VERB_NAMES.includes(name)), [], "a retired name is still listed");
  assert.deepEqual(gone.filter((name) => dispatched.includes(name)), [], "a retired name still runs");
});
