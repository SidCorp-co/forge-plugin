# `forge cloudflare` is not the tracker

Read this before the first `forge cloudflare` call of a task. Run `forge cloudflare -h` for the
sub-verbs; these are the two things `-h` does not say.

**Nothing in the tracker's arrangement applies to it.** It calls `api.cloudflare.com` on credentials
saved on this machine, so it needs no Forge endpoint, no token and no slug, and no capability probe
can withhold it. Never ask the user for a Cloudflare token to paste — `forge cloudflare accounts`
says whether one already resolved.

**The four write actions apply on the first call, with no confirmation.** They print the zone and
the account *after* the fact. These are live zones and a deleted record is not recoverable from
here, so read with `dns <zone-id>` before `dns set` or `dns rm`.
