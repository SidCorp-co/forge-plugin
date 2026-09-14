# A tool this machine saved nothing for

A verb that cannot work was advertised exactly like one that can. With an empty configuration home,
`forge -h` carried a full row for `cloudflare`, `coolify`, `codex` and `chatgpt` — the `chatgpt` row
saying *over the endpoint this machine has saved*, which that machine had not. A person reading such
a row loses seconds. An agent loses a turn: it reads the row, plans around the verb, calls it, is
refused, and re-plans. The refusal was already good and already named the way back; it arrived one
whole turn after the decision it should have prevented.

## It is not the capability gate, and may not be folded into it

[Withholding a verb](withholding-a-verb.md) keeps two mechanisms apart: a tool the server refuses
this credential, and a verb a person chose to withhold. This is a third, and the distance from the
first is the one worth stating. `isGated` reads a per-project `capabilities` record — a replay of
what `forge doctor` measured about what the **credential may spend**, server-side, on a tracker tool.
This asks whether **this machine holds a local file**: an account under `cloudflare`, a `coolify`
url, a gateway profile, a chatgpt pair. Two facts, two stores, two routes back — a Cloudflare token
saved here says nothing about what the Forge credential may call, and a capability record says
nothing about whether this box has a Cloudflare token. Collapsed into one switch they would need a
precedence rule, and a person told a verb was gone would be told the wrong reason for it.

The gate refuses; this hides. A gated verb typed says which tool it needs and that this credential
may not call it. An unconfigured verb typed **runs**, and gives the refusal it always gave, which
already names what saves the credential. Nothing about that refusal changed, and a hidden verb that
answered *unknown verb* would be worse than the row it replaced.

## One reading, five readers

`plugin/src/tools/services/tool-config.mjs` is the whole of the answer. The help's filter, `forge
doctor`'s rows, the served guides' `tool.` conditions, the writer of the skill stubs and the
Cloudflare verb's own refusal all read it. That is not tidiness: before it, the command that saves a Cloudflare account was spelled two ways — once
in the verb's refusal, once in the report's row — and they had already drifted apart in their
flags. A tool is in the table because it already refuses without local configuration today. Nothing
here decides that a tool needs a credential it did not need before, which is why the table borrows
each tool's existing reader rather than inventing a second test of the same file.

`toolState` answers null for a verb the table says nothing about, so *not a tool* is never read as
*a tool with nothing saved*; and a reader that throws answers *unconfigured* rather than throwing,
because the help asks this question before it dispatches and a directory named in
`CLAUDE_PROXY_ENV` would otherwise take every verb of the CLI down with it. The verb typed still
reaches the same reader and still fails its own way.

Two of those readers had to move to be borrowed, and that decided where the table lives. `profile`
sat in the module that makes the HTTPS call and the Cloudflare accounts sat in the verb; a hook that
loads `visibility.mjs` would have paid for an HTTP client and the tracker layer to learn whether
there is a gateway at all, against a requirement that a gate costs one process start. So both are
read here, beside the services they answer for, and `codex.mjs` imports the profile back — the
shape `chatgptSettings` already had, sitting with the settings that resolve rather than beside the
verb that spends them. The folder-width checker
is what settled it against a module of its own: `plugin/src/codex` and `plugin/src/resolve` were
each at ten files, and a third home for one fact would have been a seam picked by arithmetic.

## Doctor still names it, because doctor is the only surface that may

Hiding a tool *everywhere* would make it undiscoverable: nobody could learn that `forge coolify
login` exists. Withholding a verb gives `forge doctor` the sole permission to say a thing is
unusable and forbids any other surface making up the difference, so the report names each tool this
machine saved nothing for, with the one command or file that puts it back, and a `verbs
unconfigured` row beside the states a person chose.

That row exists for a narrower reason than completeness. `verbs on` was computed as *no entry under
this machine's key*, so a verb hidden for any reason the key does not record — unconfigured, a
channel the project closed, a capability the credential lacks — printed as `on` while being absent
from `forge -h`: the report contradicting the help, which is the one thing the single-surface rule
exists to prevent. The states are now an ordered list whose last entry is the fallback, so `verbs
on` is exactly what `forge -h` offers by construction rather than by agreement.

## What a fence on a tool may be written over

`tool.<verb>` is a third level beside the project's keys and the call's own rung: it is the
**machine's**, so two checkouts of one project are served different text where one of them saved
nothing. The three references of the `forge` skill that are wholly about one tool are fenced whole
on theirs, and a reference that renders to nothing is unlisted — read off the fence rather than off
the file's name, so the fence stays the one declaration. Asked for by name it is refused with what
configures the tool, because unlike a verb a reference has no call of its own left to carry that
sentence.

Method text is fenced only where a branch can be written that relaxes nothing. `forge record plan`
refuses a file no consult has read, so a machine with no gateway cannot reach `approved` at all;
cutting the sentence that names the consult would leave a run blocked and not told why. The branch
it gets instead says the reviewer is unreachable rather than optional, and points at the one surface
allowed to say what is missing. `harness-eval` keeps its text: its whole subject is the consult log,
so with no gateway there is nothing for that skill to be about, which is a question about whether
the skill should exist and not about a sentence inside it.

## The surface no filter reaches, and the write that answers it

A skill's `SKILL.md` is read off disk by the session host before any of this code runs, and one copy
of it ships to every machine. Nothing can stand between those two, so the file itself is what varies:
each tool's material sits on continuation lines of its own inside the shipped description, and a line
naming a tool this machine saved nothing for is dropped. Naming the tool is the whole test. A table
of fragments would be a second copy of the words, so what holds the layout is a checker instead — no
tool's material may sit on a line that does not name it, and a line the render can drop may carry
nothing else the skill needs.

Cutting those words out of what ships was the alternative, and the rule above refuses it: a checkout
that saved a Cloudflare account goes on firing on *purge cache*. What ships is therefore the
fully-configured text, and each machine below it subtracts.

The write lands in the copy the harness installed and nowhere else. Two conditions decide it and
neither answers alone: the install record says which directory the host loads, and the walk for a
marketplace above says whether that directory is somebody's source tree — a plugin can be installed
from a checkout, and an installed path can be a symlink into one. Both are asked of the real path.
What this copy ships is kept beside the stub the first time one is written, so a tool configured
afterwards has its words back at the next session start rather than at the next release.

It reaches a session one start late, which is the restart set's rule and not a defect to design
around: a session is handed its skills as of its start, so the start that writes the file says in as
many words that the text this session holds is the text from before the write. `forge doctor` names
each stub on disk that is off what this copy ships, with the tool whose words are out, and says
nothing where none is.
