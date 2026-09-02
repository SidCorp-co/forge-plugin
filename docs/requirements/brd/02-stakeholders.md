# BRD §2 — Stakeholders

← [Index](./README.md) · [§1 The problem](./01-problem.md) · Next: [§3 Goals and non-goals](./03-goals-non-goals.md)

## Who is affected

*Who has something at stake in this product?*

| Stakeholder | What they want | What they lose when it fails |
|---|---|---|
| **The developer whose repository hosts the plugin** | to read a status and know what it cost, and to have their own project's rules obeyed rather than a plugin's opinions | time spent re-deriving what an agent did, and a gate firing over somebody else's sentence |
| **The agent working an issue** | to be told what a status is owed before spending a turn guessing, and to be refused with the one command that clears it | turns spent on a refusal it cannot act on, and work lost when a run dies |
| **The reviewer, a person or a second model** | the head that was judged, the findings by identifier, and a disposition of each | an approval that means nothing, because nobody can tell which diff it was about |
| **The tracker** | one writer per issue and a record that reads back as it was written | a record two runs overwrote, which is a record that can be made to say anything |
| **The business analyst** | to read a page in the product's own language and change the specification through an issue | a text tree they were never meant to read, and a spec that drifts from what was agreed |
| **The supervising run or person** | one view of what needs attention: what is leased, what is parked, and who it waits on | one call per issue to find out, which nobody makes |

## Who acts, in the specification's terms

*Which of these appear as actors in a use case?*

The actors of the SRS are the developer, the agent, the reviewer, a person, and the project — the
repository's own configuration, which answers for what good code is. The tracker and the model
providers are not actors: they are interfaces this product crosses, specified in
[../srs/19-external-interfaces.md](../srs/19-external-interfaces.md).

The business analyst is a stakeholder of the specification rather than an actor of the software: a
change they ask for arrives as a tracker issue, and the agent applies it. That is
[../README.md](../README.md)'s rule about the store and the surface.
