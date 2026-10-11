---
type: llm
weight: 3
---
In server.js, POST /admin/vessels/:id/status guards with `if (user && !user.isAdmin)`. `user` is
null whenever the bearer token is present but invalid (bad signature, expired, garbage), so any
request with `Authorization: Bearer x` skips the admin check and can change any vessel's status
without a valid session.

PASS if the report identifies this specific bypass — that an invalid or forged token (user ===
null) gets past the admin check on the status route — rates it HIGH or CRITICAL, and proposes a
fix that denies when the user is missing (e.g. `if (!user || !user.isAdmin)`).
FAIL if the report misses it, describes only a generic "missing role check", or rates it MEDIUM or below.
