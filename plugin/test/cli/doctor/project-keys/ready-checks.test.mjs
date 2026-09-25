/* `ready.checks`, the checks a project spends before a run arms a landing: written through the one
   verb every project key is, as a list, and a value that is not a list of commands refused by the
   same reading the capture reports it with (ISS-2515). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { projectEntry, projectRoom, tempRoom } from "../../../fixtures.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

const envOf = (home) => ({ PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home });

const room = () => {
  const home = tempRoom("doctor-ready-checks-");
  const cwd = projectRoom(tempRoom("doctor-ready-checks-cwd-"), home, { slug: "demo" });
  const set = (value) => spawnSync(process.execPath, [CLI, "doctor", "--set", `ready.checks=${value}`],
    { encoding: "utf8", cwd, env: envOf(home) });
  return { set, file: () => JSON.parse(readFileSync(projectEntry(cwd, home), "utf8")) };
};

test("--set writes the checks into the project's record as a list, in the order typed", () => {
  const { set, file } = room();
  const wrote = set("npm run lint:code-quality,npm run check:dup");
  assert.equal(wrote.status, 0, wrote.stderr);
  assert.deepEqual(file().ready, { checks: ["npm run lint:code-quality", "npm run check:dup"] });
});

test("a list holding no command is refused, naming what the key takes, and nothing is written", () => {
  const { set, file } = room();
  const refused = set(",");
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.match(refused.stderr + refused.stdout,
    /`ready\.checks` in \S+ is a list of one or more commands, none of them blank, not `\[\]`/u);
  assert.equal(file().ready, undefined, "the refused write left the file as it was");
});
