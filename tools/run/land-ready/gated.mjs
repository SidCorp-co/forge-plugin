/* One gate over one candidate, in a room of the landing's own: its output passed through and kept,
   because a red reading is read for the paths the failing step named, and its verdict read back off
   the record the gate wrote for that room. The combined gate and every gate of the search are this. */
import { spawn } from "node:child_process";

import { treeOf } from "./candidate.mjs";
import { roomFor } from "../rooms/room.mjs";
import { gateNoted, verdictIn } from "../attempts/gate.mjs";
import { GATE_ERROR, GREEN, RED } from "../../../plugin/src/stats/marks/attempts.mjs";

const exitedAs = (status, error) => {
  if (error) return GATE_ERROR;
  return status === 0 ? GREEN : RED;
};

/** `{ status, green, output, verdict, own, tree, room, error }`, `own` being the record this
 *  run wrote whatever it decided; the room is the caller's to drop. */
export const gateOver = ({ root, candidate, keys }) => new Promise((done) => {
  const room = roomFor(root, candidate);
  const since = Date.now();
  const child = spawn("npm", ["run", "check"], { cwd: room, stdio: ["ignore", "pipe", "pipe"] });
  const chunks = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { chunks.push(chunk); process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { chunks.push(chunk); process.stderr.write(chunk); });
  /* Once: a child that could not be spawned reports its error and may still report a close. */
  let settled = false;
  const finished = (status, error = null) => {
    if (settled) return;
    settled = true;
    const { record } = gateNoted({ root, tree: room, candidate, members: String(keys).split(/\s+/u).filter(Boolean), since,
      exited: exitedAs(status, error) });
    done({
      status, error, green: status === 0, output: chunks.join(""),
      verdict: status === 0 ? null : record ?? verdictIn(room), own: record ?? null, tree: treeOf(root, candidate), room, candidate,
    });
  };
  child.on("error", (error) => finished(null, error));
  child.on("close", (status) => finished(status));
});
