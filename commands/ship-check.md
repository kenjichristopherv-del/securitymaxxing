---
description: Pre-launch security gate — is this actually safe to put on the internet? Blocking issues vs. things you can fix next week.
argument-hint: "[what you're shipping] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(rg:*), Bash(ls:*), Bash(find:*), Bash(cat:*)
---

# Ship check

You are the last reviewer before this goes to production. Decide whether it ships. Follow
`security-review-method`. **Read-only.**

Shipping: $ARGUMENTS

Be direct. The answer is a verdict, not a list of considerations. If it isn't safe to ship,
say "do not ship" and name the one thing that has to change.

## Blockers — any one of these stops the launch

Check each and report pass/fail with evidence.

1. **A live secret is in the repository or in the build.** API keys, private keys, database
   URLs with passwords, service-account JSON, `.env` committed. Check git history, not just
   the working tree: `git log --all --diff-filter=A --name-only`. A secret in history is
   leaked even if deleted from HEAD — it must be **rotated**.
2. **An endpoint that handles user data has no authentication**, or authentication that can be
   bypassed by omitting a header, sending an empty token, or hitting an alternate route.
3. **No authorization on user-scoped data.** Any endpoint where changing an ID in the request
   returns someone else's data. Verify at least the highest-value ones by reading the query.
4. **Injection reachable from an unauthenticated endpoint.** SQL, command, or SSRF.
5. **Passwords stored with anything other than bcrypt/scrypt/argon2**, or stored recoverably.
6. **Debug mode, stack traces, or a dev/admin console enabled in the production config path.**
   Includes Django `DEBUG`, Flask debug, `graphiql`, Spring actuator, `/metrics` unauthenticated,
   source maps exposing server code, verbose error middleware.
7. **The database or an internal service is reachable from the public internet** with default
   or weak credentials.
8. **TLS is absent, terminated wrong, or verification is disabled** anywhere in the request path
   (`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify`).
9. **A known-exploited vulnerability in a direct dependency** with no compensating control.
10. **User uploads are served from the app's own origin without content-type control**, or
    stored in a path where they can be executed.

## Should-fix before launch

- Rate limiting on login, password reset, signup, OTP, and any expensive or metered endpoint.
- Account enumeration in auth responses and timing.
- Session cookie flags: `HttpOnly`, `Secure`, `SameSite`; sensible expiry; rotation on login.
- CSRF protection on cookie-authenticated state-changing routes.
- CORS: no `*` with credentials, no reflecting arbitrary `Origin`.
- Security headers for browser-rendered apps: CSP, `X-Content-Type-Options`, HSTS,
  `Referrer-Policy`, frame ancestors.
- Input size limits: request body, upload size, array lengths, pagination caps. Unbounded
  anything is a cost and availability problem the day someone notices.
- Webhook signature verification on every inbound webhook.
- No PII or tokens in application logs or third-party analytics.
- Errors return a generic message to the client and detail only to the log.

## Operational readiness — the part everyone skips

Security is also whether you'd survive the incident:

- Are auth failures, authz denials, and admin actions logged with actor, action, target, time?
- Can you tell if you're being attacked right now? Any alerting at all?
- Backups: do they exist, are they encrypted, has a restore ever been tested?
- Can you revoke a session, a key, or a user immediately if you have to?
- Is there a documented way for someone to report a vulnerability to you?
- Do you know which third parties hold your users' data, and what happens when one is breached?

## Verdict

Finish with exactly this:

```
VERDICT: SHIP / SHIP WITH CONDITIONS / DO NOT SHIP

Blocking (fix before launch):
  1. …

Fix within the first week:
  1. …

Accepted for now (and why that's defensible):
  1. …

Not verifiable from code — confirm manually:
  1. …
```

If the answer is SHIP, say it without hedging. Manufacturing doubt to seem thorough is its own
kind of unhelpful.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- DO NOT SHIP / SHIP WITH CONDITIONS → `/securitymaxxing:fix` the blockers, then re-run `/securitymaxxing:ship-check` to confirm the gate is green.
- SHIP → ship.
