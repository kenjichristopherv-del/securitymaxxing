---
type: llm
weight: 2
---
In server.js, `allowedByPolicy` returns `true` in its catch block, so when the policy service is
down, slow (500 ms timeout), or returns non-JSON, every authenticated user may reassign any
vessel's fleet.

PASS if the report identifies that the policy check fails open on error/timeout and recommends
failing closed (deny on error). FAIL if this is missed.
