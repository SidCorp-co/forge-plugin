/* A landing's gate: what land-ready hands it, the wait for a place it takes where a builder's gate declines, and the
   decline a builder's gate says when a landing is ahead of it. The rule that puts a landing ahead is `placeFor`'s; this
   is what each side of it says and does (ISS-2461). */
import { DECLINED, LANDING_ENV, placeFor, RAISE, runnersOf, SLOT, WAIT } from "../machine.mjs";
import { spent, TICK_MS, verdictPath } from "../verdict.mjs";
import { watching } from "../../watching.mjs";

/** The variable land-ready sets beside `LANDING_ENV`. */
export const LANDING_WAIT_ENV = "FORGE_LANDING_WAIT";

/** What land-ready handed this gate: `landing` null for a builder's gate, the keys and minutes for a landing's, or a
    `refused` naming what was read, since a wait read and dropped would decline a landing that asked to wait. */
export const landingAsked = (env = process.env) => {
  const keys = env[LANDING_ENV]?.trim() || null;
  const raw = env[LANDING_WAIT_ENV];
  if (keys === null && raw === undefined) return { landing: null };
  if (keys === null) {
    return { refused: `${LANDING_WAIT_ENV}=${raw} is a landing's wait and ${LANDING_ENV} names no landing, so this `
      + `gate has nobody to wait as.` };
  }
  const minutes = raw === undefined ? 0 : Number(raw);
  if (raw !== undefined && !(minutes > 0)) {
    return { refused: `${LANDING_WAIT_ENV} takes the minutes a landing's gate waits for a place, not \`${raw}\`.` };
  }
  return { landing: { keys, minutes } };
};

const gateLine = (one) => `  pid ${one.pid}  gating ${one.tree}${one.landing ? `  the landing of ${one.landing}` : ""}`;

/** A builder's gate declined for the ceiling: every gate it counted, the landing that took the place where the
    gates started before it would have left one free, and `route`, the one command that waits for a place. */
export const declinedSaid = (place, root, route = `Wait for a place, then gate again: node tools/gates.mjs ${WAIT} ${SLOT}`) => {
  const before = place.ahead.length - place.took.length;
  const lines = [
    `\nThis gate declined the machine and judged nothing.`,
    `${before} gate(s) of this checkout are already running, and this project carries `
      + `${place.declared.value} run(s) at once  ← ${place.declared.from}`,
    ...place.ahead.map(gateLine),
  ];
  if (place.took.length && before < place.declared.value) {
    lines.push(`The place the gates started before this one left free is the landing's: ${place.took
      .map((one) => `${one.landing} (pid ${one.pid})`).join(", ")} took it, since what lands is ahead of what `
      + `is being readied.`);
  }
  lines.push(route,
    `No step ran and nothing was recorded, so nothing here judges ${root}.`,
    `Or raise ${RAISE} above ${place.declared.value}.`);
  return lines.join("\n");
};

/** A landing's gate declined for the ceiling waits for a place rather than declining, up to its minutes: true once
    admitted, false at the deadline, having said how long it waited and which gates held the places. The worktrees are
    read again where the answer is about to be yes, as `waitForSlot` does, a tree cut meanwhile holding a place too. */
export const waitAsLanding = async (root, landing, { ours = runnersOf(root), place = (set) => placeFor(set),
  tick = TICK_MS, say = console.log, warn = console.error } = {}) => {
  const began = Date.now();
  const until = began + landing.minutes * 60_000;
  let set = ours;
  say(`\nEvery place this checkout declares is held, and this is the gate of the landing of ${landing.keys}: it `
    + `waits up to ${landing.minutes} minute(s) for one, ahead of any builder's gate that starts meanwhile.`);
  for (;;) {
    let where = place(set);
    if (!where.declined) {
      set = runnersOf(root);
      where = place(set);
    }
    if (!where.declined) {
      say(`A place freed after ${spent(Date.now() - began)}, and the landing's gate runs now.`);
      return true;
    }
    if (Date.now() >= until) {
      warn(`\nThis gate declined the machine and judged nothing: it waited ${spent(Date.now() - began)} for a `
        + `place, the ${landing.minutes} minute(s) the landing of ${landing.keys} gave it, and every place `
        + `was still held by`);
      for (const one of where.ahead) warn(gateLine(one));
      warn(`No step ran and nothing was recorded, so nothing here judges ${root}; it exits ${DECLINED}.`);
      return false;
    }
    const ms = Math.min(tick, Math.max(until - Date.now(), 1));
    const wake = watching(verdictPath(where.ahead[0].tree), ms);
    await Promise.race([wake.settled, new Promise((woke) => setTimeout(woke, ms))]);
    wake.cancel();
  }
};
