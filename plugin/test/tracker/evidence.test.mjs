/* An --evidence value that was a file on disk cost `forge attach` and a re-send of the same record,
   twenty times over one verdict loop (the twelfth dry run). Each rule here fails without its check. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attachPlan, localFile, uploaded, urlBearing } from "../../src/tracker/evidence.mjs";

const DIR = mkdtempSync(join(tmpdir(), "evidence-"));
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

test("the upload answer is read for its url, and an unexpected body is printed whole", () => {
  assert.equal(uploaded(JSON.stringify({ id: "x", name: "n", url: "https://example.test/n" })), "https://example.test/n");
  assert.equal(uploaded("not json at all"), "not json at all");
  assert.equal(urlBearing({ url: "https://example.test/n" }), true);
  assert.equal(urlBearing({ url: 12 }), false);
});
