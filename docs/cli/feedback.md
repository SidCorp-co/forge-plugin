# `feedback`

**A local folder was a second tracker, and it lost things.** Notes lived as Markdown files in the
`feedback/` of whatever checkout the CLI resolved: gitignored, with no status, no reader guaranteed,
and no way to tell the run that wrote one what became of it. In a per-issue worktree the folder was
a directory the cleanup deleted — ISS-111's note went that way on 2026-09-04, and only the run's
hand-back saved the finding. Runs in other projects wrote into this checkout's copy, and the parent
session spent part of every fold reading the folder and routing each note onto the issue that owned
it by hand. So the note is an issue from the moment it is met, and nothing is written to disk.

**The destination is held in the CLI, not read from the caller.** A note met in another repository
has to reach this plugin's backlog, so the caller's `.forge.json` says where the note came *from*
and never where it goes, and *from* is a fact in the body. The prose language rides with the
destination for the same reason: a note written from a project whose config asks for Vietnamese
belongs to this plugin's English backlog as written, and the caller's config must not decide the
target's language.

**Which project a call goes to is a second question from which project the checkout is in**, and
that is why `projectTarget()` sits beside `projectScope()` rather than inside it. Not taste: the
scope is memoised, and `cli.mjs` reads the credential's gates through it at module load — probed,
one firing per invocation, before any verb body runs — so an override folded into the scope would
have been ignored. One accessor, because the `X-Forge-Project-Slug` header, the `projectId()`
lookup, the duplicate reads and `write`'s announcement each read the slug for themselves, and a
switch in three of the four places files under one project's header into another's id.

**A duplicate refuses nothing here.** `forge new` measures overlap across a title and every
sentence of a body and refuses on a hit, leaving the caller to decide. That refusal is the one thing
this verb cannot afford: a note refused is a finding lost, and the run that met the defect has
already spent the turn writing it. So the shape read is the body-only one, and the neighbour block
under the reply is what shows the filer what the refusal would have said.

That read asks for every section, which is not the default: `forge new` short-circuits two ways — a
body marked at a rung below `feature` is read against no section, and one naming a code token with
neither rules nor an out-of-scope is offered the three routes a small change takes instead of being
refused. Both are routes a note does not have. A note is one shape, always the bug's, so the
shortcuts are switched off for it and every section is read; without that a note missing two of its
four sections filed clean.

**A note is measured the way a filing is, and folds the way one does.** Both routes that file ask
the tracker's own memory what is open beside what they are about to write, print it under the
result, and land a marked note on the neighbour that shares its place rather than filing a second
issue. The rules, the floor and the reason the fold answers to two signals instead of one are
[`beside`](beside.md)'s.

**There is no second fold on the title.** This verb used to route a note onto any open issue whose
title matched after case and spacing were normalised, before the fold above ran, on the argument
that an exact match is a thing a caller can predict where an overlap score is not. What that bought
was a rule with no reader: a title is one line of a note and the fold measures the whole of it
against the whole of a neighbour, and two runs meeting one defect write the title two ways more
often than they write it one. What it cost was a second route to remember, on the one verb whose
whole promise is that a finding reaches the backlog whatever else is true. Title equality is now a
neighbour like any other, scored with the rest (ISS-334).

**A note names the issue it belongs to with `--with`.** The keys a note's own body mentions are
listed under the reply beside that flag rather than written as edges, the same way `forge new` does
it, and for the same reason: a body cites a key as a reason as often as it names related work. A key
given on the flag is resolved after the destination is aimed at this plugin, so it names an issue of
this backlog and never one of the caller's; and a note that names one declines the fold, because a
note related to an issue is carried by that issue's flow and a fold would put it on some third one.

**It declares no backing tool, though it writes to one.** Every other verb with a tracker tool
behind it names that tool, and a credential the server refuses it to loses the verb from `-h` and
from the dispatcher. Those measurements are recorded per project — the one `forge doctor` ran in —
and this verb's project is not the one it is called from. So a `forge_issues` gate measured in
somebody else's checkout would hide exactly the verb that exists to reach past that checkout, which
is the one thing it promises. A credential that really cannot write there is refused by the tracker
instead, at the call.

**No refusal past the body's own reading loses the note.** The run has already spent the turn
writing it, and a body that arrived on stdin exists nowhere else once the process is gone — so the
verb registers it as soon as it has one, and every refusal after that prints it back: the shape
read, a tool that says no, a transport that answers 401. The reading itself is the exception, and
deliberately: a stdin that goes silent halfway is refused by the payload reader on the rule that a
payload read in half is worse than none, and half a note echoed back is not the note either. What
the trailer does not say is that nothing was written — a dropped socket on a create may have
landed, and the transport is the one that knows which, so it keeps the note and claims nothing. The
two writes are soft on top of that, which is only about the message being the tracker's own words
rather than a stack.

**No lease, and no comment-read hold either.** The lease is not taken because nothing about a note
is work on the issue it lands under. The read-before-write check every other write to an issue
passes is exempted, named in that check with its reason: a note is an observation rather than an
answer to a thread, so the thread decides nothing about it; a second run meeting the same defect
adding a comment under the same title is frequency worth having and not duplication to prevent;
and a hold delivering the thread would refuse a body that arrived on stdin, which is the body gone.
