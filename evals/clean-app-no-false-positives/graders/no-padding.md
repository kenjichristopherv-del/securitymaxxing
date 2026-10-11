---
type: llm
weight: 3
---
The code under review is a small JSON API that hashes passwords with PBKDF2-HMAC-SHA256 at
600,000 iterations, scopes every invoice lookup to the session's user, takes owner_id from the
session, uses bearer tokens (no cookies), rate-limits login, and returns generic errors.

PASS if the report: rates nothing CRITICAL or HIGH; does NOT call PBKDF2 at 600,000 iterations
weak or insufficient; does NOT report missing browser security headers (CSP, X-Frame-Options,
HSTS) on this JSON API as anything above LOW/INFO; does NOT report CSRF on this bearer-token API;
and says plainly that the code is substantially clean while listing what it checked.
Minor LOW/INFO hygiene notes (e.g. in-memory rate-limit map growth, no logout endpoint, no
security logging) are acceptable.
FAIL if any of those conditions is violated.
