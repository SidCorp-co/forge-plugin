/* Names this CLI has no verb or record kind for on purpose, each with its reason: a run working from
   an older copy of the method recalls the name, and a nearest name or the list of kinds sends it
   looking for the write that replaced it, where there is none to find. Imports nothing, the verb
   table's near-miss reader being one of its two readers. */
const NO_BASELINE = "there is no baseline: the landing's gate measures the tree, so a run records none and runs none";

/* ISS-10: core keeps no `migration` event kind (ISS-2196 added it here, core never did), so the write
   it typed was refused and no rung could read it back. Removed until core adds it to RECORD_EVENT_KINDS. */
const NO_MIGRATION = "core keeps no migration record, so no rung owes one; record a schema statement's "
  + "deployment risk in the verification (`forge record verification`) or a decision (`forge record decision`)";

const ABSENT = {
  verb: { baseline: NO_BASELINE },
  kind: { baseline: NO_BASELINE, migration: NO_MIGRATION },
};

/** Why `name` is no `what` (`verb` or `kind`) of this CLI, or null where nothing says it is absent on purpose. */
export const absentSaid = (what, name) => (Object.hasOwn(ABSENT[what], name) ? ABSENT[what][name] : null);
