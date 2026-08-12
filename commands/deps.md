---
description: Dependency and supply-chain review — vulnerable packages, typosquats, install scripts, and CI pipeline risk.
argument-hint: "[manifest or ecosystem] (optional)"
allowed-tools: Read, Grep, Glob, Bash(npm audit:*), Bash(npm ls:*), Bash(pnpm audit:*), Bash(yarn audit:*), Bash(pip-audit:*), Bash(pip list:*), Bash(uv:*), Bash(go list:*), Bash(govulncheck:*), Bash(bundle audit:*), Bash(cargo audit:*), Bash(git:*), Bash(rg:*), Bash(cat:*), Bash(ls:*), WebFetch
---

# Dependency and supply-chain review

Most code in a modern application was written by strangers. This reviews what you inherited.

Scope: $ARGUMENTS

## 1. Run the ecosystem's own auditor first

Detect the ecosystem from the manifests present, then run the appropriate tool. These give
real, current advisory data — far better than guessing from memory.

- **npm/pnpm/yarn**: `npm audit --json` (or `pnpm audit`, `yarn npm audit`)
- **Python**: `pip-audit` if available, else `uv pip list` and check manually
- **Go**: `govulncheck ./...` — uniquely good, it reports only vulnerabilities in code paths
  you actually call
- **Ruby**: `bundle audit check --update`
- **Rust**: `cargo audit`

If a tool isn't installed, say so and give the install command rather than silently skipping.
Never fabricate advisory IDs or CVE numbers — if you can't verify one, describe the issue in words.

## 2. Triage the results — do not just relay them

Audit output is mostly noise. Your value is telling the user which 3 of the 140 alerts matter.
For each reported vulnerability:

- **Is the vulnerable code path reachable from this application?** A prototype-pollution bug in
  a package only used by the test runner is not a production risk. Grep for actual usage.
- **Is it a direct dependency or buried transitively?** Transitive fixes may need a resolution
  override or may already be patched upstream.
- **Is it dev-only?** `devDependencies` still matter for supply chain (they run on developer
  machines and in CI, with credentials) but they are not runtime exposure. Rate them separately.
- **Is there a known exploit in the wild?** Prioritize those absolutely.
- **What is the actual fix?** Version bump, resolution override, or removal. Note if the bump
  is a major version with breaking changes.

Produce a ranked list: **fix now / fix this sprint / accept and document**.

## 3. Supply-chain risk beyond known CVEs

This is the part audit tools don't do.

**Package trust**
- Any dependency whose name is one character or one transposition away from a popular package
  (typosquatting). Check anything unfamiliar against what it claims to be.
- Packages with very few downloads, a single maintainer, no repository link, or a recent
  ownership transfer.
- Packages added recently — cross-reference `git log` on the manifest with who added them and why.
- Dependencies pulled from a git URL, a tarball URL, or a non-default registry.

**Install-time execution**
- `preinstall`/`install`/`postinstall` scripts in any dependency — these run arbitrary code on
  every developer machine and in CI, before any of your code runs. This is the primary
  supply-chain attack vector.
- Python packages with a `setup.py` that executes on install.

**Pinning and integrity**
- Is there a committed lockfile? Without one, every install can resolve differently.
- Are versions floating (`^`, `~`, `*`, `latest`)? A caret range means a compromised patch
  release lands in your next build automatically.
- Are container base images pinned by digest, or by a mutable tag like `:latest` or `:3`?

**Bloat as attack surface**
- Count total transitive dependencies. Flag single-function packages that could be replaced
  with a few lines, and anything with an unreasonable subtree.
- Flag abandoned packages (no release in years) that handle security-relevant work — auth,
  crypto, parsing, sanitization.

## 4. CI/CD pipeline security

The pipeline holds production credentials and runs untrusted code. Review it as its own attack surface:

- **`pull_request_target` combined with checking out the PR head** — this runs a fork's code
  with access to your secrets. It's the single most dangerous GitHub Actions misconfiguration.
- Third-party actions referenced by mutable tag (`@v3`) rather than a commit SHA.
- Secrets available to workflows triggered by external contributors.
- Overly broad `permissions:` on the `GITHUB_TOKEN` — default to `contents: read`.
- Self-hosted runners on public repositories (fork PRs get code execution on your infrastructure).
- Build artifacts, logs, or caches that could contain credentials.
- Deployment keys with more access than the deployment needs.
- Is anything signed or attested (provenance, SLSA, sigstore)?

## Report

1. **Ranked vulnerability list** with reachability judgment and the concrete fix command
2. **Supply-chain concerns** — trust, install scripts, pinning
3. **CI/CD findings**
4. **Recommended standing controls**: lockfile committed, Dependabot/Renovate with grouping,
   `npm ci --ignore-scripts` where feasible, digest-pinned base images, SHA-pinned actions,
   a scheduled audit job

State clearly which tools you actually ran and which you could not.

## Recommended next step

Close by printing one line — `→ Recommended next: …`:
- Reachable vulnerable dependency → `/securitymaxxing:fix` for the ones that actually matter, with the version bump or override.
- Then stand up Dependabot/Renovate and CI scanning so this stays green without you.
