# The drain key, and why it is not the tracker's

Two adjacent decisions, two keys, two homes. `pipelineConfig.qa` says whether the judgement between
`developed` and `testing` is an independent run's — a fact about the product, the same for every
checkout, and the tracker's. `drainedBy` says which master claims what that judgement offers, and it
is a key of the project's own file beside `flow` and `landing`.

**The split is the schema's doing rather than a preference.** The tracker's pipeline configuration
strips a key it does not declare, silently, on the way in. A live write of a drain key to that
resource on 2026-09-17 answered and read back null, which is the read-back's whole purpose and is
the one signal a caller gets. So the second key could not be stored beside the first by any call
this CLI has, and the file that already holds how this checkout is worked is where it went. If the
tracker ever declares the key, the home moves and the row's source line moves with it — the reading
is one module's.

**Two keys for adjacent decisions cost an undo, and that is paid rather than argued away.** The
write that moves the judgement off `independent` clears the drain key in the same call, and proves
it can rewrite that file before the tracker is sent anything: a judgement that landed over a file
this could not have cleared leaves exactly the orphan the pair exists to prevent. Where the file
fails after the tracker has kept the judgement, the refusal names what stands and the call that
settles it, which is the same call sent again. A write that moves no judgement leaves the key
standing, since selecting a flow that asks for nothing is not an undo of a declaration it never
touched.

**A declaration stands another master down only while the rows bear it out.** The key subtracts a
worker from a queue on the strength of a name, and nothing about a name says whether the master it
names is running: a declared QA master with no pane and no process held four rows at `developed` for a
whole session while the master that could have judged them read that they were not its own. So the
declaration is checked where it subtracts, against the rows standing at that status, and holds only
on positive evidence — another session's live lease on one of them, a claim another session recorded
at that status inside the window, or an oldest offered row written inside it. The asking session's
own lease and claims are its own work and say nothing about another master. An empty offer is no
evidence either way: no row, and rows that are all the asking session's, leave the declaration
unchecked, and unchecked fails toward the work being done. A read the window or the listing cut short holds
nothing whatever its front showed, the rows behind it being exactly the ones nobody saw anybody take.

**The evidence is the queue's because nothing else names a master.** The tracker's runner rows carry
no role, and a lease carries a session id and an agent string; neither says `dispatcher` or
`qa-master`. A live lease or a recent claim on the queue is therefore the most any reader can know,
and it is the standard the key is held to rather than a proxy for a better one.

**The window is the project's, one lease's span by default.** `rank.drainIdle` is the minutes a row
may stand with nothing on it before the declared master is read as not draining. Sixty is the span a
lease runs between writes, past which a live judging run has either taken the row or let a lease lapse
on it. A project that judges slower sets its own number; a value of no minutes, or of part of one, is
refused, since it declares every master absent the moment a row lands.

**An absent key, and a value the pair does not take, name no master.** A project that declared
nothing has declared nothing, and resolving it to the dispatcher told every QA master to stand down on
an arrangement nobody made. A misspelled value is the same absence with a typo on it, so the queue says
no master is declared and any master that reads it takes the rows, and the resolution report prints a
`miss` until the key is put right. The lease is what keeps two masters off one row, which makes the
cost of a missing declaration contention and never double work, where the cost of a false one is a
queue nobody works. The report prints another `miss` for the combination the configuration can express
and the flow cannot mean — a master named while the judgement is not `independent`, which offers
nothing at that status for anything to drain.

**The key decides who is dispatched and never whether an issue is offered.** The judging section of
the ranked order turns on the judgement alone and keeps doing so; the declared master is printed
beside those rows so a wave and a QA master each read at the queue whether the set in front of them
is theirs. Folding the two questions into one key would make the undo of either the undo of both,
which is the shape this repository refuses everywhere else.
