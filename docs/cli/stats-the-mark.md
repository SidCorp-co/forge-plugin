# `stats` — the mark a reading is pinned at, and what reads it back

**A comparison nobody took at the crossing could not be taken afterwards.** The pair of windows a
mark named was gone once more runs landed, so two readings a day apart compared different pairs and
the question "what did the release at fifty runs actually cost" had no answer. The reading is
written at the crossing instead, and `--against` puts it back where the sliding window would stand.
The eval itself, and what a cost figure is: [`stats-the-eval.md`](stats-the-eval.md).

## Why the ship prints the mark, writes the reading there once, and remembers nothing else

The consult that crosses a hundred-mark names the codex eval, and the run whose landing brings this
project's corpus to a multiple of fifty names this one, from the release step that already prints
what the release cost the gate and whether a reading is owed. The count is read off the corpus at
that moment and never off anything that remembers a crossing: a file that did is a second copy of a
number the transcripts already hold, wrong the first time a transcript is lost. The count is this
project's and not the device's, because the corpus root is derived per project and the ship runs
inside one.

What gets written is the comparison the line names — the object `--json` prints — appended as one
JSON line to a store under the forge config directory, next to the consult log and kept as that log
keeps its entries: never rewritten, tagged by kind. It is written once per mark and never again, so two ships
landing on the same count write one record, and a corpus that lost a transcript and reaches a count
twice appends nothing the second time (ISS-478). The consult side writes the same way at its own
crossing. Before this, the pair of windows the mark named was gone once more runs landed, so a
reading nobody took at the mark could not be taken later, and two readings a day apart compared
different pairs.

`--against <mark>` puts the stored reading's recent window where the sliding before would stand, and
the rest of the comparison is computed by the lines the sliding one takes — the same figure line,
group block, moved rows and shifts — so a stored before and a live before never disagree about what a
run cost. A mark is named by its count, the number the mark line printed; `--against` alone takes
the newest held. The screen's before line names the mark and says when the two windows overlap,
which they do until the corpus has moved a full window past the mark, and the JSON carries `against`
at the top. A mark nobody wrote is refused by name, with the list subject that shows what is held:
`forge stats marks` for this project's runs readings, `forge codex marks` for the device's consult
readings. A runs reading is the project's, resolved by the root its corpus was read for; a consult
reading is the device's, as the log is, so every checkout sees it. The evaluator's method names the
pinned comparison beside the sliding one (`forge guide harness-eval`).

Two fields exist for the stored side alone. The shifts are tallied off each window rather than its
rows, because a stored window has none: a runs window carries `spanned`, the count of runs that saw
a release land (its rung counts are already in the profile), and a consult window carries `from`,
`to` and `mix`, one count per value of slot, model, prompt and effort — a consult group's key folds
slots and efforts together, so nothing else in the object holds those counts. A stored window's
scores are the ones written at the mark; a verdict recorded after it does not rescore it, which is
what pinning is for.
