/* `forge --version` answered "No verb named --version." A version is asked first where something
   else is in doubt, so it is read off this copy's own manifest and needs no credential or project. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const MANIFEST = new URL("../../../.claude-plugin/plugin.json", import.meta.url);
const { version } = JSON.parse(readFileSync(MANIFEST, "utf8"));

test("--version and version print the version this copy's plugin.json names, and nothing else", async () => {
  const env = { ...process.env, XDG_CONFIG_HOME: tempHome("cli-version").path };
  for (const word of ["--version", "version"]) {
    const run = await ranAsync(FORGE, [word], env);
    assert.equal(run.status, 0, `${word}: ${run.stderr}`);
    assert.equal(run.stdout, `${version}\n`, `${word}: the manifest's version alone`);
    assert.equal(run.stderr, "", `${word}: nothing refused or suggested`);
  }
});

test("the verb list says where the version is read", async () => {
  const run = await ranAsync(FORGE, ["-h"], { ...process.env, XDG_CONFIG_HOME: tempHome("cli-version-help").path });
  assert.match(run.stdout, /This copy's version: `forge --version`\./u, run.stdout);
});
