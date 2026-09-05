# copies — a gate that landed is the gate that fires

Why: over three days, 44 landings told every open session to restart; 3 of them moved what a session
had registered, and the other 41 moved code it could have picked up.

A registration is read once, at session start, and names its entries by path. The entries are thin:
each hands the call to the copy the `forge` link would run, chosen by working directory. The
harness, the gates and the vendored rules come from that copy, so a fix is live at once. Inside a
checkout that ships this plugin the copy is the checkout — the tree you are editing is the tree that
judges you; outside one it is the newest install that resolves. `forge doctor` prints both answers,
the CLI's and the gates'.

A restart is still owed for the registration, the entries it names, what those import and the
skills the session loaded. `plugin/src/tools/plugin-copy.mjs` declares that set and the release
names what a change moved. Renaming a gate is in it: the registration pins the names.

Not judged: whether the chosen copy's gates are any good. Uncommitted edits are what fires inside a
checkout; a gate that throws on load stands down for the session, on stderr and in the log, and a
copy that will not load at all leaves the harness beside the entry to answer.
