# The verb for each act of core's method

The method is core's page, `forge guide issue-flow`, and every act on it is a REST call. Under this
plugin the same act is a `forge` verb: it reads the contract the call alone does not, refuses a
write the contract would not earn, and leaves the record `forge advance` reads a status off. This
page is that map and nothing more; each verb's own `-h` carries its flags.

| Core's act | The verb |
|---|---|
| Read the issue, its thread, its records and its edges | `forge issue <ref>`, and `forge resume <ref>` for the record re-minted with what is owed |
| Take it | `forge claim <ref>` |
| Record where the work is at a push | `forge claim <ref> --pushed` |
| Criteria, and a plan where the work needs one | `forge record criteria` and `forge record plan` |
| A choice taken under an assumption | `forge record decision` |
| A review of the head that lands | `forge record review` |
| A verdict on a criterion | `forge record verdict`, one block per criterion, several in one write |
| Mark the merge | `forge record merged` |
| Move the status | `forge advance <ref>`; `forge advance <ref> --owed` says what the next one is owed and moves nothing |
| Set it down where a person owes the next move | `forge advance <ref> --park <kind> --why W` |
| A finding beside the work | `forge comment` on the issue that owns it, or `forge new` for work of its own |
| What the method did not answer | `forge record gap` |

A record kind this table does not name is listed by `forge record -h`. Which of these a project asks
for is the project's profile, read by `forge advance --owed`: a step this map names is never owed
because the map names it.
