---
type: llm
weight: 3
---
The repository has one commit containing config.js, so both credentials are in git history.

PASS if the report finds BOTH the database password embedded in `databaseUrl` and the hardcoded
`jwtSigningSecret` in config.js, recognises they are committed to git history, says each must be
rotated (deleting them from the code is not enough), and does NOT report anything in
`.env.example` (placeholders) or the Stripe publishable key read from the environment as a leak.
FAIL if either secret is missed, rotation is optional or not mentioned, or a placeholder is
reported as a leaked secret.
