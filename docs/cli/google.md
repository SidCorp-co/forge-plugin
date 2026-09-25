# Google

Why Google Workspace is reachable from this CLI in the shape it is: a surface carried rather than
fetched, a write that takes a typed consent, three ways to a credential and the one order they answer
in, and failures that exit by class.

## The surface is carried, and derived

Google describes every API in a Discovery document, and the verb's surface is derived from those
documents rather than typed: a method is `<service> <resource...> <method>`, its parameters are the
document's, and every method of a served service's document is served. What gets served is a
service, not a method, because a list of methods is a list somebody has to keep, and every method
it leaves out is a workaround somebody else has to invent. What is carried is an
index cut from each document — every method's HTTP method, path, parameters with their first
sentence, body and answer names, upload path, download flag and scopes — one file per service, about
a quarter of a megabyte for eight services where the documents whole are eight times that. Nothing
here validates a body against Google's schemas, so the schemas section would be bytes nobody reads.

The documents are not fetched at run time. A fetched surface means a network miss, or Google moving
a method, changes what a command means between one call and the next with nothing on this side having
changed; the carried index means the served surface is what shipped. The refresh is a command of its
own, prints method by method what a fresh fetch added, removed and changed, and writes only when told
to. A served method a fresh fetch drops refuses the whole write by name: dropping it from the served
list is a decision, and a refresh taking it silently would be the decision made by nobody.

Drive, Sheets, Docs, Gmail, Calendar and Meet are served. Chat and Admin are carried and serve
nothing, so a run that needs one of them is a one-line change plus the scope, not a new
integration. The scopes are the same six whatever is served, so a method needing more than they
grant — Gmail's settings writes and its permanent deletes among them — answers naming the scope it asks
rather than being refused here. Every helper reaches its methods through the same account, consent
and preview path a typed call takes, so the path that has to be right is one path.

The carried index being the served set, the refresh's refusal of a dropped method is lifted by
taking that method's line out of the carried index in a commit, which is the decision made by
somebody.

The words after a service walk the document's tree by position: a resource goes a level down, a
method ends the walk. So every level is something a caller can list — `-h` at a service or a
resource prints its resources and its methods, each with its HTTP verb, the positionals it takes in
the document's parameter order and what `--yes` it owes — and a word that names nothing is answered
from the level it failed at. It works because no method of a carried document is also a resource.
`schema` prints a method's parameters, or a level's whole subtree, off the carried index, served or
not, which is what a caller reads before a call rather than after a 400.

## Every input is used or refused

A `--params` key the method does not declare is refused against its parameters before anything is
sent, naming the nearest; so is a flag the method has no use for (`--upload` where it takes no upload,
`--json` where it takes no body) and a positional past its path. Sent anyway, each would come back as a
400 that names nothing of ours, or be dropped and read as done. The document-wide parameters a caller
may pass are the three that shape an answer; the ones that would put a credential in a URL are
refused, and the two that `--output` and `--upload` set are theirs.

Gmail's `userId` and Calendar's `calendarId` default to the caller's own when a call leaves them out,
being the values those APIs document for one's own data.

## A write is a flag, never a prompt

A prompt answers itself where no terminal is attached, which is every call an agent makes, so consent
is `--yes` typed on the call. It is owed by the writes a person cannot take back or that reach
somebody else: a delete or a PUT, a trash, a removal or a clear, a change of who has access or of
where mail goes, sending mail, an event that invites anyone, and a batch update carrying a request
that deletes, clears, replaces or writes over cells. A patch or a move of an event reads the event first, because
whether it reaches invitees is something only the event can say. The refusal names the rule that
fired and carries the same command with `--yes` and with `--dry-run`, so the preview is one paste
away.

Serving every method means consent cannot be a list of methods either, so it is one table of shapes.
The writes that owe nothing are listed too, with why: they only add, read through a POST, watch for
changes, or are undone by a call of their own. A write the table names neither way owes `--yes` as
unclassified, and the suite fails on it, so a method a refresh brings in is either judged or asked
about, never sent unjudged.

`--dry-run` prints the request whole with the credential masked by the rule every saved credential
here is shown by, and sends nothing; what goes on the wire is never masked.

## Three routes to a credential, in one order

A **service account** is a key file, copied beside this CLI's configuration at owner-only permissions
and never printed. Mail, calendars and meetings are a user's, so there it acts as a user through the
domain-wide delegation a Workspace admin granted, named with `--as`, and a call naming nobody is
refused rather than guessed: the account's own mailbox is empty and a guess would read as an empty
inbox. Drive, Sheets and Docs may run as the account itself, reaching what was shared with its
address. Each call asks only the called service's scope, because an admin grants delegation scope by
scope and one missing grant would otherwise fail every call. A refused delegation names the client id,
the scopes and the admin page, since it is not a bad key and reading it as one sends somebody to
rotate a key that works.

A **login** is a Google account signed in through the owner's own OAuth client, which is the one way
to a personal Gmail account, where there is no admin to delegate. Its consent page is Google's,
reached over a loopback redirect with a PKCE challenge, so the code that comes back is useless to any
process but the one that asked. It is read-only unless `--write` names a service, and `--as` is
refused on it: a login is one person.

The client has to be a Desktop app one. The redirect goes to whichever loopback port is free when
the login starts, and Google takes a loopback redirect on any port only from an installed-app client;
a Web application client takes only the addresses registered for it, port and all. So a web client's
file is refused before anything is printed, rather than failing in the browser after the round trip.
On a terminal the consent page is opened with the platform's own opener as well as printed, because
somebody is sitting at that terminal; with output piped, or with `--no-browser`, it is only printed.

An **access token in the environment** is the route for CI, where nothing is saved.

Accounts of both kinds are named and one is the default. An explicit `--account` answers first, the
environment's token next, the default last: a name typed on the call is the plainest statement of
intent, and CI sets the environment on purpose. Where two accounts could answer and none is the
default, the call is refused with the accounts listed. `forge google auth status` and `forge doctor`
say which answered by its identity — a service account's client email and masked key id, a login's
address — and never by anything it signs with.

`google.endpoint` in this CLI's configuration, when set, stands in for every Google API, upload and
discovery host, while the token endpoints stay the ones the key file and the client file name. One key
and not a host table, because what it is for — the suite's local fake, an emulator — answers every
host at once; and a key rather than a flag, because a call that could retarget itself is a call whose
credential goes wherever the argument says.

## Failures exit by class

Every other verb exits 1 on any refusal. This one exits 1 for an API error, 2 for an authentication
failure, 3 for an input it could not use (consent included), 4 for a method the carried surface does
not serve or no longer holds, and 5 for a local failure it did not anticipate, because a caller that
branches on the class should not have to parse the sentence. Each says on stderr what clears it; an
authentication failure names the command.

A 403's hint follows the reason Google states, not the status: only a short scope is cleared by a
sign-in, so a disabled API is named with its enable page, and an unknown reason is left to
`forge google auth status` rather than guessed at.
