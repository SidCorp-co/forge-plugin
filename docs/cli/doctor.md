# doctor

Every other verb fails at the first missing piece. Doctor reports all of them together, because "no
credentials" and "credentials from the wrong file" look identical from inside one failing command.

**It withholds values by default.** Its output lands in an agent's context, and an agent never types a
token, a project id or a path. A fragment of a credential is still a credential once it is in a
transcript. `--full` is for the human holding two tokens who needs to know which is which.

**A probe is paid for once.** All 67 tools are declared to a PAT and `forge_project_pm` then refuses
all six of its actions, so what a probe learned is written down, keyed by project and dated, and
listings mark a gated tool without paying for a probe of their own.

**CLAUDE.md's claims, calibrated over 28 real files** in this tree rather than over one. The absence
claim — "there is no `backend/.env` and there must not be one" — is why direction matters: read the
other way round, a checker reports the required state as the defect. Three of those projects state the
identifier rule themselves, so that check is theirs. Only backticked spans and link targets count; a
placeholder, glob, package name, url, CIDR block, date mask, bare extension, git ref and build
directory are each excluded because each produced a false positive on that corpus. A path whose
basename exists elsewhere is *stale* rather than missing, and prints as one note with a count — 102
occurrences across the corpus is worth a line, not a list.

**Structure is measured against the published rules, not taste.** The 200-line target and a resolving
`@path` import are mechanical and gate; emphasis dilution, vague words and coverage are notes, because
each is a reading. Nine of the 28 files had every bullet bold-led — one was 25 of 25 — so dilution is
flagged above 80% of at least 8 bullets. A word quoted as an anti-pattern is not a finding: one project
lists those exact words as signals of unfinished thinking, and meant it.

Structure and claims read the tree and nothing else, so they run before the endpoint: a project with no
Forge slug still gets its CLAUDE.md checked, anchored at the `.forge.json` directory rather than by
walking up — an unbounded walk-up eventually reaches `~/.claude/CLAUDE.md` and reviews the user's global
file against a project's guides.

**A rule a checker already states is noted where CLAUDE.md explains it too.** Only backticked
hyphenated names count, against names a checker declares as a literal, so a rule that derives its name
from its filename is missed and a stray string cannot invent one. **And the guides are the authority**,
the project file the copy: a rule stated in both diverges the first time someone corrects only the one
they found, silently, because each still reads as correct alone. The overlap measure is the one the
duplicate-comment rule uses, at 0.25 over a floor of 3 rather than 0.34 over 5 — two documents state
one rule in their own vocabularies, and over those 28 files 0.34/5 finds nothing while 0.25/3 finds
seven pairs, every one a real restatement.

A pair is reported, never classified: negation is a stop word, so a restatement and a flat contradiction
score alike. That is why an overlap is a note and cannot fail doctor — a check that stays red until
somebody edits prose gets switched off. A project may override a guide but not fork one by accident, so
the waiver names the guide and gives a reason, and one naming a guide that does not exist fails, because
that is mechanical. A global guide whose body calls a foreign MCP namespace is a finding against the
guide, and a note, since nobody can fix it from the checkout.

**It exits non-zero when it printed a `miss` and never for a `note`.** So the level is a judgement
about whose the finding is rather than about how bad it looks: a credential no verb here waits on, a
branch on the tracker's own project, a tool the server gates against this token and prose nobody can
classify are notes, and each still names its route out. Nine lines once said `miss` and failed
nothing, which is a report that teaches a caller to read neither half (ISS-102).

Writes translate before they post, so a missing `vi-natural` key is a miss exactly where the project
declares the language that waits on it. The gateway url and model are read beside the key, because a
saved key alone is configuration that looks complete and dies at the first call.

**And it names the copy a call from here would run, and the copy the gates come from** — two lines
rather than one, because the case that matters is when they disagree: [the way in](the-way-in.md).

## One verb reports every level, so the project is a level of it

There were two verbs where there is now one, and each carried a partial view of what the other
already answered, under its own wording. A reader holding two answers
to *what is configured here* has a precedence question nobody wrote down, and the second view drifted
from the first twice. So the project's own record is a level of this report, under the names its owner
uses rather than the tracker's columns, and the name `project` went to the thing that had no verb at
all — the projects themselves, which are the one resource no checkout scopes.

**A key is written through the route of the resource that holds it, and read back off that route
before it reports set.** The two resources merge per key; the whole-`agentConfig` patch beside them
replaces the document, so two writers to different keys of it lose each other's. And the pipeline
schema *strips a key it does not declare*, silently, on the way in — so a write that answered 200 and
kept nothing would print as a setting that took. The read-back is what turns that into a refusal
naming the key, which is the only place an operator can learn it.

A bare key belongs to whichever resource already answered with it, and a key neither holds is refused
with both key sets rather than guessed at: a typo landing in the facts as a new guide is a write
nobody asked for and there is no delete for it. `pipeline.<k>` and `fact.<k>` name one outright, which
is how a key the project has not got yet is created.

## Two lines Phase 0 reads before it plans a landing

**Where the merge sits is derived, not asked for.** The project already told the tracker whether its
default branch deploys production on its own, and that is the fact that decides it: one branch
deploying production means a push *is* the deploy, so a candidate is deployed and judged before it is
pushed; distinct branches mean the merge lands on staging and is judged there. A record answering
neither branch prints *not stated* rather than the safer-looking route, because a run told
*after-merge* by a default would deploy production without knowing it. The `landing` key in a
checkout overrides the derivation and prints its own source, so a project that disagrees with what
its record implies says so once, where a reader can see both.

**Whether an independent agent judges between `developed` and `tested` is the record's alone.** A
project has one tracker record and many checkouts, and QA belongs with the deploy facts rather than
beside them; read from a checkout instead, two clones of one project would judge the same change
differently. So a `qa` key in a `.forge.json` has no effect on this line, which prints
*not stated* until the record itself answers. This report says so at the point where there is still
time to change the record, and not at the transition that would later turn it down.

The test credentials the deploy lines withhold, and the guard that keeps them out of every payload:
[the test credentials](test-credentials.md). The brief this report also writes — why `--refresh` takes
the answer it is meant to produce, which files a digest covers, and what a store that will not answer
is not: [the brief](the-brief.md).
