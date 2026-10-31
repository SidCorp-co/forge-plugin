# `feedback` — core's door

**A credential that cannot see this plugin's project still files: through core's own door.** The
destination above is a project on the pinned core, and a credential scoped to one client's project
cannot see it. Six times in the Agenfold sessions of 2026-10-30/31 that ended the call on "no
project … slug forge-plugin", and the run fell back to a hand-written POST. Core has a door for
exactly this — `POST /api/forge/feedback` (REQ-47), which files a note about Forge into Forge's home
from any project a credential can read — so where the projects this credential sees hold no
`forge-plugin`, the note goes there instead: the body whole, the title, the kind mapped onto core's
(`bug` stays `bug`, an enhancement or a review is a `change_request`, a feature an `idea`),
`whereSeen` from `--where` or the CLI's own name and version, and `clientVersion`. The reply names
the item core filed (`FB-nn`). The flags that only mean something on an issue — `--with`, `--module`,
`--new` — are refused on that path by name rather than dropped, because the door holds no issue to
fold onto. A projects read that is itself refused stops the call with the refusal: that is no
evidence the plugin's project is out of sight.
