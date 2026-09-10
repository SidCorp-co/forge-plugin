## Two layers, one record

A status is a promise to whoever reads the tracker next, and the payload that earned it is what they
may rely on. The phases are the workflow under that contract: each produces one payload, and the
status an issue holds says which phase it is in. Phases 0 and 8 write to the project, never to a
transition.

Check presence, recency, the sha a payload carries and, where a rule says *since*, order. Judge fit
nowhere: whether an attachment is really the migration classification, or a comment really an
approving review, is the reviewer's to say.

Three of the tracker's statuses are no step of this flow. `draft` is the reporter's, before `open`.
`testing` is a label this contract has no use for. `reopen` is a person's word, and nothing earns it.
