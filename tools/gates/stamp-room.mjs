import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { stampRoom } from "../../plugin/src/hooks/stamps.mjs";

/** One temp root per run, every step spawned under it. Removed however the run ends, since a throw
 *  from a step or the ledger exits past every verdict, and nothing else sweeps one; a kill leaves it. */
export const gateTmp = () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-gate-tmp-"));
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

const ROOM = basename(stampRoom());

/** Where a step left the stamp room, with how many stamps are in it; null is the pass. */
export function roomLeft(dir) {
  const at = join(dir, ROOM);
  if (!existsSync(at)) return null;
  return { at, stamps: readdirSync(at).length };
}

export const leakMessage = ({ at, stamps }) =>
  `This step left ${stamps} hook stamp(s) in ${at}, the temporary directory this gate handed it.\n`
  + `A gate resolves that room under TMPDIR at every call, so on a developer's machine the same\n`
  + `write lands in the room every hook reads and reaps before every stamp of its own — and a\n`
  + `suite's green says nothing about what it left there.\n`
  + `Counting the machine's room instead would prove nothing: the session running this gate stamps\n`
  + `into it throughout. So the run gives its steps a temp root no hook outside it can name, and the\n`
  + `room turning up in it at all is the leak.\n`
  + `plugin/test/fixtures.mjs points TMPDIR at the test process's own root for every test file that\n`
  + `imports it. The file to fix is the one that reached a gate without it.`;
