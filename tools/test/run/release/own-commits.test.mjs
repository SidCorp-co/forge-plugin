/* The ship leaves a release commit out of the change it names, and a commit that moved the version
   together with any other field of the manifest is not one: it is the change, and the line a mark
   takes its sha from names it (ISS-2520). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, lastStep, pushed } from "../run-fixtures.mjs";

const bumpWith = (work, extra, subject) => {
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ ...held, version: "1.0.1", ...extra }, null, 2));
  git(work, "add", "package.json");
  git(work, "commit", "-m", subject);
  return git(work, "rev-parse", "HEAD").stdout.trim();
};

test("a version commit that also moves a dependency is named as the change", () => {
  const { work } = pushed("own-commit-dependency");
  const change = bumpWith(work, { dependencies: { left: "1.2.4" } }, "chore(release): 1.0.1, and a dependency");
  const run = lastStep(work);
  assert.ok(run.stdout.includes(`the change landed as ${change.slice(0, 7)};`),
    `a dependency's move riding a version bump was left out of the change:\n${run.stdout}`);
});

test("a version commit that moves the version alone is still left out of the change", () => {
  const { work } = pushed("own-commit-version");
  bumpWith(work, {}, "chore(release): 1.0.1, the bump an earlier attempt left");
  const run = lastStep(work);
  assert.match(run.stdout, /this release landed nothing but the version commit/u, run.stdout);
});
