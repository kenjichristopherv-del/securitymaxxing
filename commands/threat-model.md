---
description: STRIDE threat model of the system's design — trust boundaries, attacker goals, and the controls that are missing.
argument-hint: "[system, feature, or design doc to model] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git ls-files:*), Bash(find:*), Bash(rg:*), Write
---

# Threat model

Model the design, not the syntax. A code audit finds bugs in what was built; a threat model
finds the control that was never built at all. Follow `security-review-method` for rigor,
but note that findings here are **missing controls**, not traced exploits — say so plainly and
rate them by the risk they leave open.

Subject: $ARGUMENTS

If nothing was specified, model the whole application as it exists in this repository.

## Step 1 — Establish what you're defending

Read enough of the codebase to answer these in the report. Ask the user only what you truly
cannot infer.

- **What does this system do**, and what would it mean for the business if it failed?
- **What are the assets?** Rank them. Customer PII, credentials, payment data, proprietary
  content, availability, integrity of a ledger, reputation. The ranking drives everything else.
- **Who are the actors?** Anonymous internet, authenticated user, another tenant, a
  privileged/admin user, an internal operator, a third-party integration, a compromised
  dependency, an insider. Include the ones people don't like to list.
- **What is the deployment reality?** Public internet, VPC, on-prem, mobile client, desktop
  app, air-gapped vessel/edge device. This changes which threats are credible.

## Step 2 — Draw the data flow and mark the trust boundaries

Produce a diagram as a Mermaid `flowchart`, showing external entities, processes, data stores,
and the flows between them. Mark every **trust boundary** crossing explicitly — that is where
threats live. Typical boundaries: internet→edge, edge→app, app→database, app→third party,
tenant→tenant, user→admin, host→container, client→server.

For each boundary, state what enforces it today.

## Step 3 — STRIDE, per element

For each process, data store, and flow, walk the six categories. Skip categories that genuinely
don't apply and say why — don't pad.

| | Threat | Ask |
|---|---|---|
| **S** | Spoofing | Can an actor claim to be someone else? Weak auth, forgeable tokens, unverified webhooks, missing mTLS, trusting a client-supplied user ID or `X-Forwarded-For`. |
| **T** | Tampering | Can data be modified in transit or at rest? Missing integrity checks, mutable audit logs, unsigned updates, client-controlled prices/roles, no TLS on an internal hop. |
| **R** | Repudiation | Can someone deny an action? No audit trail, logs that the actor can edit or that omit who/what/when, no correlation IDs. |
| **I** | Information disclosure | What leaks? Over-broad API responses, error messages, timing and enumeration oracles, cached/CDN'd private data, backups, logs, analytics, LLM context. |
| **D** | Denial of service | What is unbounded? Unpaginated queries, unbounded uploads, zip/regex bombs, expensive endpoints without rate limits, a single point of failure, cost-based DoS on metered third-party APIs. |
| **E** | Elevation of privilege | How does a user become an admin, or one tenant become another? Missing authz, IDOR, JWT claim trust, SSRF into an internal admin service, container escape, over-broad IAM role. |

## Step 4 — Rate and rank

For each threat: **Likelihood** (how motivated and capable must the attacker be? is it
scriptable?) × **Impact** (which ranked asset, how badly) → Critical / High / Medium / Low.

Then state, per threat:
- **Existing control** — what actually stops or limits it today, cited to `file:line` or config
  where you can. Write "none found" when there is none; that is the whole point of the exercise.
- **Gap** — what the existing control fails to cover.
- **Proposed control** — specific and buildable. "Add authorization" is not a control;
  "enforce `tenant_id` at the query layer via Postgres RLS, so a missed filter fails closed"
  is a control.
- **Residual risk** after the proposed control, and whether that residual is worth accepting.

## Step 5 — Deliver

Output:

1. System description and ranked assets
2. Mermaid data-flow diagram with trust boundaries
3. Actor list
4. STRIDE threat table, ranked by risk
5. **Top risks** — the 5 that matter, with the control to build for each
6. **Accepted risks** — things you judged not worth defending, stated explicitly so the
   decision is on the record rather than accidental
7. **Assumptions** — everything you inferred rather than confirmed. A threat model built on
   silent assumptions is how systems get owned.

Offer to save this to `docs/threat-model.md`. Ask before writing.

## Recommended next step

Close by printing one line — `→ Recommended next: …`: verify the top risks against the code —
`/securitymaxxing:authz`, `/securitymaxxing:injection`, or `/securitymaxxing:authn` for the
app-layer ones, `/securitymaxxing:harden` for the infra ones. A threat model is a list of
hypotheses until the code confirms each.
