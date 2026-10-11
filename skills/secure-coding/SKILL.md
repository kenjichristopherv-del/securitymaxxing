---
name: secure-coding
description: >
  Load BEFORE writing or editing any server-side code that handles a request, a user, an ID, a
  query, a file, a secret, or a dependency — it supplies the secure pattern to write the first
  time, so the vulnerability never exists. Covers: HTTP routes, routers, API endpoints, handlers,
  controllers, resolvers, webhooks; login, signup, sessions, passwords, tokens, JWTs; database
  queries, especially raw SQL or dynamic query building; anything that reads a user/tenant/
  resource ID from a request (the ownership check); file uploads, downloads, and filesystem
  paths; shell or subprocess calls; outbound HTTP to user-supplied URLs; rendering user content
  as HTML; encryption, hashing, random tokens; secrets, API keys, env config; CORS, cookies,
  security headers; adding a dependency. Any web stack (Express, Next.js API routes, FastAPI,
  Django, Flask, Rails, Spring, Go net/http). Trigger on 'route', 'endpoint', 'router', 'API',
  'handler', 'controller', 'GET /', 'POST /', ':id', 'req.user', 'current user', 'login', 'auth',
  'query', 'SQL', 'upload', 'webhook', 'make this secure', 'harden', 'add auth'.
---

# Secure Coding

The cheapest security fix is the one you never have to make. When writing code on any of the
surfaces below, use these patterns by default — without being asked, and without announcing
that you're doing something special. Secure code should just look like normal good code.

When you deviate from a safe default for a real reason, say so in one line and explain the
tradeoff. Don't silently ship the unsafe version.

## Authorization — the highest-value habit

**Every query that fetches a user-owned resource must constrain by the owner in the query
itself**, using the identity from the session. Not fetched-then-checked, and never using an
owner ID that came from the request.

```
# wrong — the ID is attacker-controlled, ownership is never checked
order = db.query(Order).filter(Order.id == request.params.id).one()

# right — ownership is part of the lookup; a wrong ID is simply not found
order = db.query(Order).filter(
    Order.id == request.params.id,
    Order.user_id == session.user_id,      # from the session, never the request
).one_or_none()
```

Rules that follow from this:

- The acting identity comes from the verified session. Never from a request body field, a
  header, a query parameter, or a client-supplied claim you didn't verify.
- Apply it to **writes as much as reads**. Update and delete paths are the ones that get missed.
- For nested resources, verify the whole chain: that the project belongs to the org *and* the
  org belongs to the user.
- In multi-tenant systems, enforce the tenant filter **structurally** — row-level security, a
  scoped base query, a repository layer that can't be bypassed. Isolation enforced by
  remembering to add a `where` clause will eventually be forgotten. Design so that forgetting
  fails closed.
- Never rely on unguessable IDs as an access control. UUIDs are a speed bump, not a permission.
- Hiding a control in the UI is not authorization. Assume every endpoint is called directly.

**Never accept a raw request body into a model.** Allowlist the fields the client may write:

```
# wrong — client can set role, credits, tenant_id, is_verified…
user.update(**request.json)

# right
ALLOWED = {"display_name", "bio", "avatar_url"}
user.update(**{k: v for k, v in request.json.items() if k in ALLOWED})
```

## Untrusted input reaching a sink

Untrusted means: anything from a request, an upload, a webhook, a third-party API, an LLM, or
**a database row another user wrote**.

- **SQL** — always parameterize. Identifiers (table, column, `ORDER BY`) cannot be
  parameterized, so map them through an allowlist dictionary. Never build a query by
  concatenation or interpolation, even "just for a column name".
- **Shell** — avoid the shell entirely. Use the argument-array form (`spawn(cmd, [args])`,
  `subprocess.run([...])` without `shell=True`). Even then, prefix user-controlled filenames
  with `./` or pass `--` so a leading `-` can't become a flag. Best of all: use a library
  instead of shelling out.
- **Paths** — join, resolve, then verify containment against the resolved base directory.
  Never trust a client-supplied filename; generate the stored name server-side.
  ```
  full = os.path.realpath(os.path.join(BASE, user_input))
  if not full.startswith(os.path.realpath(BASE) + os.sep):
      raise Forbidden()
  ```
- **Outbound URLs (SSRF)** — allowlist the destination host if you possibly can. If you can't,
  allow only `http`/`https` and reject loopback (`127.0.0.0/8`, `::1`), unspecified (`0.0.0.0`,
  `::`), link-local (`169.254.0.0/16` — especially `169.254.169.254` — and `fe80::/10`), private
  (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), CGNAT `100.64.0.0/10`, and IPv4-mapped IPv6
  (`::ffff:0:0/96`). **Resolve DNS once, validate every resolved IP, then connect to that pinned
  IP** — checking the hostname and letting the HTTP client resolve again is defeated by DNS
  rebinding. Disable automatic redirects; if you must follow them, re-run the full check per
  hop. Better still, route egress through a proxy that enforces this (e.g. smokescreen).
- **HTML** — let the framework escape by default. Reach for `dangerouslySetInnerHTML`,
  `v-html`, `|safe`, or `innerHTML` only with a maintained sanitizer (DOMPurify, nh3) and
  an explicit reason. Never build a URL attribute from user input without checking the scheme
  — `javascript:` and `data:` are executable.
- **Deserialization** — `yaml.safe_load`; never `pickle`, Java `ObjectInputStream`, .NET
  `BinaryFormatter`, PHP `unserialize`, or Ruby `Marshal` on untrusted data; XML parsers with
  DTDs and external entities disabled.
- **Templates** — pass user data as *context*, never concatenate it into the template string.

Validate at the boundary with a schema (zod, pydantic, valibot, struct tags) so the rest of the
code works with typed, known-shaped data. Allowlist what's permitted rather than denylisting
what isn't.

## Authentication and sessions

- Passwords: **argon2id** (minimum m=19 MiB, t=2, p=1), **scrypt** (N=2^17, r=8, p=1),
  **bcrypt** (cost ≥10), or **PBKDF2-HMAC-SHA256** (≥600,000 iterations, where FIPS is required)
  — the OWASP Password Storage minimums. A framework's built-in default hasher is fine. Never a
  general-purpose hash, salted or not. bcrypt silently uses only the first **72 bytes**: reject
  longer passwords or use argon2id, and never pre-hash into a raw binary digest (a NUL byte
  truncates it). Verify with the library's own (constant-time) verify function.
- Tokens, session IDs, reset codes, OTPs, salts, IVs: a CSPRNG only — `crypto.randomBytes`,
  `secrets.token_urlsafe`, `crypto/rand`. Never `Math.random()`, `random`, or a timestamp.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) set explicitly, narrow `Domain`,
  sane expiry. Prefer the `__Host-` prefix for session cookies.
- CSRF: cookie-authenticated state-changing requests need a CSRF token (or a verified `Origin`/
  `Sec-Fetch-Site` check) in addition to SameSite — browser default-Lax is Chromium-only,
  SameSite does nothing against a sibling subdomain, and it allows top-level GET. Never change
  state on GET.
- Regenerate the session on login and on any privilege change. Invalidate server-side on logout.
- JWTs: verify the signature, **pin the algorithm**, and check `exp`, `iss`, and `aud`. Never
  `decode` without verification. Keep them short-lived, since you usually can't revoke them.
  Ignore `jku`/`x5u`/embedded `jwk` headers, and never let `kid` select a file path or SQL row
  unvalidated.
- Compare secrets, tokens, and MACs in constant time — Node `crypto.timingSafeEqual` on
  equal-length Buffers (e.g. compare HMAC digests of both values, since it throws on a length
  mismatch), Python `hmac.compare_digest`, Go `subtle.ConstantTimeCompare` — never with `==` or a
  prefix/`startswith` check.
- Password reset tokens: random, hashed at rest, single-use, short expiry, and the link's host
  from config — never from the `Host` header.
- Rate-limit login, signup, reset, and OTP by account *and* by IP. Return identical responses
  for existing and non-existing accounts.

## Secrets

Read from the environment or a secrets manager. Never a literal in source, a committed `.env`,
a Dockerfile `ENV`, or a test fixture. Never log a token, a header, a password, or a full
request body that might contain one. Remember that `NEXT_PUBLIC_*`, `VITE_*`, and `REACT_APP_*`
ship to the browser and are public by definition.

If you notice a secret already committed, say so immediately and state that it needs
**rotating**, not just deleting.

## Output, errors, and logging

- Return an explicit field allowlist, not the whole database object. It's easy to leak
  `password_hash` or another user's email through an eagerly-loaded relation.
- Errors to the client: generic. Errors to the log: detailed. Never send a stack trace, a SQL
  statement, or an internal path to a user.
- Don't log PII, credentials, tokens, or full request bodies. Do log auth failures, authz
  denials, and admin actions with actor, action, target, and time — you'll need them during an
  incident.
- **Fail closed.** An exception inside an auth/authz check, a policy-engine timeout, a
  signature-verification error, or a missing config value must deny — never fall through to
  `next()`, `return True`, or a default role. No empty `catch` around a security check; no
  `except Exception: pass`.

## Limits, by default

Every list endpoint gets a maximum page size. Every upload gets a size and type cap. Every
request body gets a size limit. Every loop over client-supplied data gets a length cap. Every
expensive or metered operation gets a rate limit. Unbounded anything is an availability and
cost problem waiting for someone to notice.

## Framework defaults to keep

Don't disable protections to make something work. If you find yourself writing
`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify: true`, `csrf_exempt`,
`# nosec`, `eslint-disable security/*`, `@SuppressFBWarnings`, or `// NOSONAR`, stop — that is almost always
the wrong fix. If it's genuinely necessary, isolate it to the narrowest possible scope and
leave a comment explaining why it's safe there.

## Adding dependencies

Before adding a package, confirm it exists and is the one you meant — AI assistants hallucinate
plausible package names, and attackers register them (slopsquatting). Prefer well-maintained
packages, commit the lockfile, pin exact versions, install with `npm ci --ignore-scripts` (or
the ecosystem equivalent) where feasible, and pin CI actions and base images by commit SHA or
digest.

## When you're unsure

Say so. "This needs an ownership check but I can't see how sessions work in this codebase —
where does the current user come from?" is far more useful than a confident guess that ships a
vulnerability.
