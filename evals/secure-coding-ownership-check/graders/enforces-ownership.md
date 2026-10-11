---
type: llm
weight: 3
focus: { source: file, path: invoices.js }
---
PASS if the handler enforces on the server that the invoice belongs to req.user (compares
ownerId to the user's id, or scopes the lookup by owner) and returns 404 (preferred) or 403 when
it does not, and the response does not include fields beyond the invoice itself.
FAIL if any authenticated user can fetch any invoice by changing the id.
