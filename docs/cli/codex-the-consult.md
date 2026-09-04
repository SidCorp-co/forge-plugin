# codex — the consult

**No local agent.** The first engine spawned a `claude` session with `--allowedTools Read Grep Glob`;
that flag auto-approves and does not confine, so the child inherited this machine's skills, answered a
review prompt by running a multi-agent review skill, and had to be killed by pid after eleven minutes.
The one exception since is `codex.check`: a command the *checkout* names in `.forge.json`, run at most
once per consult under a clock, exit code and tail returned. "The tests pass" was the claim every review
said it could not verify; a fixed command it did not choose is not a shell.

**What the advisor is, measured.** From a transcript: the built-in advisor forwards the whole
conversation (32,385 input tokens, no cache read, ~33 s) and its reply comes back encrypted, never
entering the transcript as plaintext. That is the number behind what the skill says about carrying
its reply into the consult.

**The diff travels, not the body.** Sending files whole *and* offering tools paid twice: two consults
spent 12 and 17 calls re-reading text already in front of them. Telling it not to re-read did not
work; sending less did — 4,381 characters against 32,233 on a two-file review, 5,266 against 59,462 on
a four-file one, same findings. `bodies` remains for a file outside any checkout.

**Calls are the only lever on wall time**, which is `calls × ~45s`, almost all of it thinking before
the first token: one timed consult was 49.5s, 39.5s of it silence. Against the same gateway a trivial
call is 1.6–2.0s and this payload with one word asked for is 6.1s, so input size is not where the
minutes go. Eleven runs over a fixture with two planted defects: given ten calls it used two on a
two-file review and four on a four-file one with three named risks, and a cap of three lost no finding
while saving a third of the time (99s against 145s). Every run found both defects at every cap from one
upward, so rounds are for *reaching* code, not for thinking longer. The last call is warned one round
early: a model told mid-answer that its tools are gone has already spent the round it would have read
in.

**Three was a constant, and it was the wrong shape.** Over 487 answered consults, 384 ended at exactly
three calls, and what a reply then said tracked the cap and not the difficulty: a clause saying the
reviewer could not check something appears in none of the 22 one-call replies, 10 of the 75 two-call
ones and 251 of the 384 three-call ones. Three is now where a consult *starts*, and the payload moves
it — a `bodies` pass holds every file it was asked about and has nothing to fetch, so it starts a call
lower; each clipped file is the one thing that reliably costs a retrieval round, so it earns one back.
`--rounds n` is still used exactly as typed.

**A review that says it could not check is not shown and then patched by the next consult.** It is one
attempt short, so it gets one more at `codex.roundsMax`, and the caller sees nothing until that one
answers. Which is why the first attempt is buffered rather than streamed: "retried before it is shown"
and a stream to stdout cannot both hold, and what streaming was actually for — telling a slow review
from a hung one — is the `call N of M` and tool lines, which print either way. The predicate is one
definition, shared by the field on the row, the retry's trigger and the stats line, and the one thing
it must never match is `CANNOT TELL`: that ruling is what the verification grammar *asks for* on a risk
the reviewer cannot decide, and retrying there buys the same answer at twice the price.

Thinking tokens come out of the same ceiling as the reply, which is why 8,000 was mostly spent before
the review began. `reasoning_effort` is a request rather than a lever — the same puzzle answers
identically at minimal and at high — and the minutes go on the reviewer's own reading, which is why
medium is the base rather than the answer. It was also the *only* level anything ran at: medium on 384
of the 393 consults that recorded one, high on four. What moves it now is the round and the size, one
step and never two, the round winning where both apply. A recheck is asked a narrower question than the
pass that raised the findings, so it steps down; a change under `codex.effortLines.small` steps down and
one over `.large` steps up, measured on the diff where the consult is anchored to one and on the bodies
where it is not.

**An open stdin is not an intent that has not arrived yet.** The consult reads its intent from
stdin, and inside a harness the shell's stdin is a pipe nobody is writing to: read to EOF, it never
returns. Two consults ran 17 and 13 minutes on 2026-09-03 and were killed by pid, which is the
largest single round a dry run has lost. What is bounded now is silence rather than the whole read —
two seconds before the first byte and between any two, ten for a payload a verb cannot proceed
without — because a producer that writes one byte and stalls is the same unbounded wait. A silence
after bytes have arrived is a refusal and never a short payload: a plan read in half would be stored
as the plan. The line naming what the consult is about to do prints before the read, so a stall says
where it is.

**Asked for a diff and given nothing, the tree answers.** `--diff` with no file named and nothing
pending answered "nothing to consult on", and what an author then did was run `git diff --name-only`
and type the list back. The names come from there now and are printed on stderr, so the review's
scope is legible without a second call. A deletion is among them, and so is an untracked file: the
diff step used to pass over a path that is not on disk, which named the file and said nothing about
it, and `git diff` never lists a file git has not been told about, which a turn's new file always
is.

**Three of the reviewer's four tools take the checkout when no path came.** `list_dir`, `git_diff`
and `grep` default to the root: 34 refusals in the log were that argument left out, and a reviewer
that meant the repository has nowhere else to mean. `read_file` keeps its path, having no such
default. And a path that is not there is answered with the entries of the nearest directory above it
that is, rather than the root's top — a leaf six levels down has siblings, and the root says nothing
about them.

**A follow-up round verifies; it does not roam.** Six rounds on one patch, each a full review, each
finding a narrower hole than the last with no signal to stop on. `--recheck` replays the previous
consult's findings as the verification list, which is the shape the reviewer is reliable in.

That was half of what stops a consult repeating itself. The other half is that 100 of 196 rechecks raised something marked
New, and each one cost the head another fix and another round — a recheck asked to confirm went looking
instead. So a recheck now anchors to the head its findings were made against, which puts the diff since
that head in front of the reviewer instead of the whole file it has to find the change in again; where
nothing differs from that head the consult runs without a diff rather than refusing, because the
findings are still owed a ruling. And its system prompt carries a clause the first pass does not: the
round exists to close findings, not open them. It does not forbid a New one — a defect the fix itself
introduced is real — it requires the bullet to name why the earlier round could not have seen it, which
is the sentence a wasted round cannot write. `newFindings` on the row is what says how often that
worked.

**Angles are the checkout's.** On this CLI three of the four wrote "nothing material" in every one of
92 consults — output paid for, and the reader skimming past the one angle that mattered. The board
stays for a product with screens; `.forge.json` names the angles that fit.
