/* Which machine a reading was taken on. The tracker models devices — `defaultDeviceId` on a project
   row, `authorDeviceId` on a comment — but names none of them for the machine this process is on, so
   there is nothing to read back and an identity is minted here instead: an opaque value, because the
   question a reader asks of it is only whether two readings came from one machine. Two devices
   measuring one project is a fact about the reading and not a conflict to resolve, which is what
   makes this a field rather than something to reconcile (ISS-1984). */
import { randomBytes } from "node:crypto";

import { configDir, readJson, writeJsonPrivate } from "./config.mjs";
import { join } from "node:path";

/* The answer for a reading that was taken before this field existed. Named rather than left absent,
   so a reader can tell a reading whose device is unknown from one this code failed to stamp. */
export const UNKNOWN_DEVICE = "unknown";

const devicePath = () => join(configDir("forge"), "device.json");

/** This machine's id, minted once and then read. It sits beside the token and the consult log rather
 *  than anywhere of this run's own, a value that changed per run answering nothing. */
export const deviceOf = () => {
  const held = readJson(devicePath())?.device;
  if (typeof held === "string" && held) return held;
  const minted = randomBytes(8).toString("hex");
  try {
    writeJsonPrivate(devicePath(), { device: minted });
  } catch {
    /* A machine whose config directory will not take a write still measures; the reading it holds
       says the device is unknown rather than carrying an id that would differ at the next call. */
    return UNKNOWN_DEVICE;
  }
  return minted;
};
