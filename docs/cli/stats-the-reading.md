# `stats daily` — the models' reading of a day's page

What the page holds and why every figure on it is another reader's: [`stats.md`](stats.md). What
each role does and how it is configured: `forge stats daily -h`.

## Why a model reads the page at all

**The figures judge nothing, and a person wanted to know which to act on.** Code surfaces only the
patterns it was written to find, so weighing them against each other was left to whoever opened the
page, and in practice nobody did.

**Three roles, because one reading of a whole page weighs what it happened to notice.** Explore
proposes per section, review keeps what that section's own figures support, and one judge per page
weighs the survivors against each other.

**A model points at a figure and never restates it.** It cites a figure by its key in the gathered
content, so a number on the Decisions block is the page's own; a reading citing a key, an issue or a
command the page does not hold is dropped and counted in the open. A judge that invents is visible
rather than trusted.

**The call is not a consult.** It reviews no code, so its cost belongs in the page's footer and not
in the log every consult figure is read from. The figures never wait on it.

## What a decision is

**A decision is something one command of this CLI carries out, and code writes that command.** The
owner asked for decisions and nothing else, and a prompt asking for commands still returned advice
("evaluate", "leave alone") and bare verbs a reader had to finish. So the judge names fields — the
issue and the priority to raise it to, or a filing's title, cause and category — and code composes
the command from fields it checked, quoting each for a POSIX shell. An item naming no action a command
carries out is dropped and counted; leaving a movement alone, dropping an issue and reverting a
release are carried out by no one command, so they are not decisions here.

**A filing an open issue already covers is a comment on that issue.** The judge is shown the open
issue each finding matches and each offered issue's status and priority, so it can raise rather than
file; a filing that still matches goes to the owner as a comment. The body of a new filing is the
reader's: `forge new` refuses a body without its category's sections, and the page says so.

**Better or worse cites the baseline it moved against.** A verdict is a claim about a movement, so it
is kept only beside a figure of its own section that the page computed as a comparison window; a
trend's earlier day is one day and not a window. A section with no such figure reads steady or has
no verdict, and code rather than the prompt holds that line.
