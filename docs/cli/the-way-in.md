# The way in

Dispatch is by own-property, not truthiness: a mistyped verb naming a prototype member ran it and
exited 0 with no output. A dropped socket is caught, because an unhandled rejection reads as a bug in
this CLI rather than a network that is down.

The tracker's write-time rules are carried in the binary rather than fetched: a guide costs 3–6 KB,
and paying that lecture for a typo cost more bytes than `forge -h` itself. They print on
`-h --full`, because ten lines went into every transcript that only asked what to type.

`-h` answered on four of seventeen verbs. The others read it as their own argument — a filename to
open, a uuid, a tool name — and three resolved project scope before parsing anything, so the one
command that says what to type was the one a caller could not run. It is intercepted before the verb
now, and a verb documenting actions of its own says so rather than being overridden. Help is an
answer, so it goes to stdout: on stderr, `forge -h | head` printed nothing and every caller learned
to write `2>&1` first.

## Which copy the call reaches

`~/.local/bin/forge` is one file for the machine. It was a symlink each session's start wrote to its
own plugin root, so the last session to start took every other session's calls: for two days every
project on this machine ran one checkout, and later two sessions on two copies of the plugin flipped
it at each other's every start (FB-430). It is now a dispatcher the start writes instead, a script
naming no session: it runs the root in `FORGE_PLUGIN_ROOT`, which each session's start writes into
that session's own environment (`CLAUDE_ENV_FILE`), and outside any session the newest installed copy
it was written with. A copy loaded by path is never that fallback, since every other caller would run
it; with no install at all, a call outside a session is refused by name, as is a root that holds no
copy. A release before this one replaces a link and leaves any other file alone, so once a start of
this release has written the dispatcher an older session's start no longer moves it: it says the file
is not its own, and its typed `forge` runs the installed copy. `forge doctor` reads the copy a typed
`forge` reaches off that file and the environment, on the row it labels "dispatcher on PATH".

The dispatcher hands the call to that copy's chooser, which picks per call — the checkout the working
directory sits in, else the copy the calling session was started with by path (`--plugin-dir`, read
off `FORGE_PLUGIN_ROOT` or that Claude Code process's command line), else the newest installed copy
the record resolves to — so the answer changes with `cd` and the report has to answer for a directory
rather than for the machine, on the row it labels "copy a call runs". A call that names a copy by its own
path still runs that copy: the probe of a worktree, the suite's own spawns and the bundled
`vi-natural` all mean the copy they name, and a caller who typed a path was not asking.

The flow's verbs are the exception to the working directory, and the reason is who judges what they
write. A record is read by the tracker's contract and moved by the landing, and both answer to the
installed release, so a worktree cut a few releases ago that answered `forge claim` itself wrote and
read records under rules nobody was still serving: a route released that morning was refused by a
run whose branch predated it. So a flow verb arriving through the link runs the installed copy
wherever it is typed, and every other verb keeps the checkout's, because those are the ones a change
is probed with. Which verbs are the flow's is declared once, beside the chooser that reads it. A run
whose change is to a flow verb is told so on the call, since the answer it just read is not its own
code's, and it probes its own through the checkout's wrapper by path, which is the case above.

The gates ask the same chooser for a different file, so `forge doctor` gives them their own line
rather than sharing one, as it does the flow's verbs. The answers are usually the same and the case that matters is when they are
not: an install holding one entry and not the other picks a different copy for each, and nothing else
on that report would show it.
