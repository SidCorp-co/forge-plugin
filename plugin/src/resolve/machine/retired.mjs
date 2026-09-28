/* Keys this machine's own file held and no longer decides anything by. Each is outside the keys the
   machine owns: `ship` is the PROJECT's now (ISS-2174), so `--set ship=` has to reach the project's
   own table rather than be refused as the machine's, and the only thing left to say about a value an
   older release wrote is that it is ignored. `forge doctor` says it; nothing that decides reads it. */

/** `now` is the key that decides this instead, and `route` the command that writes that key. */
export const MACHINE_RETIRED = [
  { key: "ship", now: "`ship` in this machine's record of that project",
    route: "`forge doctor --ship <value>` run inside a checkout of that project" },
];
