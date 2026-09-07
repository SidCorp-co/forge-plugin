/* An --evidence value that was a file on disk cost `forge attach` and a re-send of the same record,
   twenty times over one verdict loop (the twelfth dry run). Each rule here fails without its check. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { attachPlan, localFile, uploadRefusal, uploaded, urlBearing } from "../../src/tracker/evidence.mjs";
import { tempRoom } from "../fixtures.mjs";

const DIR = tempRoom("evidence-");
const FILE = join(DIR, "iss65-evidence.md");
writeFileSync(FILE, "# evidence\n");
mkdirSync(join(DIR, "a-directory"));
const held = (names) => (ref) => /^https?:\/\//u.test(ref) || /^[0-9a-f]{7,40}$/iu.test(ref) || names.includes(ref);

test("a path is evidence when it is a readable file, and a directory is not", () => {
  assert.deepEqual(localFile(FILE), { path: FILE, name: "iss65-evidence.md" });
  assert.equal(localFile(join(DIR, "a-directory")), null, "a directory is no document");
  assert.equal(localFile(join(DIR, "nothing-here.md")), null);
  assert.equal(localFile(""), null);
  assert.equal(localFile(undefined), null);
});

test("a file on disk is put up under its base name and cited by it", () => {
  const plan = attachPlan([FILE], [], held([]));
  assert.deepEqual(plan.upload, [{ path: FILE, name: "iss65-evidence.md" }]);
  assert.deepEqual(plan.cite, ["iss65-evidence.md"], "and the record cites the name, never the path");
  assert.equal(plan.refusal, null);
});

/* A name attached twice resolves to two documents and every verdict citing it is ambiguous (ISS-55),
   so the collision is refused with the two ways out rather than uploaded. */
test("a path whose name is already attached is refused, and the refusal names it", () => {
  const plan = attachPlan([FILE], ["iss65-evidence.md"], held(["iss65-evidence.md"]));
  assert.deepEqual(plan.upload, [], "nothing goes up before the whole plan is read");
  assert.match(plan.refusal, /already on this issue/u);
  assert.match(plan.refusal, /--evidence iss65-evidence\.md/u, "the one command that cites what is there");
});

test("a name, a URL and a commit are cited as they stand, and nothing is uploaded", () => {
  const names = ["a-screenshot.png"];
  const refs = ["a-screenshot.png", "https://example.test/run/1", "4e41dfd"];
  const plan = attachPlan(refs, names, held(names));
  assert.deepEqual(plan.upload, []);
  assert.deepEqual(plan.cite, refs);
});

/* Two paths whose base names are one name is the same ambiguity as a name already attached, and the
   plan is read whole before anything goes up, so the second is seen. */
test("two files with one base name in the same command is the collision too", () => {
  const other = join(DIR, "a-directory", "iss65-evidence.md");
  writeFileSync(other, "# another\n");
  const plan = attachPlan([FILE, other], [], held([]));
  assert.deepEqual(plan.upload, [], "nothing goes up when the plan cannot be read whole");
  assert.match(plan.refusal, /named `?twice in this command/u);
});

/* The one case where a citation and a file are the same string: refusing it would name the citation
   the author already made, and the default off the record cites exactly this (F2 of the recheck). */
test("a citation that is also a file here is cited and said, not refused", () => {
  const said = [];
  const stderr = console.error;
  console.error = (line) => said.push(line);
  let plan = null;
  try {
    plan = attachPlan([FILE], [FILE], () => true);
  } finally {
    console.error = stderr;
  }
  assert.deepEqual(plan.upload, [], "what is up is not sent again");
  assert.deepEqual(plan.cite, [FILE]);
  assert.equal(plan.refusal, null, "a refusal here has no route to name");
  assert.match(said.join("\n"), /is on this issue and is also a file here/u, "and the ambiguity is said");
});

/* A document called `deadbee` is seven hex digits too, and a verdict citing it as a commit points
   at nothing: the file wins, and the line says the other reading was there (F2 of the final review). */
test("a readable file whose name reads as a commit goes up as a file, and says so", () => {
  writeFileSync(join(DIR, "deadbee"), "a document, not a sha\n");
  const cwd = process.cwd();
  const said = [];
  const stderr = console.error;
  console.error = (line) => said.push(line);
  let plan = null;
  try {
    process.chdir(DIR);
    plan = attachPlan(["deadbee"], [], held([]));
  } finally {
    process.chdir(cwd);
    console.error = stderr;
  }
  assert.equal(plan.upload.length, 1, "the file goes up");
  assert.match(plan.upload[0].path, /deadbee$/u);
  assert.deepEqual(plan.cite, ["deadbee"]);
  assert.match(said.join("\n"), /readable file here and goes up as one/u);
  const nowhere = attachPlan(["deadbee"], [], held([]));
  assert.deepEqual(nowhere.upload, [], "and the same value with no file behind it is cited as the commit");
  assert.deepEqual(nowhere.cite, ["deadbee"]);
});

/* The tracker's own line says which mime it guessed and nothing about the file, the extension or
   the set, so four runs in one week renamed a `.log` to `.txt` by guessing (ISS-134). */
test("a refusal on the name says which file, what it read off it, and what the tracker takes", () => {
  const said = uploadRefusal(join(DIR, "iss134-gate-final.log"), "Error: MIME_NOT_ALLOWED: mime not allowed: application/octet-stream");
  assert.match(said, /^iss134-gate-final\.log is a name the tracker would not take/u);
  assert.match(said, /the extension \.log/u);
  assert.match(said, /This CLI types \.png \.jpg [.\w ]*\.xlsx —/u);
  assert.match(said, /its reading of the tracker's set rather than the tracker's own answer/u);
  assert.match(said, /MIME_NOT_ALLOWED/u, "the tracker's own words stay in it");
  const log = join(DIR, "iss134-gate-final.log");
  assert.match(said, new RegExp(`ln -- '${log}' '${log}\\.txt'$`, "u"), "the same name plus .txt collides with nothing");
});

/* The mint bought the tracker's verdict before any byte went, and one request cannot: what the
   refusal owes instead is the names already up, there being no delete for an upload (ISS-614). */
test("a refusal mid-write names what is already up, and how to cite it", () => {
  const said = uploadRefusal(join(DIR, "iss134-gate-final.log"),
    "MIME_NOT_ALLOWED: mime not allowed: application/octet-stream", ["first.txt", "second.txt"]);
  assert.match(said, /2 file\(s\) of this write are up and cannot be deleted: first\.txt, second\.txt\./u);
  assert.match(said, /Cite those by name rather than by path/u);
  assert.match(said, /--evidence first\.txt --evidence second\.txt/u);
  const alone = uploadRefusal(join(DIR, "iss134-gate-final.log"), "Forge answered 401: token expired");
  assert.match(alone, /It was the first of the write, so nothing else went up\./u,
    "and where it was the first, that it was: an empty list reads as an unanswered question");
});

test("a name carrying no extension is told that, and a name a shell would read is quoted", () => {
  const bare = uploadRefusal("/tmp/gate-run", "Error: MIME_NOT_ALLOWED: mime not allowed: application/octet-stream");
  assert.match(bare, /a name carrying no extension\./u);
  assert.match(bare, /ln -- '\/tmp\/gate-run' '\/tmp\/gate-run\.txt'$/u);
  const hostile = uploadRefusal("/tmp/$(touch PWNED) it's.log", "Error: MIME_NOT_ALLOWED: mime not allowed: x");
  assert.match(hostile, /ln -- '\/tmp\/\$\(touch PWNED\) it'\\''s\.log' '\/tmp\/\$\(touch PWNED\) it'\\''s\.log\.txt'$/u);
});

/* A 401 or a credential refusal is no fact about the name, so the set is not offered against it:
   naming what the tracker takes would read as the answer to a question it never asked. */
test("a refusal that is not about the name names the file and offers no set", () => {
  const said = uploadRefusal(join(DIR, "iss134-gate-final.log"), "Forge answered 401: token expired");
  assert.match(said, /^iss134-gate-final\.log is a name the tracker would not take/u);
  assert.match(said, /token expired/u);
  assert.doesNotMatch(said, /This CLI types/u, "no extension is named where the name is not what refused");
  assert.doesNotMatch(said, /\.txt/u);
});

/* The one action a refusal prints is only an action if running it does what it says, so it is run:
   a name a shell would read, a name `ln` would read as a flag, and a destination already there. */
const ranTail = (path, cwd) => {
  const said = uploadRefusal(path, "Error: MIME_NOT_ALLOWED: mime not allowed: application/octet-stream");
  return spawnSync("sh", ["-c", said.split("\n").pop().trim()], { cwd, encoding: "utf8" });
};

test("the command the refusal prints runs, and refuses a destination rather than overwriting it", () => {
  const room = tempRoom("mint-command-");
  writeFileSync(join(room, "$(touch PWNED) it's.log"), "gate output\n");
  assert.equal(ranTail("$(touch PWNED) it's.log", room).status, 0, "a name a shell would read is one path");
  assert.equal(readFileSync(join(room, "$(touch PWNED) it's.log.txt"), "utf8"), "gate output\n");
  assert.equal(existsSync(join(room, "PWNED")), false, "and nothing in it ran");
  writeFileSync(join(room, "-f.log"), "flag-shaped\n");
  assert.equal(ranTail("-f.log", room).status, 0, "a leading hyphen is an operand");
  assert.equal(readFileSync(join(room, "-f.log.txt"), "utf8"), "flag-shaped\n");
  writeFileSync(join(room, "held.log"), "new\n");
  writeFileSync(join(room, "held.log.txt"), "already here\n");
  assert.notEqual(ranTail("held.log", room).status, 0, "a destination already there is refused");
  assert.equal(readFileSync(join(room, "held.log.txt"), "utf8"), "already here\n", "and its bytes stand");
});

test("the upload answer is read for its url, and an unexpected body is printed whole", () => {
  assert.equal(uploaded(JSON.stringify({ id: "x", name: "n", url: "https://example.test/n" })), "https://example.test/n");
  assert.equal(uploaded("not json at all"), "not json at all");
  assert.equal(urlBearing({ url: "https://example.test/n" }), true);
  assert.equal(urlBearing({ url: 12 }), false);
});
