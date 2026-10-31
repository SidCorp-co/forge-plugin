### `closed`, `dropped` — terminal, until a person disagrees

No advance reaches `closed`: core enters it from `awaiting_release` only by the release that ships the
change (`CLOSE_ONLY_BY_RELEASE`), whose record is `forge release-batch record`.

A triage rules how far back the work goes, never how far forward: it may not send an issue past the
rung it was at when the person spoke.
