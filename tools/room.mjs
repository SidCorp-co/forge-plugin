/* A filesystem answer libuv has no name for arrives as `UNKNOWN: unknown error, write` with the
   number intact and, where the write failed on a descriptor, no path at all. Six sightings of a
   per-user quota on a `usrquota` tmpfs were read as flaky cases before one was decoded (ISS-1611). */
import { appendFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { constants } from "node:os";
import { dirname } from "node:path";

/* The gate points this at its own record directory and never under the temporary root: the
   filesystem that refused the write is the one a note there would be written to. */
export const ROOM_ENV = "GATE_ROOM_REFUSED";

const ERRNO = Object.entries(constants.errno);

// The platform's own name for the number: `util.getSystemErrorName(-122)` answers it is unknown.
export const errnoName = ({ errno, code }) =>
  ERRNO.find(([, value]) => value === Math.abs(errno ?? NaN))?.[0] ?? code ?? "no errno";

const MEANS = new Map([
  ["EDQUOT", "this user's quota on that filesystem is spent, in bytes or in inodes — df and df -i "
    + "both read healthy while it is, because neither of them counts a quota"],
  ["ENOSPC", "that filesystem is out of bytes or out of inodes"],
  ["EACCES", "that directory is not this user's to write in"],
  ["EPERM", "the operation is not permitted there, whatever the free space says"],
  ["EROFS", "that filesystem is mounted read-only"],
  ["EMFILE", "this process has no file descriptor left to open one with"],
]);

const SPLIT = "\n\n";

const tmpdirInForce = () => process.env.TMPDIR
  ?? "unset, so the platform's own temporary directory is what these rooms are made under";

export const roomRefusal = (error, at) => {
  const name = errnoName(error);
  return [
    `Could not make the temporary room at ${at}: ${name}`,
    ...(MEANS.has(name) ? [`${name} means ${MEANS.get(name)}.`] : []),
    `TMPDIR in force: ${tmpdirInForce()}`,
    `This is the machine refusing the room, not the tree under test being wrong.`,
    `Point TMPDIR at a filesystem with room to spare and run it again.`,
    `node reported it as: ${error.message}`,
  ].join("\n");
};

const note = (said) => {
  const at = process.env[ROOM_ENV];
  if (!at) return;
  try {
    mkdirSync(dirname(at), { recursive: true });
    appendFileSync(at, `${said}${SPLIT}`);
  } catch { /* empty */ }
};

/* An errno with a syscall beside it, which is every `node:fs` refusal and nothing a fixture threw
   about its own contents: a bad assertion inside a room build must reach the run unchanged. */
const filesystem = (error) => typeof error?.errno === "number" && typeof error?.syscall === "string";

export const madeIn = (at, build) => {
  try {
    return build();
  } catch (error) {
    if (!filesystem(error)) throw error;
    const said = roomRefusal(error, at);
    note(said);
    throw Object.assign(new Error(said), { cause: error, code: error.code, errno: error.errno });
  }
};

export const roomRefused = (at) => {
  let text;
  try {
    text = readFileSync(at, "utf8");
  } catch {
    return null;
  }
  const said = text.split(SPLIT).map((one) => one.trim()).filter(Boolean);
  return said.length === 0 ? null : { said: said[0], times: said.length };
};

export const forgetRoomRefusal = (at) => rmSync(at, { force: true });
