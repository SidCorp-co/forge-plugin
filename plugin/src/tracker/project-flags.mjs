/* What `forge doctor` takes for the project's own record — the flags that write it and the text under
   them — apart from the module that writes it, which is imported only once a call is past `-h`. */

/* Three ways to write one brief entry, and a call takes one; the body's fields ride only with the whole body, since the narrow writes carry the stored entry's forward untouched. */
export const WRITES = ["refresh", "confirm", "line"];
export const WITH_BODY = ["title", "confidence"];

/** The dozen lines a usage row cannot hold: a reader who has to be told what a `stale:` line means before they can act on one is a reader the row has already lost. */
export const PROJECT_USAGE = [
  "",
  "The project's own record prints beside this machine's keys — the branches a change lands on, the",
  "staging deploy, each key of the pipeline configuration and the project facts, and the brief Phase",
  "0 reads instead of learning the repository by hand.",
  "",
  "  --set <key>=<value>  one key of the project's configuration, written through the route of the",
  "                       resource that holds it and read back off it before it reports set. A key",
  "                       neither resource holds is refused; `pipeline.<k>` and `fact.<k>` name one",
  "                       outright, which is how a key the project has not got yet is created.",
  "  --credentials        the test credentials the deploy lines withhold, printed once.",
  "",
  "The brief prints with a `stale:` line naming which of the files it was read from have moved",
  "since. Nothing here writes the brief's prose, because no program reads a repository's dangers",
  "out of its README — so a stale line is judged by a run and closed by whichever of these it is:",
  "",
  "  --confirm <source>   the lines naming that source were read against the file as it now is",
  "                       and their prose still holds, so the digest alone is re-stamped and the",
  "                       body goes back byte for byte. The lines it covered are printed.",
  "  --line <n> <text>    one line's prose, replaced. A digest is a path's and not a line's, so a",
  "                       source another line also reads is left stale and that line is named.",
  "  --refresh <body>     the whole brief, for one being rewritten on purpose. Its digests are",
  "                       stamped from that same body in the same call.",
  "",
  "The entry is `forge knowledge`'s in every other respect — one slug, `project-brief`, kind",
  "`overview`, injection `always` — and --title, --confidence and --meta mean there what they mean",
  "here. Injection is not a flag: a brief a session has to ask for is the call this entry removes.",
].join("\n");
