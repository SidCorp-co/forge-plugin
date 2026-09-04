# The refusal log

Three false refusals shipped in one session — a DNS query containing `cp`, a commit message quoting
`mv`, an intent whose heredoc quoted `writeFileSync` — and every one was found by watching a command
fail. Refusing is now what writes the line, so a gate cannot opt in or forget, including the two written
before the log existed. Only refusals are logged: they are the signal a false positive leaves, and
allows would double the write sites for a question nothing is asking.

**A class of refusal is a loop, and the log can say so.** `forge hooks --rounds` counts, per
session, the refusals that stood in front of a tracker write and how many distinct writes they stood
in front of. The number is refusals per *refused* write, and it is named that in the output, because
only refusals are written down here: the writes that passed are in no denominator, so 1.0 is the
rule working and 2.0 is a run re-sending. Across this session's own 307 refusals it read 1.16, with
three on one `forge plan`; the worst row in the whole log is 6.5, from a session calling the
tracker's tool directly, which is where the write is named by the tool rather than by the command.
Two gates answering one attempt is one round, so a refusal of the same write inside a second counts
once. A true rate wants a counter where every write already passes, which is
one site in the transport rather than the many the rule in [one transport](one-transport.md) rejected.

**It is a file on disk, so it never holds a credential.** Named secret flags, `Authorization` and
`Bearer` values, and the shapes that read as a secret on sight — a Coolify `7|…` token, a JWT,
`sk-`/`ghp_` — are masked, then the line is cut at 220 characters. An hour before this was written, a
Coolify token reached a session transcript through a redaction that missed one nesting level. A zone id
and a hostname survive, because those are what the log is read for. A failed write is silent here: a
hook's stderr is protocol, and a full disk must not turn a gate into noise.
