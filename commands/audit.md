---
description: Full evidence-based security audit of the codebase — traced findings with file:line, exploit paths, severity, and patches.
argument-hint: "[path or area, e.g. src/api or 'the auth flow'] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git ls-files:*), Bash(git diff:*), Bash(cat:*), Bash(ls:*), Bash(find:*), Bash(rg:*), Bash(wc:*), TodoWrite
---

# Full security audit

Perform a rigorous application security audit. Follow the `security-review-method` skill for
evidence discipline, severity, and the finding format. **This is read-only — do not edit any
file.**

Scope: $ARGUMENTS

If no scope was given, audit the whole repository, prioritizing code reachable from untrusted
input.

## Phase 1 — Map the attack surface before reading any vulnerability

Do not start grepping for bad patterns. Start by understanding what this application *is*.

1. Identify the stack: read manifests (`package.json`, `requirements.txt`, `pyproject.toml`,
   `go.mod`, `Gemfile`, `pom.xml`, `composer.json`, `Cargo.toml`) and note frameworks **and
   versions** — the framework's default protections determine which findings are real.
2. Enumerate every **entry point**, because these are the only places an attacker touches:
   - HTTP routes / controllers / serverless handlers / RPC + GraphQL resolvers
   - WebSocket and SSE handlers
   - Webhook receivers (these are usually the weakest — often unauthenticated by design)
   - Message queue / cron / background job consumers
   - CLI arguments and env-driven behavior, if the tool is invoked with untrusted input
   - File upload and import paths
3. Establish the **trust boundaries**: what is public, what needs a session, what needs an
   elevated role, what is tenant-scoped. Find the middleware or decorator that enforces each,
   and note anything that bypasses it.
4. Locate the data stores, the secrets sources, and every outbound call to a third party.

Write this map down as a short section at the top of your report. It is the reader's proof
that you understood the system before you judged it.

## Phase 2 — Review each class against the actual code

Work through these. For each, state what you found **or** that you checked it and it was clean.

**A. Access control** (usually the highest-yield class, and the one scanners cannot find)
- Object-level: every handler that takes an ID from the request — is ownership/tenancy checked
  on the *server*, in the same query or immediately after? Trace at least a representative
  sample of ID-taking endpoints individually. IDOR hides in the one endpoint that forgot.
- Function-level: are role checks applied to every mutating and admin route, or only to the
  ones someone remembered? Look for routes registered outside the guarded router.
- Field-level: mass assignment / over-posting — can the client set `role`, `is_admin`,
  `tenant_id`, `price`, `credits`, `status` by including it in the body?
- Multi-tenancy: is the tenant filter enforced centrally (RLS, base query scope) or repeated
  by hand in every query? Hand-repeated filters always have a gap — find it.
- Client-side-only checks: a hidden UI button is not an authorization control.

**B. Injection and untrusted input**
- SQL/NoSQL: string-built queries, `raw()`/`literal()` escapes, ORM `where` fed a raw object,
  dynamic ORDER BY / table names, `$where` and operator injection in Mongo.
- Command: `exec`, `execSync`, `system`, `popen`, `subprocess` with `shell=True`, backticks.
- Path traversal: user input reaching `path.join`/`open`/`readFile` without containment.
- SSRF: user-supplied URLs fetched server-side — check for cloud metadata (`169.254.169.254`),
  internal ranges, `file://`/`gopher://` schemes, and redirect-following.
- Deserialization: `pickle`, `yaml.load`, Java native, PHP `unserialize`, `Marshal.load`.
- Template injection: user input concatenated into a template *string* rather than passed as data.
- XSS: `dangerouslySetInnerHTML`, `innerHTML`, `v-html`, `|safe`, `Markup`, unescaped
  interpolation, `javascript:` URLs, and any place the framework's auto-escaping was opted out of.

**C. Authentication and session**
- Password storage (bcrypt/scrypt/argon2 vs anything else), reset-token generation and
  expiry, single-use enforcement, and whether reset links leak via Referer.
- JWT: algorithm confusion / `alg: none`, unverified `decode`, missing `exp`/`aud`/`iss`
  checks, secrets in the repo, no revocation path.
- Session cookies: `HttpOnly`, `Secure`, `SameSite`, fixation on privilege change, lifetime.
- MFA/OAuth: state parameter, PKCE, redirect_uri allowlist, token handling.
- Rate limiting and lockout on login, reset, OTP, and any enumeration-prone endpoint. Check
  whether responses differ for existing vs non-existing accounts.

**D. Secrets and configuration**
- Hardcoded credentials, API keys, private keys, connection strings — in code, config,
  Dockerfiles, CI workflows, and committed `.env` files.
- Check whether anything sensitive is tracked by git that shouldn't be (`git ls-files`).
- Debug flags, permissive CORS (`*` with credentials, or origin reflection), verbose errors,
  exposed admin/metrics/actuator/graphiql endpoints in production paths.

**E. Data protection**
- PII and secrets in logs, error reports, analytics events, or third-party telemetry.
- Crypto misuse: ECB, static/reused IVs, `Math.random()` for tokens, MD5/SHA1 for passwords,
  homemade crypto, missing certificate verification.
- What is stored that should not be stored at all (raw card data, full ID numbers, plaintext tokens).

**F. Supply chain and CI**
- Direct dependencies with known-vulnerable ranges; unpinned or wildcard versions;
  install-time scripts; typosquat-shaped names.
- CI: `pull_request_target` with checkout of untrusted head, secrets exposed to fork PRs,
  unpinned third-party actions, artifacts leaking tokens.

**G. Business logic** (no scanner finds these — think like a fraudster)
- Race conditions on balance, inventory, coupon redemption, quota.
- Negative/overflow quantities and prices; currency and rounding abuse.
- Workflow steps that can be skipped or replayed; idempotency on payment endpoints.
- Webhook handlers that trust the payload without verifying a signature.

**H. AI/LLM surfaces**, if present — prompt injection, tool/agent authority, output used as
code or as an authorization decision. Cover these using the `llm-app-security` skill.

## Phase 3 — Verify before you report

For every candidate finding, before it goes in the report:

- Name the source and the sink explicitly. If you can't, downgrade to **Needs verification**.
- Look for the mitigation you may have missed — read the middleware, the base model, the
  framework default for that version.
- Find the callers. Confirm the path is reachable by someone who shouldn't reach it.
- Ask: what does the attacker actually *get*? If the answer is nothing, drop it.

Actively try to disprove your own findings. A finding that survives an honest attempt to kill
it is worth reporting; one that doesn't was never real.

## Phase 4 — Report

Use the finding format from `security-review-method`. Structure:

1. **Attack surface map** — the Phase 1 output, kept short.
2. **Findings** — most severe first, in the standard format.
3. **Checked and clean** — classes you verified with no finding. Name them; this is coverage evidence.
4. **Coverage and limits** — what you could not review (unreadable, out of scope, needs a
   running system), and what a human should verify manually.
5. **Do this first** — the top 3 fixes ranked by risk reduced per unit of effort.

Then stop. Do not begin fixing. Offer `/securitymaxxing:fix` for remediation.

## Recommended next step

Close by printing one line — `→ Recommended next: …` — chosen by what you found:
- Confirmed CRITICAL/HIGH → `/securitymaxxing:redteam` to prove each with a working PoC, then `/securitymaxxing:fix`.
- Only LOW/INFO, or clean → say so; `/securitymaxxing:harden` for the infra side, `/securitymaxxing:ship-check` before launch.
- A finding the reader wants unpacked → `/securitymaxxing:explain <finding>`.
