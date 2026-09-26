/* `--baseline`: the one command a run types for its Phase 0 baseline in this repository, so that
   none of them re-decides it from `--owed`'s output and reaches `--full` (ISS-2291). Which of the
   two a head is owed, the citation or a measurement, is `citeForm`'s and the clean head is
   `headNow`'s, both asked here and neither copied. Loaded only when the flag is given, so a gate
   run without it pays nothing for the flow modules this reaches. */
import { freshForm } from "../../plugin/src/flow/earned/baseline.mjs";
import { citeForm } from "../../plugin/src/flow/earned/published.mjs";
import { headNow } from "../../plugin/src/flow/worklog.mjs";
import { slugIfAny } from "../../plugin/src/resolve/settings.mjs";
import { SLOT, WAIT } from "./machine.mjs";
import { waitForSlot } from "./verdict.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const GATE = "npm run check";
const BASELINE = "--baseline";
const RUNNER = fileURLToPath(new URL("../gates.mjs", import.meta.url));

/** What the head in hand is owed: `refused` where it cannot be stamped at all, `cite` where a ship
 *  published a whole-tree result for it, `fresh` where the gate has to measure it. */
export const baselineRoute = (ref) => {
  const head = headNow();
  if (!head) return { refused: true };
  const cite = citeForm(ref, slugIfAny(), head);
  return cite ? { cite, head } : { fresh: freshForm(ref, GATE).replace("<sha>", head), head };
};

const REFUSED = "a baseline stamps a clean head, and this tree has uncommitted paths or is no "
  + "checkout at all: it is taken before the first edit, so commit or move that work first.";

const citedSaid = (head, cite) => `A ship published a whole-tree result for ${head}, so no `
  + `step is spent: the baseline is this one write.\n  ${cite}`;

const freshSaid = (head, fresh) => `Nothing is published for ${head}, so the gate measures `
  + "it now, reading the record as `npm run check` does and never as --full, which trusts none of "
  + `it. Record what it reports, at this head:\n  ${fresh}`;

const WHY = {
  "--full": "--full trusts no record, so a head a ship already measured is spent whole again",
  "--wait": `--wait reads the verdict of a gate already running and measures nothing, and the one wait a baseline `
    + `takes is for a place: ${WAIT} ${SLOT}`,
  "--anyway": "a baseline stamps a clean head, and --anyway gates a dirty one",
};

/** The refusal for a flag beside `--baseline` that no baseline takes, naming the one that is. */
export const besideSaid = (other, key) => `--baseline is the baseline and ${other} is not part of one: `
  + `${WHY[other]}.\nTake the baseline: node tools/gates.mjs --baseline ${key ?? "<ISS-nn>"}`;

/** The arguments that wait for a place and then take this baseline, as the caller named it. */
export const baselineWaitCall = (key) => `${BASELINE}${key ? ` ${key}` : ""} ${WAIT} ${SLOT}`;

/** The exit code of a route that needs no gate, having said it: a dirty head refused, a published one cited. */
const settled = (route) => {
  if (route.refused) {
    console.error(REFUSED);
    return 1;
  }
  if (route.cite) {
    console.log(citedSaid(route.head, route.cite));
    return 0;
  }
  return null;
};

/** Says what the head in hand is owed and returns the exit code, or null where the gate goes on to
 *  measure it the way a bare call does. */
export const takeBaseline = (key) => {
  const route = baselineRoute(key ?? "<ISS-nn>");
  const code = settled(route);
  if (code === null) console.log(freshSaid(route.head, route.fresh));
  return code;
};

/* The measurement runs as a gate of its own, started with no `--wait` on its command line: a process carrying one is
   one no other gate counts (`machine.mjs`), so a baseline measured in the process that waited would take a place
   nobody else could see it holding. What it prints is the bare `--baseline` call's, the head read when it starts. */
const measured = async (key) => {
  const gate = spawn(process.execPath, [RUNNER, BASELINE, ...(key ? [key] : [])], { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, gate.kill.bind(gate));
  const [code] = await once(gate, "exit");
  return code ?? 1;
};

/** `--baseline --wait slot`: a head a ship published is cited with no place asked for; one nothing published waits for
 *  a place with the plain gate's own wait and is then measured, the exit code being the measurement's or the wait's. */
export const baselineAfterPlace = async (root, key, { minutes }) => {
  const code = settled(baselineRoute(key ?? "<ISS-nn>"));
  if (code !== null) return code;
  const waited = await waitForSlot(root, { minutes, again: baselineWaitCall(key),
    then: "The baseline is measured now, as a gate of its own that any gate starting meanwhile counts." });
  return waited === 0 ? measured(key) : waited;
};
