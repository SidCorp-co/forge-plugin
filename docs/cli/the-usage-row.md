# the usage row

A verb declares the flags it takes in one place, and it is the place the caller was already shown.
What that buys, and every refusal composed from it: the matching that answers a name nobody has is
["did you mean"](did-you-mean.md).

**A verb's flags are read off the row its own help prints.** They are declared nowhere else, the way
that row already decides whether a verb takes a value at all: a second list beside the parser is a copy
that drifts, and the row is what the caller was shown. The check runs before the parser asks what value
a token was given, because *given no value* said of a flag nobody has names a mistake the caller did not
make; and it runs before an endpoint is resolved, because a local slip should cost no credential and no
call. Where a path or another positional stands, a token opening with `--` is read as a flag and refused
by name rather than opened as a file, so a path whose own name opens that way is passed as `./--name`,
which is what every other CLI asks for too. A **value** slot reads it the other way about: the shell has
already bound that argument to its flag, so whatever it opens with is the value, and only a bare flag
word — two dashes with no space in it — is still read as the next flag. A record whose
sentence has to name a flag first is the case that settles it. Where the value is that one word and
nothing else it is still refused, and the refusal names the token it read rather than the consequence,
because *given no value* said of a value sitting quoted in the same argument names a mistake the caller
did not make either. Where the candidates are a set the tracker owns — a filter, a rank, a guide slug,
a tool name — the live read stays where it is and the refusal waits for it.

**And a verb with more than one call has more than one row.** `forge issue` reads a list against one
usage text and one issue against another; `forge chatgpt` parses four. The set the parser is holding
is then that call's and never the verb's, so *no such flag* is false — and the caller who asked
`--fields` of one issue a moment earlier can see it is false, which teaches them nothing except that
the refusal is unreliable. What they are owed instead is where the flag does live, so the refusal
names it as another call's and carries the one command that reaches it there. That command is
composed at the moment of the refusal from the other call's own usage text, its first line up to the
first optional argument and then the group or row declaring the flag, appended only where that head
does not already name it: a reach line written out beside each usage would be the second copy this
whole page exists to avoid, and one naming a required flag twice would be a line this parser itself
refuses. Only *which* calls a verb has is declared, at each call site, beside the usage it is already
handing over.

**A name the parser has already bound is refused, and `pullRepeated` is the only thing that says
otherwise.** Keeping one of `--set a=1 --set a=2` and dropping the other is the reading no caller can
have meant, and until ISS-930 it was the one the parser made silently. The reply then described the
survivor, so a caller who asked for three fields read a success naming one. It cost more than a
re-run where a recorded override leaves a correction, because that correction is the durable trace of
the call: it named the surviving field under a reason written for three, which is true about what
happened and misleading about what was asked. So the refusal names **both** values rather than the
survivor — a caller shown only what was kept cannot see which of their arguments was thrown away —
and it says nothing was sent, a flag given twice being one question asked twice with neither answer
better. A repeated **boolean** is not refused: a second `true` loses no value.

Accumulating is a declaration and not a default: a verb whose flag accumulates pulls it out with
`pullRepeated` first, and that call is the one place in the tree saying a flag may repeat. No second
list, no `many` table beside the parser, nothing to keep in step with the usage row — so reading a
verb tells you which of its flags accumulate, and one that meant to accumulate and forgot is refused
rather than silently dropping a value.

**Anything that puts a flag in front of a caller's own argv has made a repeat**, and that is where
the rule bites rather than on anything a caller types. `blocksIn` gives every block of a `record`
write the flags shared before the first key, and a block's own value of a single flag *replaces* the
shared one, so the shared occurrence comes out for exactly the flags the block names — while a flag
named twice inside one block is still a caller asking twice and is still refused. Removing a pair is
not skipping it: the shared occurrence is refused for a missing value first, or a replacement would
erase a syntax error before the parser saw it. A test helper prepending a flag is the same shape, and
the case that writes that flag itself calls a helper that does not. Neither is answered by softening
the parser, which cannot know which occurrence is the replacement.

**The other wrong call a body slot takes is the body itself.** An agent holding the text in context
writes it where the path goes, and until ISS-842 nothing between that argument and `open` judged it:
the answer came from `fs` and named a file the caller never meant to open. So the read decides first,
on what a caller can act on rather than on a guess — a value carrying a newline, or whitespace with
no path separator and nothing readable at that name — which leaves a path genuinely meant and
genuinely missing to be reported as missing, and leaves a one-word body there with it. The refusal
then carries the caller's own call twice, once through a file and once through stdin, built by
filling that slot in the argument list they typed, so the reference and the flags come back with it
and nothing is retyped from memory. Which argument is the slot is the parser's own question and gets
the parser's own answer: the occurrence no flag word owns, so a flag handed the same string as the
body keeps its value and only the body is replaced — or the only occurrence there is, since a body a
flag takes is owned by that flag and is still what a caller has to change. Three calls get the
shapes and no command at all: one where two arguments could equally be the slot, since a command
that replaces the wrong one costs the round it was printed to save; one where the value repeats and
every occurrence is some flag's; and one read with no call of this CLI's own around it, where a
command assembled from the argument list of whatever embedded the read would be fiction.

**A printed form is never one the next call turns away.** The reader the plan and criteria verbs
pass a path to first stats it and raises, so it asks the same question before `stat` does and those
two answer in the same sentence as the rest — but that reader refuses a pipe, because a consult is
shown a path. So it asks for the file form alone and says why, rather than printing a stdin line the
gate that just refused would refuse again. It also reads existence against the directory *it*
resolves against, which is not always the one the process stands in.

A flag accepted and named nowhere is declared beside the verb that takes it rather than on its row.
[Withholding a verb](withholding-a-verb.md) is the reason for the two only a maintainer can act on, and
`new` declares two more so that the retired flags for a kind and for a complexity reach the refusal that
names this CLI's flag instead. No suggestion may offer any of them: a refusal naming a flag its caller
may not act on has leaked the thing that rule keeps off every other surface.

One sentence above has a checker now: `plugin/src/checks/surface/judged-arguments.mjs` refuses an
argument whose values this CLI declares and whose verb spends no judge on it before the call, with
`refuseUndeclared` as that sentence. The rest of this page is held by cases alone.
