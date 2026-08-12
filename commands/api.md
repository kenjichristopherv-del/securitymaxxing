---
description: API and web surface review — CORS, CSRF, headers, rate limits, over-fetching, GraphQL, and file uploads.
argument-hint: "[API path or spec file] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(find:*), Bash(git ls-files:*)
---

# API and web surface review

Covers the OWASP API Security Top 10 concerns that aren't already handled by
`/securitymaxxing:authz` and `/securitymaxxing:authn`. Follow `security-review-method`. **Read-only.**

Scope: $ARGUMENTS

If an OpenAPI/GraphQL schema exists, read it — then verify the implementation matches it. Docs
that lie about auth requirements are themselves a finding.

## 1. Excessive data exposure

- Do responses return whole database objects, or an explicit field allowlist? Look for
  `res.json(user)` returning `password_hash`, `stripe_customer_id`, internal flags, other
  users' emails, or soft-deleted rows.
- Serializers/DTOs: is the field list explicit, or is it "everything except a denylist"?
  Denylists silently leak every field added later.
- Related-object expansion: does including a relation pull in fields the caller shouldn't see?
- Error responses: do they leak stack traces, SQL, file paths, internal hostnames, or library versions?
- Do list endpoints leak the existence and count of other users' resources?

## 2. Resource consumption

- Pagination: is there a maximum page size, or can a client request `limit=1000000`?
- Are there unbounded queries, `SELECT *` on large tables, or N+1 loops driven by a client array?
- Request body size limits, array length limits, string length limits, upload size caps.
- Expensive operations (export, report, search, image/PDF processing, model calls) — rate
  limited, queued, or synchronous and unbounded?
- Zip bombs, decompression bombs, and catastrophic regex (ReDoS) on user input.
- Anything metered that costs you money per call: SMS, email, model tokens, third-party APIs.
  Cost-DoS is real and underrated.

## 3. Rate limiting and abuse control

- Is there rate limiting at all, and at what layer (edge, gateway, app)?
- Keyed on what? IP alone is weak (shared NAT, trivially rotated); per-account and per-API-key
  is better. Check whether `X-Forwarded-For` is trusted blindly — if so, the limit is bypassable.
- Are the sensitive endpoints (login, reset, OTP, signup, invite, search, export) limited more
  strictly than the rest?
- Idempotency keys on payment and other non-repeatable operations.

## 4. CORS and CSRF

**CORS** — read the actual config:
- `Access-Control-Allow-Origin: *` combined with `Allow-Credentials: true` (browsers reject
  this pairing, but the intent usually means the real config is origin reflection).
- **Origin reflection**: echoing back whatever `Origin` was sent, with credentials — this is a
  total same-origin-policy bypass.
- Regex allowlists with unescaped dots or missing anchors: `/example\.com$/` matches
  `evilexample.com`; `/^https:\/\/.*\.example\.com/` may match `evil.com#.example.com`.
- `null` origin allowed (sandboxed iframes and some redirects send it).

**CSRF** — only relevant where the browser attaches credentials automatically:
- Cookie-authenticated state-changing endpoints without a CSRF token or `SameSite` protection.
- `SameSite=None` without a token.
- Is CSRF protection applied to all methods including `PUT`/`DELETE`, or only `POST`?
- Endpoints exempted from CSRF middleware — check each exemption is justified (webhooks
  usually are, if they verify signatures instead).
- Bearer-token APIs don't need CSRF; don't report it there.

## 5. Security headers (browser-rendered apps)

- **CSP** — present? Does it actually restrict scripts, or is it `unsafe-inline` +
  `unsafe-eval` + wildcards, i.e. decorative? Is `frame-ancestors` set?
- `Strict-Transport-Security` with a meaningful max-age
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy` — prevents leaking URLs (and reset tokens) to third parties
- `Permissions-Policy` for camera/mic/geolocation
- Cache headers on authenticated responses (`Cache-Control: no-store`) — otherwise a shared
  proxy or CDN can serve one user's data to another. Check CDN cache keys include the auth context.

## 6. GraphQL, if present

- Introspection enabled in production?
- Query depth and complexity limits — without them, a nested query is a trivial DoS.
- Batching abuse: aliased queries bypassing per-request rate limits (a login brute-force in one HTTP request).
- Is authorization enforced **per field/resolver**, or only at the top-level query? Nested
  resolvers are the common IDOR location.
- Do error messages leak schema or internal detail? Is field suggestion ("did you mean") on?

## 7. File uploads

- Is the type validated by **content inspection**, not just extension or the client's
  `Content-Type` header?
- Is the stored filename generated server-side? Never use the client's filename in a path.
- Are uploads stored outside the web root, or on a separate origin/bucket? Serving user files
  from your app's origin means an uploaded HTML or SVG file becomes stored XSS with full
  same-origin access.
- Is `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` set on downloads?
- Size limits, and limits on the number of files per request.
- Are the files scanned, and is any image/document processing library (ImageMagick, ffmpeg,
  PDF renderers) sandboxed? These have a long history of RCE.
- Signed URLs: do they expire, are they scoped to one object, and are they unguessable?

## 8. Other web surface

- Open redirects: any `?next=`/`?redirect=`/`?returnTo=` reaching a redirect without an
  allowlist. Used to make phishing links look legitimate and to steal OAuth codes.
- HTTP method handling: does a `GET` perform a state change? Does an unexpected method skip
  middleware?
- Host header trust — used to build links, reset URLs, or cache keys.
- Verb/path normalization differences between a proxy and the app (request smuggling, auth bypass
  via `//admin` or `/admin/./`).
- Subdomain takeover: dangling DNS records pointing to deprovisioned services.

## Report

Standard finding format, grouped by the categories above, with the specific config or handler
cited. Skip categories that don't apply to this architecture and say why — a machine-to-machine
JSON API shouldn't be dinged for missing CSP.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Provable issue (CORS reflection, upload, GraphQL authz) → `/securitymaxxing:redteam` to demonstrate it, then `/securitymaxxing:fix`.
- Config or header gaps → `/securitymaxxing:fix`.
