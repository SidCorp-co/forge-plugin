/* What the record proves about the run behind a lease, which the clock never could: the recorded
   process id absent in the place that id was issued, and nothing else. Why only absence proves it,
   and why a hostname is not that place: docs/cli/claim.md (ISS-919). An id that cannot be signalled
   answers, another user's run being no call of this one's to make. */
import { readFileSync, readlinkSync } from "node:fs";

/* The kernel boot and the process table; both halves or nothing, so a platform exposing neither records no place and leaves its leases to the clock. */
const BOOT = "/proc/sys/kernel/random/boot_id";
const TABLE = "/proc/self/ns/pid";

const read = (how, path) => {
  try {
    return how(path, "utf8").trim();
  } catch {
    return "";
  }
};

let here = null;

export const placeOf = () => {
  if (here === null) {
    const boot = read(readFileSync, BOOT);
    const table = read(readlinkSync, TABLE);
    here = boot && table ? `${boot} ${table}` : "";
  }
  return here;
};

const absent = (pid) => {
  const id = Number(pid);
  if (!Number.isInteger(id) || id < 1) return false;
  try {
    process.kill(id, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
};

export const holderGone = (lease, at = placeOf()) =>
  Boolean(lease?.place) && lease.place === at && absent(lease.pid);

export const holderGoneSaid = (lease) =>
  `Process id ${lease.pid}, which that lease records as its holder's, is not running where the lease `
  + `was taken — the same kernel boot and the same process table this call stands in — so the record `
  + `proves the run is gone and nothing about it had to be established.`;
