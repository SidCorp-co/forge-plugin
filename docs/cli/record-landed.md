# `record landed`

**A landing built by hand was four calls, and they failed apart.** A change that reached the base
branch outside `forge claim --landed` — merged in a web UI, pushed by a person, landed by a master in
direct mode — owed the tracker everything a landing writes, from the lease to its hand-back. Runs made them as four
or five separate calls, and in the Agenfold sessions of 2026-10-30/31 they failed apart: a mark sent
with no lease (`NO_HOLDER`), a move sent before the mark, a lease written twice (`NO_OP`). Each
failure left the issue half-recorded, and the run that met it could not tell from the refusal which
half stood.

**One verb makes them in the order core's direct mode names.** `forge record landed <ISS> --sha
<40-hex>` follows core's `DIRECT_ORDER` for a master's direct mode, one step after another, each read before the next
is sent:

1. the lease: taken where nothing holds the issue, renewed where this run holds it, refused where
   another run does — and an issue at `open`, `approved` or `reopen` is then taken to `in_progress`,
   that being the one status core moves to `awaiting_release` from;
2. the merge mark, written only after `git fetch` of the remote base branch shows that branch
   carries the sha — a commit only this disk holds is no landing;
3. the move to `awaiting_release`, the sha its reason, and `--reason` after it;
4. the comment: `--comment-file`, or one line naming the sha, the base and the commit's subject;
5. the lease handed back, the last write.

**A refusal stops the verb by name and says what stands.** Each step's refusal ends the call
naming the step, core's own words, and every step already done; nothing after it is sent and the
lease stays with the run. A step already standing is said and not made again — a mark at this sha,
an issue already at `awaiting_release` — so the same call made again resumes where the last one
stopped rather than failing on what it already wrote.

**The sha is whole and the base is read, not trusted.** A short sha is refused before any request
(`COMMIT_NOT_WHOLE`, as core's mark refuses it), and the base branch is the project's `baseBranch`,
fetched into its remote-tracking ref before the ancestry is asked. `--dry-run` reads the issue and
prints every call the run would make, in order, and sends none.

**What it is not.** It does not close the issue. The close from `awaiting_release` is the release's
own (`CLOSE_ONLY_BY_RELEASE`), recorded by `forge release-batch record`.
