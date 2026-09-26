/* A change that writes a generated file, landed across another change that wrote the same file: what
   the base moved there is what the merged head's own `generate:` scripts write back, so the chain
   carries the change and the mark lets its verdicts stand. A hand edit in that file, a generator that
   fails, and a source path moved beside it each still hand the branch back (ISS-1421). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  BASE, BRANCH, KEY, OWNED, context, forgetInstall, git, landingRan, marks, ready, seeded, sha, tracker,
  world,
} from "../fixture.mjs";

const { landingOf } = await import("../../../../../plugin/src/flow/landing/checkpoint.mjs");
const { regenerated } = await import("../../../../run/rooms/generated.mjs");

test.after(() => tracker.close());

const PAGES = join("docs", "pages");
const LIST = join("docs", "pages.txt");
const GEN = join("tools", "gen.mjs");
const GENERATOR = `import { readdirSync, writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(LIST)}, readdirSync(${JSON.stringify(PAGES)}).sort().map((one) => one + "\\n").join(""));
`;

const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);
const landing = () => landingOf(context());

const put = (room, path, text) => {
  mkdirSync(join(room, dirname(path)), { recursive: true });
  writeFileSync(join(room, path), text);
};

/* The generated list and a page beside it, generated with the generator every side runs. */
const page = (room, name) => {
  put(room, join(PAGES, name), `the page ${name}\n`);
  spawnSync(process.execPath, [GEN], { cwd: room, encoding: "utf8" });
  git(room, "add", PAGES, LIST);
};

/** The base declares the generator and holds four pages with room between them, and the change on the
 *  branch adds one of its own: the list is a file both sides then write and neither writes by hand. */
const generating = () => {
  const { at, work } = world();
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  put(work, "package.json", JSON.stringify({ ...held, scripts: { ...held.scripts, "generate:pages": `node ${GEN}` } }, null, 2));
  put(work, GEN, GENERATOR);
  for (const name of ["a.md", "k.md", "m.md", "n.md"]) page(work, name);
  git(work, "add", "package.json", GEN);
  git(work, "commit", "-qm", "the base declares a generator");
  git(work, "push", "-q", "origin", `HEAD:${BASE}`);
  const base = sha(work, BASE);
  git(work, "checkout", "-q", BRANCH);
  git(work, "rebase", "-q", BASE);
  page(work, "b.md");
  git(work, "commit", "-qm", "the change adds a page");
  git(work, "push", "-q", "-f", "origin", BRANCH);
  git(work, "checkout", "-q", BASE);
  return { at, work, base, head: sha(work, BRANCH) };
};

/** Another clone's landing that adds a page too, and whatever `also` does to that clone beside it. */
const serverAdds = (at, name, also = () => {}) => {
  const clone = join(at, `clone-${name}`);
  spawnSync("git", ["clone", "-q", join(at, "origin.git"), clone], { cwd: at, encoding: "utf8" });
  page(clone, name);
  also(clone);
  git(clone, "commit", "-qm", `another clone adds ${name}`);
  git(clone, "push", "-q", "origin", `HEAD:${BASE}`);
  return sha(clone, "HEAD");
};

const landed = async (also) => {
  const { at, work, base, head } = generating();
  seeded({ landing: ready(head, base, { files: [OWNED, join(PAGES, "b.md"), LIST] }) });
  forgetInstall();
  const theirs = serverAdds(at, "z.md", also);
  const said = await landingRan([KEY], work);
  return { at, work, head, theirs, said, held: landing() };
};

test("a base that moved the change's generated file as its generator writes it lands the change", async () => {
  const { at, work, head, theirs, said, held } = await landed();
  assert.notEqual(held.state, "builder-owed", `the generator's own output is no move of the change:\n${said}`);
  assert.equal(held.moved, undefined, `and nothing was recorded as moved:\n${said}`);
  const now = remote(at);
  assert.notEqual(now, theirs, `the change landed:\n${said}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", head, now).status, 0, `carrying the judged head:\n${said}`);
  assert.equal(git(work, "show", `${now}:${LIST}`).stdout, "a.md\nb.md\nk.md\nm.md\nn.md\nz.md\n", said);
});

test("the landing names the path it took as generated and the scripts it ran", async () => {
  const { head, said } = await landed();
  const told = said.split("\n").find((line) => line.includes(`${LIST} moved since ${head.slice(0, 7)}`));
  assert.ok(told, `the path taken as generated is named:\n${said}`);
  assert.ok(told.includes("generate:pages run at "), `with the script that was run:\n${said}`);
  assert.ok(told.includes("wrote it back byte for byte"), said);
});

test("the mark over a generated-only move says the landing moved nothing", async () => {
  const { head, said } = await landed();
  assert.equal(marks().length, 1, `one mark:\n${said}`);
  const note = marks()[0].body;
  assert.match(note, /landing moved nothing;/u, note);
  assert.ok(note.includes(`judged head ${head}`), note);
});

test("a base that hand-edited the generated file hands the branch back naming it", async () => {
  const { at, theirs, said, held } = await landed((clone) => {
    appendFileSync(join(clone, LIST), "by-hand.md\n");
    git(clone, "add", LIST);
  });
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, LIST, said);
  assert.ok(said.includes(`the landing moved ${LIST}, so this change's own paths are not what was judged`), said);
  assert.match(said, /did not write docs\/pages\.txt back byte for byte/u, `and why the generator did not clear it:\n${said}`);
  assert.equal(remote(at), theirs, `nothing was pushed:\n${said}`);
});

test("a generator that fails at the merged head leaves the file it writes a move", async () => {
  const { at, theirs, said, held } = await landed((clone) => {
    appendFileSync(join(clone, GEN), "process.exit(3);\n");
    git(clone, "add", GEN);
  });
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, LIST, said);
  assert.match(said, /generate:pages exited 3, so nothing it writes is taken as generated/u, said);
  assert.equal(remote(at), theirs, `nothing was pushed:\n${said}`);
});

test("a base that moved a source path beside the generated one hands the branch back naming the source", async () => {
  const { at, theirs, said, held } = await landed((clone) => {
    const text = readFileSync(join(clone, OWNED), "utf8");
    writeFileSync(join(clone, OWNED), text.replace("line 9\n", "line 9, as the base moved it\n"));
    git(clone, "add", OWNED);
  });
  assert.equal(held.state, "builder-owed", said);
  assert.equal(held.moved, OWNED, `the source path alone is the move:\n${said}`);
  assert.ok(said.includes(`the landing moved ${OWNED}, so this change's own paths are not what was judged`), said);
  assert.equal(remote(at), theirs, `nothing was pushed:\n${said}`);
});

/* A path the merged head does not hold reads as unmoved once removed, whatever the generators did: a
   deletion is no file a generator wrote back, so it stays a move beside one that is cleared. */
test("a path the merged head lacks is not taken as generated beside one its generator writes back", () => {
  const { work, head } = generating();
  const gone = join("plugin", "src", "gone.mjs");
  const found = regenerated(work, head, [LIST, gone]);
  assert.deepEqual(found.generated, [LIST], JSON.stringify(found));
  assert.deepEqual(found.scripts, ["generate:pages"], JSON.stringify(found));
  assert.match(found.why, /did not write plugin\/src\/gone\.mjs back byte for byte/u, found.why);
});

/* The same absence behind an ignore rule, which status does not list even once a generator writes the
   file: whether the merged head holds a path is asked of the head, not read off what status leaves out. */
test("an ignored path the merged head lacks is not taken as generated when a generator writes it", () => {
  const { work } = generating();
  const made = join("docs", "made.txt");
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  put(work, ".gitignore", `${made}\n`);
  put(work, join("tools", "made.mjs"), `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(made)}, "made\\n");\n`);
  put(work, "package.json", JSON.stringify({ ...held, scripts: { ...held.scripts, "generate:made": "node tools/made.mjs" } }, null, 2));
  git(work, "add", ".gitignore", "package.json", join("tools", "made.mjs"));
  git(work, "commit", "-qm", "a generator of an ignored file");
  const found = regenerated(work, sha(work, "HEAD"), [LIST, made]);
  assert.deepEqual(found.generated, [LIST], JSON.stringify(found));
  assert.match(found.why, /did not write docs\/made\.txt back byte for byte/u, found.why);
});
