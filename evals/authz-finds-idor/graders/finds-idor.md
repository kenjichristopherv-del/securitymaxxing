---
type: llm
weight: 3
---
PASS if the report identifies that GET /api/notes/:id returns a note without checking that it
belongs to the requesting user (an IDOR / broken object-level authorization), so one user can
read another user's note, AND it points at the handler in server.js (a line number or the code
quoted), AND it proposes a concrete fix (an ownership check or an owner-scoped lookup).
FAIL if the IDOR is missed, described only vaguely, or reported without a location.
