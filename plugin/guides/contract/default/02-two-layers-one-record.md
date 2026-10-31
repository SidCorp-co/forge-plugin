## Two layers, one record

A status is a promise to whoever reads the tracker next, and the payload that earned it is what they
may rely on. The phases are the workflow under that contract: each produces one payload, and the
status an issue holds says which phase it is in. Phases 0 and 8 write to the project, never to a
transition.

Check presence, recency, the sha a payload carries and, where a rule says *since*, order. Judge fit
nowhere: whether an attachment is really the migration classification, or a comment really an
approving review, is the reviewer's to say.

The statuses are core's, and core refuses every other name (`ISSUE_STATUS_LEGACY`). Four steps of
this flow are `in_progress` at a work step, written as the status and then the step. Of the rest,
`draft` is the reporter's, before `open`; `reopen` is a person's word, and nothing earns it;
`needs_info` and `on_hold` are where a park waits; and `closed` is the release's.
