/* The requirements tree's record is a file a landing reads as generated only because this repository
   declares its one writer as a `generate:` script (ISS-1421): the declaration has to be that writer,
   and running it over this tree's clauses has to move nothing, or every landing across a spec edit
   reads the record as a hand's work again. Run over a copy, so a stale record fails here rather than
   being rewritten in the tree the gate is judging. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./run-fixtures.mjs";
import { tempRoom } from "../../../plugin/test/fixtures.mjs";

const { GENERATE } = await import("../../run/generated.mjs");

const RECORD = join("docs", "requirements", "digests.json");
const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const WRITER = scripts[`${GENERATE}spec`];

test("the spec record's one writer is declared as a generate: script", () => {
  assert.equal(WRITER, "node plugin/src/cli.mjs spec check --record",
    `package.json declares ${GENERATE}spec as ${WRITER}, which is not the record's writer`);
});

test("that script run over this tree's clauses moves nothing", () => {
  const room = tempRoom("generate-spec-");
  cpSync(join(ROOT, "docs", "requirements"), join(room, "docs", "requirements"), { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: room, encoding: "utf8" });
  const [, cli, ...argv] = WRITER.split(" ");
  const run = spawnSync(process.execPath, [join(ROOT, cli), ...argv], { cwd: room, encoding: "utf8" });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /clause\(s\), 0 moved\./u, run.stdout);
  assert.equal(readFileSync(join(room, RECORD), "utf8"), readFileSync(join(ROOT, RECORD), "utf8"), run.stdout);
});
