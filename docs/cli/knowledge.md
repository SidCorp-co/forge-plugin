# `knowledge` — the store's own verb, and the one write it refuses to make thin

## The measurement the verb exists for

Measured on plugin 3.35.49: the tracker had held a knowledge store for this project the whole time
and it held **zero entries after forty-three delegated runs**. The runs that learn the most about the
codebase are the batch readings — ISS-165 read twenty-four files across twelve releases as one change
— and each left what it found in a closed issue's confirmation record, which no later run opens. The
next run relearned it from the files.

So the store is not a nice-to-have surface: it is where a reading's findings go instead of being
relearned, and the reading is its writer. That is why the body the ship step generates for a batch
reading carries the writing rule itself, rather than a prompt or a skill carrying it: the run reads
its obligations off its own issue, and a person types none of them.

## `upsert` replaces the whole row, and nothing said so

Probed live on 2026-09-04 against a throwaway slug, one field at a time:

| Written, then written again without that flag | Stored before | Stored after |
|---|---|---|
| `injection` | `always` | `on_demand` |
| `confidence` | `verified` | `inferred` |
| `metadata` | one key | empty |
| a create naming no kind | — | `guide` |
| a write naming no title | — | refused |

The tool's own description calls the action "create or replace" and its schema marks none of those
fields required, so a reader has every reason to expect a merge. A verb passing the caller's flags
straight through would therefore have relabelled every entry a later write touched: the second
correction of a `reference` entry, written to fix a sentence, would file it as a `guide` on
`on_demand` at `inferred`, and nothing would say so.

Two answers were weighed. Refusing a replace that would drop a stored field was rejected: the common
write is a body correction, and making it cost four flags retyped off a read is a copy the caller
maintains by hand. So the verb **carries forward what the caller did not name**, and says which
fields it carried — a write that keeps a value nobody typed is still a write about that value, and a
line the caller can read is what keeps the carry from being a second silent thing.

The reversal, if the tracker ever makes `upsert` a merge: hand the caller's flags through unchanged
and drop the read that precedes the write.

**The edge the carry cannot close.** A read and a whole-row write are two calls, and the tool
declares no revision and no conditional write to hang the second off the first. So a second writer
landing between them is overwritten by the copy the first read — and the verb cannot tell. Nothing
here pretends otherwise: the store's writers today are the batch readings, one at a time, and
closing this needs a compare-and-swap the tracker does not offer. A carried field the store holds as
null is left out rather than sent, for a smaller reason: no field carried here is nullable there, and
the schema takes null for none of them, so sending one would turn a keep into a refusal.

One field is still refused rather than carried, because there is nothing to carry it from: a **new**
entry naming no kind. The tracker labels that one `guide`, which mislabels a reference rather than
under-labelling it, and no later reader can tell that from somebody's choice.

## The enums come off the declaration, and nothing keeps a copy

Kind, injection and confidence are the tracker's enums, read off the tool declaration this endpoint
answered with and refused with the set they were read from. No copy of the values is kept — not in
the verb, not in its help, not here. A copy would be a second authority that goes stale the release
the tracker grows a kind, and the failure mode is the worst kind: a value the tracker accepts,
refused locally, with the refusal naming a set that is wrong.

That declaration is cached per endpoint, which the whole CLI depends on and this verb does not
escape, so the refusal says the set is the cached one and names what re-reads it. Between a value
added upstream and a doctor run, the refusal is a stale one — which is why it says so rather than
reading as the tracker's own word.

The test that holds this declares a kind the real tracker does not have and asserts the verb accepts
it, and declares one it does have and asserts the verb refuses it. A verb holding a copy fails both
halves.

## What an entry is, and who refuses one that is not

An entry states what **is**, and cites where it was read — a path, a commit, an issue key. A
convention two runs each half-followed is an entry of kind `rule` only with the two places that show
it, named in the body. The one-home rule holds here exactly as it holds for a document: an entry
repeating a rule the project's own files already carry is a copy nobody will remember to correct
twice, and the tracker embeds it for search, so it comes back beside the original.

None of that is a checker, and the choice is deliberate. A cited path resolved against the working
directory would refuse a correct entry written from a repository this checkout cannot see — the store
belongs to a project, and the verb ships to projects whose files are not here. So the rule is stated
where its writer reads it, the generated reading body and this verb's own help, and the reader who
finds the overlap is the one who refuses the entry. A checker for it, if one is ever wanted, is its
own issue.

## Two smaller decisions

**An empty store is answered with the route out of it.** Until the first reading writes, every run
gets zero rows, and zero rows printed as nothing reads as a call that failed. The empty answer names
the write. A *filtered* answer of zero rows does not: an entry set that matched no kind is not an
empty store, and telling the caller to write one would be wrong.

**A body is printed as markdown rather than escaped inside JSON**, for the reason the guides are:
every newline of prose a reader is meant to read tokenizes worse as two characters than as one.

**A refusal from the store is not read as an absence.** A read that answers anything but the
tracker's own not-found means the row could not be read, and a write that took that for an absent
entry would go down the create path and replace what it never saw. And the write compares the
read-back field by field against what it sent, rather than checking that some row is there: a field
accepted and dropped answers success exactly like one that was stored.

## What this verb is not

It does not touch the tracker's embedding or its injection modes beyond passing a caller's choice
through, and **an entry is not translated** where an issue body on the same project would be: the
prose language applies to what a project's people read, and an entry is a reading of a codebase,
which this repository keeps in English for the reason CLAUDE.md gives. That falls out of where the
body travels rather than from a branch, so nothing here reads as a choice and this paragraph is
where the choice is. Reversing it is not a flag: the tracker would have to declare a translatable
payload for this tool, and whoever declared it would first have to decide whose language a store
two projects share is in. It writes nothing to the checkout — an entry lives in the tracker,
which is the point of having one. The project brief that ISS-147 adds is an entry like any other,
at slug `project-brief`, and is read by the project verb rather than by this one.
