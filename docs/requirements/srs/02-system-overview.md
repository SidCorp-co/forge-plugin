# SRS §2 — System overview

← [Index](./README.md) · [§1 Introduction](./01-introduction.md) · Next: [§3 FR-01 Resolution](./fr-01-resolution.md)

## The parts

*What is this product made of?*

| Part | What it is | Requirements |
|---|---|---|
| **The CLI** | one binary on the developer's path, reaching the tracker over a single request per call, with no client connected in the asking session | FR-01 to FR-06 |
| **The gates** | checks the host runs before and after a tool call, in one process per event, that may refuse a call or answer after it | FR-07 to FR-12 |
| **The skills** | the method an agent follows, carrying no project's facts and no rule a checker already keeps | cited by FR-05, FR-09 |
| **The Vietnamese route** | a second CLI and one generated module holding every string the product may send | FR-13 |
| **The specification** | this tree, and the verbs that will read, check and render it | FR-14 |
| **The vendored linter** | a copy of this repository's own package, because a plugin directory travels alone | FR-11, C-02 |

## The actors

*Who acts on this product?*

| Actor | Who they are | What only they may do |
|---|---|---|
| **The developer** | the person whose repository has the plugin installed | switch a gate off, hide a verb, write the account's credential |
| **The agent** | the session working an issue | take a lease, write a payload, move a status |
| **The reviewer** | a person, or a second model on another provider | stand behind a head; answer a park that waits on a person |
| **A person** | any commenter the tracker did not mark as an agent's | lift a hold, reopen, approve a screen |
| **The project** | the repository's own configuration | decide what good code is, which paths want a second opinion, whether a person must approve |

## What holds the state

*Where does this product keep what it knows?*

Three places, and each answers for exactly one thing.

- **The tracker holds the process.** Status, plan, criteria, every typed payload, the lease, the
  merged mark, the relations. It is the only witness a check reads (BR-02), and the only thing a
  new run needs in order to resume one that died.
- **The pushed branch holds the code.** A commit is pushed as it is made, because a branch on one
  disk is a checkpoint nobody else can resume from (C-10).
- **The account's configuration directory holds the credential and the switches.** The endpoint,
  the token, which verbs are withheld, which gates are off, the cached tool declaration and the
  consult log. Its shape is [§18](./18-data.md).

Nothing lives in a session. That is the constraint that makes every other requirement possible:
what an agent remembers is not state, because the next run will not remember it.
