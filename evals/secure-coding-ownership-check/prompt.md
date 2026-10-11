---
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Write, Glob, Grep, Skill]
tags: [skill, secure-coding]
---

In a new file invoices.js, write an Express router with GET /invoices/:id that returns the
invoice for the logged-in user. Assume `req.user` is set by our auth middleware and that
`db.invoices.findById(id)` returns `{ id, ownerId, amountCents, memo }` or null. Export the router.
