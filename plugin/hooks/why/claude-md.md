# claude-md — a claim is read as fact, and rots in silence

CLAUDE.md is loaded into every session this repository opens. A path it names that was renamed, a
script that lost its entry, a `-h` nobody wired: each is read as fact by an agent with no reason to
doubt it, and none of them fails loudly. `forge doctor` has checked these for a while, and that is
the wrong moment — doctor is run when someone suspects something, and nobody suspects a sentence they
just wrote.

So the check moved to where the claim is made. It is `PostToolUse`, beside `code-quality`, because
both answer for a file a call has just written and both need the written bytes rather than the
intent. It reads `checkClaims` from `src/claude-md.mjs` — the same function doctor reports from, in
doctor's own words, because two messages for one rule diverge at the first correction.

**It answers for the write, not for the file's history.** The baseline is `git show HEAD:CLAUDE.md`:
a claim already broken in the committed file is not this write's doing, and reporting it would refuse
the edit that fixes it — which is how a gate that fires on a repository someone inherited gets
switched off in its first hour. A claim the write introduces is reported. That includes a claim the
write leaves standing while renaming what it referred to, because the pair is what broke.

Eight kinds, all settled by a command rather than by taste: a missing path, an npm script no
`package.json` holds, a `-h` a script does not handle, a tool not on PATH, an unresolvable git ref, a
file asserted absent that exists, a sha that is no ancestor of HEAD, and an identifier cited nowhere
else in the repository. The shapes that produced only false positives over 28 real CLAUDE.md files —
a CIDR block, a date mask, a bare extension — are excluded before any of this runs, and only
backticked spans and link targets count, so prose naming a file is not a claim.

**It refuses; it does not advise.** The end-of-turn reminder is the pattern that was already tried
here and ignored — `codex-turn` prints `additionalContext` and an agent can walk past it. A wrong
claim in this file costs every future session a little, silently, so it is worth one blocked write
now. The way out is in the message: correct the claim, or delete it. Deleting is a real answer — the
file the claim names is the authority, and a claim it has outlived is worse than silence.

What this does not touch: whether a rule belongs in CLAUDE.md at all, whether a guide already says
it, and whether a checker already enforces it. Those are judgements about prose, they stay in
`forge doctor` where a human is reading the output, and a gate that refuses a write over one is a
gate that gets turned off.
