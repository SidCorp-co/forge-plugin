/* The git rules fire only where there is uncommitted work: a fixture reading this checkout failed the
   whole suite on a clean master, stopping `npm run check` before seven later gates. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (room, ...args) =>
  spawnSync("git", ["-C", room, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { encoding: "utf8" });

export const dirtyRepo = () => {
  const room = mkdtempSync(join(tmpdir(), "dirty-repo-"));
  spawnSync("git", ["init", "-q", room], { encoding: "utf8" });
  writeFileSync(join(room, "tracked.txt"), "committed\n");
  git(room, "add", "tracked.txt");
  git(room, "commit", "-qm", "base");
  writeFileSync(join(room, "tracked.txt"), "changed, and never committed\n");
  return room;
};
