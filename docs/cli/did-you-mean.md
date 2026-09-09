# "did you mean"

An agent's mistakes are not a human's: it does not fat-finger adjacent keys, it recalls a name from the
wrong shape — a dot where the server wants an underscore, a singular for a plural. So matching is on the
separator-stripped form and containment counts as much as edit distance, which puts a name differing
only by separator ahead of everything.

**A synonym is read before distance is measured.** A run types the verb it remembers for the thing
it wants, and meaning is not something edit distance can reach: `get` is two edits from `new` and no
distance at all from the verb it means. So a small table beside the names takes a synonym to the one
live verb it stands for, and it answers alone — a second name beside it is the guess the table was
added to spend. It answers wherever the name it means is among the candidates, which is not a
confinement to verbs and is not meant to be: `forge attach get` means `forge attach issue`, and
`issue` is the right answer there too. Where the set holds no such name — a flag, a kind, a slug —
the given word is ranked as it always was, and a verb this credential may not see is no more
suggestible than before. A retired name is never a key in it. A CLI that knows an old name is
exactly the redirect [withholding a verb](withholding-a-verb.md) forbids, and the table is not the
place that route comes back. The rows, and both rules over them, are held by the case beside the
helper.

**One sentence, and every name goes through it.** What was given, the nearest names, and the set where
the set is short enough to read at a glance. The third clause is what saves the round: a caller shown
three names spends no turn asking which three, and a caller shown thirty reads a list instead of a
sentence, so past the threshold the route to the set is what fits. That route is said where nothing
matched and the set is too long to name — beside the set itself, or beside a nearest name, it is a
clause spent on nothing, because a caller one retype from the name they meant is not browsing the set.
A set that repeats the suggestion it just made is not said either. And a refusal writing its own set
beside the helper's is two copies of one list, the second of which is the one that goes stale.

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

**A name the parser has already bound is refused, and `pullRepeated` is the only thing that says otherwise.**
Two readings are available for `--set a=1 --set a=2`: keep one and drop the other, or hand the verb
both. Keeping one is the reading no caller can have meant, and until ISS-930 it was the one the
parser made silently — the reply then described the value that survived, so a caller who asked for
three fields read a success naming one and had no line anywhere saying the other two were dropped.
It cost more than a re-run on the verb where a recorded override leaves a correction, because that
correction is the durable trace of the call: it named the surviving field under a reason written for
three, which is true about what happened and misleading about what was asked, and no later reader
can tell those two apart. So the refusal names **both** values rather than the survivor, since a
caller shown only what was kept cannot see which of their arguments the parser threw away, and it
says nothing was sent, because a flag given twice is one question asked twice and neither answer is
better than the other. A repeated **boolean** is not refused: binding `true` a second time loses no
value, and refusing it would spend a round on a call that meant exactly what it did.

The other reading is a declaration and not a default. A verb whose flag accumulates pulls it out with
`pullRepeated` before handing the rest to the parser, which is the one place in the tree that says a
flag may repeat — there is no second list, no `many` table beside the parser and nothing to keep in
step with the usage row. So reading a verb tells you which of its flags accumulate without reading
the parser, and a verb that meant to accumulate and forgot gets a refusal rather than a drop, which
is the failure this way round is chosen for.

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

The parser itself, the verbs that parse their own flags, and the check that would hold every source line
to the sentence above are ISS-227's; until it lands, this rule is held by cases and not by a checker, so
a new refusal can still be written in its own words without anything going red.
