---
description: "Turn audit findings into a shareable report — a plain-English verdict and fix plan up front, the technical detail behind it — for a co-founder, client, or investor."
argument-hint: "[audience: founder | engineering | client] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git rev-parse:*), Bash(git log:*), Bash(git remote -v), Edit(.securitymaxxing/**)
---

# Security report

Write a report someone who wasn't in this session can read, trust, and act on. You are
**summarizing work already done**, not auditing again: do not add findings that no review raised,
and do not edit any application file. The only file you write is the report.

Audience: $ARGUMENTS
(`founder` — non-technical, wants a decision and a plan · `engineering` — wants the detail ·
`client` — a third party is paying for this review; formal, complete, nothing assumed. If blank,
write for a technical founder: plain English first, detail after.)

## Sources, in order

1. `.securitymaxxing/findings.json` — the findings ledger, including `status`, `proof`
   (from `/securitymaxxing:redteam`), and fix history.
2. Findings and verdicts from reviews earlier in this conversation.
3. The code itself — only to confirm a `file:line` still points where the finding says.

If there is no ledger and no review in this conversation, stop and say so: recommend
`/securitymaxxing:audit --deep` (or `/securitymaxxing:vibe-check`) first. Never produce a report
from nothing.

Record what you're reporting on: the repository name (`git remote -v`, else the folder name), the
commit (`git rev-parse --short HEAD`), today's date, and which reviews produced the findings
(standard or deep audit, which focused commands, whether redteam proved anything).

## Rules

- **Only report what was established.** Every finding keeps its confidence: confirmed, proven by
  PoC, or *needs verification*. Don't promote a hypothesis to a fact.
- **Never include a secret value.** Refer to secrets by location; redact (`sk_live…7Q3F`).
- **Severity as rated by the review**, not re-rated for drama. If the ledger has a verifier's
  rating, use it.
- **Be honest about limits.** A code review is point-in-time and reads code; it is not a
  penetration test and does not cover the hosting account, cloud console, or runtime config
  unless those were reviewed. Say what was and wasn't in scope.
- **Plain language in the first two sections, always** — even for an engineering audience.

## Structure

Write it to `.securitymaxxing/report-YYYY-MM-DD.md` (one per day; overwrite today's if re-run),
then print the path and the verdict paragraph.

```
# Security review — <app name>
<date> · commit <sha> · <what was run> · prepared with securitymaxxing

## The verdict
One paragraph. Is it safe to put (or keep) on the internet? Yes / yes once these N things are
done / not yet — and the one thing standing in the way. Then a single line:
CRITICAL n · HIGH n · MEDIUM n · LOW n · INFO n   (open findings only)

## What could actually happen
The 3–5 most important risks, each as a short paragraph in plain English: what someone could do,
to whom, and how likely — no jargon, no IDs. ("Any logged-in customer can read any other
customer's invoices by changing a number in the link.")

## Fix plan
| When | Fix | Why it matters | Effort |
Now (before launch / this week) → Next (this month) → Later (hygiene). Effort as S / M / L.
Then a separate list: **Things only you can do** — rotate a key, change a dashboard setting,
notify users — so they can't be missed.

## Progress since last review        (only if the ledger has history)
New · still open · fixed · regressed — with names, not just counts.

## Findings in detail
Every open finding, most severe first, in the standard finding format (location, evidence,
exploit path, impact, fix, confidence), plus `proof:` if redteam ran. Fixed findings in a short
table at the end.

## What was checked and found sound
Areas reviewed with no finding — named specifically. This is what lets the reader trust the
rest.

## Scope and limits
What was reviewed (paths, entry-point count if known), what wasn't, how (code review / deep
multi-agent review with independent verification / PoC testing against local or staging), and
this sentence, verbatim:
"This is a point-in-time review of the source code. It is not a penetration test or a guarantee
that no other vulnerabilities exist."
```

For `client` audiences, also add at the top, under the title: who the review was prepared for, by
whom, and the review dates — leave `<client>` and `<reviewer>` placeholders if you don't know them,
and say so in your reply.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Open CRITICAL/HIGH → `/securitymaxxing:fix` on them, then `/securitymaxxing:audit` to confirm and
  re-run this report.
- Nothing serious open → `/securitymaxxing:ship-check`.
