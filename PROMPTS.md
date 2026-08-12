# The securitymaxxing prompt catalog

Copy-paste security prompts for Claude Code, Cursor, Copilot, ChatGPT, or any coding assistant.

The slash commands in this plugin are the polished versions of these. This file is for when you
want the raw prompt — to paste somewhere else, to edit for your stack, or to read so you know
what the commands are actually asking for.

**Contents**

[0. The preamble](#0-the-preamble) · [1. Recon & threat modeling](#1-recon--threat-modeling) ·
[2. Access control](#2-access-control) · [3. Injection](#3-injection--untrusted-input) ·
[4. Auth & sessions](#4-authentication--sessions) · [5. Secrets](#5-secrets--credentials) ·
[6. API & web surface](#6-api--web-surface) · [7. Crypto & data](#7-cryptography--data-protection) ·
[8. Dependencies & CI](#8-dependencies--supply-chain) · [9. Infra](#9-infrastructure--deployment) ·
[10. AI & LLM](#10-ai--llm-features) · [11. Business logic](#11-business-logic) ·
[12. Code review](#12-code-review--pull-requests) · [13. Pre-launch](#13-pre-launch) ·
[14. Plain English](#14-plain-english-for-vibe-coders) · [15. Fixing](#15-fixing--verifying) ·
[16. Learning](#16-learning) · [17. Red team](#17-red-team--proving-it)

---

## 0. The preamble

**Paste this before any security prompt.** It is the single highest-leverage thing in this
file. Without it you get a list of plausible-sounding findings, most of which are wrong, and
you learn to ignore security output. With it you get findings you can act on.

```
Before reporting any security finding, you must satisfy all of these:

1. Name the SOURCE (where attacker-controlled data enters) and the SINK (where it does
   damage), and show the path between them. If you can't name both, mark the item
   "needs verification" and say what you'd need to read to confirm it.
2. Check whether the framework, ORM, or an upstream layer already mitigates it — for the
   version actually in the manifest. Read the code; don't assume in either direction.
3. Find the callers. Confirm the vulnerable path is reachable by someone who shouldn't
   reach it. State who can reach it.
4. Rate severity by realistic exploitability x impact, not by how scary the bug class
   sounds. Chained issues get rated as the chain.
5. Quote the actual code you read. Distinguish what you read from what you inferred.
6. Do not report missing defense-in-depth as a vulnerability. Say what the real exposure is.
7. Do not invent CVE or CWE numbers. Describe the class in words if you're not certain.
8. Zero findings is a valid result. Do not pad the report. If it's clean, say it's clean
   and list what you checked.

Report each finding as:
[SEVERITY] Title | file:line | Confidence: Confirmed/Likely/Needs verification
Evidence: <quoted code showing source and sink>
Exploit path: <the concrete requests an attacker sends>
Impact: <what they actually get, in business terms>
Fix: <the specific corrected code>

End with a Coverage section: what you reviewed, what you couldn't reach, and what a
human still needs to check manually.
```

---

## 1. Recon & threat modeling

**1.1 — Map the attack surface** *(always do this first)*
```
Before looking for any vulnerability, map this application's attack surface. Identify:
(1) the stack and framework versions from the manifests; (2) every entry point an attacker
can reach — HTTP routes, GraphQL resolvers, websockets, webhooks, queue consumers, cron
jobs, file uploads, CLI inputs; (3) the trust boundaries — what's public, what needs a
session, what needs a role, what's tenant-scoped, and the code that enforces each;
(4) data stores, secrets sources, and every outbound third-party call.
Output a table of entry points with their auth requirements. Don't report vulnerabilities
yet — I want the map first.
```

**1.2 — STRIDE threat model**
```
Build a STRIDE threat model of this system. First state the assets worth protecting, ranked,
and the actors (anonymous, authenticated user, other tenant, admin, insider, compromised
dependency). Draw the data flow as a Mermaid diagram with trust boundaries marked. Then for
each process, store, and flow, walk Spoofing / Tampering / Repudiation / Information
disclosure / Denial of service / Elevation of privilege. For each threat give: existing
control (cited to file:line, or "none found"), the gap, a specific proposed control, and
residual risk. Rank by likelihood x impact. List every assumption you made.
```

**1.3 — Attacker's first move**
```
You're an attacker with no credentials who just found this application. Walk me through
exactly what you'd probe first and why — which endpoints, which parameters, what you'd
look for in the JavaScript bundle, what you'd guess about the backend. Rank by expected
payoff. Be specific to this codebase, not generic.
```

**1.4 — Abuse cases**
```
For each major feature, write the abuse cases alongside the use cases. Not "user uploads a
profile picture" but "attacker uploads a 4GB SVG containing script, named ../../etc/passwd,
10,000 times in parallel." Cover every user-facing feature.
```

**1.5 — Blast radius**
```
Assume an attacker has already compromised [the web server / a single user account / a
developer laptop / one dependency]. What do they reach from there, and what stops lateral
movement? Cite the specific controls.
```

---

## 2. Access control

*Broken access control is OWASP A01 and the most common serious flaw in real applications.
Scanners cannot find it — the malicious request looks completely valid.*

**2.1 — Endpoint inventory** *(do this before 2.2)*
```
List every route/handler/resolver in this codebase in a table with: path, method, whether
authentication is required, what role is required, whether it accepts a resource ID from
the request, and the file:line of the ownership check. Include admin routes, internal
routes, and anything mounted under a debug or dev prefix. Mark any row where the ownership
check column is empty.
```

**2.2 — IDOR hunt**
```
For every endpoint that accepts an ID from the request (path, query, body, or a
client-supplied filter), trace the database query and tell me whether the current user's
ownership is enforced *in that query*, server-side. Show the query for each. Check read and
write paths separately — apps commonly scope GET correctly and forget PATCH and DELETE.
Also check nested routes (is the child verified to belong to the parent, or only the parent
verified?) and batch endpoints that accept arrays of IDs. Flag every endpoint where changing
an ID returns or modifies someone else's data.
```

**2.3 — What escapes the guard**
```
Find how authentication and authorization are supposed to be applied in this codebase
(middleware, decorator, guard, base class). Then find everything that escapes it: routes
registered on a different router, routes registered before the middleware is mounted,
handlers with the guard commented out or flagged public, allowlists that match more paths
than intended (prefix or startswith matching), middleware ordering bugs, and static file or
proxy rules that serve protected content around the app entirely.
```

**2.4 — Mass assignment**
```
Find every place a request body is passed into a model or update call — Object.assign,
spread into a constructor, Model(**request.json), .update(req.body), serializers without an
explicit field allowlist. For each, list the sensitive fields on that model (role, is_admin,
tenant_id, owner_id, balance, credits, price, status, email_verified, subscription_tier) and
tell me which ones a client could set. Show the allowlist fix.
```

**2.5 — Tenant isolation**
```
This is a multi-tenant application. Determine whether tenant isolation is enforced
structurally (row-level security, a scoped base query, a repository layer) or by manually
repeating a filter in every query. If it's manual, find the query that forgot — check raw
SQL, background jobs, exports, admin tooling, search indexes, and cache keys. Also: where
does the tenant ID come from? If it comes from the request rather than the session, that's
the whole vulnerability. If Postgres RLS is used, confirm the app connects as a role that
RLS actually applies to — table owners and superusers bypass it silently.
```

**2.6 — Privilege escalation paths**
```
Enumerate every way a user could gain privileges they shouldn't have: reaching an admin
endpoint directly, a role read from a client-controlled field or an unverified token claim,
a self-service endpoint that can modify role/permission fields, an invite or team-membership
flow that can be pointed at another org, an impersonation feature without proper checks, or
a support tool with no authorization. Show the request for each.
```

---

## 3. Injection & untrusted input

**3.1 — Full source-to-sink trace**
```
Trace untrusted input to dangerous sinks in this codebase. Sources include request path,
query, body, headers, cookies, Host, uploaded file contents AND filenames, webhook payloads,
imported files, third-party API responses, and database rows written by other users (second-
order injection). Sinks: SQL/NoSQL queries, shell execution, filesystem paths, HTML/DOM
insertion, template rendering, deserializers, outbound HTTP (SSRF), redirects, and eval.
For each hit, walk backwards until you reach either a real source (report it) or a validated
constant (don't). Show the full trace with a concrete payload.
```

**3.2 — SQL injection, including the ones ORMs don't stop**
```
Find SQL injection. Cover: string concatenation and f-strings/template literals building
queries; raw query escapes (knex.raw, Sequelize.literal, $queryRawUnsafe, session.execute
(text(...))); ORM where clauses fed a whole request object; and — most importantly —
DYNAMIC IDENTIFIERS: table names, column names, ORDER BY, and LIMIT built from user input.
Those cannot be parameterized and are the injection that survives in codebases that "use an
ORM everywhere". For NoSQL, check for operator injection ($ne, $gt, $where) from user
objects reaching find().
```

**3.3 — Command injection**
```
Find every shell or subprocess invocation: exec, execSync, spawn with shell:true, os.system,
popen, subprocess with shell=True, backticks, Runtime.exec with a string. For each, trace
whether any argument is user-controlled. Also check ARGUMENT injection even where no shell
is used — a user-controlled filename starting with "-" becomes a flag to the underlying tool
(git, ffmpeg, curl, tar, rsync all have dangerous flags). Show the array-form fix.
```

**3.4 — SSRF**
```
Find every place a URL from user input is fetched server-side: fetch, axios, requests,
http.get, webhook registration, "import from URL", avatar fetchers, link preview generators,
PDF or screenshot renderers, OIDC/OpenAPI discovery. For each, check: is there a host
allowlist? Are loopback, link-local (169.254.169.254, metadata.google.internal), and RFC1918
ranges blocked? Is the destination re-validated AFTER following redirects? Are non-HTTP
schemes rejected? Is it vulnerable to DNS rebinding? Also tell me whether the cloud metadata
service requires IMDSv2 — if not, any SSRF here becomes cloud credential theft.
```

**3.5 — XSS**
```
Find XSS. Check: innerHTML/outerHTML/insertAdjacentHTML/document.write;
dangerouslySetInnerHTML, v-html, [innerHTML], {@html}; template escaping opt-outs (|safe,
{{{ }}}, Markup(), mark_safe, raw, html_safe); user data inside <script> blocks, inline
event handlers, or URL attributes accepting javascript:/data:; server-rendered JSON embedded
in HTML without escaping </script>; and reflected values in error pages, search results, and
404 handlers. For each, distinguish reflected / stored / DOM. Where a sanitizer is used,
review its configuration rather than assuming it's sufficient. Note where the framework
already escapes by default and no finding exists.
```

**3.6 — Path traversal & file access**
```
Find path traversal. Check every path.join / open / readFile / sendFile / res.download and
every archive extraction (Zip Slip — entry names inside an archive are attacker-controlled
paths). Verify containment is checked AFTER resolution (realpath starts-with the realpath'd
base), not by textually blocking "../" — that's bypassed by URL encoding, unicode, and
absolute paths. Also check whether the stored filename comes from the client.
```

**3.7 — Deserialization, parsers, and templates**
```
Find unsafe deserialization (pickle.loads, yaml.load without SafeLoader, Marshal.load, PHP
unserialize, Java ObjectInputStream, BinaryFormatter), XML parsers with external entities
enabled (XXE), and server-side template injection — user input concatenated into a template
STRING rather than passed as context (render_template_string, Handlebars.compile on user
input). Also flag any parser given unbounded input: billion laughs, zip bombs, catastrophic
regex.
```

**3.8 — The overlooked ones**
```
Check for: CSV formula injection in exports (cells starting with = + - @), CRLF/header
injection, log injection, LDAP and XPath injection, ReDoS from regexes built with user
input, and Unicode normalization or case-folding issues that let input bypass a validation
check before reaching the sink.
```

---

## 4. Authentication & sessions

**4.1 — Full auth review**
```
Review authentication end to end. Password storage (bcrypt/scrypt/argon2 only — flag any
general-purpose hash, and check the work factor); constant-time comparison; password policy
including a breached-password check and no low maximum length; session storage, cookie flags
(HttpOnly, Secure, SameSite, Domain scope), session regeneration on login and privilege
change, server-side invalidation on logout, and whether a password change kills other
sessions; session ID entropy from a CSPRNG. Also: are API keys and personal access tokens
stored hashed, or in plaintext?
```

**4.2 — JWT**
```
Review every JWT usage. Check: is the signature verified or merely decoded (look for
jwt.decode without a key, verify=False, a client-side decode library used server-side)? Is
the algorithm PINNED, or taken from the token header (enabling alg:none and RS256->HS256
confusion)? Are exp, nbf, iss, and aud all validated? How strong is the signing secret and
where does it live? Is kid used to load a key from a path or database (injection)? Is there
ANY revocation path? Are tokens in localStorage rather than an HttpOnly cookie — and is that
tradeoff acknowledged?
```

**4.3 — Password reset** *(the most-attacked flow)*
```
Review the password reset flow specifically. Check: token generated by a CSPRNG with real
entropy (not a UUIDv1, timestamp, or hash of the user ID); short expiry; strictly single-use
and invalidated after a password change; constant-time comparison and exact lookup (not a
prefix or startswith match); the reset link's host taken from config and NOT from the Host
header (host header injection sends the link to the attacker); all sessions invalidated on
reset; rate limited per account and per IP; and whether MFA can be bypassed through this flow.
```

**4.4 — Enumeration & brute force**
```
Check whether login, signup, password reset, and OTP endpoints reveal which accounts exist —
through the message, the status code, response timing, or a redirect. Then check rate
limiting: is it per-IP only (weak — shared NAT, trivially rotated) or also per-account? Can
it be bypassed by spoofing X-Forwarded-For? Are OTP codes length-limited, expiring,
attempt-limited, and single-use? Is there anything stopping automated credential stuffing?
```

**4.5 — OAuth / SSO integration**
```
Review the OAuth/OIDC integration. Check: state parameter generated, stored, and verified
(CSRF on the callback); PKCE for public clients; redirect_uri matched against an EXACT
allowlist with no wildcard or prefix match; ID token signature, iss, aud, and nonce verified;
provider tokens stored encrypted and minimally scoped. Most important: does the app link
accounts by email WITHOUT confirming the provider verified that email? That's a complete
account takeover primitive.
```

**4.6 — Downstream trust**
```
Show me every place the current user's identity is established. Is req.user always populated
from a verified session, or is it ever read from a header, a query parameter, or a request
body field? Check impersonation/"log in as" features for authorization, auditing, and time
limits. Check service-to-service authentication — static shared secrets, mTLS, or nothing?
```

---

## 5. Secrets & credentials

**5.1 — Full secret sweep** *(searches history, not just the working tree)*
```
Find leaked credentials. Search the working tree AND git history — a secret in history is
leaked even if deleted from HEAD.

Working tree: cloud keys (AKIA/ASIA, AIza, ya29., Azure connection strings, GCP service
account JSON), provider tokens (sk-, sk-ant-, ghp_/gho_/github_pat_, glpat-, xoxb-, SG.,
sk_live_, npm_), private keys (BEGIN * PRIVATE KEY, .pem/.p12/.pfx/.jks/id_rsa), connection
strings with inline passwords, generic assignments (password/secret/api_key/token/
client_secret = "literal"), high-entropy literals, and JWTs.
Include: Dockerfiles, docker-compose, .github/workflows, *.tf and *.tfstate, k8s manifests
and ConfigMaps, .npmrc/.pypirc/.netrc, notebook outputs, README/docs, mobile Info.plist and
strings.xml, and every .env variant.

History: git ls-files for tracked .env/.pem/.key/credentials files; git log --all
--diff-filter=A --name-only; git log --all -p -S for each secret pattern; and git stash list.

Do NOT print full secret values — show location plus a redacted fingerprint.

Output a rotation table: secret | location | in git history | repo ever public | still valid |
blast radius | action. For each real one, give the exact rotation steps for that provider and
where to check for abuse (CloudTrail, provider audit log, billing anomalies). State clearly
that rotation is the fix and history rewriting is cosmetic.
```

**5.2 — Client-side exposure**
```
Find secrets that ship to the client. Anything prefixed NEXT_PUBLIC_, VITE_, REACT_APP_, or
EXPO_PUBLIC_ is public by definition — list them and flag any that's actually sensitive. Also
check the built bundle, source maps, mobile app strings, and any secret embedded in a
client-side API call. Then check runtime leakage: secrets in Docker ARG/ENV (they persist in
image layers), secrets echoed in CI logs, secrets in error-reporting payloads, and any
logging call that includes a token, header, or full request body.
```

**5.3 — Secret management posture**
```
Beyond finding leaks, assess how secrets are managed: where do they come from in production
(env, secrets manager, file on disk)? Is there any rotation story? Are keys scoped to least
privilege or is everything a root key? Are the same credentials shared between dev, staging,
and production — so a dev leak becomes a production breach? Is .gitignore correct, and is
there a pre-commit secret scanner and CI scanning with push protection?
```

---

## 6. API & web surface

**6.1 — Excessive data exposure**
```
Check what these API responses actually return. Do they serialize whole database objects or
an explicit field allowlist? Look for password hashes, internal IDs, other users' emails,
soft-deleted rows, internal flags, and fields pulled in through eagerly-loaded relations.
Flag any serializer that uses a denylist rather than an allowlist — those silently leak every
field added later. Also check whether error responses leak stack traces, SQL, file paths, or
internal hostnames.
```

**6.2 — Resource consumption & cost DoS**
```
Find everything unbounded. Pagination without a maximum page size; unbounded queries and
SELECT * on large tables; N+1 loops driven by a client-supplied array; missing request body,
upload, array length, and string length limits; expensive operations (export, report, search,
image/PDF processing, model calls) without a rate limit or queue; decompression bombs and
ReDoS. Pay special attention to anything that costs money per call — SMS, email, AI tokens,
third-party APIs. An authenticated user shouldn't be able to run up an arbitrary bill.
```

**6.3 — CORS & CSRF**
```
Read the actual CORS config. Flag: wildcard origin with credentials; ORIGIN REFLECTION
(echoing back whatever Origin was sent, with credentials — a complete same-origin-policy
bypass); regex allowlists with unescaped dots or missing anchors (/example\.com$/ matches
evilexample.com); and "null" origin allowed.
Then CSRF: find cookie-authenticated state-changing endpoints with no CSRF token and no
SameSite protection. Check that protection covers PUT and DELETE, not just POST, and review
every route exempted from CSRF middleware. Don't report CSRF on bearer-token APIs.
```

**6.4 — Security headers**
```
Check security headers for browser-rendered responses: CSP (and whether it's real or
decorative — unsafe-inline plus unsafe-eval plus wildcards restricts nothing), HSTS,
X-Content-Type-Options, Referrer-Policy (prevents leaking reset tokens via Referer),
Permissions-Policy, and frame-ancestors. Also check Cache-Control on authenticated responses —
without no-store, a shared proxy or CDN can serve one user's data to another. Verify CDN cache
keys include the auth context. Skip headers that don't apply to this architecture and say why.
```

**6.5 — GraphQL**
```
Review this GraphQL API: is introspection disabled in production? Are query depth and
complexity limits enforced (without them a nested query is a trivial DoS)? Can aliased
batched queries bypass per-request rate limits — e.g. 100 login attempts in one HTTP request?
Most importantly: is authorization enforced per-field/per-resolver, or only at the top-level
query? Nested resolvers are where the IDOR lives. Do errors leak schema detail, and is field
suggestion enabled?
```

**6.6 — File uploads**
```
Review the file upload path. Is the type validated by inspecting content, or by trusting the
extension and the client's Content-Type? Is the stored filename generated server-side? Are
files stored outside the web root or on a separate origin — because serving user uploads from
your app's origin turns an uploaded HTML or SVG into stored XSS with full same-origin access.
Are Content-Disposition: attachment and nosniff set on downloads? Are there size and count
limits? Is any image/document processing library (ImageMagick, ffmpeg, PDF renderers)
sandboxed — those have a long RCE history. Do signed URLs expire and scope to one object?
```

**6.7 — Redirects, methods, and edges**
```
Check for open redirects — any ?next=/?redirect=/?returnTo= reaching a redirect without an
allowlist (used to make phishing links look legitimate and to steal OAuth codes). Then: does
any GET perform a state change? Does an unexpected HTTP method skip middleware? Is the Host
header trusted for building links or cache keys? Are there path normalization differences
between the proxy and the app (//admin, /admin/./) that could bypass auth? Any dangling DNS
records pointing at deprovisioned services (subdomain takeover)?
```

---

## 7. Cryptography & data protection

**7.1 — Crypto review**
```
Review all cryptography. Algorithms and modes: flag ECB, CBC without a MAC, DES/3DES/RC4,
MD5/SHA-1 where collisions matter, and any general-purpose hash used for passwords. Require
AEAD (AES-GCM, ChaCha20-Poly1305) for symmetric encryption.
Then the details that actually break it: IV/nonce reuse (a hardcoded or zero IV — GCM nonce
reuse leaks the auth key); missing authentication on ciphertext; non-constant-time comparison
of MACs, tokens, signatures, and API keys; and weak randomness — Math.random(), random.random
(), rand(), or time-seeded PRNGs used for tokens, session IDs, reset codes, OTPs, salts,
nonces, or IVs. Flag any hand-rolled construction as a finding by default.
```

**7.2 — Key management**
```
Review key management, which is usually worse than the algorithm choice. Where do keys come
from — hardcoded, env, KMS/HSM, derived from a password? Is the encryption key stored next to
the encrypted data (same database, same config, same repo)? If so, say plainly that the
encryption protects against almost nothing. Are separate keys used for encryption, signing,
and sessions? Is there a rotation mechanism, and is a key version stored with the ciphertext
so rotation is even possible? Who and what can read the key? Are keys ever logged or included
in crash reports?
```

**7.3 — Transport**
```
Check TLS everywhere, including internal service-to-service hops and database connections.
Find every place certificate verification is disabled — rejectUnauthorized: false,
verify=False, InsecureSkipVerify: true, curl -k, a trust-everything TrustManager. This is
common in code that once had a staging cert problem, and it makes TLS worthless. Check
minimum version (1.2+), cipher suites, and HSTS on browser-facing hosts.
```

**7.4 — Data protection & retention**
```
Which fields hold regulated or high-sensitivity data (payment, government ID, health,
precise location, biometrics, private messages), and how is each protected? Be precise about
what each control actually mitigates — disk encryption does nothing against SQL injection.
Then the strongest control: what is stored that shouldn't be stored at all? Raw card data,
full ID numbers, plaintext third-party credentials, unnecessary PII, indefinite retention.
Also: are backups encrypted and access-controlled? Does PII reach logs, analytics, or error
trackers? When a user deletes their account, what actually gets deleted — and what survives
in backups, caches, search indexes, and third-party processors?
```

---

## 8. Dependencies & supply chain

**8.1 — Triage, don't relay**
```
Run the ecosystem's audit tool (npm audit / pip-audit / govulncheck / bundle audit /
cargo audit) and then TRIAGE the results — don't just relay them. For each reported
vulnerability: is the vulnerable code path actually reachable from this application (grep for
real usage)? Is it a direct or transitive dependency? Is it dev-only (still a supply-chain
risk, but not runtime exposure — rate separately)? Is there a known exploit in the wild? What
is the concrete fix, and is it a breaking major bump? Give me a ranked list: fix now / fix
this sprint / accept and document. Don't fabricate advisory IDs — if a tool isn't installed,
say so and give the install command.
```

**8.2 — Package trust & install scripts**
```
Beyond known CVEs, assess supply-chain risk. Flag any dependency whose name is one character
or transposition away from a popular package (typosquatting); packages with very few
downloads, a single maintainer, no repository link, or a recent ownership transfer;
dependencies added recently (cross-reference git log on the manifest); and anything pulled
from a git URL, tarball, or non-default registry. Most importantly, find preinstall/install/
postinstall scripts and Python setup.py execution — these run arbitrary code on every dev
machine and in CI before any of your code runs. Also check pinning: committed lockfile,
floating caret ranges, and container base images pinned by tag rather than digest.
```

**8.3 — CI/CD pipeline**
```
Review the CI/CD pipeline as its own attack surface — it holds production credentials and
runs untrusted code. Check for: pull_request_target combined with checking out the PR head
(this runs a fork's code with access to your secrets — the single most dangerous Actions
misconfiguration); third-party actions pinned to a mutable tag rather than a commit SHA;
secrets reachable by workflows triggered by external contributors; overly broad GITHUB_TOKEN
permissions; self-hosted runners on public repos; and build artifacts, logs, or caches that
could leak credentials. Is anything signed or attested?
```

---

## 9. Infrastructure & deployment

**9.1 — Container hardening**
```
Review the Dockerfile and compose/runtime config. Check: is there a USER directive with a
non-root UID (default is root)? Is the base image pinned by digest? Is it slim/distroless or
a full OS with a shell and package manager an attacker can use? Are build secrets passed via
ARG/ENV (they persist in image layers) rather than --mount=type=secret? Does the final image
ship build tools, source, .git, and dev dependencies? Does .dockerignore exclude .env and
.git? At runtime: --privileged, added capabilities, host network mode, the Docker socket
mounted in (that's root on the host), broad writable host mounts, missing resource limits, no
read-only rootfs, no seccomp/AppArmor.
```

**9.2 — Kubernetes**
```
Review the Kubernetes manifests: pod security (runAsNonRoot, readOnlyRootFilesystem,
allowPrivilegeEscalation: false, dropped capabilities, no hostPID/hostNetwork/hostPath); RBAC
(any ClusterRole with wildcard verbs or resources, over-broad service account bindings, the
default service account token auto-mounted where it isn't needed); secrets (base64 in a
manifest is not encryption — is there sealed-secrets/external-secrets and etcd encryption at
rest?); NetworkPolicies (without them every pod reaches every other pod — is there a
default-deny?); and ingress exposing internal services.
```

**9.3 — Cloud IAM & network**
```
Review cloud configuration. IAM: any Action:* or Resource:*, AdministratorAccess on a service
role, wildcard trust policies, long-lived static keys where workload identity or OIDC
federation would work. Network: public buckets, public snapshots and AMIs, publicly reachable
databases, security groups open to 0.0.0.0/0 on 22/3306/5432/6379/27017/9200, missing
segmentation. Critically: is IMDSv2 required? With IMDSv1, any SSRF becomes cloud credential
theft. Also check audit logging is enabled and retained tamper-resistantly, encryption at rest
on volumes/buckets/databases/backups, and deletion protection on stateful resources.
```

**9.4 — Runtime config**
```
Check the production config path specifically: debug mode off, verbose errors off, dev/admin
endpoints and consoles off, source maps not served, directory listing off, default credentials
changed. Do staging and production share databases, keys, or third-party accounts? Is the
reverse proxy configured with a trusted-proxy list — because if X-Forwarded-For is trusted
blindly, clients spoof their IP and bypass every rate limit. Are internal services (Redis,
Elasticsearch, Postgres, admin panels, metrics, brokers) bound to private networks with
authentication enabled?
```

**9.5 — Detection & response readiness**
```
Hardening without visibility means being breached quietly. Check: are authentication failures,
authorization denials, admin actions, and config changes logged with actor/action/target/time?
Are logs shipped somewhere the app server can't edit them? Is there any alerting — error
spikes, auth failure spikes, new IAM principals, egress anomalies? Can you revoke a key, a
session, or a user immediately? Do backups exist, are they encrypted and off-site, and has a
restore ever actually been tested? Is there a SECURITY.md or security.txt so researchers can
report to you?
```

---

## 10. AI & LLM features

**10.1 — The authority question** *(start here)*
```
For this AI feature, answer one question directly: if an attacker had complete control over
the model's output, what could they do? List every tool the model can call, what each can
access or change, and whether it re-checks authorization server-side using the session's
identity rather than an ID the model supplied. That answer — not the quality of the system
prompt — is the actual security posture. Assume prompt-level defenses fail.
```

**10.2 — Prompt injection surface**
```
Enumerate every untrusted string that reaches the model's context: direct user input,
retrieved documents (RAG), fetched web pages and files, tool results, third-party API
responses, prior conversation history in shared threads, email/ticket/chat content in
integrations, filenames, image metadata, and text inside images. Pay particular attention to
INDIRECT injection — content an attacker controls that a victim retrieves, like a poisoned
document in a shared knowledge base that attacks every user who queries it. For each vector,
state what the model can do once it believes that text.
```

**10.3 — Tool authority audit**
```
Build a table of every tool exposed to the model: tool | what it can do | who authorized it |
reversible? | blast radius if the model is fully attacker-controlled. Then check: does each
tool resolve the acting user from the SESSION rather than from model-supplied arguments? Are
arguments validated against a schema and allowlist before execution? Is there a tool that
reads private data AND any channel that reaches outward — including rendering markdown images,
which exfiltrate via the URL on render with no click? Can the model trigger irreversible or
costly actions, and does confirmation show the human the real action rather than the model's
summary of it? Is there a loop, token, and spend budget?
```

**10.4 — Model output handling**
```
Treat every model output as untrusted input and trace it. Is it rendered as HTML or markdown
(XSS — is it sanitized, and are javascript:/data: URLs and remote image loads blocked)? Used
to build SQL, shell commands, file paths, or URLs (injection)? Eval'd or written to a file
that later executes (RCE)? Parsed as JSON without schema validation? Used as an authorization
decision — which is broken by design? Returned to another system that trusts it?
```

**10.5 — RAG isolation & data exposure**
```
Check RAG tenant isolation: is the vector search filtered by tenant/user INSIDE the query, or
are results filtered afterward in application code? Post-filtering means the wrong data was
already retrieved and one missed filter leaks across customers. Are indexes or namespaces
partitioned? Then data exposure: what ends up in prompts that shouldn't leave your
infrastructure (PII, secrets, other tenants' data)? Does the provider retain or train on your
data, and does that match your privacy policy? Are prompts and completions logged with PII in
them?
```

**10.6 — AI supply chain & abuse**
```
Check: are model weights and versions pinned by hash? Any pickle-based model formats (.bin,
.pt) that execute code on load, where safetensors would work? Have the MCP servers and
third-party tools been reviewed — a malicious tool DESCRIPTION is itself an injection vector
since it goes straight into the model's context. Then abuse: are there rate limits and
per-user cost caps on model calls? Is this endpoint effectively a free proxy to a paid model
that anyone can call?
```

---

## 11. Business logic

*No scanner finds these. They require thinking like a fraudster rather than a hacker.*

**11.1 — Race conditions**
```
Find race conditions in state-changing operations: balance updates, inventory decrements,
coupon and referral redemption, quota and rate counters, one-time actions, and any
check-then-act sequence. For each, tell me whether the check and the write are atomic — a
database transaction with the right isolation level, a row lock, a conditional update, or an
idempotency key — or whether concurrent requests can both pass the check. Show the concrete
exploit: N parallel requests, and what the attacker gets.
```

**11.2 — Value and workflow abuse**
```
Think like someone trying to get something for free. Check for: negative or zero quantities,
integer overflow, and float rounding abuse in prices and totals; prices, discounts, or
currency taken from the client rather than looked up server-side; workflow steps that can be
skipped, replayed, or done out of order (paying after fulfillment, verifying after access);
missing idempotency on payment endpoints; refund and cancellation flows that can be repeated;
and trial, quota, or referral limits enforced only in the UI.
```

**11.3 — Webhook trust**
```
For every inbound webhook handler, check whether the payload's signature is actually verified
before it's trusted — with the raw body, using a constant-time comparison, with a timestamp
check to prevent replay. An unverified webhook handler is an unauthenticated endpoint that
mutates your data, and it's one of the most commonly missed vulnerabilities in payment and
integration code.
```

---

## 12. Code review & pull requests

**12.1 — Security review of a diff**
```
Review this diff for security impact. Look specifically for the things diffs hide:
- A NEW ENTRY POINT (route, handler, resolver, webhook, job) — does it inherit the same auth
  and authz middleware as its neighbors, or is it registered on a different router?
- A REMOVED OR WEAKENED CHECK — deleted lines matter more than added ones. Removed guard
  clauses, validation calls, verify/escape/sanitize calls, or a query filter that lost its
  tenant_id.
- A WIDENED PERMISSION — IAM policy, CORS origin, cookie SameSite, CSP, bucket policy, role
  check loosened.
- A NEW SECRET — including in tests, fixtures, and CI. It needs rotating, not deleting.
- A NEW DEPENDENCY — what is it, who maintains it, is it a typosquat, does it run install
  scripts, is it pinned?
- UNTRUSTED DATA REACHING A NEW SINK.
- A CHANGED SECURITY DEFAULT in config.
- A COPY-PASTE of a pattern that was already wrong elsewhere — report both.
For every changed function, open the surrounding file and read enough to know who can call it
and what guards it sits behind. Don't review the diff in isolation.
End with a verdict: safe to merge / safe with follow-ups / do not merge, and why.
```

**12.2 — Adversarial self-review**
```
You wrote this code. Now try to break it. For each function: what input did you not consider?
What happens with null, empty string, a very large value, a negative number, unicode, a
path, a URL, an array where you expected a scalar, or the same request sent twice
concurrently? What does an authenticated attacker do that a normal user wouldn't? Be
genuinely adversarial about your own work rather than defending it.
```

**12.3 — Kill your own findings**
```
Here are the findings you just produced. Now argue against each one. For each, make the
strongest case that it is NOT exploitable — the framework already handles it, the path isn't
reachable, the input is already validated upstream, the impact is nil. Then tell me which
findings survived that argument. I only want the survivors.
```

---

## 13. Pre-launch

**13.1 — Ship gate**
```
You are the last reviewer before this goes to production. Check the blockers first — any one
stops the launch:
1. A live secret in the repo or git history (check history, not just HEAD)
2. An endpoint handling user data with no authentication, or bypassable authentication
3. No authorization on user-scoped data — changing an ID returns someone else's data
4. Injection reachable from an unauthenticated endpoint
5. Passwords stored with anything other than bcrypt/scrypt/argon2
6. Debug mode, stack traces, or an admin/dev console enabled in the production config path
7. A database or internal service reachable from the internet with weak credentials
8. TLS absent or certificate verification disabled anywhere in the request path
9. A known-exploited vulnerability in a direct dependency
10. User uploads served from the app's own origin without content-type control
Then the should-fixes: rate limiting, enumeration, cookie flags, CSRF, CORS, security
headers, input size limits, webhook signature verification, PII in logs, generic client errors.
Then operational readiness: audit logging, alerting, tested backups, revocation ability, a
security contact.
End with: VERDICT: SHIP / SHIP WITH CONDITIONS / DO NOT SHIP, blocking items, first-week
items, accepted risks, and what needs manual verification. Be direct — don't manufacture
doubt to seem thorough.
```

**13.2 — Compliance reality check**
```
We need to be able to answer [SOC 2 / GDPR / HIPAA / PCI-DSS] questions about this system.
Based only on what's in this codebase, tell me what we can honestly demonstrate today and
what we'd be claiming without evidence: access control enforcement, audit logging with actor
and timestamp, encryption in transit and at rest, data retention and deletion, subprocessor
data flows, incident detection. Be blunt about the gaps — this is not the place for optimism.
```

---

## 14. Plain English (for vibe coders)

**14.1 — Is this safe to put on the internet?**
```
I built this app quickly, mostly with AI help, and I'm not a security expert. Tell me
honestly whether it's safe to put on the internet.

Check, in this order: (1) can a stranger read or change other people's data by changing an
ID in a URL or request? (2) is there a real login check on the SERVER for every route that
matters, not just hidden buttons in the UI? (3) are there passwords or API keys sitting in
the code or in git history? (4) can someone break in through what they type — into a
database query, a shell command, a file path, or the page HTML? (5) are passwords stored
hashed with bcrypt or argon2? (6) can someone run up my bill — no rate limits on signup,
login, email, SMS, AI calls, or uploads? (7) is anything private accidentally public — open
storage buckets, an internet-facing database, debug mode on, an admin page with no password,
secrets shipped to the browser? (8) if it has an AI feature, can a user make it do something
it shouldn't? (9) would I even know if something went wrong?

Explain everything in plain English — no jargon without a translation. Lead with what a
stranger could actually DO to me and my users, not with the name of the bug. Give me
file:line so I can look. Group as: fix before anyone uses this / fix soon / worth doing
eventually / what's already fine / what you couldn't check. Then answer the actual question
in one paragraph, directly, no hedging.
```

**14.2 — What did I just accept?**
```
An AI wrote this code and I accepted it without fully understanding it. Walk me through what
it actually does, then tell me specifically where it trusts something it shouldn't — user
input, a client-supplied ID, an external response, a filename. Assume I know how to code but
not how attacks work.
```

**14.3 — The one thing**
```
If I only have an hour, what is the single most important security fix in this codebase, and
why that one over everything else? Give me the change, the file, and the reasoning for the
ranking.
```

---

## 15. Fixing & verifying

**15.1 — Remediate properly**
```
Fix this finding. Requirements:
- Confirm the finding is real first by re-tracing the source-to-sink path. If it's a false
  positive, say so and stop.
- Fix the CLASS, not the instance. If the same flaw appears in twelve handlers, patching one
  is theater — either patch all twelve or introduce the layer that makes the safe path the
  default (a query scope that always applies the tenant filter, a middleware that requires
  explicit opt-out, a typed serializer with an allowlist), then remove the unsafe path.
- Match the codebase's existing framework, libraries, and style. Don't add a dependency
  without saying why.
- Prefer, in order: remove the dangerous capability > make the safe path structural >
  strict allowlist validation at the boundary > sanitization (least reliable).
- Never weaken another control to make the fix easier, and never swallow an error to make a
  symptom disappear.
After the change: re-trace the original exploit path and state why it's now blocked. Consider
bypasses — encoding, case, unicode, double-encoding, an alternate route to the same sink. Run
the tests and report results honestly. Add a regression test that fails without the fix. Tell
me what this breaks: existing clients, existing data, existing sessions, and whether a
migration or a key rotation is required.
```

**15.2 — Verify a fix actually works**
```
Here is a vulnerability and the patch that supposedly fixes it. Verify it independently. Can
you still reach the sink through a different code path? Does the fix handle encoded, unicode,
double-encoded, or case-varied input? Is there a second entry point to the same function? Does
the fix hold under concurrency? Does the fix introduce a new problem? Don't take the patch's
word for it.
```

**15.3 — Build the guardrail**
```
This vulnerability class keeps appearing in this codebase. Don't just patch the instances —
design the change that makes it structurally impossible or at least loud when it happens: a
type, a wrapper, a lint rule, a base class, a database constraint, a test that enumerates all
routes and asserts each has a guard. Show me the guardrail and what it would have caught.
```

---

## 16. Learning

**16.1 — Explain it against my code**
```
Explain [vulnerability] to me. Structure it as: (1) the one-sentence version, no acronyms;
(2) how it works, with a tiny worked example — vulnerable code, the exact input an attacker
sends, and what the program then does; (3) why it matters in MY codebase specifically —
does this pattern exist here, at what file:line, and what would an attacker get from my
application in particular? If my code is NOT vulnerable, show me why the framework or the
code already protects me; (4) the fix in my language and framework, plus why the
tempting-but-wrong fixes fail; (5) what to grep for and what shape of code should make me
suspicious next time.
```

**16.2 — Teach me this codebase's security model**
```
Explain how security works in this codebase as if onboarding me: how a request is
authenticated, where authorization is enforced, how tenant isolation works, where secrets
come from, what's trusted and what isn't, and which conventions I must follow so I don't
introduce a hole. Then tell me the three places where that model is fragile — where a new
developer would most easily break it by accident.
```

**16.3 — Post-incident**
```
Something went wrong: [describe]. Help me work out what happened. What in this codebase
could produce that symptom? What logs or data would confirm or rule out each hypothesis?
What should I preserve right now before it rotates away? What do I need to rotate or revoke
immediately as a precaution, before I even know the cause?
```

---

## 17. Red team — proving it

*A finding is a hypothesis until an exploit confirms it. These prove — or disprove — a finding
against **your own** application. Only run active attacks against systems you own or are
explicitly authorized to test.*

**17.1 — Build a proof-of-concept**
```
This is my own application and I want to confirm whether this finding is actually exploitable
before I spend time on it. Build a working proof-of-concept against a local or staging
instance. First state the falsifiable prediction — "if this IDOR is real, requesting order
1042 as user B returns user A's data." Set up a safe harness: run it locally if possible, and
create two throwaway accounts (attacker + victim) so cross-user access is proven without
touching real users. Send the attack, capture the exact request and the exact response that
proves or disproves it. Keep it NON-DESTRUCTIVE — demonstrate read access, prove write access
with a marker you then clean up, and stop short of anything irreversible. Redact real secrets
and PII from the output. End with a verdict: EXPLOITED / NOT EXPLOITABLE / BLOCKED BY <control>,
and reproduce steps I can re-run.
```

**17.2 — Attack the defenses**
```
Don't just look for missing controls — attack the ones that exist. For every place the code
relies on a defense (a sanitizer, an input filter, an allowlist, auth middleware, a rate
limit), try to defeat it against my own running app: encoding and double-encoding, unicode and
case variation, the alternate route that skips the middleware, a mutation payload past the
sanitizer, IP spoofing past the rate limit. For anything that survives an honest attempt to
beat it, report it as VERIFIED STRONG and name the control — I want to know what's actually
holding, not just what's missing.
```

**17.3 — Verify a fix under attack**
```
This was just fixed. Prove the fix works by re-running the original exploit against my app — a
fix isn't verified until the original attack fails. Then try the obvious bypasses of the fix
itself, not just the literal payload from the report: encoded, unicode, double-encoded,
case-varied, and any second entry point to the same sink. Tell me whether the fix holds or
whether there's still a way through, with the exact request either way.
```

**17.4 — Confirm a leaked credential is live**
```
I found what looks like a valid credential in my own repo. Confirm whether it's currently
active with a single, minimal, READ-ONLY authenticated call to its provider — nothing more.
Redact the key itself in your output. If it's live, tell me the exact rotation steps for that
provider and where to check its audit log for prior misuse. Rotation is the fix; treat the key
as compromised regardless of the result.
```

**17.5 — Turn the PoC into a permanent test**
```
Take this confirmed exploit and turn it into a regression test in my project's existing test
framework — one that fails against the vulnerable code and passes once it's fixed. This way the
vulnerability can never silently come back, and the proof lives in CI instead of in a chat log.
```

---

## Using these well

**Give it the preamble.** Section 0 matters more than any individual prompt. Without it, an
AI security review reads as a list of confident guesses.

**One category at a time.** "Audit my whole app for everything" gets shallow coverage of
everything. `/securitymaxxing:authz` on one module gets a real answer.

**Make it argue with itself.** Run a review, then run prompt 12.3 on the results. The findings
that survive are the ones worth your afternoon.

**Findings are hypotheses until you check them.** These prompts are a very good first pass and
a genuinely useful teacher. They are not a penetration test, and they don't replace one for
anything holding real money or real personal data.
