/* The Corepack home a landing's gate runs `npm` under. Where `npm` is Corepack's shim, the npm it
   runs is the one its home already holds, and that home is read off HOME: a case's room of its own
   would start with none and fetch npm from the registry before every gate, so the suite's answer
   would be the network's (ISS-2512). So the room gets a Corepack home of its own, its directories
   real and its pin a copy, with each version the developer's holds linked in: a pin Corepack moves
   or a version it installs lands in the room, and the developer's is only read. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

/** The developer's Corepack home, resolved the way Corepack resolves it, off the HOME it is read under. */
export const developerCorepack = () => process.env.COREPACK_HOME
  ?? join(process.env.XDG_CACHE_HOME ?? join(process.env.HOME, ".cache"), "node", "corepack");

const dirsIn = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [])
  .filter((one) => one.isDirectory()).map((one) => one.name);

/** A Corepack home at `to` lending the versions installed at `from`, which it never writes. */
export const lendCorepack = (from, to) => {
  mkdirSync(to, { recursive: true });
  const pin = join(from, "lastKnownGood.json");
  if (existsSync(pin)) copyFileSync(pin, join(to, "lastKnownGood.json"));
  for (const layout of dirsIn(from)) {
    for (const manager of dirsIn(join(from, layout))) {
      mkdirSync(join(to, layout, manager), { recursive: true });
      for (const version of dirsIn(join(from, layout, manager))) {
        symlinkSync(join(from, layout, manager, version), join(to, layout, manager, version));
      }
    }
  }
};
