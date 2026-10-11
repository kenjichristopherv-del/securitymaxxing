---
name: security-review-method
description: >
  The evidence discipline for any security review, audit, threat model, or vulnerability
  triage. Use this skill whenever performing or reporting on application security work:
  auditing code for vulnerabilities, reviewing a diff or PR for security impact, triaging
  a scanner result, judging whether a finding is real, or assigning security severity. Trigger on
  'security review', 'security audit', 'is this vulnerable', 'pentest my code', 'find
  vulnerabilities', 'CVE', 'CWE', 'OWASP', 'vulnerability severity', 'false positive',
  'exploitable'.
  Defines the source-to-sink proof requirement, the severity rubric, the finding format,
  and the anti-false-positive rules that every securitymaxxing command depends on.
---

# Security Review Method

A security report that cannot be acted on is worse than no report. It burns the reader's
trust, and the next real finding gets ignored. This skill defines how to produce reports
people act on.

## The one rule

**No finding without a traced path from an attacker-controlled source to a dangerous sink.**

You must be able to name both ends:

- **Source** — where attacker-controlled data enters. HTTP body/query/path/header, cookie,
  uploaded file, webhook payload, message queue, third-party API response, database row that
  another user wrote, environment variables or files writable by another tenant in a shared runtime, LLM output derived from any of
  the above.
- **Sink** — where it does damage. SQL/NoSQL/ORM raw query, shell/`exec`/`spawn`, filesystem
  path, HTML/DOM insertion, template render, deserializer, HTTP client (SSRF), redirect
  target, auth/authz decision, price/quantity/role field, log line, `eval` — and **error
  paths**: a `catch`/`except` or timeout inside an auth, authz, signature, or validation check
  that falls through to allow (fail-open, OWASP A10:2025).

If you cannot name both, you do not have a finding. You have a hypothesis — report it as
**Needs verification** and state exactly what you'd need to read to settle it.

## Anti-false-positive rules

These exist because the default failure mode of AI security review is confident nonsense.

1. **Check the mitigation before you write the finding.** Parameterized queries, ORM binding,
   framework auto-escaping, an explicitly set `SameSite=Lax/Strict` session cookie (browser
   default-Lax is not a mitigation — it is Chromium-only and has a 2-minute POST exception), CSRF
   middleware already mounted,
   a validation layer upstream. Read the framework's actual behavior for the version in
   `package.json` / `requirements.txt` / `go.mod`. Most "SQL injection in an ORM" findings die here.
2. **Follow the call chain to a real entry point.** A dangerous function that is only ever
   called with a hardcoded constant is not a vulnerability. Grep for every caller.
3. **Trust boundaries are the whole game.** Code that is only reachable by an authenticated
   admin has a different severity than the same code on a public endpoint. Establish who can
   reach it before you rate it.
4. **Non-shipping code is not a production vulnerability.** Tests, fixtures, seed scripts,
   local dev docker-compose, examples in docs. Report them separately as hygiene if they
   leak real credentials — otherwise leave them out. Verify they are not shipped or deployed
   before dismissing them.
5. **Do not report the absence of defense-in-depth as a vulnerability.** A missing
   `X-Frame-Options` on a JSON API is not a finding. A missing CSP on an app that already
   escapes all output is LOW at most. Say what the actual exposure is.
6. **Zero findings is a valid, respectable result.** Never pad a report to look thorough. If
   the code is clean, say the code is clean and describe what you checked so the reader can
   judge the coverage.
7. **Never invent a CVE, CWE number, or advisory.** If you are not certain of the identifier,
   describe the class in words instead.
8. **Distinguish "I read this" from "I inferred this."** Quote the code you actually read.
9. **Check the version before citing a known issue.** A vulnerable-function or advisory finding
   in a dependency needs the installed version from the lockfile, not the manifest range.

## Severity rubric

Rate by *realistic exploitability × impact*, not by scary-sounding class name.

| Severity | Bar |
|---|---|
| **CRITICAL** | Unauthenticated attacker gets RCE, full database read/write, auth bypass, or takeover of arbitrary accounts. Exploitable against production as it stands today. |
| **HIGH** | Authenticated attacker crosses a trust boundary — reads/writes another tenant's or user's data, escalates privilege, achieves stored XSS, or extracts secrets/keys. Also: a credential committed to a repo that is currently valid. |
| **MEDIUM** | Real exploit path but meaningful preconditions (specific user interaction, race window, non-default config), or limited impact — self-XSS, verbose error leaking stack traces, missing rate limit on an abusable-but-not-critical endpoint, open redirect. |
| **LOW** | Defense-in-depth gap with no demonstrated exploit path given the current code. |
| **INFO** | Hygiene, hardening, or maintainability-of-security observation. |

Two rules on top of the table:

- **Chained findings get rated as the chain.** Two MEDIUMs that combine into account takeover
  are reported once, as one CRITICAL, with both links shown.
- **Downgrade for compensating controls you verified**, and name the control. Don't downgrade
  for a control you assume exists.

## Finding format

Report every finding in exactly this shape. Ordered most severe first.

```
[SEVERITY] Short, specific title
Location:   path/to/file.ext:120-135  (plus any secondary sites)
Class:      OWASP A01:2025 Broken Access Control / CWE-639
Confidence: Confirmed | Likely | Needs verification

Evidence:
  <the actual code, quoted, with the source and sink both visible>

Exploit path:
  1. Attacker authenticates as any user (or: no auth required)
  2. Sends POST /api/orders/1042 with body {...}
  3. Handler reads req.params.id at line 120 and queries without an owner check at line 131
  Result: reads another tenant's order, including their billing address

Impact:
  <what the attacker actually gets, in business terms>

Fix:
  <the specific change — show the patch, not "validate input">

Residual risk:
  <what the fix does NOT cover, if anything>
```

Close every report with a **Coverage** section: what you reviewed, what you could not reach,
and what a human should still check manually. That is how the reader calibrates trust.

## Fix guidance quality bar

- Show the corrected code, in the project's existing style and framework idiom.
- Prefer the fix that removes the vulnerability class, not the single instance. A helper that
  makes the safe path the easy path beats one patched call site.
- Never propose a fix that depends on a library or version the project does not have without
  saying so.
- Flag when a fix has a breaking or behavioral side effect. Security fixes that silently break
  users get reverted, which leaves you less secure than before.
- If the fix requires a rotation (leaked key, exposed token), say so explicitly — patching the
  code does not un-leak the secret.

## Scope discipline

Do not modify code during a review unless explicitly asked. A review is read-only. Findings
first, patches second, and only on request. Never run exploits during a review: active testing
happens only in `/securitymaxxing:redteam`, only against systems the user owns or is authorized
to test, and only after confirming the target. Never touch infrastructure you were not pointed
at, and never exfiltrate real secrets into the transcript — refer to them by location, redact
the value (`AKIA…7Q3F`).

## Always end with the next step

Every command in this toolkit closes its report with one line — `→ Recommended next: …` — so the
user is never left holding findings with no path forward. The through-line is **find → prove →
fix → re-review**:

- A review surfaced exploitable findings → prove them with `/securitymaxxing:redteam`, then patch
  with `/securitymaxxing:fix`.
- `fix` finished → re-run the review that raised the finding, to confirm it now comes back clean.
- The review was clean → say so, and point at the next gate (`/securitymaxxing:ship-check`) or the
  next surface — never invent work to fill the line.

Tailor the recommendation to what you actually found. Never end a report without it.
