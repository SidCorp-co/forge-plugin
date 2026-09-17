## Repairing forward, including through a new commit

Most repairs are not a switch you flip. The common case — and the one a method written from
imagination leaves out — is that the fix is code that does not exist yet. That case is inside this
release job, not handed away from it:

**Land the fix. Promote it. Deploy it. Verify it.** Four steps, in that order, all within the run you
are already in. The release is not finished and nothing else is waiting on your handover; a fix
pushed to somebody else at this point is a release left half done with a person owed an explanation
nobody wrote.

Then re-read the world, as after any action. A fix that landed and was never observed is a claim, and
the account may not carry it as anything else.

**Read the log; do not tail it.** A blind quotation of the last lines of a build log is not an
explanation — it is an admission that nobody looked. Open the log, find where the behaviour changes,
and quote the part you chose, saying why that part and not another. A run that cannot point at a line
has not diagnosed anything and should say so at the grade that admits it.

**One change at a time.** Two repairs applied together leave you unable to say which one worked, and
the account then carries a cause that was never established. Where both are genuinely needed, apply
them in an order and read between them.
