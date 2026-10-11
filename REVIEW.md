# Hands-on launch review

**You built something. Before real people trust it with their data or money, have a person check
it.**

securitymaxxing is free and you can run it yourself — the [step-by-step guide](README.md#start-here-make-your-app-safe-step-by-step)
gets most builders most of the way. If you'd rather have someone who works with it every day do
the review, read the findings, and stand behind the report, that's what this is.

## What you get

| | **Launch review** — $249 | **Review + fix support** — $499 |
|---|---|---|
| Deep, multi-agent code review (`audit --deep`): every route read, every finding independently verified | ✓ | ✓ |
| A person reads every finding against your code and removes anything that doesn't hold up | ✓ | ✓ |
| A written report: a plain-English verdict, what could happen, a prioritized fix plan, and the technical detail for whoever fixes it | ✓ | ✓ |
| Secrets check across your full git history, with a rotation list | ✓ | ✓ |
| 30-minute call to walk through the findings and the fixes | | ✓ |
| Re-check after you've fixed things, with an updated report | | ✓ |

**Founding offer: the first five launch reviews are $149** instead of $249, in exchange for a
short testimonial you're happy for me to quote (your words, your name or just your role, and
never your findings). Say "founding offer" in your request.

Sized for a typical indie or early-stage app: one repository, one main service. Bigger systems,
several services, or a mobile app plus backend — ask, and you'll get a quote before anything
starts.

## How it works

1. **[Request a review](https://github.com/kenjichristopherv-del/securitymaxxing/issues/new?template=review-request.yml).**
   Describe the app — no code, no secrets in the form; the request is public.
2. **Scope and quote.** You get a reply with scope, price, and timing, and a short agreement
   (below). Nothing is charged until you've agreed to both.
3. **Access.** You grant read-only access to the repository (a GitHub collaborator invite, or a
   zip). Never send passwords, API keys, or production database access — they aren't needed.
4. **Review.** Within 7 days of receiving access.
5. **Report.** You receive the report and an invoice. You pay by card through the invoice's
   payment link, within 14 days. With fix support, we then book the call and the re-check.

## What it is — and isn't

- **It is** a careful review of your source code by a person using a measured, multi-agent
  process, with every finding verified against the code before it reaches you.
- **It is not** a penetration test, a compliance certification (SOC 2, ISO 27001, PCI), or a
  guarantee that no other vulnerabilities exist. It reviews code at a point in time; it doesn't
  attack your live systems or review your cloud console unless that's explicitly agreed.
- If your app handles payments, health data, or anything regulated, this is a good first pass —
  and you should still plan for a professional penetration test before or soon after launch.

## How your code is handled

- Your code is reviewed with Claude (Anthropic) through Claude Code, the same way securitymaxxing
  runs on your own machine. If that doesn't work for your company's policies, say so before
  sharing anything.
- Access is read-only and used only for your review. It's removed, and any local copy deleted,
  within 7 days of the final delivery (the report, or the re-check with fix support).
- Findings are confidential. Nothing about your app is published or reused without your written
  permission.

## Questions

Open a [review request](https://github.com/kenjichristopherv-del/securitymaxxing/issues/new?template=review-request.yml)
with your question — no commitment.
