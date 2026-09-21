import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fakeTracker, projectEntry, projectRoom, tempRoom } from "../../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "cli.mjs");

/* The one doctor fixture whose exit code means something, shared by the report's own file and by
   the release policy's: `report` in doctor.test.mjs exits 1 on its missing credential alone, so a
   case judging a level has to run against a tracker that answers. The report names the policy in
   the words its owner uses — the staging branch, never the field's own name (ISS-90). `project` is
   the keys this project's record holds beyond its slug, and the entry it was written to comes back
   because that path is what every row of the report names as its source. */
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
  const cwd = projectRoom(tempRoom("doctor-release-"), tracker.env.XDG_CONFIG_HOME,
    { slug: "release-fixture", ...project });
  const entry = projectEntry(cwd, tracker.env.XDG_CONFIG_HOME);
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
  return { ...answered, entry };
};

export const releaseReport = async (config, environments = null) => (await whole(config, { environments })).out;
