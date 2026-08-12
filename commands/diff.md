---
description: Security review of uncommitted changes, a branch, or a PR — catches vulnerabilities at the moment they're introduced.
argument-hint: "[git ref, PR number, or blank for working tree]"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(gh pr:*), Bash(rg:*)
---

# Security review of a change

Review only what changed, but judge it against the whole system. Follow the
`security-review-method` skill. **Read-only — do not edit.**

Target: $ARGUMENTS

## Get the diff

Resolve the target in this order:
- A number like `1234` → `gh pr diff 1234` (and `gh pr view 1234` for intent).
- A git ref or range → `git diff <ref>`.
- Empty → review uncommitted work: `git diff HEAD`, plus `git status` for untracked files.
  If the working tree is clean, review the current branch against its merge base:
  `git merge-base HEAD origin/main` (try `main`, then `master`, then `develop`).

Always check untracked files too — a newly added `.env` or key file never shows in `git diff`.

## What to look for in a diff specifically

Diffs have failure modes that a full audit doesn't:

1. **A new entry point.** Any added route, handler, resolver, webhook, or job consumer is new
   attack surface. Confirm it inherits the auth/authz middleware — a route registered on a
   different router than its neighbors is the classic way an endpoint ships unprotected.
   Compare against how the adjacent, older routes are guarded.

2. **A removed or weakened check.** Deleted lines matter more than added ones. Look for
   removed guard clauses, `if (!user.isAdmin)` blocks, validation calls, `verify` calls,
   `escape`/`sanitize` calls, or a narrowed query filter (`where` clause losing `tenant_id`).
   A diff that deletes a security control is the highest-yield thing in this command.

3. **A widened permission or scope.** Changed IAM policy, CORS origin, cookie `SameSite`,
   CSP directive, S3 bucket policy, database grant, feature flag default, or a role check
   loosened from `admin` to `member`.

4. **A new secret.** Any added string that looks like a key, token, password, connection
   string, or private key — including in tests, fixtures, CI workflows, and Dockerfiles.
   Report the location, redact the value, and say plainly that it must be **rotated**, not
   just deleted, because it is in git history now.

5. **A new dependency.** Check what it is, who maintains it, whether the name is a plausible
   typosquat of a popular package, whether it runs install scripts, and whether the version
   is pinned. A new transitive dependency tree is a supply-chain event.

6. **Untrusted data reaching a new sink.** Trace each added variable that comes from a request
   through to where it's used. Applies especially to new raw SQL, new `exec`, new file paths,
   new outbound URLs, new HTML rendering.

7. **A changed security-relevant default** in config: debug mode, TLS verification,
   `NODE_ENV`-dependent branches, error verbosity, session lifetime, rate limit values.

8. **Copy-paste of an existing pattern that was already wrong.** If the diff duplicates a
   flawed pattern from elsewhere in the codebase, report both — the new one and the original.

## Context requirement

You cannot review a diff safely from the diff alone. For every changed function, open the
surrounding file and read enough to know: who can call this, what the caller passes, and what
guards it sits behind. State when you did this. If a change's safety depends on a caller you
could not find, say so rather than guessing.

## Report

Standard finding format. Then:

- **Verdict**: `Safe to merge` / `Safe to merge with follow-ups` / `Do not merge` — and the
  one-line reason.
- **Blocking items** vs **non-blocking follow-ups**, separated clearly.
- If nothing is wrong, say so in one line and name what you checked. Do not manufacture nits.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Blocking finding → `/securitymaxxing:fix` before merge.
- Safe to merge → say so and merge; no next command needed.
