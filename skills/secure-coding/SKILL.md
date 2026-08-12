---
name: secure-coding
description: >
  Secure-by-default patterns to apply while writing or modifying application code. Use this
  skill whenever building or editing code that touches a security-relevant surface: HTTP
  routes, API endpoints, controllers, resolvers, or webhook handlers; login, signup, sessions,
  passwords, tokens, or JWTs; database queries, especially raw SQL or dynamic query building;
  anything that reads a user/tenant/resource ID from a request; file uploads, downloads, or
  filesystem paths; shell or subprocess execution; outbound HTTP requests to URLs that come
  from user input; rendering user content as HTML; encryption, hashing, or random token
  generation; secrets, API keys, and environment configuration; CORS, cookies, and security
  headers. Also use when the user asks to 'make this secure', 'harden', or 'add auth'. Provides
  the correct pattern to write the first time, so the vulnerability never exists.
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
  reject loopback, link-local (`169.254.0.0/16`, especially `169.254.169.254`), and private
  ranges; allow only `http`/`https`; and **re-validate after every redirect**, since the first
  hop can be public and the second internal.
- **HTML** — let the framework escape by default. Reach for `dangerouslySetInnerHTML`,
  `v-html`, `|safe`, or `innerHTML` only with a maintained sanitizer (DOMPurify, bleach) and
  an explicit reason. Never build a URL attribute from user input without checking the scheme
  — `javascript:` and `data:` are executable.
- **Deserialization** — `yaml.safe_load`, never `pickle` on untrusted data, XML parsers with
  external entities disabled.
- **Templates** — pass user data as *context*, never concatenate it into the template string.

Validate at the boundary with a schema (zod, pydantic, valibot, struct tags) so the rest of the
code works with typed, known-shaped data. Allowlist what's permitted rather than denylisting
what isn't.

## Authentication and sessions

- Passwords: **bcrypt, scrypt, or argon2id**. Never a general-purpose hash, salted or not.
- Tokens, session IDs, reset codes, OTPs, salts, IVs: a CSPRNG only — `crypto.randomBytes`,
  `secrets.token_urlsafe`, `crypto/rand`. Never `Math.random()`, `random`, or a timestamp.
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), narrow `Domain`, sane expiry.
- Regenerate the session on login and on any privilege change. Invalidate server-side on logout.
- JWTs: verify the signature, **pin the algorithm**, and check `exp`, `iss`, and `aud`. Never
  `decode` without verification. Keep them short-lived, since you usually can't revoke them.
- Compare secrets, tokens, and MACs in constant time (`timingSafeEqual`, `compare_digest`) —
  never with `==` or a prefix/`startswith` check.
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

## Limits, by default

Every list endpoint gets a maximum page size. Every upload gets a size and type cap. Every
request body gets a size limit. Every loop over client-supplied data gets a length cap. Every
expensive or metered operation gets a rate limit. Unbounded anything is an availability and
cost problem waiting for someone to notice.

## Framework defaults to keep

Don't disable protections to make something work. If you find yourself writing
`rejectUnauthorized: false`, `verify=False`, `InsecureSkipVerify: true`, `csrf_exempt`,
`# nosec`, `eslint-disable security/*`, or `@SuppressWarnings`, stop — that is almost always
the wrong fix. If it's genuinely necessary, isolate it to the narrowest possible scope and
leave a comment explaining why it's safe there.

## When you're unsure

Say so. "This needs an ownership check but I can't see how sessions work in this codebase —
where does the current user come from?" is far more useful than a confident guess that ships a
vulnerability.
