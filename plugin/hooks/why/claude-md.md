# claude-md — a claim is read as fact, and rots in silence

CLAUDE.md is loaded into every session this repository opens. A path that was renamed, a script that
lost its entry, a `-h` nobody wired: each is read as fact by an agent with no reason to doubt it, and
none of them fails loudly. `forge doctor` checked them already, and that is the wrong moment — doctor
is run when someone suspects something, and nobody suspects a sentence they just wrote.

So the check moved to where the claim is made: `PostToolUse`, beside `code-quality`, both answering for
bytes a call has just written. It calls the same `checkClaims` doctor reports from, in doctor's own
words, because two messages for one rule diverge at the first correction.

**It answers for the write, not for the file's history.** The baseline is `git show HEAD:CLAUDE.md`: a
claim already broken in the committed file is not this write's doing, and refusing it would block the
edit that fixes it — which is how a gate that fires on an inherited repository gets switched off in its
first hour.

Eight kinds, each settled by a command rather than by taste: a missing path, an npm script no
`package.json` holds, a `-h` a script does not handle, a tool not on PATH, an unresolvable git ref, a
file asserted absent that exists, a sha that is no ancestor of HEAD, an identifier cited nowhere else.
Shapes that produced only false positives over 28 real CLAUDE.md files — a CIDR block, a date mask, a
bare extension — are excluded first, and only backticked spans and link targets count, so prose naming
a file is not a claim.

**It refuses; it does not advise.** The end-of-turn reminder is the pattern already tried here and
ignored. A wrong claim costs every future session a little, silently, so it is worth one blocked write
now. Deleting the claim is a real answer: the file it names is the authority, and a claim it has
outlived is worse than silence.

What this does not touch: whether a rule belongs in CLAUDE.md at all, whether a guide already says it,
whether a checker already enforces it. Those are judgements about prose; they stay in `forge doctor`
where a human is reading, because a gate that refuses a write over one gets turned off.
