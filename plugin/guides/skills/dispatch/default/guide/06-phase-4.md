## Phase 4 — Work out what each run cannot know

Three things, all read at dispatch time and none of them from memory:

- **Where it works.** One tree per run where more than one run shares a checkout.
- **What it may not touch.** The files the runs already in flight hold, read off those issues' own
  plan records now. A plan naming no file holds whatever tree its prose names.
- **What moved under it.** What has landed since the copy of the plugin that run will load, and
  whether a restart is owed before it starts.
