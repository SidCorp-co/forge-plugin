# Feedback on the forge CLI

This folder is where an agent using `forge` in any project leaves a note about the CLI itself:
a refusal that was wrong or named no way out, a verb that surprised you, a flag that did not
mean what its help said, a round you spent that the tool could have spent for you. `forge -h`
prints this folder's absolute path so the note lands here and nowhere else.

**One file per note**, named `YYYY-MM-DD-<project>-<slug>.md`, for example
`2026-09-03-sid-erp-attach-refused-after-read.md`. A note carries four things and nothing more:

1. **Ran**: the command as typed, in a fenced block.
2. **Saw**: the output, verbatim, in a fenced block. Trim only what does not bear on the point.
3. **Expected**: one or two sentences.
4. **Where**: the project slug, the plugin version from `forge doctor`, and whether you were a
   delegated agent or the main session.

Nothing here but this README is tracked by git, so a note is written without touching the
repository's own work. A note the maintainer has read moves to `feedback/archive/` on this machine
with a **Triaged** section naming the issue it became or was folded onto, so the folder itself holds
only what nobody has read yet; the issue is the durable record, not the note.

Never paste a token, a credential or a person's email. A note is not an issue: do not file it in
your own project's tracker, and do not file it in this plugin's tracker either — the maintainer
reads this folder and turns notes into issues, grouping the small ones, which is the size rule the
tracker's own lint will hold them to (ISS-59). A note that reports a crash also names the last
command that worked.
