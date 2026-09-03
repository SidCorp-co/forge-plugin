/* The check shipped for months and `npm run check` never called it, so four directories in this
   tree had never been held to it. A step nothing proves is a step that can be dropped again. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const GATE = join(ROOT, "packages", "code-quality", "bin", "code-quality-gate.mjs");
const LIMIT = 10;

/* Its own tree, because the finding is about a directory and this repository's directories pass. */
const overWide = () => {
  const room = mkdtempSync(join(tmpdir(), "folder-width-"));
  mkdirSync(join(room, "wide"));
  for (let index = 0; index <= LIMIT; index += 1) {
    writeFileSync(join(room, "wide", `m${index}.mjs`), `export const n${index} = ${index};\n`);
  }
  writeFileSync(join(room, "eslint.config.mjs"), "export default [{}];\n");
  return room;
};

const gate = (room, ...argv) =>
  spawnSync(process.execPath, [GATE, ...argv, "."], { cwd: room, encoding: "utf8" });

test("a directory over the limit fails the gate, and names the count and the move", () => {
  const room = overWide();
  try {
    const run = gate(room);
    const said = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 1, said);
    assert.match(said, /Directories over the file limit/u);
    assert.match(said, new RegExp(`wide\\s+move 1 out: ${LIMIT + 1} source files, limit ${LIMIT}`, "u"));
    assert.match(said, /Split by responsibility, never alphabetically/u, "the directive is the remedy");
    assert.match(said, /no eslint-disable, no raised limit, no exemption entry/u);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

/* Switched off it passes the same tree, so the refusal above came from the width check and not from
   the ESLint half beside it. */
test("the same tree passes with the width check off", () => {
  const room = overWide();
  try {
    assert.equal(gate(room, "--no-folder-check").status, 0);
  } finally {
    rmSync(room, { recursive: true, force: true });
  }
});

/* The step, not the check: a gate that fails only when someone runs it by hand is not a gate. */
test("the check script runs the width gate as a step of its own", () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.match(scripts["lint:code-quality"], /\bcode-quality-gate\b/u);
  assert.match(
    scripts.check,
    /\bnpm run lint:code-quality\b/u,
    "npm run check has to name the width step, or the tree is held to it only by hand",
  );
});
