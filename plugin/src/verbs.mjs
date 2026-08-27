/* The verb table, in its own module because two importers need it and they sit at opposite ends
   of one chain: `cli` builds the usage list from it, and `doctor --hide` validates against it.
   Importing it from `cli` would have closed the cycle cli -> commands -> doctor -> cli. */
export const VERBS = [
  ["issues", "issues [--status s] [--search q] [--limit n]   the browse projection"],
  ["issue", "issue <uuid|ISS-45> [--fields a,b]             one body, or named parts of it"],
  ["new", "new <file.md|@file|-> --title T [--status S]   create; open unless --status says"],
  ["comment", "comment <uuid|ISS-45> <file.md|@file|->        post a comment"],
  ["attach", "attach <issue|comment> <uuid> <file>...        upload, no base64 through context"],
  ["deps", "deps [ISS-45] [--long]                         the graph the issue bodies claim"],
  ["dep", "dep <blocker> <blocked> [kind]                 record a dependency edge", "forge_project_pm"],
  ["guide", "guide [slug]                                   the tracker's own guides", "forge_guide"],
  ["project", "project                                        the resolved project id"],
  ["doctor", "doctor [--token t] [--url u]                   what resolves and from where"],
  ["tools", "tools [--all] | schema <tool>                  the reachable surface"],
  ["call", "call <tool> <'json'|@file|->                   anything not wrapped above"],
];

export const VERB_NAMES = VERBS.map(([verb]) => verb);
