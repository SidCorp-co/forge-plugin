# the precondition — what makes a lease exclusive, and how the CLI knows it is

The tracker takes `expect: { sessionContext }` on the issue's own PATCH and makes it a term in that
UPDATE's own WHERE, `IS NOT DISTINCT FROM` a jsonb parameter. It is not a read above the write —
that is the race it exists to close, and two writers that both read the same value would both pass a
check placed there. A write whose value moved is refused 409 with the value the field now holds, and
that sentence is the tracker's: this CLI passes it through and adds nothing after it, because a
second sentence in this CLI's words is a second place for it to go stale.

Both writes the lease covers carry one. **The lease's own write** carries the `sessionContext` the
run read. **The payload write that follows a renew** carries the object that renew *sent* — the copy
built in this process, and never the reply, because the transport strips the tracker's fence out of
every string of every answer it decodes and only the sent copy is certainly what the far end stored
(ISS-1219). That pair is what closes the window between the renew and the payload write.

**Support is established, never assumed.** A far end that took `expect` and ignored it would answer
a successful write exactly as an enforcing one does, so a run that read success as proof would
believe it held a lock it did not. Only a refusal answers the question, and the one call that asks
is the first lease write of the process itself, sent expecting a `sessionContext` of one key —
`forge.cas-probe`, against a uuid minted for that call. A one-key record is what the expectation
schema takes, so an enforcing far end reaches its guard rather than a validation error; the key is
this CLI's own and the uuid is minted at the call, so no field can be holding it. Four answers, and
each leaves the caller where it stood:

| Answer | What it settles | What the write does |
|---|---|---|
| `SESSION_CONTEXT_MISMATCH` | the far end enforces it | nothing was written; it is made again under the real expectation |
| `BAD_REQUEST` | nothing yet | the key is the only thing this call added, so the body goes again without it, and only a second write that *lands* says the key was the reason |
| anything else | nothing | a timeout says no more about the schema than a credential does, so no second write is made and the refusal is the caller's |
| success | the far end took the key and ignored it | it performed exactly the write this call was making, and that answer is the caller's |

The answer is the process's and is written down nowhere. A recorded one would survive the rollback
and the same-URL replacement that made it wrong, and it is the positive that would then suppress
both the asking and the read-back while writes went out unconditional. Asking again costs one
refused write per process, which the read-back every later lease write no longer spends pays back.

Where the far end enforces it, the lease's own read-back is not spent: that compare *was* the
compare-and-set, and two mechanisms for one guarantee is a precedence rule. The read-back on `plan`,
`acceptanceCriteria` and `releaseNotes` stays either way — it answers whether the text landed, which
is a different question and no precondition replaces it.

What `expect` cannot do is separate two writers holding one holder string: they agree on the value
and both writes are legitimate to the tracker (ISS-467).
