/* A run the brief binds to a tree is handed a scratch directory with its id, recorded beside it, so
   whatever outlives the run can say whose that directory is (ISS-2524). */
import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { escaped, tempRoom } from "../fixtures.mjs";
import { RUN, brief, homeFor, repository } from "./fixture.mjs";
import { besideGit, runIdAt, scratchAt } from "../../src/resolve/session/run-id.mjs";

const recordOf = (tree) => {
  const at = besideGit(tree, "forge-run-scratch");
  return existsSync(at) ? readFileSync(at, "utf8") : null;
};

/** A home of the case's own, with a temporary root of its own the minted directory lands under. */
const rooted = () => {
  const home = homeFor();
  const temp = tempRoom("brief-temp-");
  return { temp, env: { ...home.env, TMPDIR: temp } };
};

test("a tree the brief mints an id for is given that id's scratch directory, made, recorded and printed", () => {
  const fresh = repository();
  const { temp, env } = rooted();
  const run = brief(["ISS-7", "--tree", fresh.idle], fresh.main, env);
  assert.equal(run.status, 0, run.stderr);
  const want = join(temp, `forge-run-${runIdAt(fresh.idle)}`);
  assert.equal(recordOf(fresh.idle), `${want}\n`, "the record names the id's directory under the brief's temporary root");
  assert.equal(scratchAt(fresh.idle), want, "and is the record a run's doctor reads");
  assert.ok(existsSync(want), `${want} was recorded and not made`);
  assert.match(run.stdout, new RegExp(`^TMPDIR=${escaped(want)}$`, "mu"), "and the brief hands the run that directory");
});

test("a tree holding an id and no scratch is given the scratch of that id, its id record left as it was", () => {
  const fresh = repository();
  const { temp, env } = rooted();
  writeFileSync(besideGit(fresh.idle, "forge-run-id"), "iss-7+8-0123abcd\n");
  const run = brief(["ISS-8", "--tree", fresh.idle], fresh.main, env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readFileSync(besideGit(fresh.idle, "forge-run-id"), "utf8"), "iss-7+8-0123abcd\n");
  const want = join(temp, "forge-run-iss-7+8-0123abcd");
  assert.equal(recordOf(fresh.idle), `${want}\n`);
  assert.ok(existsSync(want));
});

test("a record already naming the id's directory is kept byte for byte, and a second brief makes nothing", () => {
  const fresh = repository();
  const first = brief(["ISS-7", "--tree", fresh.idle], fresh.main, rooted().env);
  assert.equal(first.status, 0, first.stderr);
  const kept = recordOf(fresh.idle);
  const elsewhere = rooted();
  const second = brief(["ISS-7", "--tree", fresh.idle], fresh.main, elsewhere.env);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(recordOf(fresh.idle), kept, "a brief under another temporary root moved the record");
  assert.ok(!existsSync(join(elsewhere.temp, `forge-run-${runIdAt(fresh.idle)}`)), "and made a second directory");
  const mine = recordOf(fresh.mine);
  assert.equal(brief(["ISS-7", "--tree", fresh.mine], fresh.main, rooted().env).status, 0);
  assert.equal(recordOf(fresh.mine), mine, "a started run's record stands as it was");
});

test("a record naming a directory not minted for the tree's id is replaced by one that is", () => {
  const fresh = repository();
  const { temp, env } = rooted();
  writeFileSync(besideGit(fresh.idle, "forge-run-id"), `${RUN}\n`);
  writeFileSync(besideGit(fresh.idle, "forge-run-scratch"), "/somewhere/forge-run-iss-9-deadbeef\n");
  const run = brief(["ISS-7", "--tree", fresh.idle], fresh.main, env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(recordOf(fresh.idle), `${join(temp, `forge-run-${RUN}`)}\n`);
});

test("a brief refused before it binds writes no scratch record", () => {
  const fresh = repository();
  const foreign = brief(["ABC-3", "--tree", fresh.idle], fresh.main, rooted().env);
  assert.notEqual(foreign.status, 0);
  assert.equal(recordOf(fresh.idle), null, "a key the id cannot carry");
  writeFileSync(besideGit(fresh.idle, "forge-run-id"), `${RUN}\n`);
  const other = brief(["ISS-8", "--tree", fresh.idle], fresh.main, rooted().env);
  assert.notEqual(other.status, 0);
  assert.equal(recordOf(fresh.idle), null, "an id that does not name the key");
});

test("a scratch directory that cannot be made refuses the brief, names it, and records nothing", () => {
  const fresh = repository();
  const blocked = join(tempRoom("brief-blocked-"), "a-file");
  writeFileSync(blocked, "");
  const run = brief(["ISS-7", "--tree", fresh.idle], fresh.main, { ...homeFor().env, TMPDIR: blocked });
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout, "", "no brief is printed");
  assert.match(run.stderr, new RegExp(`the scratch directory ${escaped(join(blocked, `forge-run-${runIdAt(fresh.idle)}`))} could not be made`, "u"));
  assert.equal(recordOf(fresh.idle), null);
});

test("a record that cannot be written refuses the brief and takes the directory it was for with it", (t) => {
  const fresh = repository();
  const { temp, env } = rooted();
  writeFileSync(besideGit(fresh.idle, "forge-run-id"), `${RUN}\n`);
  const gitDir = join(besideGit(fresh.idle, "forge-run-id"), "..");
  chmodSync(gitDir, 0o555);
  t.after(() => chmodSync(gitDir, 0o755));
  const run = brief(["ISS-7", "--tree", fresh.idle], fresh.main, env);
  chmodSync(gitDir, 0o755);
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout, "");
  assert.equal(recordOf(fresh.idle), null, "no record, partial or whole");
  assert.ok(!existsSync(join(temp, `forge-run-${RUN}`)), "and no directory it was made for");
});
