---
description: Prove it — build working proof-of-concept exploits for findings against your own app, and confirm defenses actually hold.
argument-hint: "[finding, endpoint, or 'validate the last audit']"
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, TodoWrite, TaskCreate, TaskUpdate, TaskList
---

# Red team — validate by attacking

A finding is a hypothesis until an exploit proves it. This command closes the loop: it builds a
**working proof-of-concept against the user's own application**, confirms whether each finding
is genuinely exploitable, and — just as important — confirms that the places you believe are
defended actually resist the attack.

Target: $ARGUMENTS

If empty, validate the findings from the most recent review in this conversation; if there are
none there, use the `open` findings in `.securitymaxxing/findings.json`; if there are none
anywhere, ask for a target.

Record each verdict in the ledger if it exists: set `"proof": "exploited" | "not_exploitable" |
"blocked_by <control>" | "static_only"` and `"proved_on": "YYYY-MM-DD"` on the finding. Don't change
its `status` — whether a finding is accepted or a false positive is the user's call.

## Authorization — read this first, every time

This is the one securitymaxxing command that sends attack traffic. It is the explicit, scoped
exception to the review method's rule — never run exploits during a review: active testing
happens only here, only against systems the user owns or is authorized to test, and only after
confirming the target in this session. Local or staging by default.

- Confirm the target is the user's own application — local, a dev/staging instance, or a
  system they've stated they control. If it's ambiguous, **ask before sending a single request.**
- Never point this at a third-party service, a production system you weren't told is fair game,
  or any host the user doesn't own. If asked to, decline and say why.
- Prefer a local or staging run. If production is the only option, say so plainly, keep every
  test non-destructive and rate-limited, and get explicit confirmation first.
- **Non-destructive by default.** Demonstrate read access, not deletion. Prove you *can* write
  by writing a marker you then clean up — never by destroying real data. For anything
  irreversible (delete, transfer, send), describe the exploit and stop short of firing it
  unless the user explicitly asks.
- Redact real secrets and real user data out of the transcript. Prove the leak by showing
  *that* data came back and its shape — not by dumping someone's PII.
- **Never commit, push, or run destructive git or filesystem commands, and never modify
  application source** — PoCs and tests only. Fixing is `/securitymaxxing:fix`'s job.

If any of this can't be satisfied, fall back to a **static** proof: the exact request, the code
path it hits, and the expected result — without sending it.

## Step 1 — Decide what you're validating

- If handed a specific finding or a prior audit's output, take each finding in turn.
- If handed an endpoint or area, first run the relevant checks (borrow from `audit`, `authz`,
  `injection`) to produce candidate findings, then validate those.
- Build a task list (TodoWrite or TaskCreate, whichever you have), one entry per claim you're going to try to prove.

For each claim, write down **the falsifiable prediction** before you test: "if this IDOR is
real, requesting order 1042 as user B returns user A's data." A test without a prediction proves
nothing.

## Step 2 — Establish the harness

Figure out how to exercise the app safely and reproducibly:

- Is there a way to run it locally (a dev script, docker-compose, a test server)? Prefer that.
- Can you create two throwaway accounts (attacker + victim) to prove cross-user access without
  touching real users? Do that — it's the cleanest possible proof of an authz bug.
- Use the project's own test framework where one exists — a failing security test is the most
  durable artifact you can leave behind.
- For a live target, use `curl`/`httpie`/a scripted client with the user's own credentials or
  test tokens, never someone else's.

Write throwaway PoCs to `.securitymaxxing/poc/` and tell the user to add it to `.gitignore`. Only
place them in the project's test suite when the user agrees to keep them.

State the harness you're using so the result is reproducible.

## Step 3 — Attack, per claim

Work the claim to a definite yes or no. Techniques, matched to the finding class:

- **Broken access control / IDOR** — authenticate as attacker, request the victim's resource by
  ID; a leak is the victim's data in the response. Try read and write paths, nested and batch
  routes, and swapping IDs in every parameter, not just the obvious one.
- **Injection** — send the payload, then confirm the *effect*, not just an error: a SQL payload
  that returns an extra row, a boolean-based response difference, or a time-based delay; a
  command payload that makes a
  benign observable side effect (a marker file, a DNS/HTTP callback to a host you control); a
  path payload that reads a file it shouldn't. Escalate from a harmless probe to a proof, and
  stop at proof. Use a callback listener the user controls, not a public OAST service, if any real
  data could be in the callback.
- **XSS** — confirm the payload survives into the response unescaped and executes in the DOM;
  for stored XSS, show it firing for a *second* account.
- **SSRF** — prove the server fetched an internal target you chose (a callback listener, or a
  benign internal endpoint), and note if cloud metadata was reachable — stop at the metadata
  index or the role *name*; never request `security-credentials/<role>` or any token endpoint.
- **Auth** — replay a token after logout, forge a JWT with `alg:none` or algorithm confusion
  (re-sign an RS256 token as HS256 using the public key as the HMAC secret), reuse a reset token,
  and exceed the expected rate limit by a small bounded margin (limit + a few) against your own
  test account only — never against real users' accounts.
- **Business logic / race** — fire N concurrent requests and show the invariant broke (balance
  went negative, the coupon redeemed twice, inventory oversold).
- **Secrets** — only with the user's explicit confirmation that the credential belongs to them
  or their org: make a single minimal, read-only identity call (e.g. `aws sts get-caller-identity`,
  GitHub `GET /user`), passing the secret via an environment variable — never as a literal in the
  command, never echoed. Then state it must be rotated. Don't exercise it further.

For each, capture the exact request sent and the exact response that proves (or disproves) the claim.

## Step 4 — Confirm the defenses hold

The other half of red teaming, and the half that builds real confidence: take the controls the
app *does* have and try to get around them.

- Where you or a prior review said "this is fine because X protects it" — attack X directly.
  Bypass the WAF-style filter with encoding. Beat the sanitizer with a mutation payload. Try the
  alternate route that skips the middleware. Send the double-encoded, unicode, and case-varied
  variants.
- Re-run the exploit for anything that was recently *fixed* — a fix isn't verified until the
  original attack fails against it. Confirm the fix also blocks the obvious bypasses, not just
  the literal payload from the report.
- A control that survives an honest attempt to defeat it is worth reporting as **verified
  strong** — say so specifically. That statement is worth as much to the user as any finding.

## Step 5 — Report

For each claim:

```
[SEVERITY] Title — VERDICT: EXPLOITED / NOT EXPLOITABLE / BLOCKED BY <control>
Prediction:  <what you expected if it were real>
Harness:     <local / staging / test accounts / live-with-consent>
Request:     <the exact request(s) sent — redacted>
Response:    <the proof, or the block — redacted>
Reproduce:   <copy-pasteable steps or the test that now encodes this>
Cleanup:     <what you created and removed — or "none">
```

Then:

- **Confirmed exploitable** — the real findings, now with a PoC. These jump the queue.
- **Could not exploit** — hypotheses that didn't survive contact. Say why they failed; that's
  often a control working correctly, which is good news worth stating.
- **Verified strong** — defenses you actively attacked and could not beat, named specifically.
- **Not tested** — anything you left as a static proof because it was destructive, out of scope,
  or unauthorized, plus what it would take to test it safely.

End by handing confirmed-exploitable findings to `/securitymaxxing:fix`, and offering to keep
the PoCs as regression tests so a fix can never silently regress.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Anything EXPLOITED → `/securitymaxxing:fix`, and keep the PoC as a regression test so it can't silently return.
- All NOT EXPLOITABLE / BLOCKED → say so plainly; that verified-strong result is itself the finding.
