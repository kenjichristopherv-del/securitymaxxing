---
description: Prove it — build working proof-of-concept exploits for findings against your own app, and confirm defenses actually hold.
argument-hint: "[finding, endpoint, or 'validate the last audit']"
allowed-tools: Read, Grep, Glob, Bash, Write, TodoWrite
---

# Red team — validate by attacking

A finding is a hypothesis until an exploit proves it. This command closes the loop: it builds a
**working proof-of-concept against the user's own application**, confirms whether each finding
is genuinely exploitable, and — just as important — confirms that the places you believe are
defended actually resist the attack.

Target: $ARGUMENTS

## Authorization — read this first, every time

This runs active attacks. That is legitimate **only** against systems the user owns or is
explicitly authorized to test.

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

If any of this can't be satisfied, fall back to a **static** proof: the exact request, the code
path it hits, and the expected result — without sending it.

## Step 1 — Decide what you're validating

- If handed a specific finding or a prior audit's output, take each finding in turn.
- If handed an endpoint or area, first run the relevant checks (borrow from `audit`, `authz`,
  `injection`) to produce candidate findings, then validate those.
- Build a TodoWrite list, one entry per claim you're going to try to prove.

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

State the harness you're using so the result is reproducible.

## Step 3 — Attack, per claim

Work the claim to a definite yes or no. Techniques, matched to the finding class:

- **Broken access control / IDOR** — authenticate as attacker, request the victim's resource by
  ID; a leak is the victim's data in the response. Try read and write paths, nested and batch
  routes, and swapping IDs in every parameter, not just the obvious one.
- **Injection** — send the payload, then confirm the *effect*, not just an error: a SQL payload
  that returns an extra row or a boolean-based timing difference; a command payload that makes a
  benign observable side effect (a marker file, a DNS/HTTP callback to a host you control); a
  path payload that reads a file it shouldn't. Escalate from a harmless probe to a proof, and
  stop at proof.
- **XSS** — confirm the payload survives into the response unescaped and executes in the DOM;
  for stored XSS, show it firing for a *second* account.
- **SSRF** — prove the server fetched an internal target you chose (a callback listener, or a
  benign internal endpoint), and note if cloud metadata was reachable — without exfiltrating
  real credentials.
- **Auth** — replay a token after logout, forge a JWT with `alg:none` or the pinned-algo swap,
  reuse a reset token, brute the endpoint past where a limit should have stopped you.
- **Business logic / race** — fire N concurrent requests and show the invariant broke (balance
  went negative, the coupon redeemed twice, inventory oversold).
- **Secrets** — confirm a discovered credential is *currently valid* with a single minimal,
  read-only authenticated call to its provider, then state it must be rotated. Don't exercise it
  further.

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
