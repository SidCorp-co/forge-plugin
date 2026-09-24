# `stats surface` — the texts an agent is served, counted in the unit they are billed in

Every other figure `forge stats` prints is time, rounds or calls. The help and guide texts this copy
serves are a fixed cost every run pays before it does any work, and the unit that cost is budgeted
in is the token. Measured by hand on 2026-09-13, a quarter of one table's reads were of a part the
reading run already held, and 45% of the `forge record <kind> -h` texts were lines another kind
prints too. The per-text cap the help cases hold sees none of that: it holds each
text alone, so splitting one text in two makes both halves greener while the sum a run reads grows.
This subject reports the sum, and the repetition inside it (ISS-1327).

## Why a count, and never an estimate

**A token is counted by the provider that bills it, and by nothing else.** The count is specific to
the model: one model's tokenizer can take a third more tokens than its predecessor's for the same
text, so a figure derived from characters cannot say what is being budgeted, and a third-party
tokenizer undercounts Claude by construction — worst on code, which this surface mostly is. An
estimator written here would carry the same error under this repository's name. So every token this
subject prints is the `input_tokens` Anthropic's count endpoint answered, and the endpoint is an
interface clause of its own (`EI-11` in the specification).

**No number where no count was taken.** The model is the caller's decision and has no default: a
figure counted for one model and read against another's is worse than none. The key is this
machine's own, saved with `forge doctor --anthropic-key` beside every other harness credential and
read from nowhere else — not the environment, and not a gateway's profile, whose count would be
another provider's. Without either, every token figure reads *not
measured* and names the one thing that would measure it, and nothing is sent. Where the endpoint
refused one text, that row prints no number, and neither does the total: a sum missing a text is not
the total, and printing it would be exactly the figure this subject exists not to print.

Each text is sent as one user message, so each count carries the endpoint's own framing of a
message. That framing is the same for every text, it is included rather than guessed at, and a figure
compared across two readings is compared like for like.

## What is walked

**What a caller is printed, by running the command that prints it.** A module constant is not the
text: several help texts add what the project's state chooses, and a guide part is rendered for the
flow and the rung it is served under. So every text is read by spawning this copy's own `forge`, from
the directory the caller stands in. What is kept is stdout, and stderr beside it only where the
command exited non-zero: a zero exit's stderr carries transient notices alone — a tracker call
retried — and measured twice, one copy's surface differed by exactly those lines, which is the one
thing a figure meant to be compared across readings cannot do.

The texts are `forge -h`, every verb's `-h`, every subject's `-h`, the contract's contents and each of
its parts, and each skill's method and each of its references. A contract part answering to two
names is one text, walked once and priced under either name, or it would report as one text
repeating itself. Which verbs have subjects is declared in each verb's own module and nowhere a
reader can reach, so the reading loads those declarations itself, and the subject table in the help
cases has to agree with it.

**Not walked, deliberately.** The tracker's own guides are the tracker's text, not this copy's. A
phase of a method, asked for by its number, is a slice of the method already walked, and walking it
would count its lines twice.

## What repeats

A line — trimmed, and holding at least one letter — that more than one text prints. The figure is the
number of such lines, their printings past the first, and the characters of those printings; where
tokens are counted, those printings are sent together as one text and counted. The first printing is
the one a reader needed, so only the rest is repetition. Where nothing repeats, the tokens are nought
without a request: there is no text to count, and the endpoint takes no empty message. The line is the unit because it is what a
copied block is made of, and it is also what makes the figure fire: a block copied into a second text
raises it, and the case holding that is the one that says this reading is not green by construction.

## What a priced read means

The guide parts the corpus window read are the `stats runs` table's rows, taken from the same fold,
and beside each: the part's tokens a call, the tokens those calls spent, and the tokens spent on
reads past each run's first. The price is this copy's text for that part as served with no rung
named; a read made under an older copy paid for the text that copy served, so the column is what
those reads would cost now, and it is labelled that way.

A read is priced only where the flow it was served under — on the read's own key — is the flow this
reading measured, and only where the part is a text this copy serves. Every other read is counted as
unpriced rather than priced at the nearest text.

**The help reads are not priced.** A help row is keyed by the verb, and for a verb whose subjects
share its row the row mixes the verb's own text with every subject's, so no single count prices it.
