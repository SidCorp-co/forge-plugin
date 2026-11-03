/* defaultRef picks the base a brief diffs its sibling trees against. origin's global default
   (refs/remotes/origin/HEAD) can point at a non-base branch, so the checkout's own upstream is
   preferred where it has one (ISS-33). */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { git, tempRoom } from "../fixtures.mjs";
import { defaultRef } from "../../src/brief/trees.mjs";

/** A repo whose origin default is `main` and that also has a pushed `dev` branch. */
const repoWithDev = () => {
  const room = tempRoom("trees-");
  const origin = join(room, "origin.git");
  const main = join(room, "main");
  git(room, "init", "-q", "--bare", "-b", "main", origin);
  git(room, "init", "-q", "-b", "main", main);
  writeFileSync(join(main, "base.txt"), "base\n");
  git(main, "add", "base.txt");
  git(main, "commit", "-qm", "base");
  git(main, "remote", "add", "origin", origin);
  git(main, "push", "-q", "origin", "main");
  git(main, "remote", "set-head", "origin", "main");
  git(main, "checkout", "-q", "-b", "dev");
  writeFileSync(join(main, "dev.txt"), "dev\n");
  git(main, "add", "dev.txt");
  git(main, "commit", "-qm", "dev");
  git(main, "push", "-q", "-u", "origin", "dev");
  return main;
};

test("the checkout's upstream is the base, not origin's default, where they differ (ISS-33)", () => {
  const main = repoWithDev();
  assert.equal(defaultRef(main), "origin/dev");
});

test("origin's default is the base where the branch has no upstream", () => {
  const main = repoWithDev();
  git(main, "checkout", "-q", "-b", "local-only");
  assert.equal(defaultRef(main), "origin/main");
});

test("outside any checkout it reads nothing", () => {
  assert.equal(defaultRef(tempRoom("trees-nowhere-")), null);
});
