import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fakeTracker, tempRoom } from "../../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "cli.mjs");

/* The one doctor fixture whose exit code means something, shared by the report's own file and by
   the release policy's: `report` in doctor.test.mjs exits 1 on its missing credential alone, so a
   case judging a level has to run against a tracker that answers. The report names the policy in
   the words its owner uses — the staging branch, never the field's own name (ISS-90). */
export const whole = async (config, { environments = null, saved = {}, project = {} } = {}) => {
  const tracker = await fakeTracker({
    answer: {
      "forge_projects.list": () => ({ projects: [{ slug: "release-fixture", id: "1e1c1a1e-0000-4000-8000-000000000001" }] }),
      forge_config: () => ({ config }),
      "forge_projects.get": () => ({ project: { environments } }),
      forge_guide: () => ({ refused: "this credential may not read guides" }),
    },
  });
  const held = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  writeFileSync(held, JSON.stringify({ ...JSON.parse(readFileSync(held, "utf8")), ...saved }));
  const cwd = tempRoom("doctor-release-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: "release-fixture" }));
  for (const [name, body] of Object.entries(project)) writeFileSync(join(cwd, name), body);
  /* Awaited, not waited on: this test is the tracker the report asks, and spawnSync holds the loop
     that would answer it. */
  const answered = await new Promise((done) => {
    const child = spawn(process.execPath, [CLI, "doctor"], { cwd, env: tracker.env });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("close", (status) => done({ out, status }));
    child.stdin.end();
  });
  tracker.close();
  return answered;
};

export const releaseReport = async (config, environments = null) => (await whole(config, { environments })).out;
