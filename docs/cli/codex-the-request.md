# codex — the request

**The cache is the provider's prefix, not a breakpoint we place.** The role and the replayed history
each carry a `cache_control` marker, and over 487 answered consults `cache_creation_input_tokens` was
0 on every single one: nothing this end asks for is honoured, because the slot resolves to a model on
another provider whose caching is automatic and keyed on the longest matching prefix of the request.
Reads do happen, and the one thing that visibly moved them was the tool list. A consult whose last call
was served `tools: []` read 11% of its input from cache; one that never reached that call read 22% —
the tool-less call is the only difference between those two groups, and system-and-tools is exactly the
front of the prefix. So the list now stays in the request on every call of a consult and the last one
is sent `tool_choice` of none instead. The cap is unchanged and stays this end's, which already refuses
and records a tool call made past it. `codex.toolChoiceNone: false` sends the empty list again.

The last three consults were the last three by date whatever they were about; one sharing a file comes
first now, because that is the one "still open" can be answered against.

**Containment is physical, not lexical.** `..` is the traversal you can see; a symlink committed inside
the repository is the one you cannot. A path is admitted by realpath and by being a regular file, for a
name on the command line as much as for one the reviewer asks for, and checking and reading stay two
operations — a checkout mutated between them is a race this narrows rather than closes. Scope is this
checkout plus the checkout of every file the caller named, because the account config and the gateway
profile both hold live tokens; a refused read is answered in words, since a reviewer that cannot tell
"outside" from "you forgot" asks again.

**A malformed tool call is answered, not thrown.** Arguments that never parsed become an empty input
and come back as a refusal: the model's mistake to correct, not a reason to end a consult already paid
for.
