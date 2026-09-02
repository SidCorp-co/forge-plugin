# BRD §5 — Success measures

← [Index](./README.md) · [§4 Business rules](./04-business-rules.md) · Next: [§6 Constraints and assumptions](./06-constraints-assumptions.md)

## What would show that it worked

*How would anyone know, without asking the person who built it?*

Every measure below is read from a source that exists, and the figures themselves are not copied
here: a measurement quoted in a second place is a number that will disagree with the first.

| Measure | Read from | Direction |
|---|---|---|
| **M-01** Transitions refused for a missing payload, against transitions accepted with nothing behind them. | the refusal log and the issue records | refusals early, and none late |
| **M-02** Raw tracker transitions per run, against transitions made by the verb. | the dry-run sections of `docs/issue-flow-contract.md` | falling to none |
| **M-03** Tracker calls made by hand to finish one issue. | the same sections | falling |
| **M-04** Payloads a run had to invent at the keyboard because no shape existed. | the same sections | none |
| **M-05** False refusals found by watching a command fail rather than by reading the log. | `forge hooks --deny` against the run reports | none, because the log is the route |
| **M-06** Node processes started per tool call by the gate arrangement. | `docs/HOOKS.md` | one |
| **M-07** Requirements with no issue citing them, and issues citing no clause. | the trace report (ISS-29) | both falling |
| **M-08** Clauses whose citations went suspect and were never resolved. | the spec gate (ISS-27) | none |

## What is deliberately not measured

*Which numbers would mislead?*

- **How often a gate fires.** A gate that fires often may be catching a real habit or refusing an
  honest shape, and the count cannot tell them apart. What matters is whether the refusal was
  right, which is why every refusal is written down and read.
- **How much of the specification is implemented, as a percentage.** A derived count over clauses
  of wildly different size reads as progress and measures nothing. The trace report says which
  clauses have a passing verdict, by name.
- **Test count and coverage.** BR-16: the half that matters here is not diffable, and a suite that
  grows says nothing about whether a prompt got a better answer.
