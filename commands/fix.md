---
description: Remediate confirmed security findings — minimal, verified patches applied one at a time with tests.
argument-hint: "[finding, file, or 'all criticals']"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, TodoWrite
---

# Remediate security findings

This is the only securitymaxxing command that writes code. Fix what is confirmed, verify each
change, and don't break the application in the name of securing it.

To fix: $ARGUMENTS

## Before touching anything

1. **Confirm the finding is real.** If it came from a prior review, re-read the code and
   re-verify the source-to-sink path. If it came from a scanner or a third party, verify it
   yourself first — do not patch a false positive. Say so and stop if it isn't real.
2. **Check the working tree is clean** (`git status`). If there are uncommitted changes,
   tell the user before editing so their work isn't tangled with security patches.
3. **Order the work by severity**, and build a TodoWrite list. Fix one finding per change.
4. **If a leaked secret is involved, rotation comes first.** Say this explicitly and do not
   let a code edit be mistaken for the fix — the secret is still valid until it is revoked.

## How to fix

**Fix the class, not the instance.** If the same flaw appears in twelve handlers, patching one
is theater. Either patch all twelve or — better — introduce the layer that makes the safe path
the default: a query scope that always applies the tenant filter, a middleware that requires
explicit opt-out, a typed serializer with an allowlist, a wrapper around the dangerous call.
Then remove the unsafe path so it can't come back.

**Match the codebase.** Use the framework, libraries, error handling, naming, and style already
present. A patch that looks foreign gets reverted or worked around. Don't add a dependency
unless there's no reasonable alternative — and if you do, say why.

**Prefer these fixes, in order:**
1. Remove the dangerous capability entirely (don't store it, don't expose it, don't accept it)
2. Make the safe path structural (parameterized query, framework escaping, enforced-by-default guard)
3. Validate strictly at the boundary with an **allowlist**
4. Sanitize — least reliable, and only with a well-maintained library, never a hand-written regex

**Never**: weaken a security control to make a fix easier; add a denylist and call it done;
catch and swallow an error to make a symptom go away; or disable a check "temporarily".

## Verify each fix

After each change, before moving to the next:

- Re-read the patched code and re-trace the original exploit path. State plainly that it is now
  blocked, and why.
- Consider the bypass: encoding, case, unicode, double-encoding, alternate route, a second
  code path that reaches the same sink. Fixing `../` while leaving `%2e%2e%2f` is not a fix.
- Run the project's typecheck/lint/tests if they exist. Report failures honestly — do not
  claim a fix is verified if the tests didn't run or didn't pass.
- **Add or extend a test that fails without the fix and passes with it**, where the project has
  a test suite. A security fix without a regression test comes back.
- Think about what the change breaks: existing clients, existing data, existing sessions,
  performance. Flag anything that needs a migration, a deploy sequence, or a comms note.

## Report

For each finding:

```
[SEVERITY] Title
Status:   Fixed | Partially fixed | Not fixed (reason)
Changed:  path/to/file.ext:120-138
Approach: <what you did and why this approach>
Verified: <how — the re-traced path, the test that now covers it, the command you ran>
Breaks:   <behavioral change, migration, or rotation required — or "none">
```

Then:

- **Still open** — findings you did not fix, and why (needs a product decision, needs
  infrastructure access, too invasive for this change).
- **Requires human action** — rotate this key, run this migration, update this dashboard,
  notify these users.
- A suggested commit message per logical fix. Do not commit or push unless the user asks.

If at any point a fix would require a design decision with real tradeoffs (breaking an API,
forcing re-authentication of all users, changing a data model), stop and present the options
rather than choosing silently.

## Recommended next step

Close by printing one line — `→ Recommended next: …`: re-run the review command that surfaced the
finding (e.g. `/securitymaxxing:authz`) to confirm it now comes back clean, and
`/securitymaxxing:diff` before you commit.
