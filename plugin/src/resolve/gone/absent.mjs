/* Names this CLI has no verb or record kind for on purpose, each with its reason: a run working from
   an older copy of the method recalls the name, and a nearest name or the list of kinds sends it
   looking for the write that replaced it, where there is none to find. Imports nothing, the verb
   table's near-miss reader being one of its two readers. */
const NO_BASELINE = "there is no baseline: the landing's gate measures the tree, so a run records none and runs none";

const ABSENT = {
  verb: { baseline: NO_BASELINE },
  kind: { baseline: NO_BASELINE },
};

/** Why `name` is no `what` (`verb` or `kind`) of this CLI, or null where nothing says it is absent on purpose. */
export const absentSaid = (what, name) => (Object.hasOwn(ABSENT[what], name) ? ABSENT[what][name] : null);
