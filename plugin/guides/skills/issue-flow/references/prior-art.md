# Where this workflow came from

Read this when changing the workflow, so a change is a decision rather than a drift.

## Contributing projects

**[GitHub Agentic Workflows](https://github.com/githubnext/gh-aw)** — agent jobs run
sandboxed and read-only by default; anything that writes goes through a separate, validated
step.
*Taken:* the propose/apply split — Rule 4, autonomy ending at the outward-facing step.
*Rejected:* the YAML workflow compiler. This is a method a session follows, not a job a CI
runner compiles.

**[SWE-agent](https://github.com/SWE-agent/SWE-agent)** and
**[OpenHands](https://github.com/OpenHands/OpenHands)** — localize, reproduce, edit, then
validate by execution, with a quality gate discarding trajectories whose reasoning was never
confirmed by a run.
*Taken:* Rules 1 and 2, and Phase 5's insistence that a claim without a run is not a result.
*Rejected:* the reproduction-script-first loop, which suits a bug report with a stack trace
rather than a product change request.

**[spec-kit](https://github.com/github/spec-kit)** — specify, plan, tasks, implement, every
phase anchored to a short constitution of non-negotiables.
*Taken:* the phase spine, and the idea that a handful of rules outrank the steps.
*Rejected:* local spec files. Here the tracker holds the plan, because the tracker is what
the next person reads.

## The global/local split

The problem: a workflow worth reusing must not know one project's facts, yet cannot work
without them.

**[Anthropic's Agent Skills format](https://agentskills.io/home)** — progressive disclosure.
That is where `SKILL.md`'s rule about its own spine comes from: a reference nobody reaches
costs nothing, so the cheapest place for detail is behind a citation. It bounds the spine by
what each phase cites, not by a line count — phases differ in length because they differ in
how much they owe.

**[OpenHands repository agents](https://docs.openhands.dev/overview/skills)** keep repository
knowledge in the repository, separate from the reusable skill.
**[Cursor rules](https://cursor.com/docs/rules)** make activation scoping explicit — the
lesson being that "always loaded" is a budget to spend sparingly.
**[AGENTS.md](https://agents.md/)** turned the repository-side half into a cross-tool
standard rather than one vendor's private file.

*Taken:* method in the skill, knowledge in the repository, and a discovery contract naming
where to look — `forge guide issue-flow project-discovery`.
*Rejected:* a bespoke per-project file only this skill understands, which would recreate the
fragmentation the standard exists to end.

**The entry point is `CLAUDE.md`.** AGENTS.md is the broader standard and nothing here
depends on which name a repository picks — a one-line `CLAUDE.md` reading `@AGENTS.md` makes
them the same file. The contract follows the pointer either way.

**The rules-not-facts doctrine came from two repositories this author also maintains** —
first-party case studies, not independent validation. Their root files declare "facts live
in the code, history lives in git", forbid hard-coded ids, slugs, tokens, hosts and ports,
refuse to recite the commands their gate script owns, and push a recurring trap down into
the checker that prevents it. That is where the doctrine is drawn from and how far the
evidence goes: it is a design choice that has worked in two repositories, stated as a
choice, and `forge guide issue-flow project-discovery` says explicitly that a project which decided
otherwise wins.

**Rule 5 — learn selectively — has no external source.** It came from this workflow's own
first rounds, where the failure was the opposite of forgetting: enough was written down
that nothing was read, and one reference transcribed an API's payload shapes that the
tool's own `-h` already documented and had since fixed. `forge guide issue-flow learning` is the
correction, and pruning is half of it.
