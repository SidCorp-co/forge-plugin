/* A red set searched for the members at fault with the fewest gates: attribution first, which costs
   none, then halves of the suspects, each gated as its own candidate on the one pin and one after the
   other, since a landing's gate is the one whole gate running. Nothing here writes a checkpoint: what
   it finds is returned, and written by the caller only once every gate it needed has answered, so a
   gate that could not run anywhere in it leaves every member the landing's turn.
   docs/cli/the-candidate.md. */
import { chainOver, treeOf } from "./candidate.mjs";
import { dropRoom } from "../rooms/room.mjs";
import { attributed, casesOf } from "./fault.mjs";
import { gateOver } from "./gated.mjs";

const keysIn = (members) => members.map((one) => one.key).join(" ");

class Unbuildable extends Error {}

/** The search, from the combined candidate's red reading: `{ green, back, gates, rounds, kept,
 *  candidate }`, `kept` being the green gate that read the tree the members left make, and its room
 *  the one room left standing. `{ unbuildable }` where a subset does not merge on the pin, and
 *  `{ unread }` where a gate never ran, each with every room dropped and the
 *  `gates` spent before it. */
export const searched = async ({ at, ctx, first }) => {
  const { root } = ctx;
  const found = { green: [], back: [], gates: 1, rounds: 0, trees: new Map() };
  const rooms = [];
  const gate = async (members) => {
    const candidate = chainOver(root, at.pin, members.map((one) => one.landing.head));
    if (!candidate) throw new Unbuildable(keysIn(members));
    const read = await gateOver({ root, candidate, keys: keysIn(members) });
    rooms.push(read.room);
    found.gates += 1;
    if (read.error) throw Object.assign(new Error("no reading"), { read });
    if (read.green) found.trees.set(read.tree, read);
    return read;
  };
  const red = async (members, reading) => {
    if (members.length === 1) {
      found.back.push({ members, reading, alone: true });
      return;
    }
    const fall = attributed(casesOf(reading.verdict, reading.output), members);
    if (fall.culprits) {
      for (const { member, cases } of fall.culprits) found.back.push({ members: [member], reading, cases });
      const rest = members.filter((one) => !fall.culprits.some(({ member }) => member === one));
      if (rest.length === 0) return;
      const again = await gate(rest);
      if (again.green) found.green.push(...rest);
      else await red(rest, again);
      return;
    }
    found.green.push(...members.filter((one) => !fall.suspects.includes(one)));
    const half = Math.ceil(fall.suspects.length / 2);
    const [low, high] = [fall.suspects.slice(0, half), fall.suspects.slice(half)];
    found.rounds += 1;
    const lowRead = await gate(low);
    const highRead = await gate(high);
    if (lowRead.green && highRead.green) {
      found.back.push({ members: fall.suspects, reading, combination: true });
      return;
    }
    for (const [part, read] of [[low, lowRead], [high, highRead]]) {
      if (read.green) found.green.push(...part);
      else await red(part, read);
    }
  };
  const result = async () => {
    let reading = first;
    let members = at.members;
    for (;;) {
      found.green = [];
      await red(members, reading);
      const left = at.members.filter((one) => found.green.includes(one));
      if (left.length === 0) return { ...found, kept: null, candidate: null };
      const candidate = chainOver(root, at.pin, left.map((one) => one.landing.head));
      if (!candidate) throw new Unbuildable(keysIn(left));
      const kept = found.trees.get(treeOf(root, candidate)) ?? null;
      if (kept) return { ...found, green: left, kept, candidate };
      reading = await gate(left);
      if (reading.green) return { ...found, green: left, kept: reading, candidate };
      members = left;
    }
  };
  let held = null;
  try {
    held = await result();
    return held;
  } catch (error) {
    if (error instanceof Unbuildable) return { unbuildable: error.message, gates: found.gates };
    if (error.read) return { unread: error.read, gates: found.gates };
    throw error;
  } finally {
    /* Every room but the one the members left were read green in, which the version step builds on. */
    for (const room of rooms) if (room !== held?.kept?.room) dropRoom(root, room);
  }
};
