/* `state.answer` is a plain map the fake tracker reads by name at call time, so a key nothing looks
   up answers exactly as one that was looked up and answered: the fixture's own default, in the same
   shape. Held per map; one replaced before a request was served out of it is what this misses. */

/** What a case registered, what a route looked up, and what covered nothing (ISS-1934). */
export const reachOf = (state) => {
  const reach = new Map();
  const standing = (at) => {
    const held = state.answer;
    if (!held) return null;
    if (!reach.has(held)) reach.set(held, { names: new Set(), meant: new Set(), at: at ?? null });
    const row = reach.get(held);
    for (const key of state.unasked ?? []) row.meant.add(key);
    return row;
  };
  /* One key names ten maps in a file that replaces it per case, so the key alone locates nothing. */
  const where = (at) => (at ? `first asked at ${at}` : "no request reached its map");
  const read = () => {
    standing();
    const over = [];
    const stale = [];
    for (const [map, held] of reach) {
      const keys = Object.keys(map);
      for (const key of keys) {
        if (held.names.has(key) || held.meant.has(key)) continue;
        if (!over.some((one) => one.key === key)) over.push({ key, at: held.at });
      }
      for (const key of held.meant) {
        if (!keys.includes(key) || held.names.has(key)) stale.push(key);
      }
    }
    return { over, stale: [...new Set(stale)] };
  };
  const unreached = () => {
    const { over, stale } = read();
    if (over.length) {
      return `${over.length} handler(s) in state.answer that no route of the fake tracker asked for: `
        + `${over.map((one) => `${one.key} (${where(one.at)})`).join(", ")}. A key nothing looks up is `
        + "answered by the fixture's own default in the same shape, so the case that registered it proves "
        + "nothing: reach the key from the subject under test, drop the handler, or name it in "
        + "state.unasked to register one on purpose.";
    }
    if (stale.length) {
      return `state.unasked names ${stale.join(", ")}, which a route asked for or no handler map held. `
        + "Drop the name: an allowance nothing needs is where the next handler to go dead hides.";
    }
    return null;
  };
  return { serving: (at) => { standing(at); }, asked: (name) => { standing()?.names.add(name); }, unreached };
};
