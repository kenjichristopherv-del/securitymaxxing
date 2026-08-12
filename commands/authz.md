---
description: Hunt broken access control — IDOR, missing role checks, mass assignment, and tenant isolation gaps. The #1 cause of real breaches.
argument-hint: "[path, route, or resource] (optional)"
allowed-tools: Read, Grep, Glob, Bash(rg:*), Bash(git ls-files:*), Bash(find:*)
---

# Access control review

Broken access control is OWASP A01 and the single most common serious flaw in real
applications, because it is invisible to scanners — the request looks perfectly valid, it just
belongs to someone else. Follow `security-review-method`. **Read-only.**

Scope: $ARGUMENTS

## Method: enumerate, then verify one at a time

Do not pattern-match. Access control bugs are bugs of *omission* — the vulnerable endpoint
looks exactly like the safe one, minus a line. You find them by listing every endpoint and
checking each.

### 1. Build the endpoint inventory

Find every route/handler/resolver/mutation and tabulate:

| Route | Method | Auth required? | Role required? | Takes a resource ID? | Ownership check (file:line) |
|---|---|---|---|---|---|

Get this from the router definitions, decorators, annotations, or file-based routing
conventions — whatever the framework uses. Include GraphQL fields and tRPC procedures. Include
admin routes, internal routes, and anything mounted under a debug prefix.

### 2. Find the enforcement mechanism, then find what escapes it

Locate how auth and authz are *supposed* to be applied — middleware, guard, decorator, base
class, policy layer. Then look specifically for:

- Routes registered on a different router or before the middleware is mounted
- Handlers with the guard decorator commented out, or with a `skip`/`public`/`allowAnonymous` flag
- An allowlist of unauthenticated paths that is broader than intended (prefix matching where
  `/api/public` also matches `/api/publicadmin`, or a `startswith` check an attacker can satisfy)
- Middleware ordering bugs: a route handler that runs before the auth middleware
- New routes added recently that don't match the codebase's established guard pattern
- Static file or proxy rules that serve protected content around the app entirely

### 3. Object-level authorization (IDOR) — check endpoint by endpoint

For every endpoint that accepts an ID from the request (path param, query, body, or a
client-supplied filter), trace the query and answer: **is the current user's ownership
enforced server-side in that same query?**

Vulnerable shape:
```
resource = db.get(Resource, request.params.id)      # no owner constraint
if not resource: 404
return resource                                      # anyone's ID works
```
Safe shape:
```
resource = db.get(Resource, id=request.params.id, owner_id=session.user_id)
```

Also check:
- **The write path separately from the read path.** Apps often scope `GET` correctly and forget
  `PATCH`/`DELETE`.
- **Nested and batch routes**: `/orgs/:orgId/projects/:projectId` — is `projectId` verified to
  belong to `orgId`, or only `orgId` verified? Batch endpoints that accept an array of IDs
  frequently check only the first.
- **Indirect references**: file keys, S3 paths, invite tokens, export IDs, invoice numbers,
  webhook replay IDs. Sequential or guessable IDs make this trivially exploitable; UUIDs make
  it harder but are **not** an access control.
- **Cross-user actions**: "share with", "transfer to", "add member" — can you add yourself to
  someone else's resource?

### 4. Function-level authorization

- Is every admin/privileged action checked server-side, or does the UI just hide the button?
- Can a lower role reach a higher role's endpoint by calling it directly?
- Is the role read from the session/database, or from a client-supplied token claim, header,
  or request body field? A role in a JWT is only as good as the signature verification — check it.
- Are there routes that check *authentication* but forgot *authorization*?

### 5. Field-level: mass assignment / over-posting

Look at every place a request body is spread into a model:
`Model(**request.json)`, `Object.assign(user, req.body)`, `update(req.body)`, `.save(payload)`,
serializers without an explicit allowlist.

Then ask what sensitive fields exist on that model: `role`, `is_admin`, `is_verified`,
`tenant_id`, `owner_id`, `balance`, `credits`, `price`, `discount`, `status`,
`email_verified`, `subscription_tier`. If the client can set one, that's the finding.

Denylists are not a fix — allowlist the writable fields.

### 6. Tenant isolation (multi-tenant apps)

- Is the tenant filter applied centrally (row-level security, a scoped base query, a
  connection-level setting) or repeated by hand in every query? Hand-repeated isolation has a
  gap in it — your job is to find the query that forgot.
- Grep every raw query and every `find`/`where` for the absence of the tenant column.
- Where does the tenant ID come from? If it's from the request rather than the session, that
  is the whole vulnerability.
- Check background jobs, exports, admin tooling, search indexes, and caches — tenant leakage
  through a shared cache key or a global search index is common and severe.
- If the app uses Postgres RLS: confirm policies exist **and** that the application connects as
  a role that RLS actually applies to. A superuser or table owner bypasses RLS silently.

## Report

Standard finding format. For each IDOR, give the concrete request an attacker sends. Include a
**Coverage** table showing which endpoints you verified individually versus which you sampled,
so the reader knows what's still unchecked.

Close with the structural recommendation: if the codebase enforces authorization by convention
rather than by construction, say so and propose the layer that would make the safe path the
default.
