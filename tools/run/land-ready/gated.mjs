/* One gate over one candidate, in a room of the landing's own: its output passed through and kept,
   because a red reading is read for the paths the failing step named, and its verdict read back off
   the record the gate wrote for that room. The combined gate and every gate of the search are this. */
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";

import { DECLINED, LANDING_ENV } from "../../gates/machine.mjs";
import { LANDING_WAIT_ENV } from "../../gates/landing/wait.mjs";
import { runOf } from "../../gates/verdict.mjs";
import { roomFor, treeOf } from "./candidate.mjs";

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

/* The room's own record, under the path the gate knows itself by: node resolves a link in the room's
   path before the gate reads where it stands, and the record is keyed on that. */
const verdictIn = (room) => {
  let real = room;
  try {
    real = realpathSync(room);
  } catch {
    /* A room that cannot be resolved is read as named, and a missing record reads as no verdict. */
  }
  return runOf(real, null);
};

/** `{ status, green, declined, output, verdict, tree, room, error }`; the room is the caller's to drop. */
export const gateOver = ({ root, candidate, keys, minutes, label = null }) => new Promise((done) => {
  const room = roomFor(root, candidate);
  const env = { ...process.env, [LANDING_ENV]: keys, [LANDING_WAIT_ENV]: String(minutes) };
  const child = spawn("npm", ["run", "check"], { cwd: room, env, stdio: ["ignore", "pipe", "pipe"] });
  const out = passed(process.stdout, label);
  const err = passed(process.stderr, label);
  const chunks = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { chunks.push(chunk); out.write(chunk); });
  child.stderr.on("data", (chunk) => { chunks.push(chunk); err.write(chunk); });
  const finished = (status, error = null) => {
    out.end();
    err.end();
    done({
      status, error, green: status === 0, declined: status === DECLINED, output: chunks.join(""),
      verdict: status === 0 ? null : verdictIn(room), tree: treeOf(root, candidate), room, candidate,
    });
  };
  child.on("error", (error) => finished(null, error));
  child.on("close", (status) => finished(status));
});
