/* What `forge doctor` takes for the project's own record — the flags that write it and the text under
   them — apart from the module that writes it, which is imported only once a call is past `-h`. */

/* Three ways to write one brief entry, and a call takes one; the body's fields ride only with the whole body, since the narrow writes carry the stored entry's forward untouched. */
export const WRITES = ["refresh", "confirm", "line"];
export const WITH_BODY = ["title", "confidence"];

/** The dozen lines a usage row cannot hold: a reader who has to be told what a `stale:` line means before they can act on one is a reader the row has already lost. */
export const PROJECT_USAGE = [
  "",
  "The project's own record prints beside this machine's keys — the branches, the staging deploy,",
  "each key of the pipeline configuration and the project facts, and the brief Phase 0 reads",
  "instead of learning the repository by hand.",
  "",
  "  --set <key>=<value>  one key of the project's configuration, written through the route of the",
  "                       resource that holds it and read back off it before it reports set. A key",
  "                       neither holds is refused; `pipeline.<k>` and `fact.<k>` create one.",
  "  --flow <slug>        the flow, into the project's own file, with every key that flow asks the",
  "                       project for; either both land or the refusal names the half that did not.",
  "  --credentials        the test credentials the deploy lines withhold, printed once.",
  "",
  "The brief prints with a `stale:` line naming which files it was read from have moved. Nothing",
  "here writes its prose — no program reads a repository's dangers out of its README — so a stale",
  "line is judged by a run and closed by whichever of these it is:",
  "",
  "  --confirm <source>   the lines naming that source were read against the file as it now is",
  "                       and their prose still holds, so the digest alone is re-stamped and the",
  "                       body goes back byte for byte. The lines it covered are printed.",
  "  --line <n> <text>    one line's prose, replaced, counting the body `forge doctor` prints",
  "                       numbered. A source another line also reads is left stale and is named.",
  "  --was <prose>        what line <n> begins with now, and it must open that one line alone: the",
  "                       store has no undo, and every other view of it counts a different body.",
  "  --refresh <body>     the whole brief, for one being rewritten on purpose. Its digests are",
  "                       stamped from that same body in the same call.",
  "",
  "The entry is `forge knowledge`'s otherwise — slug `project-brief`, kind `overview`, injection",
  "`always` — and --title, --confidence and --meta mean what they mean there. Injection is no flag:",
  "a brief a session has to ask for is the call this entry removes.",
].join("\n");
