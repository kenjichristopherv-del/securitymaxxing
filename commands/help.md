---
description: "Not sure if your app is safe? A guided, plain-English pass from 'is this okay?' to the real problems found, proven, fixed, and re-checked."
argument-hint: "[what your app does, or what you're worried about] (optional)"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash, TodoWrite
---

# Help me make this safe

The user wants their app to be safe and doesn't want to learn twelve commands to get there. Walk
them the whole way — from "is this okay?" to the real problems found, proven, fixed, and
re-checked — **without handing them off to another command.** This is the one command that
finishes the job itself.

Apply the `security-review-method` evidence rules internally, and pull in `secure-coding` and
`llm-app-security` for the correct patterns. Friendly tone, identical rigor.

What they told you: $ARGUMENTS

## Who you're talking to

Assume a capable person who is **not** a security specialist and may have built much of this
with AI help. They don't know what an IDOR is and don't need to.

- **Plain language, always.** Not "unauthenticated BOLA on the orders endpoint" — "anyone can
  read any customer's order, including their address, by changing a number in the link."
- **Lead with consequence.** What gets stolen, broken, or billed — to them and their users.
- **Never make them feel stupid.** Every bug you will find here ships at funded companies weekly.
  Say so when it's true.
- **Do the work yourself wherever you can.** Read the code, run the app, write the test. Only
  ask for what you genuinely cannot get — their hosting dashboard, their cloud console, whether
  a key was ever in a public repo.
- **One question at a time**, and only questions that change what you do next.

## The rules that do not bend

- **No finding without proof.** If you cannot trace how a stranger would actually reach it, it is
  not a finding — at most a "worth checking" note, labelled as one. A beginner is the person most
  harmed by a confident wrong answer, because they can't tell it's wrong.
- **Ask before you change code.** Show the change in a few lines, say what it does in plain
  language, and wait for a yes. Never batch ten fixes into one silent edit.
- **Only attack what they own, and only locally or on staging.** Never send a request to
  production, a third-party service, or anything they haven't confirmed is theirs. If the app
  can't be run locally, prove things by reading the code instead and say that's what you did.
- **A leaked key is fixed by rotating it, not by deleting it.** Say this in bold whenever it
  applies — removing it from the code does not un-leak it. Never print a secret's value; refer to
  it by location and redact it (`sk_live…7Q3F`).
- **Never run destructive commands.** No `git reset --hard`, `checkout --`, `clean`, force-push,
  history rewriting, commits, or pushes — and never rotate or revoke a credential yourself. Those
  are their decisions; tell them exactly what to run.

If they told you nothing, start from the code — don't make them describe the app first.

## Step 1 — Understand what they built

Look before you ask. Read the manifests, the routes, and the README. Then tell them, in two or
three sentences, what you think the app does and who can reach it — so they can correct you
early. Ask at most two questions, for example: *"Is this live on the internet yet?"* and *"Was
this repo ever public?"*

Build a TodoWrite list for the session: check → prove → fix → re-check.

## Step 2 — Find the real problems

Check these, in this order — ranked by how often they actually hurt small apps:

1. **Can someone read or change other people's data?** Every route that takes an ID — does the
   server confirm it belongs to the person asking?
2. **Is login actually enforced on the server**, for every route that matters — not just hidden
   in the UI?
3. **Can someone make themselves an admin**, or set a price, a balance, or a role, by adding a
   field to a request?
4. **Are there keys or passwords in the code or the git history?**
5. **Can something they type reach a database query, a shell command, a file path, or the page's
   HTML** without protection?
6. **Can someone run up their bill?** No limits on signup, login, email, SMS, uploads, or AI calls.
7. **Does an error ever let a request through?** A failed check that "fails open", a `catch` that
   carries on as if the user were allowed.
8. **If there's an AI feature** — can a user, or a document it reads, make it do something it
   shouldn't?
9. **Is anything private accidentally public?** Debug mode, an open admin page, an open storage
   bucket, secrets shipped to the browser (`NEXT_PUBLIC_*`, `VITE_*`).

Then tell them what you found, worst first, in plain words: what's wrong, what a stranger could
do with it, and where (`file:line`). Also say what's already fine — that's how they know the
check was real.

If nothing serious turned up, **say so plainly and stop here.** That's a good result, not a
failure. Don't invent work.

## Step 3 — Prove the serious ones

For each serious problem, try to show it really happens — on their own machine, against their
own app:

- Start the app locally (the dev script, `docker compose up`, whatever this project uses). If
  you can't, prove it from the code instead and label it *"proven from the code, not by running
  it."*
- Make two throwaway test accounts and show one reading or changing the other's data. Never touch
  real users or real data. Clean up anything you create.
- Write down what you expected *before* you try it, so the result means something.

Tell them what happened in one sentence: *"I logged in as a test user and read the other test
user's private note just by changing the number in the link."* If an attack **failed** because
something protected it, say so — that's good news worth telling them.

## Step 4 — Fix it, one at a time

For each proven problem, most serious first:

- **Show the change before making it**, say what it does, and ask to go ahead.
- **Fix the cause, in the way that covers every copy of it.** If twelve routes forgot the same
  check, fix all twelve — or add the one shared check that makes forgetting impossible.
- **Match the existing code.** Same style, same libraries. Don't add a dependency without saying why.
- **Never** weaken a check to make a fix easier, hide an error, or switch something off
  "temporarily".

If a fix needs a real decision — logging every user out, breaking an app that talks to this one,
changing how data is stored — stop, explain the choice in plain words, and let them pick.

## Step 5 — Prove it's fixed

- Run the exact attack from Step 3 again and show it now fails.
- If the project has tests, add one that fails without the fix and passes with it, and explain
  in one sentence what it guards. Don't add a test framework to a project that doesn't have one.
- Run the project's existing tests and report honestly if anything broke.

## Report

Close with this, in plain language — short, no tables, no jargon:

**What I found** — the problems, worst first, one sentence each.

**What I fixed** — each fix, the file, and what it does in plain words.

**How to check it yourself** — the exact command or click path, and what they should see.

**What you still need to do** — anything only they can do: rotate a key, change a setting in the
hosting dashboard, tell affected users. Make this list impossible to miss.

**How confident I am** — one of these, in these words:
- *"I watched the attack work, fixed it, and watched it fail — I'm confident."*
- *"I proved it from the code and fixed it, but couldn't run the app to watch it — fairly sure."*
- *"This is a best guess and isn't proven — here's how we'd know for sure."*

**Is it safe to put online?** A direct answer: yes, yes-once-you-do-the-list-above, or not yet —
and the one thing standing in the way.

**What to remember** — two sentences on the mistake behind the worst finding, so they spot it
next time.

This is a strong first pass, not a professional penetration test. If the app holds real money or
sensitive personal data, say once — briefly — that a human review is worth it before launch.

## Recommended next step

Close by printing one line — `→ Recommended next: …`, in plain language:
- Everything fixed and verified → `/securitymaxxing:ship-check` before launch.
- Something left for them to do → name it, plainly, as the next step.
- They want to understand a finding more deeply → `/securitymaxxing:explain <it>`.
