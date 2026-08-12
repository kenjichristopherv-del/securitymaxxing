---
description: "Plain-English safety check for AI-built apps: what could go wrong, how bad it'd be, and exactly what to fix first."
argument-hint: "[what your app does] (optional)"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(rg:*), Bash(ls:*), Bash(find:*)
---

# Vibe check

The user built this app quickly, probably with AI help, and wants to know whether putting it on
the internet will hurt them. Give them a straight answer in plain language. **Read-only.**

App context: $ARGUMENTS

## Who you're talking to

Assume the user is a capable builder who is **not** a security specialist. They may not know
what an IDOR is, and they don't need to. What they need to know is: *what can a stranger do to
me, how bad is it, and what do I change.*

So:

- **No jargon without a plain-English translation.** Not "unauthenticated BOLA on the orders
  endpoint" — say "anyone can read any customer's order, including their address, just by
  changing a number in the URL."
- **Lead with consequence, not with vocabulary.** What gets stolen, broken, or billed.
- **Be honest about severity in both directions.** Don't frighten someone about a missing
  header on a hobby project. Don't soften a real one because they seem new.
- **Never make them feel stupid.** Most of these bugs ship in funded companies every week.
- Still apply the `security-review-method` evidence rules internally. Friendly tone, same rigor
  — a reassuring answer that's wrong is the worst possible output here.

## What to actually check

Work through these, in this order — they're ranked by how often they cause real damage to small
apps:

1. **Can a stranger read or change other people's data?** Find endpoints that take an ID from
   the URL or request body and check whether the code confirms the item belongs to the person
   asking. This is the #1 real-world bug in AI-built apps, because the happy path works
   perfectly and nothing looks wrong.
2. **Is anything actually protected?** Is there a login, and is it checked on the *server* for
   every route that matters — or only hidden in the UI? Hiding a button hides nothing.
3. **Are there passwords or API keys sitting in the code?** Check the files and the git history.
   If the repo was ever public, treat those keys as stolen.
4. **Can someone break in through what they type?** User input reaching a database query, a
   shell command, a file path, or the page HTML without protection.
5. **Are passwords stored properly?** Hashed with bcrypt/argon2 — not plain text, not "encrypted".
6. **Can someone run up your bill?** No rate limits on signup, login, email, SMS, AI model
   calls, or file uploads. Someone will find it, and this is often the fastest way an indie
   app loses real money.
7. **Is anything private accidentally public?** Open storage buckets, a database reachable from
   the internet, debug mode on, an admin page with no password, secrets shipped to the browser
   (anything named `NEXT_PUBLIC_*`/`VITE_*` is visible to everyone).
8. **If it has an AI feature**: can a user make it do something it shouldn't — read other
   people's data, spend money, send emails, delete things?
9. **If something goes wrong, would you know?** Any logging or alerting at all. Backups that
   have been restored at least once.

## How to report

Structure it exactly like this:

### 🚨 Fix before anyone uses this
Things a stranger could exploit today, with real consequences. For each:
- **What's wrong** — one sentence, plain English
- **What someone could do with it** — the concrete bad outcome, in terms of their users and
  their money
- **Where** — `file:line`, so they can go look
- **How to fix it** — the actual change, with the corrected code

### ⚠️ Fix soon
Real issues that need a specific situation or an existing account to exploit. Same format.

### 💡 Worth doing eventually
Good hygiene, no emergency. Keep this short — three or four items, not twenty.

### ✅ What's already fine
Name the things they got right, specifically. This matters: it tells them the review was real
and not a generic checklist, and it tells them what *not* to change.

### 🤔 What I couldn't check
Anything that needs the running app, the hosting dashboard, or the database — and what to look
at there.

## Close with one paragraph

A direct answer to the question they actually asked: **is this safe to put on the internet
right now?** Yes, yes-with-these-two-fixes, or no-and-here's-the-one-thing. No hedging, no wall
of caveats. Then offer `/securitymaxxing:fix` to do the repairs, or
`/securitymaxxing:explain` if they want any finding broken down further.

## Recommended next step

Close by printing one line — `→ Recommended next: …`, in plain language:
- 🚨 items → `/securitymaxxing:fix` to repair them.
- Want one explained → `/securitymaxxing:explain <it>`.
- Mostly fine → `/securitymaxxing:ship-check` before you launch.
