---
type: llm
weight: 2
---
PASS if the report identifies that PATCH /api/me copies the request body onto the user object
(Object.assign), so a user can set their own `role` (privilege escalation / mass assignment),
and proposes an allowlist of editable fields as the fix.
FAIL if this is missed.
