# One primitive, or two

The five copies [the primitives](the-primitives.md) sent home were each one primitive written twice.
Two of them were not, and finding that out is the harder half of the same job: a second declaration
that *looks* like drift can be the other reader, and unifying it silently narrows what a checker
sees. Both are markdown spans, both were found by ISS-138, and each is decided here rather than
tidied.

## The span that admits nothing, and the span that admits an empty one

ISS-101 unified the *stripping* span and deliberately left the *capturing* one alone, because `+`
against the shared `*` is the empty span and unifying them would have added `""` to the set of repo
claims. That reasoning is about the one pattern; it says nothing about the copies of the capturing
form itself, which stood at three — the claims checker's, the tracker's token reader's, the ranking
verb's path reader's — plus a fourth spelled inside a longer pattern, and none of them could reach
another. No needle watched any of it, so the set surfaced only when a run went looking (ISS-138).

Both live in the home now, one character apart, and the character is the decision. The strip form
admits the empty span because ` `` ` is markup and removing it is the job. A masker cannot take that
form: on a double-backtick span it matches the two delimiter pairs and hands the model the content
between them bare, which is exactly what `vi-natural`'s `protectInline` is spent to prevent. So the
non-empty form is not a narrower strip form, it is the other reader, and the two are declared off one
character class so the class cannot drift on one side.

**The `vi-natural` copy needed no new rule.** Whether that CLI may reach `plugin/src/markdown.mjs`
was decided by ISS-277 and is recorded in [the primitives](the-primitives.md) and in `README.md`'s
Layout section: downward only, and what would reverse it. The guard's scan has reached that tree
since ISS-295. So nothing here widened, and nothing here was owed a boundary decision. What was
missing was needles: the tree held two shapes no listed one spelled.

**The link target came back as two primitives, not one.** `vi-natural`'s copy was the only one in the
tree without the closing paren, and the plain reading was that it had lost it. It had not, or at
least it should not: that reader compares a translation against its source rather than parsing a
link, and `[label](url "title")` is a valid link the closed form reads no target from at all — so
under the closed form a rewritten `url` there goes unreported. Neither form dominates, which is why
the divergence had to be *decided* rather than tidied: the closed form catches a translation that
dropped a paren, the opener's catches a target rewritten where the link never closed on it. The call
site broke the tie. `protectInline` runs before translation and `restoreInline` after, so the
verifier only ever sees text whose code spans are already sentinels, and the input the two forms
judge differently is a titled link — common — rather than malformed prose — rare. The verifier keeps
the opener's target, and it is named for what it reads instead of being the closed form minus a
byte, which is the same move `wantsHelp` and `isHelpWord` made above.

The needle is the opener's string, which is a literal prefix of the closed one, so one row watches
both spellings. That is what the old row could not do: it held the closed form whole, and the one
copy in the tree that had lost the paren was invisible to it.

**One row of the table is not a reader's own difference.** `plugin/src/rank/eligible.mjs` still holds
a live copy, byte for byte, and ISS-138 could not take it because another run held that tree. It is
excluded by path like the two readings above it and for an entirely different reason — a debt with an
owner rather than a permanent carve-out — so the list is its own, and ISS-421 removes the row with
the copy. An exclusion that outlives its issue is the copy going unwatched again, which is the
condition this whole file exists to describe.
