import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { flat, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("method-phases").path;
const { DEFAULT } = await import("../../../src/guides/flow.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;

test("the default flow's verification reference keeps the skip and drops the rendered state", () => {
  const held = flat(readFileSync(join(PLUGIN, "guides", "skills", "issue-flow", DEFAULT, "references", "verification.md"), "utf8"));
  assert.ok(held.includes("A library has no deployment; a CLI has no screen"),
    `the ${DEFAULT} flow's verification reference no longer says which items a project skips, which `
      + "is the line written for a project with no screen and the one that stays");
  for (const [beat, phrase] of [
    ["the rendered-state row", "| A screen |"],
    ["the login fallback", "When no login reaches the rendered state"],
  ]) {
    assert.ok(!held.includes(phrase), `the ${DEFAULT} flow's verification reference still carries `
      + `${beat}, which asks a project with no screen for evidence it has no way to produce`);
  }
});
