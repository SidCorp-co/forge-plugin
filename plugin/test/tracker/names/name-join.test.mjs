import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, test } from "node:test";

import { CHOSEN, SUBJECTS, WITHHELD, joined, nameJoinRows, recording, striking } from "../../../src/tracker/name-join.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(here, "..", "..", "..", "src", "tracker", "name-join.mjs");
const CAPTURE = join(here, "..", "..", "fixtures", "rest", "projects-get.json");

const capture = JSON.parse(readFileSync(CAPTURE, "utf8"));
const ROW = capture.rest.project;
const without = (name) => {
  const held = { ...ROW };
  delete held[name];
  return held;
};

const lines = async (row, day = "2026-09-20") =>
  (await nameJoinRows(async () => ({ parts: { page: row } }), day)).map((one) => one.detail);

describe("the two directions of the name join", () => {
  it("a name the shaper asks the row for and the row never carried is the first direction", () => {
    const held = joined("forge_projects.get", without("releaseModel"));
    assert.deepEqual(held.unserved, ["releaseModel"],
      "a column the tracker retired reads undefined on every project and says nothing");
    assert.equal(held.read.includes("releaseModel"), false);
    assert.deepEqual(joined("forge_projects.get", ROW).unserved, [],
      "and the row as the tracker serves it carries every name this shaper asks for");
  });

  it("a served name the shaper never asks for and nothing declares is the second direction", () => {
    const grown = { ...ROW, retryBudget: 3 };
    assert.deepEqual(joined("forge_projects.get", grown).undeclared, ["retryBudget"]);
    assert.deepEqual(joined("forge_config.get", grown).undeclared, ["retryBudget"]);
    assert.deepEqual(joined("forge_projects.get", ROW).undeclared, [],
      "and every drop on the row as it stands is declared with its reason");
  });

  it("an equal value arriving from inside another column hides neither of them", () => {
    const held = joined("forge_config.get", { ...ROW, repoPath: "same", agentConfig: { repoPath: "same" } });
    for (const name of ["repoPath", "agentConfig"]) {
      assert.ok(held.read.includes(name), `${name} was scored unread because its value did not move`);
      assert.equal(held.undeclared.includes(name), false, name);
      assert.equal(held.unserved.includes(name), false, name);
    }
  });

  it("the spread column is read whether what it spreads is populated or empty", () => {
    for (const agentConfig of [{}, { pipelineConfig: { autoProdDeploy: true } }]) {
      const held = joined("forge_config.get", { ...ROW, agentConfig });
      assert.ok(held.read.includes("agentConfig"), JSON.stringify(agentConfig));
      assert.equal(held.undeclared.includes("agentConfig"), false, JSON.stringify(agentConfig));
    }
  });

  it("a shaper that takes the row whole asks for every name there is, so it drops none", () => {
    const held = recording(ROW);
    assert.deepEqual(Object.keys({ ...held.stand }).length > 0, true);
    assert.equal(held.asked().whole, true, "the enumeration is what a whole-row spread asks with");
  });
});

/* Top-level rather than inside a group, because `node tools/red.mjs` reads a file's top-level cases
   and these are the ones whose red was watched before the guard they name existed. */
const SENTINEL = "a-value-no-report-has-a-reason-to-print";
const CARRYING = { ...ROW, ...Object.fromEntries(WITHHELD.map((name) => [name, SENTINEL])) };

test("no rendered line carries a withheld name, by any path that renders", async () => {
  const paths = [
    await lines(CARRYING),
    await lines(Object.fromEntries(WITHHELD.map((name) => [name, SENTINEL]))),
    (await nameJoinRows(async () => ({ refused: `${WITHHELD[0]}: required` }), "2026-09-20"))
      .map((one) => one.detail),
  ];
  for (const rendered of paths) {
    assert.ok(rendered.length, "a path that renders nothing proves nothing");
    for (const name of WITHHELD) {
      assert.equal(rendered.join("\n").includes(name), false,
        `${name} reached a line of the report:\n${rendered.join("\n")}`);
    }
  }
});

test("no rendered line carries a withheld value", async () => {
  const rendered = [...await lines(CARRYING), ...await lines({ ...CARRYING, slug: undefined })];
  assert.equal(rendered.join("\n").includes(SENTINEL), false, rendered.join("\n"));
});

test("the withheld names are counted where they are not named", async () => {
  assert.match((await lines(CARRYING)).join("\n"), /2 withheld unnamed/u);
  assert.equal((await lines(ROW)).join("\n").includes("withheld"), false,
    "the capture carries neither, so a count of them would be a count of nothing");
});

test("a withheld name is on no declaration list and in no direction", () => {
  for (const key of SUBJECTS) {
    for (const name of WITHHELD) {
      assert.equal(Object.hasOwn(CHOSEN[key], name), false, `${key} declares ${name}`);
    }
  }
  for (const name of WITHHELD) {
    const held = joined("forge_projects.get", { ...ROW, [name]: "held" });
    assert.equal([...held.read, ...held.undeclared, ...held.declared, ...held.unserved]
      .includes(name), false, name);
  }
});

test("a withheld value long enough to be one is struck, and a short one is left alone", () => {
  const strike = striking({ [WITHHELD[0]]: "a-long-held-secret", [WITHHELD[1]]: "ok" });
  assert.equal(strike("held a-long-held-secret here"), "held [withheld] here");
  assert.equal(strike("that is ok by me"), "that is ok by me",
    "a value short enough to collide with a sentence is not struck out of one");
});

describe("what the reading says about itself", () => {
  it("the reading is dated and states the bound it does not reach", async () => {
    const rendered = await lines(ROW, "2026-09-20");
    assert.match(rendered[0], /read 2026-09-20 off GET \/projects\/:id/u);
    assert.match(rendered[0], /nothing inside any of them/u,
      "a green top-level reading read as covering a nested shape is the mistake this line prevents");
  });

  it("a refused read is a row of its own, and none of the tracker's words", async () => {
    const said = "500: <html>the proxy in front of it</html>";
    const rows = await nameJoinRows(async () => ({ refused: said }), "2026-09-20");
    assert.equal(rows.length, 1, "a refused read reports no direction");
    assert.equal(rows[0].level, "note");
    assert.match(rows[0].detail, /did not answer, so neither direction of the name join was read/u);
    assert.match(rows[0].detail, /not a reading that passed/u,
      "a reader told nothing cannot tell a passing check from an absent one");
    assert.equal(rows[0].detail.includes(said), false, "the tracker's own words reached the row");
  });

  it("the join is given its row and fetches nothing", () => {
    const imports = readFileSync(SOURCE, "utf8").match(/^import .*$/gmu) ?? [];
    assert.deepEqual(imports.map((one) => /"([^"]+)"/u.exec(one)[1]), ["./routes.mjs"],
      "the join reaching a transport is a gate step that sends a request");
  });

  /* Both rows build the identical path, so a second read of it would be a second round trip for an
     answer the first one already held. */
  it("one reading of the row answers for both shapers", async () => {
    let reads = 0;
    const rows = await nameJoinRows(async () => {
      reads += 1;
      return { parts: { page: ROW } };
    }, "2026-09-20");
    assert.equal(reads, 1, "one reading of the row answers for every shaper that projects it");
    for (const key of SUBJECTS) {
      assert.ok(rows.some((one) => one.detail.includes(key)), `${key} is judged by no row`);
    }
    assert.equal(SUBJECTS.length > 1, true, "one shaper cannot show a reading shared by two");
  });
});
