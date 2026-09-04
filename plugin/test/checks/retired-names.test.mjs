/* The registry is empty until the first replacement lands, and an empty one reads exactly like a
   clean tree: every case below runs a name through the real walk, so a walk that reaches neither the
   skills nor the topics fails here rather than the day a verb is retired. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { RETIRED, exempt, problems, registryProblems } from "../../src/checks/retired-names.mjs";
import { VERB_NAMES } from "../../src/resolve/visibility.mjs";
import { tempRoom } from "../fixtures.mjs";

/* The dispatcher's own registry is read, not described, and it reaches the live config directory on
   the way in: a run on the developer's credential is the one thing a check may not do. */
const ROOM = tempRoom("retired-names-");
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
/* What the CLI answers to now, so a retired name a live one happens to share is judged by kind. */
const LIVE = [...new Set([...VERB_NAMES, ...Object.keys(commands)])];

test("no surface under plugin/ or docs/ names something that was retired", () => {
  assert.ok(files.length > 150, `${files.length} file(s) walked; the selector matches too little`);
  const found = problems(files, RETIRED, LIVE);
  assert.deepEqual(found, [], `a retired name is still readable:\n${found.join("\n")}`);
  assert.deepEqual(registryProblems(), []);
  assert.ok(RETIRED.length > 0, "and the registry holds something, so the walk above judged a name");
});

/* The registry was built for this name and could not take it: `tool` matched the bare word, so the
   live verb and the English noun both became findings, and the last test below refused any entry
   sharing a live verb's name whatever kind it had (ISS-145). */
test("a retired directory is held, and only its path form is a mention", () => {
  const folder = RETIRED.find(({ kind }) => kind === "directory");
  assert.ok(folder, "the registry holds the folder `forge feedback` replaced");
  const said = (text) => problems([{ rel: "one.md", text }], [folder], LIVE);
  assert.equal(said("notes lived as files in the feedback/ of whatever checkout\n").length, 1,
    "the path form is the shape, and it is a finding");
  assert.match(said("the feedback/ folder\n")[0], /names the directory feedback, retired in /u);
  assert.deepEqual(said("file it with `forge feedback note.md --title T`\n"), [],
    "and the live verb it was replaced by is not");
  assert.deepEqual(said("we read every piece of feedback that arrives\n"), [],
    "nor the English word, which is why a directory is not a tool");
  assert.deepEqual(problems([{ rel: "docs/cli/feedback.md", text: "the `feedback/` of a checkout\n" }],
    [folder], LIVE), [], "and the document holding the argument for the removal records it");
  for (const into of ["feedback/ISS-111.md", "feedback/archive", "feedback/README"]) {
    assert.equal(said(`its note went to ${into} and the cleanup took it\n`).length, 1,
      `${into}: a path into the folder is the path form too, extension or none`);
  }
  assert.deepEqual(said("assert.match(run.stdout, /forge feedback/u, `no route`);\n"), [],
    "and a regex literal's closing delimiter is not: a refusal on one is unactionable");
  for (const elsewhere of ["docs/cli/feedback/x.md", "the route is /api/feedback/ here",
    "see https://host/feedback/ for more", "read `docs/./feedback/x.md`"]) {
    assert.deepEqual(said(`${elsewhere}\n`), [],
      `${elsewhere}: the folder sat at a checkout's root, so a nested segment is not it`);
  }
  /* The root said out loud is the same claim as the root left implicit, and it is the form a
     command takes: `./feedback/` reads as a nested segment to a guard that only counts slashes. */
  for (const rooted of ["write it into ./feedback/ instead", "the note went to ./feedback/ISS-111.md",
    "../feedback/ from a subdirectory", "../../feedback/ from two levels down",
    "../../../feedback/ISS-111.md"]) {
    assert.equal(said(`${rooted}\n`).length, 1, `${rooted}: an explicit root marker names the folder`);
  }
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

test("a file named for a retired thing goes only where the name is not also a live one", () => {
  const folder = { name: "feedback", kind: "directory", release: "3.35.45" };
  assert.deepEqual(problems([{ rel: "docs/cli/topic.md", text: "nothing\n" }], [folder], LIVE), [],
    "a file not named for it is no finding either way");
  assert.deepEqual(problems([{ rel: "docs/other/feedback.md", text: "nothing\n" }], [folder], LIVE), [],
    "a file named for it stays where a live verb answers to the same word");
  const gone = { name: "sweep", kind: "directory", release: "3.36.0" };
  assert.match(problems([{ rel: "docs/other/sweep.md", text: "nothing\n" }], [gone], LIVE)[0],
    /^docs\/other\/sweep\.md is named for the directory sweep/u,
    "and one named for a word nothing live answers to still leaves");
  /* `live` is the verb surface, so only a directory can share a word with a live verb by design.
     The other three kinds keep the rule they had, or this issue changes them behind its own back. */
  const tool = { name: "feedback", kind: "tool", release: "3.35.45" };
  assert.match(problems([{ rel: "docs/other/feedback.md", text: "nothing\n" }], [tool], LIVE)[0],
    /^docs\/other\/feedback\.md is named for the tool feedback/u,
    "a retired tool sharing a live verb's name still loses the file named for it");
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
  assert.match(registryProblems([{ name: "advance", kind: "shortcut", release: "3.36.0" }])[0],
    /verb, flag, tool, directory/u);
  assert.deepEqual(registryProblems([{ name: "feedback", kind: "directory", release: "3.35.45" }]), [],
    "and a directory's name stays bare, the path form being the shape and not the name");
  assert.match(registryProblems([{ kind: "verb", release: "3.36.0" }])[0], /not a name a pattern can match/u);
  assert.deepEqual(registryProblems([AS_IF]), []);
});

test("neither the verb table nor the dispatcher holds a retired name, and the two agree", () => {
  const dispatched = Object.keys(commands);
  assert.deepEqual(dispatched.filter((name) => !VERB_NAMES.includes(name)), [], "a verb runs unlisted");
  assert.deepEqual(VERB_NAMES.filter((name) => !dispatched.includes(name)), [], "a listed verb runs nowhere");
  /* By kind and not by name: a retired directory may share a word with a live verb, and held
     against the verb table by name alone no entry named `feedback` could ever be registered. */
  const gone = RETIRED.filter(({ kind }) => kind === "verb").map(({ name }) => name);
  assert.deepEqual(gone.filter((name) => VERB_NAMES.includes(name)), [], "a retired verb is still listed");
  assert.deepEqual(gone.filter((name) => dispatched.includes(name)), [], "a retired verb still runs");
  const folders = RETIRED.filter(({ kind }) => kind === "directory").map(({ name }) => name);
  assert.deepEqual(folders.filter((name) => !RETIRED.some(({ name: one, kind }) => one === name && kind === "directory")), []);
  assert.ok(folders.includes("feedback"), "and the folder is held while the verb of that name runs");
  assert.ok(dispatched.includes("feedback"), "which is the pair the registry could not hold before");
});
