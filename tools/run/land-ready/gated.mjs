/* One gate over one candidate, in a room of the landing's own: its output passed through and kept,
   because a red reading is read for the paths the failing step named, and its verdict read back off
   the record the gate wrote for that room. The combined gate and every gate of the search are this. */
import { spawn } from "node:child_process";

import { DECLINED, LANDING_ENV } from "../../gates/machine.mjs";
import { LANDING_WAIT_ENV } from "../../gates/landing/wait.mjs";
import { treeOf } from "./candidate.mjs";
import { roomFor } from "../rooms/room.mjs";
import { gateNoted, verdictIn } from "../attempts/gate.mjs";
import { GATE_ERROR, GREEN, RED, DECLINED as PLACE_DECLINED } from "../../../plugin/src/stats/marks/attempts.mjs";

/* Each line of a gate run beside another under the keys it gates, so two at once still read apart. */
const passed = (to, label) => {
  let held = "";
  return {
    write: (chunk) => {
      if (!label) return to.write(chunk);
      held += chunk;
      const lines = held.split("\n");
      held = lines.pop();
      for (const line of lines) to.write(`[${label}] ${line}\n`);
      return true;
    },
    end: () => (label && held ? to.write(`[${label}] ${held}\n`) : true),
  };
};

const exitedAs = (status, error) => {
  if (error) return GATE_ERROR;
  if (status === 0) return GREEN;
  return status === DECLINED ? PLACE_DECLINED : RED;
};

/** `{ status, green, declined, output, verdict, tree, room, error }`; the room is the caller's to drop. */
export const gateOver = ({ root, candidate, keys, minutes, label = null }) => new Promise((done) => {
  const room = roomFor(root, candidate);
  const env = { ...process.env, [LANDING_ENV]: keys, [LANDING_WAIT_ENV]: String(minutes) };
  const since = Date.now();
  const child = spawn("npm", ["run", "check"], { cwd: room, env, stdio: ["ignore", "pipe", "pipe"] });
  const out = passed(process.stdout, label);
  const err = passed(process.stderr, label);
  const chunks = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { chunks.push(chunk); out.write(chunk); });
  child.stderr.on("data", (chunk) => { chunks.push(chunk); err.write(chunk); });
  /* Once: a child that could not be spawned reports its error and may still report a close. */
  let settled = false;
  const finished = (status, error = null) => {
    if (settled) return;
    settled = true;
    out.end();
    err.end();
    const { record } = gateNoted({ root, tree: room, candidate, members: String(keys).split(/\s+/u).filter(Boolean), since,
      exited: exitedAs(status, error) });
    done({
      status, error, green: status === 0, declined: status === DECLINED, output: chunks.join(""),
      verdict: status === 0 ? null : record ?? verdictIn(room), tree: treeOf(root, candidate), room, candidate,
    });
  };
  child.on("error", (error) => finished(null, error));
  child.on("close", (status) => finished(status));
});
