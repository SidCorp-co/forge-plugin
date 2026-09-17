## The five rules

1. **One master owns one status.** Everything this session claims stands at `developed` and nothing
   else does. That is what keeps it from ever contending with the run that put an issue there, and
   it is the property the whole shape rests on rather than a narrowing of the fight.
2. **The queue is re-read, never snapshotted.** Ask again after each issue. An issue that arrives
   mid-pass is taken in the same pass, and what a read says at the moment of asking is what decides
   whether the run is over — not a count taken at the start and not a timer.
3. **Nothing here waits.** The re-read happens after a unit of work, which is an event this session
   already has. A queue with nothing left in it ends the session; it is not watched for a refill.
4. **This session judges; it does not build and it does not land.** A finding that blocks returns the
   issue to a building run by moving its status, which is a fresh dispatch and not a resumption of
   the run that wrote the code.
5. **Its verdicts are its own.** It claims under an id of its own and reads the deployment identity
   back for itself rather than taking the building run's word for it. A verdict written under an
   inherited id proves nothing about who judged it.
