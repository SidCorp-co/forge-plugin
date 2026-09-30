# codex — the unavailable gateway

What a consult is owed and when a write asks for one: [the consult](codex-the-consult.md). What a
door holds: `forge hooks --how codex-second` and `forge hooks --how codex-owed`.

**A reviewer that could not answer is not an agent that did not ask.** The reviewer is a service
outside the flow, and a precondition it cannot meet holds every run behind it: on 2026-09-30 every
consult came back `503` for hours and a builder looped on its recheck until somebody told it to stop
(ISS-2932). So a consult that ended with the gateway's error is a state of its own. The log row keeps
the HTTP status in `status` beside the error's text, so a reader asks a field rather than parsing
prose, and a failure that reached no status at all — a timeout, a refused connection, a stream cut
off — is named by the first line of its error instead.

**What that state costs is the project's, in `codex.consult`.** `required` is the default because a
project that has not decided keeps what G-06 asks for, the reading before landing: the plan and
criteria writes and both doors hold such a file exactly as they hold one nobody consulted on, and the
refusal says what the gateway answered and names the setting that lets it through. `advisory` lets
the file through and says so where it lands — a comment on the issue for a plan or criteria write, a
note beside the call at a door. A machine with no gateway configured is the same case under
`advisory`, since no consult can be asked for there.

**A consult that read these bytes stands; short of one, the newest consult that carried them
speaks.** An answer is a review that happened, and a failure after it asks nothing more of the same
bytes, which is the read rule unchanged. Where none answered, a newer consult that answered only in
part outranks an older failure, and a failure over other bytes says nothing about these. The writes key on
the file's real path and the doors on a root and a rel, as each already does for a consult that
answered; the judgement of what the row means is one function both call, so the four surfaces cannot
drift into four readings of one row.

**A consult nobody asked for is held under both values.** On a machine with a gateway, an advisory
reading still refuses a file no consult was asked about, a door included where the same call also
carries a file whose consult failed. That is what lets the record tell a reviewer that was down from a
consult the agent skipped, and it costs one call: asked while the gateway is down, the consult fails
fast and the write goes through on the row it leaves. `FORGE_CODEX_DISABLE=1` is the third reason a
plan or criteria write goes through unread, and it is recorded on the issue in the same comment.

**Why a comment and not a record kind.** Nothing earns a status on the fact that no consult read a
plan, so a kind of the contract would be a shape nobody's rung reads. The comment is the whole of
what the rule needs: nothing a later reader sees claims a review that did not happen.
