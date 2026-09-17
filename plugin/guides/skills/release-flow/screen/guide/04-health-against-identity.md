## Health against identity

Two observations, never one. **Health** is whether the thing answers correctly where it runs.
**Identity** is which build it is answering as. One playbook for both sends the repair at the wrong
layer, which is the most expensive mistake available here.

- **Health green, identity green.** Nothing is wrong that these two readings can see. Say which two
  readings that was.
- **Health red, identity green.** A runtime fault on the build you meant to ship. The application is
  what it should be and does not work: look at what it depends on, what it was given, and what it
  says in its own log.
- **Health green, identity red.** Usually not the application at all. Routing, a cache, or a rollout
  that started and did not finish — something is serving an answer from somewhere other than where
  you think you are looking. Repairing the application here fixes nothing, twice.
- **Health red, identity red.** The release did not arrive. Establish that before diagnosing anything
  about behaviour: an application that was never deployed cannot be debugged.

**Reading production's identity is not a decision.** Capturing what production reports and carrying
on is the failure this section exists to stop, because a journey that would also have passed on last
week's build leads to an announcement and a close. Before any success path continues, decide —
explicitly, and say so in the account — whether production serves the release that landed. An
identity that is stale or unrelated stops the release path; it does not lower a verdict.

That decision is not literal equality with the identity staging reported. The two layers can carry
different identities for reasons that are nobody's fault, and which one answers *running where it
landed* depends on the route:

- **The landing deploys straight to production.** The deployment that answers is the one the landing
  itself built, and its identity is the landed change's.
- **Production is a separate branch, promoted to.** The deployment that answers is the one the
  promotion built. A green reading of the staging deployment says nothing about this rung: it was
  already read, by somebody else, for something else.

**A judgement of the change is not a reading of the deployment.** Somebody judged each criterion
before this run began, against whatever they were pointed at, and that work stands. What is owed here
is that the code is out and running where it landed — which no judgement of the change can say,
however green it was. A release announced on judgements alone is a release nobody looked at.
