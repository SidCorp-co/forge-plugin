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

/** `source` is who reported it: node itself, or the child process whose output named the refusal. */
export const roomRefusal = (error, at, source = "node") => {
  const name = errnoName(error);
  return [
    `Could not make the temporary room at ${at}: ${name}`,
    ...(MEANS.has(name) ? [`${name} means ${MEANS.get(name)}.`] : []),
    `TMPDIR in force: ${tmpdirInForce()}`,
    `This is the machine refusing the room, not the tree under test being wrong.`,
    `Point TMPDIR at a filesystem with room to spare and run it again.`,
    `${source} reported it as: ${error.message}`,
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

/** The one refusal a starved room throws, noted where the gate reads it, whichever process met it. */
export const refusedRoom = (error, at, source = "node") => {
  const said = roomRefusal(error, at, source);
  note(said);
  return Object.assign(new Error(said), { cause: error, code: error.code, errno: error.errno });
};

export const madeIn = (at, build) => {
  try {
    return build();
  } catch (error) {
    if (!filesystem(error)) throw error;
    throw refusedRoom(error, at);
  }
};

/* A child process meets the same quota in its own words: git says `Disk quota exceeded`, npm says
   `errno -122` under a code libuv has no name for. A setup step that ignored it left a worktree with
   no files, and the case then ran the step under test in it and read red (ISS-2785). Only the two
   errnos that mean the room is spent are read, and only off a child that failed: a permission
   refusal in a subject's output may be the subject's own defect, and a child that exited zero
   judged something whatever it printed. A number counts only inside a diagnostic shaped like an
   errno's, never bare, since a failing assertion may print `-28` as a value. */
const SPENT = [
  { name: "EDQUOT", said: /\bEDQUOT\b|Disk quota exceeded/iu },
  { name: "ENOSPC", said: /\bENOSPC\b|No space left on device/iu },
].map((one) => ({ ...one, errno: constants.errno[one.name] }));

// A release's whole output can run to thousands of lines, and the refusal is read at the gate's foot.
const TAIL = 2000;

const NUMBERED = /\b(?:errno:?|system error)\s+-(\d+)\b/giu;

/** EDQUOT or ENOSPC off a spawn result that failed, or null: from the spawn error's own code and
 *  errno, the errno's name, its strerror text, or its number in an errno-shaped diagnostic. */
export const roomSpent = (result) => {
  if (!result || (result.status === 0 && !result.error)) return null;
  const { error } = result;
  const byError = SPENT.find((one) => error?.code === one.name || Math.abs(error?.errno ?? NaN) === one.errno);
  if (byError) return byError.name;
  const text = [result.stdout, result.stderr, error?.message].filter(Boolean).join("\n");
  const numbers = [...text.matchAll(NUMBERED)].map((one) => Number(one[1]));
  return SPENT.find((one) => one.said.test(text) || numbers.includes(one.errno))?.name ?? null;
};

/** The room refusal for a failed child whose result says the room is spent, or null. `what` names
 *  the command, which the refusal reports its output under. */
export const childRefusal = (result, at, what) => {
  const name = roomSpent(result);
  if (!name) return null;
  const output = [result.stderr, result.stdout, result.error?.message].filter(Boolean).join("\n").trim().slice(-TAIL);
  const error = Object.assign(new Error(output || name), { code: name, errno: -constants.errno[name], syscall: what });
  return refusedRoom(error, at, what);
};

/** A spawn result a room's own setup made, checked: the room refusal where the room is spent, an
 *  error naming the command and quoting its output where it failed otherwise, and the result where
 *  it did not. */
export const roomBuilt = (result, at, what) => {
  const refused = childRefusal(result, at, what);
  if (refused) throw refused;
  if (result.status === 0 && !result.error) return result;
  throw new Error(`the room this case stands on was not built: ${what} in ${at} exited `
    + `${result.status ?? result.error?.code}:\n${result.stderr ?? ""}${result.stdout ?? ""}`);
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
