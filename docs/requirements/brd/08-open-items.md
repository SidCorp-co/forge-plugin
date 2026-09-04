# BRD §8 — Open items

← [Index](./README.md) · [§7 Glossary](./07-glossary.md)

## What is undecided about these requirements

*What is not settled, and who settles it?*

An open question is a tracker issue, never a marker inside a clause (R-07). Every row here names
the issue that will settle it, because a question with no owner and no place to be answered is not
an open item — it is a deferral, and this tree has no room for one. A row leaves when its issue
reaches a terminal status: the decision it made, or the finding that there was none to make, is then
in `git` and in that issue's record, so there is no ledger here to keep in step. A dropped issue
takes its row with it exactly as a closed one does — the question stopped being open either way, and
a row outliving its issue sends the next reader to a key with no answer behind it.

| Question | Issue |
|---|---|
| Whether a review's outcome and the author's disposition of each finding are two values rather than one. | ISS-16 |
| Whether a finding's identifier names the round that issued it, so a review over several rounds has no two findings alike. | ISS-34 |
| Whether an assembled report keeps every instance of a kind that repeats, rather than the latest. | ISS-11 |
| Whether a park is lifted on the record, so a retraction sits beside the park. | ISS-13 |
| Whether every move can be rehearsed, a park and a drop included. | ISS-12 |
| Whether a decision record may defer one question to a later status that then refuses until it is answered. | ISS-23 |
| Whether the plan is a typed payload carrying a way back and a criterion per step. | ISS-20 |
| Whether the requirements gate reads a tree the one-home gate cannot see, or whether that gate learns to recurse. | ISS-27 |
| Whether an identifier in a payload is read as a tracker key or as a clause citation. | ISS-36 |
| Whether a citation's revision is checked against a recorded hash, and where that record lives. | ISS-27 |
| Whether an issue must cite the clause it serves before it can be approved. | ISS-28 |

## Where the workflow's own open questions live

*Why are they not listed here?*

Because they are already listed once. `docs/issue-flow-contract.md` closes with the questions the
workflow has not answered, and that document is the specification of the statuses this tree's
requirements implement. Summarising even one of them here would put it in two places to be kept in
step, which is the duty of BR-09; the list is one link away and it is the authority for its own
contents.
