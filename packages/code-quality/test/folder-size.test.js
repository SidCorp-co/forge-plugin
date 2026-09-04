import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { findCrowdedDirectories } from "../src/folder-size.js";
import { tempRoom } from "./fixtures/room.js";

function makeTree() {
  return tempRoom("folder size ");
}

function fill(root, relative, count, extension = ".ts") {
  const directory = path.join(root, relative);
  mkdirSync(directory, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    writeFileSync(path.join(directory, `file${index}${extension}`), "export const ok = true;\n");
  }
  return directory;
}

test("reports a directory over the limit and leaves smaller ones alone", () => {
  const root = makeTree();
  const crowded = fill(root, "src/routes", 6);
  fill(root, "src/services", 3);

  const violations = findCrowdedDirectories({ roots: [root], max: 5 });
  assert.deepEqual(
    violations.map(({ directory, count }) => [directory, count]),
    [[crowded, 6]],
  );
});

test("counts only source files in the directory itself", () => {
  const root = makeTree();
  fill(root, "src", 4);
  fill(root, "src", 4, ".md");
  fill(root, "src/nested", 4);

  assert.deepEqual(findCrowdedDirectories({ roots: [root], max: 5 }), []);
  assert.equal(findCrowdedDirectories({ roots: [root], max: 3 }).length, 2);
});

test("skips build output, dependencies, and dot directories", () => {
  const root = makeTree();
  fill(root, "node_modules/pkg", 30);
  fill(root, "dist", 30);
  fill(root, ".next/static", 30);

  assert.deepEqual(findCrowdedDirectories({ roots: [root], max: 5 }), []);
});
