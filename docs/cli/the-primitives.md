# The primitives live in one module

Two verbs could not reach them and each grew its own copy; one lost the full-page guard on the way,
and a truncated dependency graph reported itself as complete. One list per process, not one per
reference: `dep <a> <b>` fetched the same 41 KB twice.
